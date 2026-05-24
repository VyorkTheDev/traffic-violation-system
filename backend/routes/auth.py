import secrets
import logging
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from flask import Blueprint, request, current_app
from models import db, User
from utils import ok, err
from extensions import limiter
import mail_service

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

_OTP_TTL_MINUTES = 10   # OTP geçerlilik süresi
_OTP_RATE        = "3 per 10 minutes"  # resend ve verify için kaba-kuvvet koruması


def _generate_otp() -> str:
    """Kriptografik olarak güvenli 6 haneli OTP üretir."""
    return str(secrets.randbelow(1_000_000)).zfill(6)


def _issue_token(user: User) -> str:
    payload = {
        "user_id":  user.id,
        "username": user.username,
        "role":     user.role,
        "exp": datetime.now(timezone.utc) + timedelta(
            hours=current_app.config["JWT_EXPIRATION_HOURS"]
        ),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")


# ---------------------------------------------------------------------------
# KAYIT — OTP gönderir, hesabı henüz etkinleştirmez
# ---------------------------------------------------------------------------

@auth_bp.route("/register", methods=["POST"])
@limiter.limit("5 per minute")
def register():
    data     = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email    = (data.get("email")    or "").strip().lower()
    password = data.get("password")  or ""

    if not username or not email or not password:
        return err("username, email ve password zorunludur")

    if len(password) < 6:
        return err("Parola en az 6 karakter olmalıdır")

    existing_by_username = User.query.filter_by(username=username).first()
    if existing_by_username and existing_by_username.is_verified:
        return err("Bu kullanıcı adı zaten alınmış", 409)

    existing_by_email = User.query.filter_by(email=email).first()
    if existing_by_email and existing_by_email.is_verified:
        return err("Bu e-posta adresi zaten kayıtlı", 409)

    otp        = _generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=_OTP_TTL_MINUTES)

    # Doğrulanmamış hesap varsa şifre + OTP güncelle, yeni kayıt açma
    existing = existing_by_email or existing_by_username
    if existing and not existing.is_verified:
        try:
            existing.password       = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            existing.otp_code       = otp
            existing.otp_expires_at = expires_at
            db.session.commit()
            user = existing
        except Exception:
            db.session.rollback()
            logger.exception("Kayıt güncellemesinde DB hatası")
            return err("Kayıt başarısız", 500)
    else:
        try:
            hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            user   = User(
                username=username,
                email=email,
                password=hashed,
                role="citizen",
                is_verified=False,
                otp_code=otp,
                otp_expires_at=expires_at,
            )
            db.session.add(user)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.exception("Kayıt sırasında DB hatası")
            return err(f"Kayıt başarısız: {str(e)}", 500)

    # E-posta gönderimi — başarısız olursa hesap yine de oluşturulmuş sayılır;
    # kullanıcı /resend-otp ile yeni kod isteyebilir.
    email_sent = True
    try:
        mail_service.send_otp_email(email, otp)
    except Exception:
        email_sent = False
        logger.exception("OTP e-postası gönderilemedi: %s", email)

    return ok(
        data={"email": email, "email_sent": email_sent},
        message=(
            f"Doğrulama kodu {email} adresine gönderildi."
            if email_sent
            else "Hesap oluşturuldu fakat e-posta gönderilemedi. "
                 "Lütfen 'Kodu Tekrar Gönder' butonunu kullanın."
        ),
        code=201,
    )


# ---------------------------------------------------------------------------
# OTP DOĞRULAMA
# ---------------------------------------------------------------------------

@auth_bp.route("/verify-otp", methods=["POST"])
@limiter.limit(_OTP_RATE)
def verify_otp():
    data  = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code  = (data.get("otp")   or "").strip()

    if not email or not code:
        return err("email ve otp zorunludur")

    user = User.query.filter_by(email=email).first()
    if not user:
        return err("Kullanıcı bulunamadı", 404)

    if user.is_verified:
        return err("Bu hesap zaten doğrulanmış")

    if not user.otp_code or not user.otp_expires_at:
        return err("Aktif OTP bulunamadı. Lütfen yeni kod isteyin.")

    # Süre kontrolü
    now = datetime.now(timezone.utc)
    expires = user.otp_expires_at
    # DB'den naive datetime gelebilir; timezone ekle
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if now > expires:
        return err("OTP kodunun süresi dolmuştur. Lütfen yeni kod isteyin.", 400)

    # Kod kontrolü — sabit zamanlı karşılaştırma (timing attack önlemi)
    if not secrets.compare_digest(user.otp_code, code):
        return err("Geçersiz OTP kodu", 400)

    # Hesabı etkinleştir, OTP alanlarını temizle
    try:
        user.is_verified    = True
        user.otp_code       = None
        user.otp_expires_at = None
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception("OTP doğrulamasında DB hatası")
        return err("Doğrulama tamamlanamadı", 500)

    token = _issue_token(user)
    return ok(data={"token": token, "user": user.to_dict()},
              message="E-posta doğrulandı. Hoş geldiniz!")


# ---------------------------------------------------------------------------
# OTP YENİDEN GÖNDER
# ---------------------------------------------------------------------------

@auth_bp.route("/resend-otp", methods=["POST"])
@limiter.limit(_OTP_RATE)
def resend_otp():
    data  = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return err("email zorunludur")

    user = User.query.filter_by(email=email).first()
    if not user:
        return err("Kullanıcı bulunamadı", 404)

    if user.is_verified:
        return err("Bu hesap zaten doğrulanmış")

    otp        = _generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=_OTP_TTL_MINUTES)

    try:
        user.otp_code       = otp
        user.otp_expires_at = expires_at
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception("OTP yenileme DB hatası")
        return err("Kod yenilenemedi", 500)

    try:
        mail_service.send_otp_email(email, otp)
    except Exception:
        logger.exception("OTP e-postası gönderilemedi (resend): %s", email)
        return err("E-posta gönderilemedi. Lütfen daha sonra tekrar deneyin.", 500)

    return ok(message=f"Yeni doğrulama kodu {email} adresine gönderildi.")


# ---------------------------------------------------------------------------
# GİRİŞ
# ---------------------------------------------------------------------------

@auth_bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    data     = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password =  data.get("password") or ""

    if not username or not password:
        return err("username ve password zorunludur")

    user = User.query.filter_by(username=username).first()
    if not user or not bcrypt.checkpw(password.encode(), user.password.encode()):
        return err("Geçersiz kullanıcı adı veya parola", 401)

    # E-posta doğrulanmamış hesaplar giriş yapamaz
    if not user.is_verified:
        return err(
            "E-posta adresiniz henüz doğrulanmamış. "
            "Lütfen e-postanıza gelen kodu girin veya yeni kod isteyin.",
            403,
        )

    token = _issue_token(user)
    return ok(data={"token": token, "user": user.to_dict()})

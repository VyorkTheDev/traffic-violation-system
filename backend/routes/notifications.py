"""
notifications.py — E-posta bildirim endpoint'leri.

/api/send-violation-email: Bir ihlale ait araç sahibine bildirim gönderir.
Yalnızca police ve admin rolü çağırabilir.
"""

import logging
import threading

from flask import Blueprint, request
from sqlalchemy.orm import joinedload

from models import db, Violation, Vehicle, User
from middleware import role_required
from utils import ok, err
import mail_service

logger = logging.getLogger(__name__)

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api")


@notifications_bp.route("/send-violation-email", methods=["POST"])
@role_required("police")
def send_violation_email():
    """
    Belirtilen ihlal için araç sahibine bildirim e-postası gönderir.

    Body: { "violation_id": <int> }

    İhlal → araç → sahip zinciri çözülemezse 404 döner.
    SMTP hatası olmadıkça 200 döner; e-posta gönderimi arka planda yapılmaz —
    başarısı doğrudan yanıta yansır.
    """
    data         = request.get_json(silent=True) or {}
    violation_id = data.get("violation_id")

    if not violation_id:
        return err("violation_id zorunludur")

    try:
        violation_id = int(violation_id)
    except (ValueError, TypeError):
        return err("violation_id bir tam sayı olmalıdır")

    # İhlal + araç bilgisini tek sorguda çek
    violation = (
        Violation.query
        .options(joinedload(Violation.vehicle))
        .filter(Violation.id == violation_id)
        .first()
    )
    if not violation:
        return err(f"İhlal #{violation_id} bulunamadı", 404)

    vehicle = violation.vehicle
    if not vehicle:
        return err("İhlale ait araç kaydı bulunamadı", 404)

    owner = User.query.get(vehicle.owner_id)
    if not owner:
        return err("Araç sahibi kullanıcı bulunamadı", 404)

    try:
        mail_service.send_violation_email(
            to=owner.email,
            username=owner.username,
            violation_id=violation.id,
            plate=violation.plate,
            location=violation.location,
        )
    except Exception as exc:
        logger.exception("İhlal bildirim e-postası gönderilemedi: violation_id=%d", violation_id)
        return err(f"E-posta gönderilemedi: {str(exc)}", 500)

    return ok(message=f"Bildirim e-postası {owner.email} adresine gönderildi.")

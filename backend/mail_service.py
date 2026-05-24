"""
mail_service.py — Resend HTTP API ile e-posta gönderme servisi.

Render gibi SMTP portlarını (587/465) engelleyen ortamlarda çalışır.
Tüm kimlik bilgileri os.getenv üzerinden okunur; sabit değer içermez.
"""

import os
import logging
import resend

logger = logging.getLogger(__name__)


def _cfg():
    return {
        "api_key":  os.getenv("RESEND_API_KEY"),
        "from":     os.getenv("MAIL_FROM", "Traffic Enforcement <onboarding@resend.dev>"),
        "frontend": os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/"),
    }


def _send(to: str, subject: str, html: str) -> None:
    cfg = _cfg()
    if not cfg["api_key"]:
        raise RuntimeError("RESEND_API_KEY ortam değişkeni eksik.")

    resend.api_key = cfg["api_key"]
    resend.Emails.send({
        "from":    cfg["from"],
        "to":      [to],
        "subject": subject,
        "html":    html,
    })
    logger.info("E-posta gönderildi → %s | konu: %s", to, subject)


def _base_template(content_html: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:520px;margin:auto;background:#ffffff;border-radius:12px;
                  border:1px solid #e2e8f0;overflow:hidden">
        <div style="background:#4f46e5;padding:20px 32px">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.5px">
            🚦 Traffic Enforcement
          </span>
        </div>
        <div style="padding:32px">
          {content_html}
        </div>
        <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">
            Bu e-posta otomatik olarak gönderilmiştir — lütfen yanıtlamayın.
          </p>
        </div>
      </div>
    </body>
    </html>
    """


def send_otp_email(to: str, otp_code: str) -> None:
    content = f"""
      <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px">E-posta Doğrulama</h2>
      <p style="color:#475569;font-size:15px;margin:0 0 24px">
        Hesabınızı etkinleştirmek için aşağıdaki doğrulama kodunu girin:
      </p>
      <div style="background:#f1f5f9;border-radius:10px;padding:28px;text-align:center;margin-bottom:24px">
        <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#4f46e5;
                     font-family:'Courier New',monospace">
          {otp_code}
        </span>
      </div>
      <p style="color:#64748b;font-size:14px;margin:0 0 4px">
        ⏱ Bu kod <strong>10 dakika</strong> geçerlidir.
      </p>
      <p style="color:#94a3b8;font-size:13px;margin:0">
        Kodu kimseyle paylaşmayın. Eğer bu isteği siz yapmadıysanız bu e-postayı görmezden gelin.
      </p>
    """
    _send(to, "Traffic Enforcement – E-posta Doğrulama Kodunuz", _base_template(content))


def send_violation_email(
    to: str,
    username: str,
    violation_id: int,
    plate: str,
    location: str,
) -> None:
    detail_url = f"{_cfg()['frontend']}/violations/{violation_id}"
    content = f"""
      <h2 style="margin:0 0 8px;color:#dc2626;font-size:22px">⚠️ Yeni Trafik İhlali</h2>
      <p style="color:#475569;font-size:15px;margin:0 0 20px">
        Sayın <strong>{username}</strong>,<br>
        <strong>{plate}</strong> plakalı aracınıza bir trafik ihlali kaydedilmiştir.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px">
        <tr style="border-bottom:1px solid #e2e8f0">
          <td style="padding:10px 8px;color:#94a3b8;white-space:nowrap">İhlal No</td>
          <td style="padding:10px 8px;font-weight:600;color:#1e293b">#{violation_id}</td>
        </tr>
        <tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc">
          <td style="padding:10px 8px;color:#94a3b8">Plaka</td>
          <td style="padding:10px 8px;font-weight:600;color:#1e293b">{plate}</td>
        </tr>
        <tr>
          <td style="padding:10px 8px;color:#94a3b8">Konum</td>
          <td style="padding:10px 8px;color:#1e293b">{location}</td>
        </tr>
      </table>
      <a href="{detail_url}"
         style="display:inline-block;background:#4f46e5;color:#ffffff;padding:13px 28px;
                border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
        İhlal Detayını Görüntüle →
      </a>
      <p style="color:#94a3b8;font-size:13px;margin-top:24px">
        <span style="color:#4f46e5">{detail_url}</span>
      </p>
    """
    _send(
        to,
        f"Traffic Enforcement – Yeni İhlal Bildirimi #{violation_id}",
        _base_template(content),
    )

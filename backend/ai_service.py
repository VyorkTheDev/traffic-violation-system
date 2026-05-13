import base64
import json
import os
import re
import threading
import traceback
import urllib.request

import anthropic
from models import db, Violation

MODEL = "claude-sonnet-4-6"
PROMPT = (
    "Analyze this traffic photo. Detect if the driver is:\n"
    "1. Using a phone while driving\n"
    "2. Smoking while driving\n"
    "3. Not wearing a seatbelt\n\n"
    "Respond ONLY with this exact JSON format, no other text:\n"
    '{"phone": true/false, "smoking": true/false, "no_seatbelt": true/false}'
)

MEDIA_TYPES = {
    "jpg":  "image/jpeg",
    "jpeg": "image/jpeg",
    "png":  "image/png",
    "webp": "image/webp",
}


def _log(msg: str):
    print(f"[AI Service] {msg}", flush=True)


def _photo_to_base64(photo_url: str, upload_folder: str) -> tuple[str, str]:
    """
    Fotoğrafı base64'e çevirir.
    - photo_url http/https ile başlıyorsa (Cloudinary) → URL'den indirir
    - Başlamıyorsa (eski local yol) → diskten okur
    """
    if photo_url.startswith("http://") or photo_url.startswith("https://"):
        _log(f"Fetching photo from URL: {photo_url}")
        with urllib.request.urlopen(photo_url, timeout=15) as response:
            raw = response.read()
        # Uzantıyı URL'den çıkar
        url_path = photo_url.split("?")[0]  # query string varsa temizle
        ext = url_path.rsplit(".", 1)[-1].lower()
    else:
        filename = os.path.basename(photo_url)
        path = os.path.join(upload_folder, filename)
        _log(f"Reading photo from disk: {path}")
        if not os.path.exists(path):
            raise FileNotFoundError(f"Photo not found on disk: {path}")
        ext = filename.rsplit(".", 1)[-1].lower()
        with open(path, "rb") as f:
            raw = f.read()

    media_type = MEDIA_TYPES.get(ext, "image/jpeg")
    _log(f"Detected media type: {media_type}")
    _log(f"File size: {len(raw)} bytes")

    data = base64.standard_b64encode(raw).decode("utf-8")
    assert not data.startswith("data:"), "base64 must NOT include a data-URI prefix"
    _log(f"Base64 length: {len(data)} chars")

    return data, media_type


def _parse_ai_response(text: str) -> dict:
    clean = text.strip()

    if clean.startswith("```"):
        lines = clean.splitlines()
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        clean = "\n".join(inner).strip()

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError:
        _log(f"Direct JSON parse failed, trying regex extraction on: {text!r}")
        m = re.search(r"\{[^{}]+\}", text, re.DOTALL)
        if not m:
            raise json.JSONDecodeError(
                f"No JSON object found in response: {text!r}", text, 0
            )
        parsed = json.loads(m.group())

    result = {
        "phone":       bool(parsed.get("phone",       False)),
        "smoking":     bool(parsed.get("smoking",     False)),
        "no_seatbelt": bool(parsed.get("no_seatbelt", False)),
    }
    _log(f"Parsed result: {result}")
    return result


def _run_analysis(violation: "Violation", upload_folder: str) -> dict:
    _log("Converting photo to base64...")
    image_data, media_type = _photo_to_base64(violation.photo_url, upload_folder)

    _log("Creating Anthropic client...")
    client = anthropic.Anthropic(timeout=30.0)

    _log(f"Sending to Claude API (model={MODEL})...")
    message = client.messages.create(
        model=MODEL,
        max_tokens=256,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": PROMPT,
                    },
                ],
            }
        ],
    )

    raw_text = message.content[0].text
    _log(f"Raw API response: {raw_text!r}")
    _log(f"Token usage -- input: {message.usage.input_tokens}, output: {message.usage.output_tokens}")

    return _parse_ai_response(raw_text)


def analyze_violation(app, violation_id: int) -> None:
    with app.app_context():
        _log(f"Starting analysis for violation ID: {violation_id}")

        violation = Violation.query.get(violation_id)
        if not violation:
            _log(f"ERROR -- violation {violation_id} not found in DB")
            return

        upload_folder = app.config["UPLOAD_FOLDER"]

        violation.ai_status = "processing"
        db.session.commit()
        _log("Status set to: processing")

        try:
            violation_type = _run_analysis(violation, upload_folder)
            violation.violation_type = violation_type
            violation.ai_status = "completed"
            _log(f"Analysis complete. violation_type={violation_type}")

        except FileNotFoundError as exc:
            _log(f"ERROR -- photo file not found: {exc}")
            violation.ai_result = {"error": f"Photo file not found: {exc}"}
            violation.ai_status = "failed"

        except json.JSONDecodeError as exc:
            _log(f"ERROR -- JSON parse failed: {exc}")
            violation.ai_result = {"error": f"Could not parse AI response: {exc}"}
            violation.ai_status = "failed"

        except anthropic.AuthenticationError as exc:
            _log(f"ERROR -- API authentication failed (check ANTHROPIC_API_KEY): {exc}")
            violation.ai_result = {"error": f"API authentication failed: {exc}"}
            violation.ai_status = "failed"

        except anthropic.APITimeoutError:
            _log("ERROR -- Claude API request timed out (30s)")
            violation.ai_result = {"error": "Claude API request timed out"}
            violation.ai_status = "failed"

        except anthropic.APIError as exc:
            _log(f"ERROR -- Claude API error: {exc}")
            violation.ai_result = {"error": f"Claude API error: {exc}"}
            violation.ai_status = "failed"

        except Exception as exc:
            _log(f"ERROR -- unexpected exception: {exc}")
            _log(traceback.format_exc())
            violation.ai_result = {"error": str(exc)}
            violation.ai_status = "failed"

        db.session.commit()
        _log(f"Final status saved: {violation.ai_status}")


def trigger_async(app, violation_id: int) -> None:
    _log(f"Spawning background thread for violation ID: {violation_id}")
    t = threading.Thread(target=analyze_violation, args=(app, violation_id), daemon=True)
    t.start()

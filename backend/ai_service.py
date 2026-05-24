import base64
import json
import logging
import os
import re
import time
import traceback
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import anthropic
from models import db, Violation

logger = logging.getLogger(__name__)

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

_executor = ThreadPoolExecutor(max_workers=10)


def _photo_to_base64(photo_url: str, upload_folder: str) -> tuple[str, str]:
    if photo_url.startswith("http://") or photo_url.startswith("https://"):
        logger.info("Fetching photo from URL: %s", photo_url)
        with urllib.request.urlopen(photo_url, timeout=15) as response:
            raw = response.read()
        url_path = photo_url.split("?")[0]
        ext = url_path.rsplit(".", 1)[-1].lower()
    else:
        filename = os.path.basename(photo_url)
        path = os.path.join(upload_folder, filename)
        logger.info("Reading photo from disk: %s", path)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Photo not found on disk: {path}")
        ext = filename.rsplit(".", 1)[-1].lower()
        with open(path, "rb") as f:
            raw = f.read()

    media_type = MEDIA_TYPES.get(ext, "image/jpeg")
    data = base64.standard_b64encode(raw).decode("utf-8")
    assert not data.startswith("data:"), "base64 must NOT include a data-URI prefix"
    logger.debug("Photo encoded: media_type=%s size=%d b64_len=%d", media_type, len(raw), len(data))
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
        logger.warning("Direct JSON parse failed, trying regex on: %r", text)
        m = re.search(r"\{[^{}]+\}", text, re.DOTALL)
        if not m:
            raise json.JSONDecodeError(f"No JSON object found: {text!r}", text, 0)
        parsed = json.loads(m.group())

    result = {
        "phone":       bool(parsed.get("phone",       False)),
        "smoking":     bool(parsed.get("smoking",     False)),
        "no_seatbelt": bool(parsed.get("no_seatbelt", False)),
    }
    logger.info("Parsed AI result: %s", result)
    return result


def _run_analysis(violation: "Violation", upload_folder: str, model: str) -> dict:
    image_data, media_type = _photo_to_base64(violation.photo_url, upload_folder)
    client = anthropic.Anthropic(timeout=30.0)
    logger.info("Sending to Claude API (model=%s violation_id=%d)", model, violation.id)
    message = client.messages.create(
        model=model,
        max_tokens=256,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": image_data},
                    },
                    {"type": "text", "text": PROMPT},
                ],
            }
        ],
    )
    raw_text = message.content[0].text
    logger.debug(
        "Raw response: %r | tokens in=%d out=%d",
        raw_text, message.usage.input_tokens, message.usage.output_tokens,
    )
    return _parse_ai_response(raw_text)


def analyze_violation(app, violation_id: int) -> None:
    with app.app_context():
        logger.info("Starting analysis for violation %d", violation_id)

        violation = Violation.query.get(violation_id)
        if not violation:
            logger.error("Violation %d not found in DB", violation_id)
            return

        upload_folder = app.config["UPLOAD_FOLDER"]
        model         = app.config.get("AI_MODEL", "claude-sonnet-4-6")
        max_retries   = app.config.get("AI_MAX_RETRIES", 2)

        violation.ai_status = "processing"
        db.session.commit()

        last_exc = None
        for attempt in range(1, max_retries + 1):
            try:
                violation_type = _run_analysis(violation, upload_folder, model)
                violation.violation_type = violation_type
                violation.ai_status = "completed"

                try:
                    from models import User
                    owner = User.query.get(violation.vehicle.owner_id)
                    if owner:
                        penalty = sum(5 for v in violation_type.values() if v)
                        if penalty > 0:
                            owner.points = max(0, owner.points - penalty)
                            if owner.points == 0:
                                owner.license_status = "suspended"
                            db.session.commit()
                            logger.info(
                                "Points updated: owner=%s penalty=%d remaining=%d",
                                owner.username, penalty, owner.points,
                            )
                except Exception as exc:
                    logger.warning("Could not update points: %s", exc)

                logger.info("Analysis complete for violation %d: %s", violation_id, violation_type)
                last_exc = None
                break

            except (FileNotFoundError, json.JSONDecodeError, anthropic.AuthenticationError) as exc:
                # Non-retryable: bad config, missing file, unparseable response
                logger.error("Non-retryable error for violation %d: %s", violation_id, exc)
                violation.ai_result = {"error": str(exc)}
                violation.ai_status = "failed"
                last_exc = None
                break

            except (anthropic.APITimeoutError, anthropic.APIError) as exc:
                last_exc = exc
                if attempt < max_retries:
                    wait = 2 ** (attempt - 1)
                    logger.warning(
                        "Attempt %d/%d failed (%s), retrying in %ds",
                        attempt, max_retries, exc, wait,
                    )
                    time.sleep(wait)
                else:
                    logger.error("All %d attempts failed for violation %d: %s", max_retries, violation_id, exc)

            except Exception as exc:
                logger.error(
                    "Unexpected error for violation %d: %s\n%s",
                    violation_id, exc, traceback.format_exc(),
                )
                violation.ai_result = {"error": str(exc)}
                violation.ai_status = "failed"
                last_exc = None
                break

        if last_exc is not None:
            violation.ai_result = {"error": str(last_exc)}
            violation.ai_status = "failed"

        db.session.commit()
        logger.info("Final status for violation %d: %s", violation_id, violation.ai_status)


def trigger_async(app, violation_id: int) -> None:
    logger.info("Submitting violation %d to thread pool", violation_id)
    _executor.submit(analyze_violation, app, violation_id)

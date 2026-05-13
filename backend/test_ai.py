"""
Standalone AI service debug script.
Run from backend/ with the venv activated:
    python test_ai.py
"""

import base64
import io
import json
import os
import re
import sys
import traceback

from dotenv import load_dotenv

# Load .env BEFORE importing anthropic (it reads ANTHROPIC_API_KEY at import time)
load_dotenv()

PASS = "\u2713 PASS"
FAIL = "\u2717 FAIL"
SKIP = "- SKIP"

# ---------------------------------------------------------------------------
# STEP 1 — API key check
# ---------------------------------------------------------------------------
print("\n[STEP 1] API Key Check...", end=" ", flush=True)
try:
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        print(FAIL)
        print("  ERROR: ANTHROPIC_API_KEY is empty or not set in .env")
        sys.exit(1)
    masked = api_key[:10] + "..." + api_key[-4:]
    print(PASS)
    print(f"  Key (masked): {masked}")
except Exception:
    print(FAIL)
    traceback.print_exc()
    sys.exit(1)

# ---------------------------------------------------------------------------
# STEP 2 — Basic API connection (text only)
# ---------------------------------------------------------------------------
print("\n[STEP 2] Basic API Connection (text only)...", end=" ", flush=True)
try:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=32,
        messages=[{"role": "user", "content": "Hello, respond with the single word OK"}],
        timeout=30,
    )
    reply = resp.content[0].text.strip()
    print(PASS)
    print(f"  Model reply  : {reply!r}")
    print(f"  Input tokens : {resp.usage.input_tokens}")
    print(f"  Output tokens: {resp.usage.output_tokens}")
except anthropic.AuthenticationError as e:
    print(FAIL)
    print(f"  Authentication failed — check your API key.\n  {e}")
    sys.exit(1)
except anthropic.APIConnectionError as e:
    print(FAIL)
    print(f"  Could not reach Anthropic API — check internet / proxy.\n  {e}")
    sys.exit(1)
except Exception:
    print(FAIL)
    traceback.print_exc()
    sys.exit(1)

# ---------------------------------------------------------------------------
# STEP 3 — Vision API with a synthetic 100x100 red square image
# ---------------------------------------------------------------------------
print("\n[STEP 3] Vision API Test (synthetic red square)...", end=" ", flush=True)

PROMPT = (
    "Analyze this traffic photo. Detect if the driver is:\n"
    "1. Using a phone while driving\n"
    "2. Smoking while driving\n"
    "3. Not wearing a seatbelt\n\n"
    "Respond ONLY with this exact JSON format, no other text:\n"
    '{"phone": true/false, "smoking": true/false, "no_seatbelt": true/false}'
)


def make_red_square_png() -> bytes:
    """Creates a minimal 100x100 red PNG without Pillow using raw bytes."""
    try:
        from PIL import Image

        img = Image.new("RGB", (100, 100), color=(220, 30, 30))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except ImportError:
        # Fallback: 1x1 red PNG (valid minimal PNG)
        RED_1PX_PNG = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
            b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00"
            b"\x00\x0cIDATx\x9cc\xf8\x1f\x00\x00\x00\x02\x00\x01\xe2!"
            b"\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        return RED_1PX_PNG


try:
    png_bytes = make_red_square_png()
    b64_data = base64.standard_b64encode(png_bytes).decode("utf-8")

    # Confirm no data-URI prefix
    assert not b64_data.startswith("data:"), "base64 must NOT include data: prefix"

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=256,
        timeout=30,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": b64_data,
                        },
                    },
                    {"type": "text", "text": PROMPT},
                ],
            }
        ],
    )

    raw = message.content[0].text
    print(PASS)
    print(f"  Raw response : {raw!r}")

    # Parse JSON (handle markdown fences + regex fallback)
    clean = raw.strip()
    if clean.startswith("```"):
        lines = clean.splitlines()
        clean = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError:
        # Regex fallback — find first {...} block
        m = re.search(r"\{[^{}]+\}", raw, re.DOTALL)
        if m:
            parsed = json.loads(m.group())
        else:
            raise

    result = {
        "phone":      bool(parsed.get("phone",      False)),
        "smoking":    bool(parsed.get("smoking",    False)),
        "no_seatbelt": bool(parsed.get("no_seatbelt", False)),
    }
    print(f"  Parsed JSON  : {result}")

except Exception:
    print(FAIL)
    traceback.print_exc()

# ---------------------------------------------------------------------------
# STEP 4 — Real photo from uploads/ folder
# ---------------------------------------------------------------------------
print("\n[STEP 4] Real Photo Test...", end=" ", flush=True)

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
MEDIA_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}

try:
    if not os.path.isdir(UPLOAD_FOLDER):
        print(SKIP)
        print(f"  uploads/ folder not found at: {os.path.abspath(UPLOAD_FOLDER)}")
    else:
        photos = [
            f for f in os.listdir(UPLOAD_FOLDER)
            if f.rsplit(".", 1)[-1].lower() in MEDIA_TYPES
        ]
        if not photos:
            print(SKIP)
            print("  No photos found in uploads/ — create a violation first.")
        else:
            photo_name = photos[0]
            photo_path = os.path.join(UPLOAD_FOLDER, photo_name)
            ext = photo_name.rsplit(".", 1)[-1].lower()
            media_type = MEDIA_TYPES.get(ext, "image/jpeg")

            print(f"\n  Using photo  : {photo_name}  ({media_type})")
            with open(photo_path, "rb") as fh:
                b64 = base64.standard_b64encode(fh.read()).decode("utf-8")

            message = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=256,
                timeout=30,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": b64,
                                },
                            },
                            {"type": "text", "text": PROMPT},
                        ],
                    }
                ],
            )

            raw = message.content[0].text
            print(f"  Raw response : {raw!r}")

            clean = raw.strip()
            if clean.startswith("```"):
                lines = clean.splitlines()
                clean = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            try:
                parsed = json.loads(clean)
            except json.JSONDecodeError:
                m = re.search(r"\{[^{}]+\}", raw, re.DOTALL)
                parsed = json.loads(m.group()) if m else {}

            result = {
                "phone":       bool(parsed.get("phone",       False)),
                "smoking":     bool(parsed.get("smoking",     False)),
                "no_seatbelt": bool(parsed.get("no_seatbelt", False)),
            }
            print(f"  Parsed JSON  : {result}")
            print(f"  {PASS}")

except Exception:
    print(FAIL)
    traceback.print_exc()

print("\n--- Debug complete ---\n")

"""
End-to-end test of the violation creation + AI analysis flow.
Run from backend/ with the venv activated:
    python test_endpoint.py

Requires the Flask backend to be running on http://localhost:5000
"""

import base64
import io
import json
import sys
import time

import requests

BASE = "http://localhost:5000/api"
POLICE_USER = "emre.arslan"
POLICE_PASS = "sifre123"
TEST_PLATE   = "34 ABC 123"   # must exist in DB (seeded)


def check(label: str, condition: bool, detail: str = ""):
    status = "\u2713 PASS" if condition else "\u2717 FAIL"
    print(f"  {status}  {label}")
    if detail:
        print(f"         {detail}")
    if not condition:
        sys.exit(1)


def make_test_image_bytes() -> bytes:
    """Returns a small PNG for testing — uses PIL if available, else a 1px fallback."""
    try:
        from PIL import Image
        img = Image.new("RGB", (100, 100), color=(60, 120, 200))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except ImportError:
        # Minimal valid 1x1 blue-ish PNG
        return (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
            b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00"
            b"\x00\x0cIDATx\x9cc\xf8\x3f\x00\x00\x00\x02\x00\x01\xe2!"
            b"\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
        )


# ---------------------------------------------------------------------------
# 1. Health check
# ---------------------------------------------------------------------------
print("\n[STEP 1] Backend health check...")
try:
    r = requests.get(f"{BASE[:-4]}/health", timeout=5)
    check("GET /health returns 200", r.status_code == 200, r.text[:120])
except requests.ConnectionError:
    print("  \u2717 FAIL  Cannot connect to http://localhost:5000")
    print("          Make sure the Flask backend is running: python app.py")
    sys.exit(1)

# ---------------------------------------------------------------------------
# 2. Login as police
# ---------------------------------------------------------------------------
print(f"\n[STEP 2] Login as {POLICE_USER}...")
r = requests.post(f"{BASE}/auth/login", json={"username": POLICE_USER, "password": POLICE_PASS})
print(f"  Status: {r.status_code}")
print(f"  Body  : {r.text[:200]}")
check("Login returns 200", r.status_code == 200)

token = r.json()["data"]["token"]
user_role = r.json()["data"]["user"]["role"]
check("Role is police", user_role == "police", f"actual role: {user_role}")
print(f"  Token (first 30 chars): {token[:30]}...")

HEADERS = {"Authorization": f"Bearer {token}"}

# ---------------------------------------------------------------------------
# 3. Create a violation
# ---------------------------------------------------------------------------
print(f"\n[STEP 3] Create violation for plate {TEST_PLATE}...")
img_bytes = make_test_image_bytes()
files   = {"photo": ("test_photo.png", img_bytes, "image/png")}
payload = {"plate": TEST_PLATE, "location": "Test Location - E5 Karayolu", "speed": "85"}

r = requests.post(f"{BASE}/violations/", headers=HEADERS, files=files, data=payload)
print(f"  Status: {r.status_code}")
print(f"  Body  : {r.text[:400]}")
check("Create violation returns 201", r.status_code == 201)

violation_id = r.json()["data"]["id"]
ai_status    = r.json()["data"]["ai_status"]
print(f"  Violation ID : {violation_id}")
print(f"  AI status    : {ai_status}  (should be 'pending')")
check("AI status starts as pending", ai_status == "pending")

# ---------------------------------------------------------------------------
# 4. Poll for AI completion (up to 30 seconds)
# ---------------------------------------------------------------------------
print(f"\n[STEP 4] Waiting for AI analysis to complete (violation #{violation_id})...")
deadline = time.time() + 30
final_status = ai_status

while time.time() < deadline:
    time.sleep(3)
    r = requests.get(f"{BASE}/violations/{violation_id}", headers=HEADERS)
    if r.status_code != 200:
        print(f"  Warning: GET violation returned {r.status_code}")
        continue
    data = r.json()["data"]
    final_status = data["ai_status"]
    print(f"  [{time.strftime('%H:%M:%S')}] ai_status = {final_status}")
    if final_status in ("completed", "failed"):
        break

print(f"\n  Final AI status  : {final_status}")
print(f"  violation_type   : {json.dumps(data.get('violation_type'), indent=4)}")
print(f"  ai_result        : {data.get('ai_result')}")

check("AI analysis completed (not failed/pending)", final_status == "completed",
      "If 'failed', check the Flask console for [AI Service] error lines.")

print("\n--- End-to-end test complete ---\n")

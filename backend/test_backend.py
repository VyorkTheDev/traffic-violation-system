"""
Backend integration test using Flask test client.
Run with: python test_backend.py

Requires a running PostgreSQL instance (traffic_db).
Tables are created automatically by create_app().
"""
import json
import sys
import bcrypt

from app import create_app
from models import db, User, Vehicle

app = create_app()
client = app.test_client()

# Seed admin and clean up any leftover test data before starting
with app.app_context():
    # Ensure admin exists
    if not User.query.filter_by(username="admin").first():
        hashed = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
        admin = User(username="admin", email="admin@traffic.local", password=hashed, role="admin")
        db.session.add(admin)
        db.session.commit()
        print("Admin user seeded.")

    # Clean up leftover test users from previous runs (vehicles first to respect FK)
    for username in ("testcitizen", "officer1"):
        u = User.query.filter_by(username=username).first()
        if u:
            Vehicle.query.filter_by(owner_id=u.id).delete()
            db.session.delete(u)
    db.session.commit()
    # Also clean up orphaned test plates
    Vehicle.query.filter(Vehicle.plate.like("34TEST%")).delete(synchronize_session=False)
    db.session.commit()

PASS = "\033[92m PASS\033[0m"
FAIL = "\033[91m FAIL\033[0m"
errors = []


def check(label, response, expected_status, assert_fn=None):
    body = {}
    try:
        body = response.get_json() or {}
    except Exception:
        pass

    status_ok = response.status_code == expected_status
    extra_ok = assert_fn(body) if assert_fn else True
    ok_flag = status_ok and extra_ok

    icon = PASS if ok_flag else FAIL
    print(f"{icon}  [{response.status_code}] {label}")

    if not ok_flag:
        errors.append(label)
        print(f"        body  : {json.dumps(body, indent=2)[:300]}")
        if not status_ok:
            print(f"        expect: {expected_status}, got: {response.status_code}")

    return body


def post(url, payload=None, token=None, content_type="application/json"):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if content_type == "application/json":
        return client.post(url, json=payload, headers=headers)
    return client.post(url, data=payload, headers=headers, content_type=content_type)


def get(url, token=None, params=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return client.get(url, headers=headers, query_string=params or {})


def delete(url, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return client.delete(url, headers=headers)


def put(url, payload, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return client.put(url, json=payload, headers=headers)


# ---------------------------------------------------------------------------
print("\n=== Health Check ===")
# ---------------------------------------------------------------------------
r = get("/health")
check("GET /health", r, 200, lambda b: b.get("success") is True)

# ---------------------------------------------------------------------------
print("\n=== Auth: Register ===")
# ---------------------------------------------------------------------------
r = post("/api/auth/register", {"username": "testcitizen", "email": "citizen@test.com", "password": "pass123"})
body = check("Register new citizen", r, 201, lambda b: b.get("success") is True)

# Duplicate username
r = post("/api/auth/register", {"username": "testcitizen", "email": "other@test.com", "password": "pass123"})
check("Register duplicate username -> 409", r, 409, lambda b: b.get("success") is False)

# Missing fields
r = post("/api/auth/register", {"username": "incomplete"})
check("Register missing fields -> 400", r, 400, lambda b: b.get("success") is False)

# ---------------------------------------------------------------------------
print("\n=== Auth: Login ===")
# ---------------------------------------------------------------------------
r = post("/api/auth/login", {"username": "testcitizen", "password": "pass123"})
body = check("Login citizen", r, 200, lambda b: "data" in b and "token" in b.get("data", {}))
citizen_token = body.get("data", {}).get("token", "")

r = post("/api/auth/login", {"username": "testcitizen", "password": "wrongpass"})
check("Login wrong password -> 401", r, 401, lambda b: b.get("success") is False)

r = post("/api/auth/login", {"username": "admin", "password": "admin123"})
body = check("Login admin (seed user)", r, 200, lambda b: "data" in b and "token" in b.get("data", {}))
admin_token = body.get("data", {}).get("token", "")

# ---------------------------------------------------------------------------
print("\n=== Vehicles ===")
# ---------------------------------------------------------------------------
r = get("/api/vehicles/", token=citizen_token)
check("List vehicles (citizen, empty)", r, 200, lambda b: b.get("success") is True)

r = post("/api/vehicles/", {"plate": "34TEST01", "brand": "Toyota", "model": "Corolla", "year": 2020}, token=citizen_token)
body = check("Create vehicle", r, 201, lambda b: b.get("success") is True)
vehicle_id = body.get("data", {}).get("id")

r = post("/api/vehicles/", {"plate": "34TEST01", "brand": "Ford", "model": "Focus", "year": 2021}, token=citizen_token)
check("Create duplicate plate -> 409", r, 409)

r = get(f"/api/vehicles/{vehicle_id}", token=citizen_token)
check("Get vehicle by id", r, 200, lambda b: b.get("success") is True)

# ---------------------------------------------------------------------------
print("\n=== Admin: User Management ===")
# ---------------------------------------------------------------------------
r = get("/api/admin/users", token=admin_token)
body = check("Admin list users", r, 200, lambda b: isinstance(b.get("data"), list))
print(f"        users in DB: {len(body.get('data', []))}")

# Citizen cannot access admin routes
r = get("/api/admin/users", token=citizen_token)
check("Citizen -> admin route -> 403", r, 403, lambda b: b.get("success") is False)

# No token
r = get("/api/admin/users")
check("No token -> 401", r, 401, lambda b: b.get("success") is False)

r = post("/api/admin/users", {"username": "officer1", "email": "officer@police.com", "password": "police123", "role": "police"}, token=admin_token)
body = check("Admin create police user", r, 201, lambda b: b.get("data", {}).get("role") == "police")
police_user_id = body.get("data", {}).get("id")

r = post("/api/auth/login", {"username": "officer1", "password": "police123"})
body = check("Login as new police officer", r, 200, lambda b: b.get("data", {}).get("user", {}).get("role") == "police")
police_token = body.get("data", {}).get("token", "")

# ---------------------------------------------------------------------------
print("\n=== Admin: Stats ===")
# ---------------------------------------------------------------------------
r = get("/api/admin/stats", token=admin_token)
check("Admin stats", r, 200, lambda b: "users" in b.get("data", {}))

# ---------------------------------------------------------------------------
print("\n=== Police: Search ===")
# ---------------------------------------------------------------------------
r = get("/api/police/search", token=police_token, params={"plate": "34TEST"})
check("Police search plate (partial)", r, 200, lambda b: b.get("success") is True)

r = get("/api/police/search", token=police_token, params={"plate": "XXXXXX"})
check("Police search no results -> 404", r, 404)

# ---------------------------------------------------------------------------
print("\n=== Cleanup ===")
# ---------------------------------------------------------------------------
if vehicle_id:
    r = delete(f"/api/vehicles/{vehicle_id}", token=citizen_token)
    check("Delete own vehicle", r, 200)

if police_user_id:
    r = delete(f"/api/admin/users/{police_user_id}", token=admin_token)
    check("Admin delete police user", r, 200)

# Delete test citizen
r = get("/api/admin/users", token=admin_token)
users = r.get_json().get("data", [])
citizen = next((u for u in users if u["username"] == "testcitizen"), None)
if citizen:
    r = delete(f"/api/admin/users/{citizen['id']}", token=admin_token)
    check("Admin delete test citizen", r, 200)

# ---------------------------------------------------------------------------
print("\n=== Summary ===")
# ---------------------------------------------------------------------------
if errors:
    print(f"\033[91m{len(errors)} test(s) FAILED:\033[0m")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("\033[92mAll tests passed!\033[0m")

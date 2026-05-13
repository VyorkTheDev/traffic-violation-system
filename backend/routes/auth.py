from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from flask import Blueprint, request, current_app
from models import db, User
from utils import ok, err

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not username or not email or not password:
        return err("username, email and password are required")

    if len(password) < 6:
        return err("Password must be at least 6 characters")

    if User.query.filter_by(username=username).first():
        return err("Username already taken", 409)

    if User.query.filter_by(email=email).first():
        return err("Email already registered", 409)

    try:
        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user = User(username=username, email=email, password=hashed, role="citizen")
        db.session.add(user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return err(f"Registration failed: {str(e)}", 500)

    return ok(data=user.to_dict(), message="Registration successful", code=201)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return err("username and password are required")

    user = User.query.filter_by(username=username).first()
    if not user or not bcrypt.checkpw(password.encode(), user.password.encode()):
        return err("Invalid credentials", 401)

    payload = {
        "user_id": user.id,
        "username": user.username,
        "role": user.role,
        "exp": datetime.now(timezone.utc) + timedelta(
            hours=current_app.config["JWT_EXPIRATION_HOURS"]
        ),
    }
    token = jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")

    return ok(data={"token": token, "user": user.to_dict()})

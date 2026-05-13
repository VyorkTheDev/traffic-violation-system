from functools import wraps
import jwt
from flask import request, current_app, g
from utils import err
from models import User

ROLE_HIERARCHY = {"citizen": 0, "police": 1, "admin": 2}


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return err("Authorization header missing or malformed", 401)

        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(
                token, current_app.config["JWT_SECRET"], algorithms=["HS256"]
            )
        except jwt.ExpiredSignatureError:
            return err("Token expired", 401)
        except jwt.InvalidTokenError:
            return err("Invalid token", 401)

        user = db_get_user(payload.get("user_id"))
        if not user:
            return err("User not found", 401)

        g.current_user = user
        return f(*args, **kwargs)

    return decorated


def db_get_user(user_id):
    try:
        return User.query.get(user_id)
    except Exception:
        return None


def role_required(*allowed_roles):
    """
    Decorator that validates JWT (via token_required logic) then checks role.
    Admin always passes; role hierarchy: admin(2) > police(1) > citizen(0).
    Usage: @role_required("police")  → police + admin can access.
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            # --- inline token validation (avoids double-decorator stacking issues) ---
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return err("Authorization header missing or malformed", 401)

            token = auth_header.split(" ", 1)[1]
            try:
                payload = jwt.decode(
                    token, current_app.config["JWT_SECRET"], algorithms=["HS256"]
                )
            except jwt.ExpiredSignatureError:
                return err("Token expired", 401)
            except jwt.InvalidTokenError:
                return err("Invalid token", 401)

            user = db_get_user(payload.get("user_id"))
            if not user:
                return err("User not found", 401)

            g.current_user = user

            # --- role check ---
            user_level = ROLE_HIERARCHY.get(user.role, -1)
            required_level = min(ROLE_HIERARCHY[r] for r in allowed_roles)
            if user_level < required_level:
                return err("Insufficient permissions", 403)

            return f(*args, **kwargs)

        return decorated
    return decorator

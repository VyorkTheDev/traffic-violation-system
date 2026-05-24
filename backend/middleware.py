from functools import wraps
import jwt
from flask import request, current_app, g
from utils import err
from models import User

ROLE_HIERARCHY = {"citizen": 0, "police": 1, "admin": 2}


def _decode_token():
    """JWT'yi doğrular. Başarıda (user, None), hata durumunda (None, error_response) döner."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, err("Authorization header missing or malformed", 401)

    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(
            token, current_app.config["JWT_SECRET"], algorithms=["HS256"]
        )
    except jwt.ExpiredSignatureError:
        return None, err("Token expired", 401)
    except jwt.InvalidTokenError:
        return None, err("Invalid token", 401)

    user = User.query.get(payload.get("user_id"))
    if not user:
        return None, err("User not found", 401)

    return user, None


def token_required(f):
    """Tüm kimliği doğrulanmış roller (citizen, police, admin) için kullanılır."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user, error = _decode_token()
        if error:
            return error
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


def role_required(*allowed_roles):
    """
    JWT doğrulayıp rol kontrolü yapar.
    Hiyerarşi: admin(2) > police(1) > citizen(0).
    Kullanım: @role_required("police") → police + admin erişebilir.
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user, error = _decode_token()
            if error:
                return error
            g.current_user = user

            user_level = ROLE_HIERARCHY.get(user.role, -1)
            required_level = min(ROLE_HIERARCHY[r] for r in allowed_roles)
            if user_level < required_level:
                return err("Insufficient permissions", 403)

            return f(*args, **kwargs)
        return decorated
    return decorator

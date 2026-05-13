import os
from datetime import datetime, timezone, timedelta

import bcrypt
from flask import Blueprint, request, current_app
from sqlalchemy import func, cast, Date

from models import db, User, Vehicle, Violation
from middleware import role_required
from utils import ok, err

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


# ---------------------------------------------------------------------------
# USER MANAGEMENT
# ---------------------------------------------------------------------------

@admin_bp.route("/users", methods=["GET"])
@role_required("admin")
def list_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return ok(data=[u.to_dict() for u in users])


@admin_bp.route("/users", methods=["POST"])
@role_required("admin")
def create_user():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    role = (data.get("role") or "citizen").strip()

    if not username or not email or not password:
        return err("username, email and password are required", 400)

    if role not in ("citizen", "police", "admin"):
        return err("role must be citizen, police or admin", 400)

    if User.query.filter_by(username=username).first():
        return err("Username already taken", 409)

    if User.query.filter_by(email=email).first():
        return err("Email already registered", 409)

    try:
        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user = User(username=username, email=email, password=hashed, role=role)
        db.session.add(user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return err(f"Could not create user: {str(e)}", 500)
    return ok(data=user.to_dict(), code=201)


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@role_required("admin")
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    try:
        db.session.delete(user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return err(f"Could not delete user: {str(e)}", 500)
    return ok(message=f"User '{user.username}' deleted")


@admin_bp.route("/users/<int:user_id>/role", methods=["PUT"])
@role_required("admin")
def update_role(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}
    new_role = (data.get("role") or "").strip()

    if new_role not in ("citizen", "police", "admin"):
        return err("role must be citizen, police or admin", 400)

    try:
        user.role = new_role
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return err(f"Could not update role: {str(e)}", 500)
    return ok(data=user.to_dict())


# ---------------------------------------------------------------------------
# VEHICLE MANAGEMENT
# ---------------------------------------------------------------------------

@admin_bp.route("/vehicles", methods=["GET"])
@role_required("admin")
def list_vehicles():
    vehicles = Vehicle.query.order_by(Vehicle.created_at.desc()).all()
    result = []
    for v in vehicles:
        data = v.to_dict()
        data["owner"] = {
            "id": v.owner.id,
            "username": v.owner.username,
            "email": v.owner.email,
        }
        result.append(data)
    return ok(data=result)


@admin_bp.route("/vehicles", methods=["POST"])
@role_required("admin")
def create_vehicle():
    data = request.get_json(silent=True) or {}
    plate = (data.get("plate") or "").strip().upper()
    brand = (data.get("brand") or "").strip()
    model = (data.get("model") or "").strip()
    year = data.get("year")
    owner_id = data.get("owner_id")

    if not plate or not brand or not model or not year or not owner_id:
        return err("plate, brand, model, year and owner_id are required", 400)

    try:
        year = int(year)
        owner_id = int(owner_id)
    except (ValueError, TypeError):
        return err("year and owner_id must be integers", 400)

    if not User.query.get(owner_id):
        return err(f"User #{owner_id} not found", 404)

    if Vehicle.query.filter_by(plate=plate).first():
        return err(f"Plate '{plate}' already registered", 409)

    try:
        vehicle = Vehicle(plate=plate, brand=brand, model=model, year=year, owner_id=owner_id)
        db.session.add(vehicle)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return err(f"Could not create vehicle: {str(e)}", 500)
    return ok(data=vehicle.to_dict(), code=201)


@admin_bp.route("/vehicles/<int:vehicle_id>", methods=["DELETE"])
@role_required("admin")
def delete_vehicle(vehicle_id):
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    try:
        db.session.delete(vehicle)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return err(f"Could not delete vehicle: {str(e)}", 500)
    return ok(message=f"Vehicle '{vehicle.plate}' deleted")


# ---------------------------------------------------------------------------
# VIOLATION MANAGEMENT
# ---------------------------------------------------------------------------

@admin_bp.route("/violations", methods=["GET"])
@role_required("admin")
def list_violations():
    query = Violation.query

    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    violation_type = request.args.get("violation_type")
    ai_status = request.args.get("ai_status")

    if date_from:
        try:
            query = query.filter(Violation.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            return err("date_from must be ISO 8601 (YYYY-MM-DD)", 400)

    if date_to:
        try:
            # Include the full day by adding 1 day
            dt_to = datetime.fromisoformat(date_to) + timedelta(days=1)
            query = query.filter(Violation.created_at < dt_to)
        except ValueError:
            return err("date_to must be ISO 8601 (YYYY-MM-DD)", 400)

    if ai_status:
        if ai_status not in ("pending", "processing", "completed", "failed"):
            return err("Invalid ai_status value", 400)
        query = query.filter(Violation.ai_status == ai_status)

    if violation_type:
        if violation_type not in ("phone", "smoking", "no_seatbelt", "speed"):
            return err("violation_type must be phone, smoking, no_seatbelt or speed", 400)
        if violation_type == "speed":
            query = query.filter(Violation.speed.isnot(None))
        else:
            # JSON boolean filter: violation_type->>'key' = 'true'
            query = query.filter(
                Violation.violation_type[violation_type].astext == "true"
            )

    violations = query.order_by(Violation.created_at.desc()).all()
    return ok(data=[v.to_dict() for v in violations])


@admin_bp.route("/violations/<int:violation_id>", methods=["GET"])
@role_required("admin")
def get_violation(violation_id):
    violation = Violation.query.get_or_404(violation_id)
    data = violation.to_dict()
    if violation.vehicle:
        data["vehicle"] = violation.vehicle.to_dict()
    return ok(data=data)


@admin_bp.route("/violations/<int:violation_id>", methods=["DELETE"])
@role_required("admin")
def delete_violation(violation_id):
    violation = Violation.query.get_or_404(violation_id)

    photo_path = os.path.join(
        current_app.config["UPLOAD_FOLDER"],
        os.path.basename(violation.photo_url),
    )
    if os.path.exists(photo_path):
        os.remove(photo_path)

    db.session.delete(violation)
    db.session.commit()
    return ok(message=f"Violation #{violation_id} deleted")


# ---------------------------------------------------------------------------
# STATISTICS DASHBOARD
# ---------------------------------------------------------------------------

@admin_bp.route("/stats", methods=["GET"])
@role_required("admin")
def stats():
    # User counts
    total_users = User.query.count()
    citizens = User.query.filter_by(role="citizen").count()
    police_count = User.query.filter_by(role="police").count()
    admins = User.query.filter_by(role="admin").count()

    # Vehicle / violation counts
    total_vehicles = Vehicle.query.count()
    total_violations = Violation.query.count()

    # Violation type distribution
    all_violations = Violation.query.all()
    type_dist = {"phone": 0, "smoking": 0, "no_seatbelt": 0, "speed": 0}
    for v in all_violations:
        vt = v.violation_type or {}
        if vt.get("phone"):
            type_dist["phone"] += 1
        if vt.get("smoking"):
            type_dist["smoking"] += 1
        if vt.get("no_seatbelt"):
            type_dist["no_seatbelt"] += 1
        if v.speed is not None:
            type_dist["speed"] += 1

    # Violations per day — last 7 days
    today = datetime.now(timezone.utc).date()
    seven_days_ago = today - timedelta(days=6)

    daily_rows = (
        db.session.query(
            cast(Violation.created_at, Date).label("day"),
            func.count(Violation.id).label("count"),
        )
        .filter(Violation.created_at >= datetime.combine(seven_days_ago, datetime.min.time()))
        .group_by("day")
        .order_by("day")
        .all()
    )

    # Build a complete 7-day series (fill gaps with 0)
    daily_map = {str(row.day): row.count for row in daily_rows}
    violations_per_day = [
        {
            "date": str(today - timedelta(days=i)),
            "count": daily_map.get(str(today - timedelta(days=i)), 0),
        }
        for i in range(6, -1, -1)
    ]

    return ok(data={
        "users": {
            "total": total_users,
            "citizen": citizens,
            "police": police_count,
            "admin": admins,
        },
        "vehicles": {"total": total_vehicles},
        "violations": {
            "total": total_violations,
            "type_distribution": type_dist,
            "per_day_last_7": violations_per_day,
        },
    })

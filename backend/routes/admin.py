from datetime import datetime, timezone, timedelta

import bcrypt
import cloudinary
import cloudinary.uploader
from flask import Blueprint, request, current_app
from sqlalchemy import func, cast, Date, case, String
from sqlalchemy.orm import joinedload

from models import db, User, Vehicle, Violation
from middleware import role_required
from utils import ok, err, normalize_plate, validate_plate

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


# ---------------------------------------------------------------------------
# USER MANAGEMENT
# ---------------------------------------------------------------------------

@admin_bp.route("/users", methods=["GET"])
@role_required("admin")
def list_users():
    page     = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 50, type=int), 200)
    paginated = (
        User.query
        .order_by(User.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return ok(data=[u.to_dict() for u in paginated.items], meta={
        "page": paginated.page,
        "per_page": per_page,
        "total": paginated.total,
        "pages": paginated.pages,
    })


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

    if User.query.filter(func.lower(User.username) == username.lower()).first():
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
        # 1. Bu kullanıcının polis olarak oluşturduğu ihlalleri sil (created_by FK)
        Violation.query.filter_by(created_by=user.id).delete(synchronize_session=False)

        # 2. Bu kullanıcının araçlarına bağlı ihlalleri sil (vehicle_id FK)
        vehicle_ids = [v.id for v in user.vehicles]
        if vehicle_ids:
            Violation.query.filter(
                Violation.vehicle_id.in_(vehicle_ids)
            ).delete(synchronize_session=False)

        # 3. Bu kullanıcının araçlarını sil (owner_id FK)
        Vehicle.query.filter_by(owner_id=user.id).delete(synchronize_session=False)

        # 4. Kullanıcıyı sil
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
    page     = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 50, type=int), 200)
    paginated = (
        Vehicle.query
        .options(joinedload(Vehicle.owner))
        .order_by(Vehicle.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    result = []
    for v in paginated.items:
        data = v.to_dict()
        data["owner"] = {
            "id": v.owner.id,
            "username": v.owner.username,
            "email": v.owner.email,
        }
        result.append(data)
    return ok(data=result, meta={
        "page": paginated.page,
        "per_page": per_page,
        "total": paginated.total,
        "pages": paginated.pages,
    })


@admin_bp.route("/vehicles", methods=["POST"])
@role_required("admin")
def create_vehicle():
    data = request.get_json(silent=True) or {}
    plate = normalize_plate(data.get("plate") or "")
    brand = (data.get("brand") or "").strip()
    model = (data.get("model") or "").strip()
    year = data.get("year")
    owner_id = data.get("owner_id")

    if not plate or not brand or not model or not year or not owner_id:
        return err("plate, brand, model, year and owner_id are required", 400)

    if not validate_plate(plate):
        return err("Geçersiz plaka formatı. Beklenen: 34AB123 veya 34 AB 123", 400)

    try:
        year = int(year)
        owner_id = int(owner_id)
    except (ValueError, TypeError):
        return err("year and owner_id must be integers", 400)

    if not db.session.get(User, owner_id):
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
                cast(Violation.violation_type[violation_type], String) == "true"
            )

    page     = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 50, type=int), 200)
    paginated = (
        query
        .order_by(Violation.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return ok(data=[v.to_dict() for v in paginated.items], meta={
        "page": paginated.page,
        "per_page": per_page,
        "total": paginated.total,
        "pages": paginated.pages,
    })


@admin_bp.route("/violations/<int:violation_id>", methods=["GET"])
@role_required("admin")
def get_violation(violation_id):
    violation = (
        Violation.query
        .options(joinedload(Violation.vehicle))
        .filter(Violation.id == violation_id)
        .first_or_404()
    )
    return ok(data=violation.to_dict_with_vehicle())


@admin_bp.route("/violations/<int:violation_id>", methods=["DELETE"])
@role_required("admin")
def delete_violation(violation_id):
    violation = Violation.query.get_or_404(violation_id)

    # Cloudinary'den sil
    public_id = getattr(violation, "photo_public_id", None)
    if public_id:
        try:
            cloudinary.config(
                cloud_name=current_app.config["CLOUDINARY_CLOUD_NAME"],
                api_key=current_app.config["CLOUDINARY_API_KEY"],
                api_secret=current_app.config["CLOUDINARY_API_SECRET"],
            )
            cloudinary.uploader.destroy(public_id)
        except Exception:
            pass

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

    # Violation type distribution — single aggregate query (no Python loop)
    dist_row = db.session.query(
        func.count(case((cast(Violation.violation_type["phone"],       String) == "true", 1))).label("phone"),
        func.count(case((cast(Violation.violation_type["smoking"],     String) == "true", 1))).label("smoking"),
        func.count(case((cast(Violation.violation_type["no_seatbelt"], String) == "true", 1))).label("no_seatbelt"),
        func.count(Violation.speed).label("speed"),
    ).one()
    type_dist = {
        "phone":       dist_row.phone,
        "smoking":     dist_row.smoking,
        "no_seatbelt": dist_row.no_seatbelt,
        "speed":       dist_row.speed,
    }

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

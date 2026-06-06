from flask import Blueprint, request, g
from sqlalchemy.orm import joinedload
from models import Vehicle, Violation
from middleware import role_required
from utils import ok, err, normalize_plate

police_bp = Blueprint("police", __name__, url_prefix="/api/police")


@police_bp.route("/violations", methods=["GET"])
@role_required("police")
def my_violations():
    violations = (
        Violation.query
        .options(joinedload(Violation.vehicle))
        .filter_by(created_by=g.current_user.id)
        .order_by(Violation.created_at.desc())
        .all()
    )
    return ok(data=[v.to_dict_with_vehicle() for v in violations])


@police_bp.route("/search", methods=["GET"])
@role_required("police")
def search_vehicle():
    plate = normalize_plate(request.args.get("plate") or "")
    if not plate:
        return err("plate query parameter is required")

    vehicles = (
        Vehicle.query
        .options(
            joinedload(Vehicle.owner),
            joinedload(Vehicle.violations),
        )
        .filter(Vehicle.plate.ilike(f"%{plate}%"))
        .all()
    )
    if not vehicles:
        return err(f"No vehicles found matching '{plate}'", 404)

    result = []
    for vehicle in vehicles:
        owner = vehicle.owner
        violations_sorted = sorted(vehicle.violations, key=lambda v: v.created_at, reverse=True)
        result.append({
            **vehicle.to_dict(),
            "owner": {
                "license_status": owner.license_status,
                "points": owner.points,
            } if owner else None,
            "violations": [
                {
                    "id": v.id,
                    "plate": v.plate,
                    "violation_type": v.violation_type,
                    "speed": v.speed,
                    "speed_limit": v.speed_limit,
                    "location": v.location,
                    "ai_status": v.ai_status,
                    "ai_result": v.ai_result,
                    "photo_url": v.photo_url,
                    "created_at": v.created_at.isoformat(),
                }
                for v in violations_sorted
            ],
        })

    return ok(data=result)

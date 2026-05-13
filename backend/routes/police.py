from flask import Blueprint, request, g
from models import Vehicle, Violation
from middleware import role_required
from utils import ok, err, normalize_plate

police_bp = Blueprint("police", __name__, url_prefix="/api/police")


@police_bp.route("/violations", methods=["GET"])
@role_required("police")
def my_violations():
    violations = (
        Violation.query
        .filter_by(created_by=g.current_user.id)
        .order_by(Violation.created_at.desc())
        .all()
    )

    result = []
    for v in violations:
        data = v.to_dict()
        if v.vehicle:
            data["vehicle"] = {
                "plate": v.vehicle.plate,
                "brand": v.vehicle.brand,
                "model": v.vehicle.model,
                "year": v.vehicle.year,
            }
        result.append(data)

    return ok(data=result)


@police_bp.route("/search", methods=["GET"])
@role_required("police")
def search_vehicle():
    plate = normalize_plate(request.args.get("plate") or "")
    if not plate:
        return err("plate query parameter is required")

    vehicles = Vehicle.query.filter(Vehicle.plate.ilike(f"%{plate}%")).all()
    if not vehicles:
        return err(f"No vehicles found matching '{plate}'", 404)

    result = []
    for vehicle in vehicles:
        violations = (
            Violation.query
            .filter_by(vehicle_id=vehicle.id)
            .order_by(Violation.created_at.desc())
            .all()
        )
        result.append({
            **vehicle.to_dict(),
            "violations": [
                {
                    "id": v.id,
                    "violation_type": v.violation_type,
                    "speed": v.speed,
                    "location": v.location,
                    "ai_status": v.ai_status,
                    "photo_url": v.photo_url,
                    "created_at": v.created_at.isoformat(),
                }
                for v in violations
            ],
        })

    return ok(data=result)

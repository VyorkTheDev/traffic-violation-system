from flask import Blueprint, request, g
from models import db, Vehicle
from middleware import token_required
from utils import ok, err, normalize_plate, validate_plate

vehicles_bp = Blueprint("vehicles", __name__, url_prefix="/api/vehicles")


@vehicles_bp.route("/", methods=["GET"])
@token_required
def list_vehicles():
    user = g.current_user
    if user.role == "admin":
        vehicles = Vehicle.query.order_by(Vehicle.created_at.desc()).all()
    else:
        vehicles = Vehicle.query.filter_by(owner_id=user.id).order_by(
            Vehicle.created_at.desc()
        ).all()
    return ok(data=[v.to_dict() for v in vehicles])


@vehicles_bp.route("/", methods=["POST"])
@token_required
def create_vehicle():
    data = request.get_json(silent=True) or {}
    plate = normalize_plate(data.get("plate") or "")
    brand = (data.get("brand") or "").strip()
    model = (data.get("model") or "").strip()
    year = data.get("year")

    if not plate or not brand or not model or not year:
        return err("plate, brand, model and year are required")

    if not validate_plate(plate):
        return err("Geçersiz plaka formatı. Beklenen: 34AB123 veya 34 AB 123", 400)

    try:
        year = int(year)
    except (ValueError, TypeError):
        return err("year must be a valid integer")

    if Vehicle.query.filter_by(plate=plate).first():
        return err(f"Plate '{plate}' is already registered", 409)

    try:
        vehicle = Vehicle(
            plate=plate, brand=brand, model=model, year=year,
            owner_id=g.current_user.id,
        )
        db.session.add(vehicle)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return err(f"Could not create vehicle: {str(e)}", 500)

    return ok(data=vehicle.to_dict(), code=201)


@vehicles_bp.route("/<int:vehicle_id>", methods=["DELETE"])
@token_required
def delete_vehicle(vehicle_id):
    vehicle = db.session.get(Vehicle, vehicle_id)
    if not vehicle:
        return err("Vehicle not found", 404)

    user = g.current_user
    if user.role != "admin" and vehicle.owner_id != user.id:
        return err("Access denied", 403)

    try:
        db.session.delete(vehicle)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return err(f"Could not delete vehicle: {str(e)}", 500)

    return ok(message=f"Vehicle '{vehicle.plate}' deleted")

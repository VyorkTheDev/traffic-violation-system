import os
import cloudinary
import cloudinary.uploader
from flask import Blueprint, request, g, current_app
from models import db, Vehicle, Violation
from middleware import token_required, role_required
from utils import ok, err, normalize_plate
import ai_service

violations_bp = Blueprint("violations", __name__, url_prefix="/api/violations")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}


def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _configure_cloudinary():
    """Cloudinary'yi config'den gelen değerlerle yapılandırır."""
    cloudinary.config(
        cloud_name=current_app.config["CLOUDINARY_CLOUD_NAME"],
        api_key=current_app.config["CLOUDINARY_API_KEY"],
        api_secret=current_app.config["CLOUDINARY_API_SECRET"],
    )


def _save_photo(file) -> tuple[str, str]:
    """
    Fotoğrafı Cloudinary'ye yükler.
    Döndürür: (photo_url, public_id)
    photo_url  → veritabanına kaydedilecek erişim URL'i
    public_id  → silme işlemi için Cloudinary kimliği
    """
    _configure_cloudinary()
    result = cloudinary.uploader.upload(
        file,
        folder="traffic_violations",   # Cloudinary'de klasör adı
        resource_type="image",
    )
    return result["secure_url"], result["public_id"]


def _delete_photo(public_id: str):
    """Cloudinary'den fotoğrafı siler."""
    if not public_id:
        return
    _configure_cloudinary()
    cloudinary.uploader.destroy(public_id)


def _with_vehicle(v: Violation) -> dict:
    data = v.to_dict()
    if v.vehicle:
        data["vehicle"] = {
            "plate": v.vehicle.plate,
            "brand": v.vehicle.brand,
            "model": v.vehicle.model,
        }
    return data


@violations_bp.route("/", methods=["GET"])
@token_required
def list_violations():
    user = g.current_user

    if user.role in ("police", "admin"):
        violations = Violation.query.order_by(Violation.created_at.desc()).all()
    else:
        owned_plates = [v.plate for v in Vehicle.query.filter_by(owner_id=user.id).all()]
        violations = (
            Violation.query
            .filter(Violation.plate.in_(owned_plates))
            .order_by(Violation.created_at.desc())
            .all()
        )

    return ok(data=[_with_vehicle(v) for v in violations])


@violations_bp.route("/<int:violation_id>", methods=["GET"])
@token_required
def get_violation(violation_id):
    violation = Violation.query.get(violation_id)
    if not violation:
        return err("Violation not found", 404)

    user = g.current_user
    if user.role not in ("police", "admin"):
        owned_plates = [v.plate for v in Vehicle.query.filter_by(owner_id=user.id).all()]
        if violation.plate not in owned_plates:
            return err("Access denied", 403)

    return ok(data=_with_vehicle(violation))


@violations_bp.route("/", methods=["POST"])
@role_required("police")
def create_violation():
    print("=== VIOLATION CREATION START ===", flush=True)

    photo = request.files.get("photo")
    plate = normalize_plate(request.form.get("plate") or "")
    location = (request.form.get("location") or "").strip()
    speed_raw = request.form.get("speed")
    speed_limit_raw = request.form.get("speed_limit")
    latitude_raw = request.form.get("latitude")
    longitude_raw = request.form.get("longitude")

    if photo:
        print(f"  Photo filename   : {photo.filename}", flush=True)
        print(f"  Photo mimetype   : {photo.mimetype}", flush=True)
    else:
        print("  Photo            : NOT received", flush=True)

    print(f"  Plate            : {plate!r}", flush=True)
    print(f"  Location         : {location!r}", flush=True)

    if not photo or not plate or not location:
        return err("photo, plate and location are required", 400)

    if not _allowed_file(photo.filename):
        return err(f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}", 400)

    vehicle = Vehicle.query.filter_by(plate=plate).first()
    if not vehicle:
        return err(f"No vehicle registered with plate '{plate}'", 404)

    speed = None
    if speed_raw is not None:
        try:
            speed = int(speed_raw)
        except (ValueError, TypeError):
            return err("speed must be an integer")

    speed_limit = None
    if speed_limit_raw is not None:
        try:
            speed_limit = int(speed_limit_raw)
        except (ValueError, TypeError):
            pass

    latitude = None
    if latitude_raw is not None:
        try:
            latitude = float(latitude_raw)
        except (ValueError, TypeError):
            pass

    longitude = None
    if longitude_raw is not None:
        try:
            longitude = float(longitude_raw)
        except (ValueError, TypeError):
            pass

    try:
        # Cloudinary'ye yükle, URL ve public_id al
        photo_url, photo_public_id = _save_photo(photo)
        print(f"  Cloudinary URL   : {photo_url}", flush=True)
        print(f"  Cloudinary PID   : {photo_public_id}", flush=True)

        violation = Violation(
            vehicle_id=vehicle.id,
            plate=plate,
            photo_url=photo_url,
            photo_public_id=photo_public_id,   # ← modele bu alan eklenmeli (aşağıya bak)
            speed=speed,
            speed_limit=speed_limit,
            location=location,
            latitude=latitude,
            longitude=longitude,
            violation_type={"phone": False, "smoking": False, "no_seatbelt": False},
            ai_status="pending",
            created_by=g.current_user.id,
        )
        db.session.add(violation)
        db.session.commit()
        print(f"  Violation #{violation.id} committed to DB", flush=True)
    except Exception as e:
        db.session.rollback()
        return err(f"Could not create violation: {str(e)}", 500)

    print("  Calling AI service...", flush=True)
    ai_service.trigger_async(current_app._get_current_object(), violation.id)
    print("=== VIOLATION CREATION END (AI running in background) ===", flush=True)

    return ok(data=violation.to_dict(), message="Violation created, AI analysis started", code=201)


@violations_bp.route("/<int:violation_id>", methods=["PUT"])
@role_required("police")
def update_violation(violation_id):
    violation = Violation.query.get(violation_id)
    if not violation:
        return err("Violation not found", 404)

    user = g.current_user
    if user.role != "admin" and violation.created_by != user.id:
        return err("Only the creator or admin can update this violation", 403)

    data = request.get_json(silent=True) or {}

    if "speed" in data:
        try:
            violation.speed = int(data["speed"]) if data["speed"] is not None else None
        except (ValueError, TypeError):
            return err("speed must be an integer")

    if "location" in data:
        location = (data["location"] or "").strip()
        if not location:
            return err("location cannot be empty")
        violation.location = location

    if "speed_limit" in data:
        violation.speed_limit = int(data["speed_limit"]) if data["speed_limit"] is not None else None
    if "latitude" in data:
        violation.latitude = float(data["latitude"]) if data["latitude"] is not None else None
    if "longitude" in data:
        violation.longitude = float(data["longitude"]) if data["longitude"] is not None else None

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return err(f"Could not update violation: {str(e)}", 500)

    return ok(data=violation.to_dict())


@violations_bp.route("/<int:violation_id>", methods=["DELETE"])
@role_required("police")
def delete_violation(violation_id):
    violation = Violation.query.get(violation_id)
    if not violation:
        return err("Violation not found", 404)

    user = g.current_user
    if user.role != "admin" and violation.created_by != user.id:
        return err("Only the creator or admin can delete this violation", 403)

    try:
        # Cloudinary'den fotoğrafı sil
        _delete_photo(getattr(violation, "photo_public_id", None))

        db.session.delete(violation)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return err(f"Could not delete violation: {str(e)}", 500)

    return ok(message=f"Violation #{violation_id} deleted")

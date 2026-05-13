from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)  # bcrypt hash
    role = db.Column(db.Enum("citizen", "police", "admin", name="user_role"), nullable=False, default="citizen")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    vehicles = db.relationship("Vehicle", backref="owner", lazy=True)
    violations_created = db.relationship("Violation", backref="creator", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat(),
        }


class Vehicle(db.Model):
    __tablename__ = "vehicles"

    id = db.Column(db.Integer, primary_key=True)
    plate = db.Column(db.String(20), unique=True, nullable=False)
    brand = db.Column(db.String(80), nullable=False)
    model = db.Column(db.String(80), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    violations = db.relationship("Violation", backref="vehicle", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "plate": self.plate,
            "brand": self.brand,
            "model": self.model,
            "year": self.year,
            "owner_id": self.owner_id,
            "created_at": self.created_at.isoformat(),
        }


class Violation(db.Model):
    __tablename__ = "violations"

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"), nullable=True)
    plate = db.Column(db.String(20), nullable=False)
    photo_url = db.Column(db.String(500), nullable=False)
    photo_public_id = db.Column(db.String(255), nullable=True)   # Cloudinary silme için
    speed = db.Column(db.Integer, nullable=True)
    speed_limit = db.Column(db.Integer, nullable=True)
    location = db.Column(db.String(255), nullable=False)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    violation_type = db.Column(db.JSON, nullable=False, default=lambda: {
        "phone": False,
        "smoking": False,
        "no_seatbelt": False,
    })
    ai_status = db.Column(
        db.Enum("pending", "processing", "completed", "failed", name="ai_status"),
        nullable=False,
        default="pending",
    )
    ai_result = db.Column(db.JSON, nullable=True)  # stores raw AI analysis output
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "vehicle_id": self.vehicle_id,
            "plate": self.plate,
            "photo_url": self.photo_url,
            "speed": self.speed,
            "speed_limit": self.speed_limit,
            "location": self.location,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "violation_type": self.violation_type,
            "ai_status": self.ai_status,
            "ai_result": self.ai_result,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
        }

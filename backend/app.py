import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from config import Config
from models import db
from utils import ok, err


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Ensure upload folder exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Extensions
    db.init_app(app)
    from extensions import limiter
    limiter.init_app(app)
    frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/")
    # Prodüksiyonda yalnızca FRONTEND_URL; geliştirmede localhost'a da izin ver
    allowed_origins = [frontend_url] if frontend_url else []
    if app.config["DEBUG"]:
        allowed_origins += [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ]
    allowed_origins = list(dict.fromkeys(o for o in allowed_origins if o))  # deduplicate

    CORS(app, resources={
        r"/api/*":     {"origins": allowed_origins, "supports_credentials": True},
        r"/uploads/*": {"origins": allowed_origins},
    })

    # Blueprints
    from routes.auth import auth_bp
    from routes.vehicles import vehicles_bp
    from routes.violations import violations_bp
    from routes.police import police_bp
    from routes.admin import admin_bp
    from routes.notifications import notifications_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(vehicles_bp)
    app.register_blueprint(violations_bp)
    app.register_blueprint(police_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(notifications_bp)

    # Yeni kurulumda tabloları oluştur.
    # Mevcut DB için: alembic upgrade head komutunu kullanın.
    with app.app_context():
        db.create_all()

    # Serve uploaded photos
    @app.get("/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    @app.get("/health")
    def health():
        return ok(message="Backend is running")

    # Global error handlers
    @app.errorhandler(400)
    def bad_request(e):
        return err(str(e.description), 400)

    @app.errorhandler(404)
    def not_found(e):
        return err("Resource not found", 404)

    @app.errorhandler(405)
    def method_not_allowed(e):
        return err("Method not allowed", 405)

    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        return err("Çok fazla istek. Lütfen bir dakika bekleyin.", 429)

    @app.errorhandler(500)
    def internal_error(e):
        db.session.rollback()
        return err("Internal server error", 500)

    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger

    def reset_points():
        with app.app_context():
            db.session.execute(db.text("UPDATE users SET points = 100, license_status = 'valid'"))
            db.session.commit()

    scheduler = BackgroundScheduler()
    scheduler.add_job(reset_points, CronTrigger(month=1, day=1, hour=0, minute=0))
    scheduler.start()

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=app.config["DEBUG"], port=5000)

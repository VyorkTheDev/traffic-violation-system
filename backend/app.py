import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from config import Config
from models import db
from utils import err


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Ensure upload folder exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Extensions
    db.init_app(app)
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    allowed_origins = list({
        frontend_url,
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    })
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
    app.register_blueprint(auth_bp)
    app.register_blueprint(vehicles_bp)
    app.register_blueprint(violations_bp)
    app.register_blueprint(police_bp)
    app.register_blueprint(admin_bp)

    # Create tables on first run + add new columns if missing
    with app.app_context():
        db.create_all()
        with db.engine.connect() as conn:
            conn.execute(db.text(
                "ALTER TABLE violations ADD COLUMN IF NOT EXISTS latitude FLOAT"
            ))
            conn.execute(db.text(
                "ALTER TABLE violations ADD COLUMN IF NOT EXISTS longitude FLOAT"
            ))
            conn.execute(db.text(
                "ALTER TABLE violations ADD COLUMN IF NOT EXISTS speed_limit INTEGER"
            ))
            conn.execute(db.text(
                "ALTER TABLE violations ADD COLUMN IF NOT EXISTS photo_public_id VARCHAR(255)"
            ))
            conn.commit()

    # Serve uploaded photos
    @app.get("/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    @app.get("/health")
    def health():
        from utils import ok
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

    @app.errorhandler(500)
    def internal_error(e):
        db.session.rollback()
        return err("Internal server error", 500)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=app.config["DEBUG"], port=5000)

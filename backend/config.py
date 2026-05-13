import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Flask
    SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key")
    DEBUG = os.getenv("FLASK_DEBUG", "False").lower() == "true"

    # Database
    # Eğer DATABASE_URL tanımlıysa (Neon.tech gibi cloud DB) onu kullan,
    # yoksa local PostgreSQL bağlantısını oluştur.
    _local_db = (
        f"postgresql://"
        f"{os.getenv('DB_USER', 'postgres')}:"
        f"{os.getenv('DB_PASSWORD', '')}@"
        f"{os.getenv('DB_HOST', 'localhost')}:"
        f"{os.getenv('DB_PORT', '5432')}/"
        f"{os.getenv('DB_NAME', 'traffic_db')}"
    )
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", _local_db)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # SSL sadece cloud DB (Neon.tech vb.) kullanılırken aktif olur
    SQLALCHEMY_ENGINE_OPTIONS = (
        {"connect_args": {"sslmode": "require"}}
        if os.getenv("DATABASE_URL")
        else {}
    )

    # JWT
    JWT_SECRET = os.getenv("SECRET_KEY", "fallback-secret-key")
    JWT_EXPIRATION_HOURS = 24

    # Anthropic
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

    # Cloudinary
    CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
    CLOUDINARY_API_KEY    = os.getenv("CLOUDINARY_API_KEY")
    CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

    # Uploads — absolute path so background threads always find the files
    _uploads_raw = os.getenv("UPLOAD_FOLDER", "uploadss")
    UPLOAD_FOLDER = _uploads_raw if os.path.isabs(_uploads_raw) else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), _uploads_raw
    )
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 16 * 1024 * 1024))
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

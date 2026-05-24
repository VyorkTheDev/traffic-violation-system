import os
from dotenv import load_dotenv

load_dotenv(override=True)

class Config:
    # Flask
    SECRET_KEY = os.getenv("SECRET_KEY")
    if not SECRET_KEY:
        raise RuntimeError(
            "SECRET_KEY ortam değişkeni tanımlı değil. "
            "Başlatmadan önce .env dosyasına veya ortama ekleyin."
        )
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
    JWT_SECRET = SECRET_KEY
    JWT_EXPIRATION_HOURS = 24

    # Anthropic
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    AI_MODEL          = os.getenv("AI_MODEL", "claude-sonnet-4-6")
    AI_MAX_RETRIES    = int(os.getenv("AI_MAX_RETRIES", "2"))

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
    
    MAIL_USERNAME = os.getenv("MAIL_USERNAME")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
    MAIL_FROM = os.getenv("MAIL_USERNAME")
    MAIL_SERVER = "smtp.gmail.com"
    MAIL_PORT = 587


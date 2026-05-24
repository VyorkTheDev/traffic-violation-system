import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Proje kökünü Python path'ine ekle
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import Config
from models import db

# Alembic Config nesnesi — alembic.ini değerlerine erişim sağlar
config = context.config

# Logging ayarla
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Modellerin metadata'sını hedef olarak tanımla (autogenerate için)
target_metadata = db.metadata

# DB URL'ini Flask Config'den al
config.set_main_option("sqlalchemy.url", Config.SQLALCHEMY_DATABASE_URI)


def run_migrations_offline() -> None:
    """Gerçek DB bağlantısı olmadan SQL üret (CI/CD dry-run)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Gerçek DB bağlantısı ile migration çalıştır."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

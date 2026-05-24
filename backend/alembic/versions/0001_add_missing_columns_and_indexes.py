"""add missing columns and indexes

Revision ID: 0001
Revises:
Create Date: 2026-05-24

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── violations tablosuna eksik kolonları ekle ──────────────────────────────
    op.execute("""
        ALTER TABLE violations
            ADD COLUMN IF NOT EXISTS latitude         FLOAT,
            ADD COLUMN IF NOT EXISTS longitude        FLOAT,
            ADD COLUMN IF NOT EXISTS speed_limit      INTEGER,
            ADD COLUMN IF NOT EXISTS photo_public_id  VARCHAR(255)
    """)

    # ── users tablosuna eksik kolonları ekle ──────────────────────────────────
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS points         INTEGER NOT NULL DEFAULT 100,
            ADD COLUMN IF NOT EXISTS license_status VARCHAR(20) NOT NULL DEFAULT 'valid'
    """)
    op.execute("UPDATE users SET points = 100 WHERE points IS NULL")
    op.execute("UPDATE users SET license_status = 'valid' WHERE license_status IS NULL")

    # ── index'leri ekle (IF NOT EXISTS — mevcut DB'de hata vermez) ────────────
    op.execute("CREATE INDEX IF NOT EXISTS ix_violations_plate      ON violations (plate)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_violations_created_by ON violations (created_by)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_violations_ai_status  ON violations (ai_status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_vehicles_owner_id     ON vehicles   (owner_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_vehicles_owner_id")
    op.execute("DROP INDEX IF EXISTS ix_violations_ai_status")
    op.execute("DROP INDEX IF EXISTS ix_violations_created_by")
    op.execute("DROP INDEX IF EXISTS ix_violations_plate")

    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS license_status")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS points")

    op.execute("ALTER TABLE violations DROP COLUMN IF EXISTS photo_public_id")
    op.execute("ALTER TABLE violations DROP COLUMN IF EXISTS speed_limit")
    op.execute("ALTER TABLE violations DROP COLUMN IF EXISTS longitude")
    op.execute("ALTER TABLE violations DROP COLUMN IF EXISTS latitude")

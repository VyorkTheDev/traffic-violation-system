"""add otp fields to users

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-24
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # is_verified: mevcut kullanıcılar OTP'siz kayıt olduğundan True başlatılır
    op.add_column("users", sa.Column(
        "is_verified",
        sa.Boolean(),
        nullable=False,
        server_default=sa.text("true"),
    ))
    op.add_column("users", sa.Column("otp_code",       sa.String(6),                  nullable=True))
    op.add_column("users", sa.Column("otp_expires_at", sa.DateTime(timezone=True),    nullable=True))

    # Migration sonrası server_default kaldır; yeni kayıtlar model default'unu (False) kullanır
    op.alter_column("users", "is_verified", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "otp_expires_at")
    op.drop_column("users", "otp_code")
    op.drop_column("users", "is_verified")

"""add points and license_status to users

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-06
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column(
        "points",
        sa.Integer(),
        nullable=False,
        server_default=sa.text("100"),
    ))
    op.add_column("users", sa.Column(
        "license_status",
        sa.String(20),
        nullable=False,
        server_default=sa.text("'valid'"),
    ))
    # Remove server_defaults so app-level defaults take over for new rows
    op.alter_column("users", "points",         server_default=None)
    op.alter_column("users", "license_status", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "license_status")
    op.drop_column("users", "points")

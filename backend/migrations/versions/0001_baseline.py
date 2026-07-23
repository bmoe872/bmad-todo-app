"""baseline (no feature tables)

Establishes the Alembic version chain for the project. Intentionally empty of
feature tables: the ``todos`` table lands in Story 2.1. This baseline enables the
``alembic upgrade head`` / ``downgrade base`` cycle (AD-11) and gives later
autogenerate runs a starting point.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-07-23

"""
from __future__ import annotations

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "0001_baseline"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """No-op baseline. Feature schema is introduced by later revisions."""
    pass


def downgrade() -> None:
    """No-op baseline reversal."""
    pass

"""create todos table

Additive, non-destructive migration (AD-11) introducing the sole domain entity
``todos`` (AD-3). The ``id`` default ``gen_random_uuid()`` requires the
``pgcrypto`` extension, so it is created (idempotently) before the table. A
``created_at DESC`` index backs the newest-first ordering query (FR-5). Schema
mirrors ``app.db.models.Todo`` exactly.

Revision ID: 0002_create_todos
Revises: 0001_baseline
Create Date: 2026-07-23

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002_create_todos"
down_revision: str | None = "0001_baseline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # gen_random_uuid() lives in pgcrypto on PostgreSQL < 18; create it first.
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.create_table(
        "todos",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "completed",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "char_length(description) BETWEEN 1 AND 500",
            name="ck_todos_description_length",
        ),
    )
    op.create_index(
        "ix_todos_created_at_desc",
        "todos",
        [sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_todos_created_at_desc", table_name="todos")
    op.drop_table("todos")
    # pgcrypto is intentionally left in place: dropping a shared extension is
    # destructive and non-idempotent (AD-11: migrations stay non-destructive).

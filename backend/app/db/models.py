"""SQLAlchemy ORM models.

AD-3: ``Todo`` is the sole domain entity. AD-2: models (like all SQLAlchemy
APIs) live in the ``db``/``repositories`` layers only. The table schema mirrors
the Alembic migration ``0002_create_todos`` exactly so ``Base.metadata`` is a
faithful single source of truth for ``--autogenerate``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Index,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Todo(Base):
    """A single Todo item (AD-3).

    Wire shape: ``{ id, description, completed, created_at }``. No ``owner_id``
    and no auth in v1 — the owner-scoping seam (AD-9) attaches at the repository
    query, not on the model.
    """

    __tablename__ = "todos"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    completed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        # Enforce the shared length rule at the storage boundary too (AD-5,
        # NFR-Sec) — defense in depth alongside the Pydantic/service validation.
        CheckConstraint(
            "char_length(description) BETWEEN 1 AND 500",
            name="ck_todos_description_length",
        ),
        # Supports the newest-first ordering query (AD-3, FR-5).
        Index("ix_todos_created_at_desc", text("created_at DESC")),
    )

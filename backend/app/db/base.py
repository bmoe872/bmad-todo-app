"""SQLAlchemy declarative base.

The single ``Base`` all ORM models inherit from. Its ``metadata`` is the target
for Alembic autogenerate. No feature models are registered here in Story 1.2;
the ``Todo`` model lands in Story 2.1.
"""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""

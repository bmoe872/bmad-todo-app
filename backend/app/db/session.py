"""Synchronous SQLAlchemy engine, session factory, and per-request dependency.

AD-12: the backend uses synchronous SQLAlchemy 2.0 + psycopg 3; FastAPI runs
sync path operations in its threadpool. Exactly one session is provided per
request via the ``get_db`` dependency and closed at request end. No async DB
layer in v1. SQLAlchemy session/query APIs live only here and in
``app/repositories`` (AD-2).
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.errors import DatabaseUnavailableError
from app.core.logging import get_logger


def create_db_engine(database_url: str | None = None) -> Engine:
    """Create the synchronous SQLAlchemy engine.

    ``pool_pre_ping`` guards against stale connections after a DB restart so a
    dropped connection surfaces as a clean retry rather than a hard error.
    """
    url = database_url or get_settings().database_url
    return create_engine(url, pool_pre_ping=True, future=True)


# Module-level engine + session factory bound to the configured DATABASE_URL.
engine: Engine = create_db_engine()
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
    class_=Session,
)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding one session per request, closed at end."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_connection(db: Session) -> None:
    """Perform a lightweight DB round-trip for readiness checks.

    Keeps SQLAlchemy query APIs in the db layer (AD-2): the health route calls
    this instead of importing SQLAlchemy itself. Raises
    ``DatabaseUnavailableError`` (503) on failure and logs it, so the process
    never crashes on an unreachable DB.
    """
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        get_logger().error("health_db_check_failed", extra={"code": "db_unavailable"})
        raise DatabaseUnavailableError() from exc

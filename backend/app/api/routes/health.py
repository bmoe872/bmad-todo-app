"""Health / readiness endpoint.

API Contract: ``GET /api/health`` -> ``200 { "status": "ok", "db": "ok" }``
after a real DB round-trip; ``503`` if the DB is unreachable. This is liveness
plus readiness (FR-4). The DB round-trip is delegated to the db layer
(``check_connection``) so no SQLAlchemy query API is imported in the route (AD-2);
it flows through the standard per-request session dependency (AD-12).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import check_connection, get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    """Return liveness + DB readiness after a real DB round-trip."""
    check_connection(db)
    return {"status": "ok", "db": "ok"}

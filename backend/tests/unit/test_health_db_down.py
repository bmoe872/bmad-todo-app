"""Unit test: health endpoint returns 503 (not a crash) when the DB is down.

Overrides the per-request session dependency with a stub whose ``execute``
raises a SQLAlchemy error, proving the endpoint remaps to a 503 AD-5 envelope
and the process does not crash. No real DB is used.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db.session import get_db
from app.main import create_app


class _BrokenSession:
    """Stand-in Session whose DB round-trip always fails."""

    def execute(self, *_args, **_kwargs):
        raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    def close(self) -> None:  # pragma: no cover - trivial
        pass


def _broken_get_db():
    yield _BrokenSession()


def test_health_returns_503_when_db_unreachable() -> None:
    app = create_app()
    app.dependency_overrides[get_db] = _broken_get_db
    # raise_server_exceptions defaults True; a 503 AppError is handled, so the
    # client sees a clean 503 and the app never crashes.
    client = TestClient(app)
    resp = client.get("/api/health")
    assert resp.status_code == 503
    body = resp.json()
    assert body["error"]["code"] == "db_unavailable"
    assert set(body.keys()) == {"error"}

"""Integration test fixtures: real Postgres + transactional-rollback isolation.

This establishes the reusable pattern for Epic 2: each test runs inside a
transaction that is rolled back afterward, so tests never persist data and stay
independent. Implements SQLAlchemy 2.0's "join an external transaction" recipe
(outer transaction + SAVEPOINT restart on nested commit).

The suite requires a reachable test Postgres. The DSN is taken from
``TEST_DATABASE_URL`` (falls back to the local dev DSN on port 5433 used by the
standalone test container). If no DB is reachable, the whole integration suite
is skipped with a clear reason — never faked green.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.main import create_app

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://todo:todo@localhost:5433/todo",
)


def _db_reachable(url: str) -> bool:
    try:
        eng = create_engine(url, pool_pre_ping=True, future=True)
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        eng.dispose()
        return True
    except SQLAlchemyError:
        return False


# Gate the entire integration suite on DB reachability. A module-level
# `pytestmark` in conftest.py does NOT propagate to sibling test modules, so we
# skip every collected integration item via a collection hook instead — this is
# honest gating (never a faked pass) when no test Postgres is available.
_REACHABLE = _db_reachable(TEST_DATABASE_URL)
_SKIP_REASON = (
    f"No test Postgres reachable at {TEST_DATABASE_URL}. "
    "Start one (e.g. `docker run -d --name todo-test-pg -e POSTGRES_USER=todo "
    "-e POSTGRES_PASSWORD=todo -e POSTGRES_DB=todo -p 5433:5432 postgres:17`) "
    "or set TEST_DATABASE_URL."
)


def pytest_collection_modifyitems(config, items) -> None:
    """Skip all integration tests when the test Postgres is unreachable."""
    if _REACHABLE:
        return
    skip_marker = pytest.mark.skip(reason=_SKIP_REASON)
    integration_root = str(__import__("pathlib").Path(__file__).parent)
    for item in items:
        if str(item.fspath).startswith(integration_root):
            item.add_marker(skip_marker)


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    eng = create_engine(TEST_DATABASE_URL, pool_pre_ping=True, future=True)
    yield eng
    eng.dispose()


@pytest.fixture()
def db_session(engine: Engine) -> Iterator[Session]:
    """Yield a Session bound to a transaction that is rolled back after the test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session: Session):
    """FastAPI TestClient whose get_db yields the rolled-back test session."""
    from fastapi.testclient import TestClient

    app = create_app()

    def _override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

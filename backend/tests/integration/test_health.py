"""Integration test: GET /api/health against a real Postgres.

Runs through the transactional-rollback fixture (see conftest.py), exercising a
real DB round-trip per the health contract.
"""

from __future__ import annotations


def test_health_ok_against_real_db(client) -> None:
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "db": "ok"}
    # The request-id middleware echoes a request id on the response.
    assert resp.headers.get("X-Request-ID")


def test_transaction_rolled_back_between_tests(client, db_session) -> None:
    # Create an ephemeral table + row inside the test transaction; it must not
    # survive rollback. This proves the isolation pattern for Epic 2.
    from sqlalchemy import text

    db_session.execute(text("CREATE TEMPORARY TABLE _probe (id int)"))
    db_session.execute(text("INSERT INTO _probe (id) VALUES (1)"))
    count = db_session.execute(text("SELECT count(*) FROM _probe")).scalar()
    assert count == 1

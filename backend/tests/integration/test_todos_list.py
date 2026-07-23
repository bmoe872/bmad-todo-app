"""Integration: GET /api/todos ordering + shape against a real Postgres.

Verifies FR-4/FR-5/AD-3: newest-first by created_at DESC with id tiebreak,
snake_case keys, and Z-suffixed timestamps. Empty DB returns an empty list.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from app.db.models import Todo


def test_empty_db_returns_empty_list(client) -> None:
    resp = client.get("/api/todos")
    assert resp.status_code == 200
    assert resp.json() == {"todos": []}


def test_list_ordered_created_at_desc(client, db_session) -> None:
    base = datetime(2026, 7, 23, 12, 0, 0, tzinfo=UTC)
    older = Todo(description="older", created_at=base)
    middle = Todo(description="middle", created_at=base + timedelta(minutes=5))
    newer = Todo(description="newer", created_at=base + timedelta(minutes=10))
    db_session.add_all([older, middle, newer])
    db_session.commit()

    body = client.get("/api/todos").json()
    descriptions = [t["description"] for t in body["todos"]]
    assert descriptions == ["newer", "middle", "older"]


def test_id_tiebreak_for_equal_created_at(client, db_session) -> None:
    ts = datetime(2026, 7, 23, 9, 0, 0, tzinfo=UTC)
    # Two rows with identical created_at; deterministic order by id DESC.
    id_low = uuid.UUID("00000000-0000-0000-0000-000000000001")
    id_high = uuid.UUID("00000000-0000-0000-0000-000000000002")
    db_session.add_all(
        [
            Todo(id=id_low, description="low-id", created_at=ts),
            Todo(id=id_high, description="high-id", created_at=ts),
        ]
    )
    db_session.commit()

    ids = [t["id"] for t in client.get("/api/todos").json()["todos"]]
    assert ids == [str(id_high), str(id_low)]


def test_list_keys_snake_case_and_z_suffix(client, db_session) -> None:
    db_session.add(
        Todo(
            description="check shape",
            created_at=datetime(2026, 7, 23, 8, 0, 0, tzinfo=UTC),
        )
    )
    db_session.commit()

    todo = client.get("/api/todos").json()["todos"][0]
    assert set(todo.keys()) == {"id", "description", "completed", "created_at"}
    assert todo["created_at"].endswith("Z")

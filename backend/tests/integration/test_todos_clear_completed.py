"""Integration: DELETE /api/todos/completed against a real Postgres.

Verifies the AD-7 deferred-commit / id-snapshot semantics (FR-9):
- snapshot-scoped delete removes only still-completed snapshot rows;
- an omitted body clears all completed;
- active rows always survive;
- a re-activated snapshot id is NOT swept;
- no-op cases return {"deleted": 0};
- the route-ordering guard proves `/completed` is not captured by `/{id}`.

Runs inside the transactional-rollback fixture (conftest), so seeded rows never
persist. Because there is no toggle endpoint in this worktree (Story 2.2), the
`completed` flag is set directly on inserted rows via the test session.

Note: the endpoint commits on the SAME session the fixture yields, which expires
seeded ORM instances; so each test captures ids as strings BEFORE issuing the
DELETE (reading a deleted row's attributes afterward would trigger a reload).
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.db.models import Todo


def _make_todo(db: Session, description: str, *, completed: bool) -> str:
    """Insert a Todo with an explicit completed flag; return its id as a string."""
    todo = Todo(description=description, completed=completed)
    db.add(todo)
    db.flush()
    return str(todo.id)


def _ids(client) -> set[str]:
    return {t["id"] for t in client.get("/api/todos").json()["todos"]}


def test_snapshot_deletes_only_completed_in_snapshot(client, db_session) -> None:
    c1 = _make_todo(db_session, "done 1", completed=True)
    c2 = _make_todo(db_session, "done 2", completed=True)
    c3 = _make_todo(db_session, "done 3", completed=True)
    a1 = _make_todo(db_session, "active 1", completed=False)
    a2 = _make_todo(db_session, "active 2", completed=False)

    resp = client.request("DELETE", "/api/todos/completed", json={"ids": [c1, c2]})
    assert resp.status_code == 200
    assert resp.json() == {"deleted": 2}

    # c3 (completed, not in snapshot) and both actives survive.
    assert _ids(client) == {c3, a1, a2}


def test_reactivated_snapshot_id_is_not_swept(client, db_session) -> None:
    # A todo that was completed at snapshot time but is now active must NOT be
    # deleted even though its id is in the snapshot (AD-7 "still completed").
    still_done = _make_todo(db_session, "still done", completed=True)
    reactivated = _make_todo(db_session, "reactivated", completed=False)

    resp = client.request(
        "DELETE",
        "/api/todos/completed",
        json={"ids": [still_done, reactivated]},
    )
    assert resp.status_code == 200
    assert resp.json() == {"deleted": 1}

    survivors = _ids(client)
    assert reactivated in survivors
    assert still_done not in survivors


def test_omitted_body_clears_all_completed(client, db_session) -> None:
    _make_todo(db_session, "done 1", completed=True)
    _make_todo(db_session, "done 2", completed=True)
    a1 = _make_todo(db_session, "active", completed=False)

    resp = client.request("DELETE", "/api/todos/completed")
    assert resp.status_code == 200
    assert resp.json() == {"deleted": 2}
    assert _ids(client) == {a1}


def test_no_completed_is_noop(client, db_session) -> None:
    a1 = _make_todo(db_session, "active 1", completed=False)
    a2 = _make_todo(db_session, "active 2", completed=False)

    resp = client.request("DELETE", "/api/todos/completed")
    assert resp.status_code == 200
    assert resp.json() == {"deleted": 0}
    assert _ids(client) == {a1, a2}


def test_empty_snapshot_is_noop(client, db_session) -> None:
    # An explicit empty snapshot deletes nothing even though completed rows exist.
    c1 = _make_todo(db_session, "done", completed=True)
    a1 = _make_todo(db_session, "active", completed=False)

    resp = client.request("DELETE", "/api/todos/completed", json={"ids": []})
    assert resp.status_code == 200
    assert resp.json() == {"deleted": 0}
    assert _ids(client) == {c1, a1}


def test_snapshot_with_unknown_ids_deletes_intersection_only(client, db_session) -> None:
    # Snapshot ids that do not exist are simply not matched; only the existing
    # still-completed row is deleted. deleted count reflects the actual removal.
    c1 = _make_todo(db_session, "done", completed=True)
    a1 = _make_todo(db_session, "active", completed=False)
    ghost = str(uuid.uuid4())

    resp = client.request("DELETE", "/api/todos/completed", json={"ids": [c1, ghost]})
    assert resp.status_code == 200
    assert resp.json() == {"deleted": 1}
    assert _ids(client) == {a1}


def test_malformed_ids_returns_422_envelope(client) -> None:
    # A non-UUID element fails Pydantic validation -> centralized AD-5 envelope.
    resp = client.request(
        "DELETE",
        "/api/todos/completed",
        json={"ids": ["not-a-uuid"]},
    )
    assert resp.status_code == 422
    body = resp.json()
    assert "error" in body
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["details"][0]["field"] == "ids.0"


def test_route_ordering_completed_not_captured_as_id(client, db_session) -> None:
    # MERGE GUARD (AD-4 route-ordering hazard): `DELETE /api/todos/completed`
    # MUST resolve to the clear-completed handler, NOT be interpreted as a
    # single-resource delete of id "completed". This must hold on THIS branch
    # (only /completed exists) and after Story 2.2 merges its UUID-typed
    # `DELETE /{id}` route below /completed. We assert the response is the
    # clear-completed body shape (`deleted` key), never a 404/422 that would
    # signal `/completed` was routed to `/{id}`.
    _make_todo(db_session, "done", completed=True)

    resp = client.request("DELETE", "/api/todos/completed", json={"ids": None})
    assert resp.status_code == 200
    body = resp.json()
    assert "deleted" in body
    assert isinstance(body["deleted"], int)
    # Not treated as an id path: no 404 ("todo not found") / no 422 (bad UUID).
    assert resp.status_code not in (404, 422)

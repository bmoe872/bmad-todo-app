"""Integration: PATCH /api/todos/{id} against a real Postgres (rollback fixture).

Verifies the toggle contract (FR-2, AD-3, AD-5): 200 + persisted flip in both
directions, only ``completed`` mutable, ordering unchanged, 404 for a missing
id, and 422 for a missing / non-boolean body.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from app.db.models import Todo


def _create(client, description: str = "Task") -> dict:
    resp = client.post("/api/todos", json={"description": description})
    assert resp.status_code == 201
    return resp.json()


def test_patch_sets_completed_true_then_false(client) -> None:
    todo = _create(client, "Toggle me")
    todo_id = todo["id"]

    # active -> completed
    resp = client.patch(f"/api/todos/{todo_id}", json={"completed": True})
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == todo_id
    assert body["completed"] is True
    # description / created_at are untouched (only `completed` mutable).
    assert body["description"] == todo["description"]
    assert body["created_at"] == todo["created_at"]

    # completed -> active (both directions persist — verify via GET)
    resp = client.patch(f"/api/todos/{todo_id}", json={"completed": False})
    assert resp.status_code == 200
    assert resp.json()["completed"] is False

    listing = client.get("/api/todos").json()["todos"]
    match = [t for t in listing if t["id"] == todo_id]
    assert len(match) == 1
    assert match[0]["completed"] is False


def test_patch_persists_completed_flag(client) -> None:
    todo = _create(client, "Persist flag")
    client.patch(f"/api/todos/{todo['id']}", json={"completed": True})
    listing = client.get("/api/todos").json()["todos"]
    assert [t for t in listing if t["id"] == todo["id"]][0]["completed"] is True


def test_patch_extra_keys_do_not_edit_description(client) -> None:
    todo = _create(client, "Original text")
    resp = client.patch(
        f"/api/todos/{todo['id']}",
        json={"completed": True, "description": "HACKED"},
    )
    assert resp.status_code == 200
    # Only `completed` is mutable; the extra `description` key is ignored.
    assert resp.json()["description"] == "Original text"


def test_patch_does_not_reorder_list(client, db_session) -> None:
    # Insert with explicit, distinct created_at for a deterministic order.
    # (The rollback fixture runs one transaction, so DB now() would be identical
    # for API-created rows — set created_at directly, mirroring test_todos_list.)
    base = datetime(2026, 7, 23, 12, 0, 0, tzinfo=UTC)
    older = Todo(description="Older", created_at=base)
    newer = Todo(description="Newer", created_at=base + timedelta(minutes=10))
    db_session.add_all([older, newer])
    db_session.commit()

    ids_before = [t["id"] for t in client.get("/api/todos").json()["todos"]]
    assert ids_before == [str(newer.id), str(older.id)]  # newest-first

    # Toggle the OLDER item — position must not change (AD-3, FR-5).
    client.patch(f"/api/todos/{older.id}", json={"completed": True})
    ids_after = [t["id"] for t in client.get("/api/todos").json()["todos"]]
    assert ids_after == [str(newer.id), str(older.id)]


def test_patch_missing_id_returns_404_envelope(client) -> None:
    resp = client.patch(f"/api/todos/{uuid.uuid4()}", json={"completed": True})
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "not_found"
    assert "message" in body["error"]


def test_patch_missing_completed_returns_422(client) -> None:
    todo = _create(client, "Needs body")
    resp = client.patch(f"/api/todos/{todo['id']}", json={})
    assert resp.status_code == 422
    body = resp.json()
    assert body["error"]["code"] == "validation_error"
    assert any(d["field"] == "completed" for d in body["error"]["details"])


def test_patch_non_boolean_completed_returns_422(client) -> None:
    todo = _create(client, "Strict bool")
    for bad in ["yes", 1]:
        resp = client.patch(f"/api/todos/{todo['id']}", json={"completed": bad})
        assert resp.status_code == 422, f"expected 422 for completed={bad!r}"
        assert resp.json()["error"]["code"] == "validation_error"


def test_patch_malformed_uuid_returns_422(client) -> None:
    # UUID-typed path param: a non-UUID id is a path-validation 422 (AD-4).
    resp = client.patch("/api/todos/not-a-uuid", json={"completed": True})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"

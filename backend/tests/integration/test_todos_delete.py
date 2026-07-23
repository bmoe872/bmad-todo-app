"""Integration: DELETE /api/todos/{id} against a real Postgres (rollback fixture).

Verifies the delete contract (FR-3, AD-5): 204 + row permanently gone, 404 for
a missing / already-deleted id, and that unrelated rows are unaffected.
"""

from __future__ import annotations

import uuid


def _create(client, description: str = "Task") -> dict:
    resp = client.post("/api/todos", json={"description": description})
    assert resp.status_code == 201
    return resp.json()


def test_delete_existing_returns_204_and_empty_body(client) -> None:
    todo = _create(client, "Delete me")
    resp = client.delete(f"/api/todos/{todo['id']}")
    assert resp.status_code == 204
    assert resp.content == b""


def test_delete_removes_row(client) -> None:
    todo = _create(client, "Gone soon")
    client.delete(f"/api/todos/{todo['id']}")
    listing = client.get("/api/todos").json()["todos"]
    assert all(t["id"] != todo["id"] for t in listing)


def test_delete_missing_id_returns_404_envelope(client) -> None:
    resp = client.delete(f"/api/todos/{uuid.uuid4()}")
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "not_found"
    assert "message" in body["error"]


def test_delete_twice_second_is_404(client) -> None:
    todo = _create(client, "Double delete")
    assert client.delete(f"/api/todos/{todo['id']}").status_code == 204
    # already gone -> 404 (client treats as already-gone, reconciles).
    assert client.delete(f"/api/todos/{todo['id']}").status_code == 404


def test_delete_leaves_other_rows_untouched(client) -> None:
    keep = _create(client, "Keep me")
    drop = _create(client, "Drop me")
    client.delete(f"/api/todos/{drop['id']}")
    listing = client.get("/api/todos").json()["todos"]
    remaining_ids = [t["id"] for t in listing]
    assert keep["id"] in remaining_ids
    assert drop["id"] not in remaining_ids


def test_delete_malformed_uuid_returns_422(client) -> None:
    resp = client.delete("/api/todos/not-a-uuid")
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"

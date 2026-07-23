"""Integration: POST /api/todos against a real Postgres (rollback fixture).

Verifies the create contract (FR-1): 201, correct body shape, trimming, and a
real persisted row.
"""

from __future__ import annotations


def test_create_returns_201_and_correct_body(client) -> None:
    resp = client.post("/api/todos", json={"description": "Buy milk"})
    assert resp.status_code == 201
    body = resp.json()
    assert set(body.keys()) == {"id", "description", "completed", "created_at"}
    assert body["description"] == "Buy milk"
    assert body["completed"] is False
    # id is a UUID string.
    import uuid

    uuid.UUID(body["id"])
    # created_at is ISO-8601 UTC with a Z suffix (AD-3, contract).
    assert body["created_at"].endswith("Z")


def test_create_persists_row(client) -> None:
    client.post("/api/todos", json={"description": "Persist me"})
    listing = client.get("/api/todos").json()
    assert len(listing["todos"]) == 1
    assert listing["todos"][0]["description"] == "Persist me"


def test_create_trims_description(client) -> None:
    resp = client.post("/api/todos", json={"description": "   Trim me   "})
    assert resp.status_code == 201
    assert resp.json()["description"] == "Trim me"


def test_create_response_keys_are_snake_case(client) -> None:
    body = client.post("/api/todos", json={"description": "snake"}).json()
    # created_at (not createdAt) — snake_case wire contract.
    assert "created_at" in body
    assert "createdAt" not in body

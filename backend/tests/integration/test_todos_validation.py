"""Integration: POST /api/todos invalid input -> 422 AD-5 envelope, zero rows.

Verifies FR-1/FR-7/AD-5/NFR-Sec: each invalid description is rejected with the
uniform error envelope naming the field, and no row is created.
"""

from __future__ import annotations

import pytest

INVALID_CASES = {
    "empty": "",
    "whitespace_only": "   ",
    "embedded_newline": "line1\nline2",
    "tab_control_char": "a\tb",
    "too_long": "x" * 501,
}


@pytest.mark.parametrize("case", list(INVALID_CASES.values()), ids=list(INVALID_CASES))
def test_invalid_description_returns_422_envelope(client, case: str) -> None:
    resp = client.post("/api/todos", json={"description": case})
    assert resp.status_code == 422
    body = resp.json()
    # AD-5 envelope shape.
    assert set(body.keys()) == {"error"}
    error = body["error"]
    assert "code" in error
    assert "message" in error
    assert "details" in error
    assert isinstance(error["details"], list) and error["details"]
    first = error["details"][0]
    assert set(first.keys()) >= {"field", "issue"}
    assert first["field"] == "description"


@pytest.mark.parametrize("case", list(INVALID_CASES.values()), ids=list(INVALID_CASES))
def test_invalid_description_creates_no_row(client, case: str) -> None:
    client.post("/api/todos", json={"description": case})
    listing = client.get("/api/todos").json()
    assert listing["todos"] == []


def test_missing_description_field_returns_422(client) -> None:
    resp = client.post("/api/todos", json={})
    assert resp.status_code == 422
    assert resp.json()["error"]["details"][0]["field"] == "description"

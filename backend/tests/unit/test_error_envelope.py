"""Unit tests for the centralized AD-5 error envelope handlers.

Verifies that a raised ``AppError``, FastAPI's native ``RequestValidationError``,
and an unexpected exception each map to the exact envelope shape/keys, with no
DB or network involved.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.errors import AppError, register_exception_handlers


class _Body(BaseModel):
    description: str


def _build_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom")
    def boom() -> None:
        raise AppError(
            code="teapot",
            message="I am a teapot",
            status_code=418,
            details=[{"field": "kettle", "issue": "wrong vessel"}],
        )

    @app.get("/crash")
    def crash() -> None:
        raise RuntimeError("unexpected internal failure")

    @app.post("/validate")
    def validate(body: _Body) -> dict[str, str]:
        return {"description": body.description}

    return app


def _client() -> TestClient:
    # Do not raise server exceptions so the catch-all 500 handler is exercised.
    return TestClient(_build_app(), raise_server_exceptions=False)


def test_app_error_maps_to_envelope() -> None:
    resp = _client().get("/boom")
    assert resp.status_code == 418
    body = resp.json()
    assert set(body.keys()) == {"error"}
    err = body["error"]
    assert err["code"] == "teapot"
    assert err["message"] == "I am a teapot"
    assert err["details"] == [{"field": "kettle", "issue": "wrong vessel"}]


def test_request_validation_error_remapped_to_envelope() -> None:
    # Missing required "description" triggers RequestValidationError -> 422 envelope.
    resp = _client().post("/validate", json={})
    assert resp.status_code == 422
    body = resp.json()
    assert set(body.keys()) == {"error"}
    err = body["error"]
    assert err["code"] == "validation_error"
    assert isinstance(err["details"], list) and err["details"]
    detail = err["details"][0]
    assert set(detail.keys()) == {"field", "issue"}
    assert detail["field"] == "description"


def test_unexpected_exception_maps_to_500_envelope_without_leaking() -> None:
    resp = _client().get("/crash")
    assert resp.status_code == 500
    body = resp.json()
    assert body["error"]["code"] == "internal_error"
    # Internal detail must not leak to the client.
    assert "unexpected internal failure" not in body["error"]["message"]

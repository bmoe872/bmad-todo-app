"""Unit tests for structured JSON request logging.

Verifies the app emits exactly one structured JSON log line per request and that
the line carries a ``request_id`` and parses as JSON.
"""

from __future__ import annotations

import io
import json
import logging

from fastapi.testclient import TestClient

from app.core.logging import LOGGER_NAME, JsonFormatter
from app.main import create_app


def test_json_formatter_emits_parseable_line_with_extras() -> None:
    formatter = JsonFormatter()
    record = logging.LogRecord(
        name=LOGGER_NAME,
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="request",
        args=(),
        exc_info=None,
    )
    record.request_id = "abc-123"
    record.status = 200
    line = formatter.format(record)
    payload = json.loads(line)
    assert payload["message"] == "request"
    assert payload["level"] == "info"
    assert payload["request_id"] == "abc-123"
    assert payload["status"] == 200


def test_request_emits_single_json_log_line_with_request_id() -> None:
    # Build the app first: create_app() calls configure_logging(), which resets
    # the logger's handlers. Attach the in-memory capture handler AFTERWARD.
    app = create_app()

    @app.get("/api/_ping")
    def _ping() -> dict[str, bool]:
        return {"ok": True}

    logger = logging.getLogger(LOGGER_NAME)
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    try:
        client = TestClient(app)
        resp = client.get("/api/_ping")
        assert resp.status_code == 200
    finally:
        logger.removeHandler(handler)

    lines = [ln for ln in stream.getvalue().strip().splitlines() if ln]
    # Exactly one request line for the single request.
    request_lines = [ln for ln in lines if json.loads(ln).get("message") == "request"]
    assert len(request_lines) == 1
    payload = json.loads(request_lines[0])
    assert payload["request_id"]
    assert payload["method"] == "GET"
    assert payload["path"] == "/api/_ping"
    assert payload["status"] == 200
    # request id is echoed on the response header
    assert resp.headers["X-Request-ID"] == payload["request_id"]

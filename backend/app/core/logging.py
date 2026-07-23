"""Structured JSON logging to stdout.

Both services emit structured JSON logs to stdout (viewable via
`docker-compose logs`); the backend writes one line per request carrying a
request id. This module installs a stdlib-logging JSON formatter (no external
logging dependency) and exposes helpers to configure logging and to bind a
request id onto emitted records.
"""

from __future__ import annotations

import json
import logging
import sys
from typing import Any

LOGGER_NAME = "nearform_todo_app"

# Standard LogRecord attributes; anything else on the record is treated as a
# structured "extra" field and merged into the JSON payload.
_RESERVED_ATTRS = frozenset(
    logging.makeLogRecord({}).__dict__.keys()
    | {"message", "asctime", "taskName"}
)


class JsonFormatter(logging.Formatter):
    """Render each log record as a single-line JSON object on stdout."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)

        # Merge any structured extras (e.g. request_id, method, path, status).
        for key, value in record.__dict__.items():
            if key not in _RESERVED_ATTRS and not key.startswith("_"):
                payload[key] = value

        return json.dumps(payload, default=str)


def configure_logging(level: str = "info") -> logging.Logger:
    """Configure the application logger to emit JSON to stdout.

    Idempotent: replaces existing handlers so repeated ``create_app()`` calls
    (e.g. across tests) do not stack duplicate handlers.
    """
    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(JsonFormatter())

    logger.handlers = [handler]
    logger.propagate = False
    return logger


def get_logger() -> logging.Logger:
    """Return the shared application logger."""
    return logging.getLogger(LOGGER_NAME)

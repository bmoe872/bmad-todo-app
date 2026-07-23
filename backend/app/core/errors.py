"""Centralized error handling and the uniform AD-5 JSON error envelope.

AD-5: every non-2xx response is
``{ "error": { "code": string, "message": string, "details"?: [{field, issue}] } }``,
produced by centralized FastAPI exception handlers — including a handler that
remaps FastAPI's native ``RequestValidationError`` into this same envelope so
the client parses one error shape everywhere.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger


class AppError(Exception):
    """Base application error carrying the AD-5 envelope fields.

    Feature code raises subclasses (or ``AppError`` directly) instead of
    hand-building responses, so every failure funnels through one handler and
    one shape.
    """

    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int = 500,
        details: list[dict[str, str]] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class DatabaseUnavailableError(AppError):
    """Raised when a required DB round-trip fails (maps to 503)."""

    def __init__(self, message: str = "Database is unavailable") -> None:
        super().__init__(
            code="db_unavailable",
            message=message,
            status_code=503,
        )


class NotFoundError(AppError):
    """Raised when a requested resource does not exist (maps to 404).

    Flows through ``_handle_app_error`` into the uniform AD-5 envelope with a
    stable ``code`` ("not_found") — preferred over ``HTTPException(404)`` (which
    would yield ``code="http_404"``) so failures stay funneled through
    ``AppError`` like the rest of the service layer. ``message`` is overridable
    so other resources can reuse it.
    """

    def __init__(self, message: str = "Todo not found") -> None:
        super().__init__(
            code="not_found",
            message=message,
            status_code=404,
        )


def _envelope(
    code: str, message: str, details: list[dict[str, str]] | None = None
) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if details:
        error["details"] = details
    return {"error": error}


def register_exception_handlers(app: FastAPI) -> None:
    """Install the centralized AD-5 exception handlers on ``app``."""
    logger = get_logger()

    @app.exception_handler(AppError)
    async def _handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        # 5xx are unexpected; log at error. 4xx are client faults; log at warning.
        log = logger.error if exc.status_code >= 500 else logger.warning
        log(
            "request_error",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "code": exc.code,
                "status": exc.status_code,
            },
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details: list[dict[str, str]] = []
        _sources = ("body", "query", "path")
        for err in exc.errors():
            # loc is a tuple like ("body", "description"); drop the source prefix.
            loc = [str(part) for part in err.get("loc", ()) if part not in _sources]
            field = ".".join(loc) if loc else "__root__"
            details.append({"field": field, "issue": err.get("msg", "invalid value")})
        logger.warning(
            "validation_error",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "code": "validation_error",
                "status": 422,
            },
        )
        return JSONResponse(
            status_code=422,
            content=_envelope("validation_error", "Request validation failed", details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http_exception(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        # Map framework HTTPExceptions (e.g. 404) into the same envelope.
        code = f"http_{exc.status_code}"
        message = exc.detail if isinstance(exc.detail, str) else "HTTP error"
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(code, message),
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        # Catch-all: never leak internals to the client; log full detail.
        logger.error(
            "unhandled_error",
            exc_info=exc,
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "code": "internal_error",
                "status": 500,
            },
        )
        return JSONResponse(
            status_code=500,
            content=_envelope("internal_error", "An internal server error occurred"),
        )

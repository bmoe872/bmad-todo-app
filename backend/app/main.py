"""FastAPI application factory, middleware, and ASGI entrypoint.

``create_app()`` builds and returns a fully wired ``FastAPI`` instance:
- mounts the aggregate ``/api`` router (AD-4);
- installs the centralized AD-5 exception handlers;
- configures ``pydantic-settings`` env config and structured JSON stdout
  logging with a per-request request id;
- enables CORS only when origins are configured (dev profile, AD-10).

The module-level ``app = create_app()`` is the target for ``uvicorn app.main:app``.
"""

from __future__ import annotations

import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger

APP_NAME = "nearform_todo_app"


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build and return the configured FastAPI application."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    logger = get_logger()

    app = FastAPI(title=APP_NAME)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        """Assign a request id and emit one structured JSON log line per request."""
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response

    # CORS is enabled ONLY when origins are configured (dev profile; AD-10).
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    register_exception_handlers(app)
    app.include_router(api_router, prefix="/api")

    return app


app = create_app()

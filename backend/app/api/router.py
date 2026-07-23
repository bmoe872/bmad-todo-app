"""Aggregate API router mounted under the versionless ``/api`` base (AD-4).

Feature route modules (todos, etc.) are included here as they land in later
stories. ``create_app()`` mounts this single router with the ``/api`` prefix.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import health

api_router = APIRouter()
api_router.include_router(health.router)

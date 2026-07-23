"""Pydantic request/response schemas for the Todo API (AD-3, AD-5).

The description validation rules live here as the single server-side definition
(mirrored client-side in Epic 3): required, whitespace-trimmed, non-empty,
single-line (no newlines/control chars), and <= 500 chars measured on the
trimmed string. A ``ValueError`` raised in a validator becomes FastAPI's
``RequestValidationError``, which the centralized handler in ``app.core.errors``
remaps into the uniform AD-5 envelope with ``details=[{field, issue}]``.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    StrictBool,
    field_serializer,
    field_validator,
)

MAX_DESCRIPTION_LENGTH = 500

# Issue messages (also usable as the AD-5 ``details[].issue`` text).
EMPTY_ISSUE = "Description must not be empty."
CONTROL_CHAR_ISSUE = "Description must be a single line without control characters."
TOO_LONG_ISSUE = (
    f"Description must be at most {MAX_DESCRIPTION_LENGTH} characters."
)


def validate_description(raw: str) -> str:
    """Validate and normalize a Todo description; return the trimmed value.

    Single source of truth for the AD-5 description rules. Raises ``ValueError``
    with a specific message on the first rule violated. Length is measured on
    the trimmed string.
    """
    trimmed = raw.strip()
    if not trimmed:
        raise ValueError(EMPTY_ISSUE)
    # Reject any C0 control char (ord < 32: newlines, tabs, etc.) or DEL (127).
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in trimmed):
        raise ValueError(CONTROL_CHAR_ISSUE)
    if len(trimmed) > MAX_DESCRIPTION_LENGTH:
        raise ValueError(TOO_LONG_ISSUE)
    return trimmed


class TodoCreate(BaseModel):
    """Request body for ``POST /api/todos`` (FR-1, AD-5)."""

    description: str

    @field_validator("description")
    @classmethod
    def _validate_description(cls, value: str) -> str:
        return validate_description(value)


class TodoUpdate(BaseModel):
    """Request body for ``PATCH /api/todos/{id}`` (FR-2, AD-4).

    Only ``completed`` is mutable in v1 — there is no text-editing path. Typed as
    ``StrictBool`` so only real JSON booleans are accepted: strings ("true") and
    ints (1) are rejected as a ``RequestValidationError`` → the AD-5 ``422``
    envelope with ``details[].field == "completed"``. A missing field is likewise
    a ``422``. Any extra keys sent in the body are ignored (never applied).
    """

    completed: StrictBool


class TodoRead(BaseModel):
    """Response shape for a single ``Todo`` (AD-3).

    Serializes ORM rows directly (``from_attributes``); ``created_at`` is
    emitted as ISO-8601 UTC with a trailing ``Z`` per the wire contract.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    description: str
    completed: bool
    created_at: datetime

    @field_serializer("created_at")
    def _serialize_created_at(self, value: datetime) -> str:
        # TIMESTAMPTZ comes back tz-aware (UTC); assume UTC if ever naive.
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


class TodoListResponse(BaseModel):
    """Response envelope for ``GET /api/todos`` -> ``{ "todos": [...] }`` (AD-3)."""

    todos: list[TodoRead]


class ClearCompletedRequest(BaseModel):
    """Request body for ``DELETE /api/todos/completed`` (FR-9, AD-7).

    Carries the optional *id snapshot* of the deferred-commit model: the exact
    set of Todo ids the client captured as completed when the user clicked
    "Clear completed". The server deletes only those ids that are **still**
    completed (see ``TodoService.clear_completed``), so a Todo re-activated
    during the Undo window is never swept.

    ``ids is None`` (body omitted / ``null``) => clear ALL currently-completed
    Todos. ``ids == []`` is an explicit empty snapshot => deletes nothing. A
    non-list value or a non-UUID element fails Pydantic validation and flows
    through the centralized AD-5 ``422`` handler.
    """

    ids: list[uuid.UUID] | None = None


class ClearCompletedResponse(BaseModel):
    """Response for ``DELETE /api/todos/completed`` -> ``{ "deleted": <int> }``."""

    deleted: int

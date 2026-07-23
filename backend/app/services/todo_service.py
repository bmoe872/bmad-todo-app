"""Todo domain service — orchestration + domain rules (AD-2).

Sits between routes and the repository. Never imports SQLAlchemy query APIs
(those are confined to ``repositories``/``db``). Validation lives in the schema
(``app.schemas.todo``); the service re-asserts the description rule as
defense-in-depth so a future caller that bypasses the Pydantic body model still
cannot persist an invalid Todo — the shared ``validate_description`` helper keeps
this DRY, and a violation is surfaced as the AD-5 ``422`` envelope.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app.core.errors import AppError, NotFoundError
from app.db.models import Todo
from app.repositories.todo_repo import TodoRepository
from app.schemas.todo import TodoCreate, validate_description

if TYPE_CHECKING:
    # Type-only import: with `from __future__ import annotations` the `Session`
    # annotation is never evaluated at runtime, so the service imports zero
    # SQLAlchemy at runtime — keeping query/session APIs confined to
    # repositories/db (AD-2 chokepoint).
    from sqlalchemy.orm import Session


class TodoService:
    """Domain operations for Todos."""

    def __init__(self, db: Session) -> None:
        self._repo = TodoRepository(db)

    def list_todos(self) -> list[Todo]:
        """Return all Todos newest-first (delegates ordering to the repo)."""
        return self._repo.list()

    def create_todo(self, data: TodoCreate) -> Todo:
        """Validate + persist a new Todo, returning it with server defaults."""
        try:
            description = validate_description(data.description)
        except ValueError as exc:
            # Reached only if a caller bypassed schema validation; map to the
            # same AD-5 envelope the RequestValidationError handler produces.
            raise AppError(
                code="validation_error",
                message="Request validation failed",
                status_code=422,
                details=[{"field": "description", "issue": str(exc)}],
            ) from exc
        return self._repo.create(description)

    def toggle_todo(self, todo_id: uuid.UUID, completed: bool) -> Todo:
        """Set a Todo's completion to ``completed`` (both directions), FR-2.

        The client sends the desired state, so this is a set-to-value, not a
        server-side flip. Raises ``NotFoundError`` (AD-5 404) if the id is
        unknown; ordering/position is unchanged (the repo touches only the flag).
        """
        todo = self._repo.set_completed(todo_id, completed)
        if todo is None:
            raise NotFoundError()
        return todo

    def delete_todo(self, todo_id: uuid.UUID) -> None:
        """Permanently delete a Todo by id (FR-3).

        Raises ``NotFoundError`` (AD-5 404) if the id is unknown / already gone,
        which the client treats as already-gone and reconciles.
        """
        if not self._repo.delete(todo_id):
            raise NotFoundError()

"""Todo endpoints (AD-4): ``GET /api/todos`` and ``POST /api/todos``.

Routes are thin: they resolve a per-request session (``get_db``, AD-12), call
the service, and return schema-typed responses. No SQLAlchemy query APIs are
imported here (AD-2). Body validation of ``TodoCreate`` produces the AD-5
``422`` envelope automatically via the centralized exception handlers.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.todo import (
    ClearCompletedRequest,
    ClearCompletedResponse,
    TodoCreate,
    TodoListResponse,
    TodoRead,
)
from app.services.todo_service import TodoService

router = APIRouter(tags=["todos"])


# MUST precede /{id} route — static path, see AD route-ordering hazard.
# FastAPI matches routes in declaration order, so the literal `/todos/completed`
# must be declared ABOVE the parametric `DELETE /todos/{id}` (Story 2.2, merged
# on a separate branch) or `/completed` would be captured as `{id}="completed"`
# (AD-4). Keep this at the top of the router; add `/{id}` routes BELOW it.
@router.delete("/todos/completed", response_model=ClearCompletedResponse)
def clear_completed(
    db: Annotated[Session, Depends(get_db)],
    body: Annotated[ClearCompletedRequest | None, Body()] = None,
) -> ClearCompletedResponse:
    """Bulk-delete completed Todos, optionally scoped to an id snapshot (FR-9, AD-7).

    Body ``{ "ids": [uuid, …] }`` restricts the delete to that snapshot; the
    server removes only ids that are **still** completed. An omitted body clears
    all currently-completed Todos. Returns ``200 { "deleted": <int> }``; a no-op
    match returns ``{ "deleted": 0 }``.
    """
    ids = body.ids if body is not None else None
    deleted = TodoService(db).clear_completed(ids)
    return ClearCompletedResponse(deleted=deleted)


@router.get("/todos", response_model=TodoListResponse)
def list_todos(db: Annotated[Session, Depends(get_db)]) -> TodoListResponse:
    """Return all Todos newest-first: ``200 { "todos": [...] }`` (FR-4, FR-5)."""
    todos = TodoService(db).list_todos()
    return TodoListResponse(todos=[TodoRead.model_validate(t) for t in todos])


@router.post("/todos", response_model=TodoRead, status_code=status.HTTP_201_CREATED)
def create_todo(
    data: TodoCreate,
    db: Annotated[Session, Depends(get_db)],
) -> TodoRead:
    """Create a Todo from a validated, trimmed description: ``201 Todo`` (FR-1)."""
    todo = TodoService(db).create_todo(data)
    return TodoRead.model_validate(todo)

"""Todo endpoints (AD-4): ``GET /api/todos`` and ``POST /api/todos``.

Routes are thin: they resolve a per-request session (``get_db``, AD-12), call
the service, and return schema-typed responses. No SQLAlchemy query APIs are
imported here (AD-2). Body validation of ``TodoCreate`` produces the AD-5
``422`` envelope automatically via the centralized exception handlers.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.todo import TodoCreate, TodoListResponse, TodoRead
from app.services.todo_service import TodoService

router = APIRouter(tags=["todos"])


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

"""Unit tests for TodoService (AD-2). No DB — the repository is stubbed.

Verifies the service passes the trimmed description to the repository and maps a
bypassed-schema validation failure to the AD-5 422 envelope.
"""

from __future__ import annotations

import uuid

import pytest

from app.core.errors import AppError
from app.schemas.todo import TodoCreate
from app.services.todo_service import TodoService


class _FakeRepo:
    """Records the description handed to create()."""

    _UNSET = object()

    def __init__(self) -> None:
        self.created_with: str | None = None
        self.listed = False
        # Sentinel so tests can distinguish "not called" from "called with None".
        self.cleared_with: object = self._UNSET
        self.clear_returns = 0

    def create(self, description: str):
        self.created_with = description
        return {"description": description}

    def list(self):
        self.listed = True
        return []

    def clear_completed(self, ids):
        self.cleared_with = ids
        return self.clear_returns


def _service_with_fake_repo() -> tuple[TodoService, _FakeRepo]:
    service = TodoService.__new__(TodoService)  # bypass __init__ (no real Session)
    fake = _FakeRepo()
    service._repo = fake  # type: ignore[attr-defined]
    return service, fake


def test_create_todo_passes_trimmed_description_to_repo() -> None:
    service, fake = _service_with_fake_repo()
    service.create_todo(TodoCreate(description="   Buy milk   "))
    assert fake.created_with == "Buy milk"


def test_list_todos_delegates_to_repo() -> None:
    service, fake = _service_with_fake_repo()
    result = service.list_todos()
    assert fake.listed is True
    assert result == []


def test_create_todo_rejects_bypassed_invalid_description() -> None:
    # Construct a TodoCreate then mutate around validation to simulate a caller
    # that bypassed the schema (model_construct skips validators).
    service, _ = _service_with_fake_repo()
    bypassed = TodoCreate.model_construct(description="   ")
    with pytest.raises(AppError) as exc_info:
        service.create_todo(bypassed)
    err = exc_info.value
    assert err.status_code == 422
    assert err.code == "validation_error"
    assert err.details is not None
    assert err.details[0]["field"] == "description"


def test_clear_completed_forwards_snapshot_verbatim() -> None:
    # A concrete id snapshot is passed through to the repo unchanged (AD-7:
    # the still-completed filtering is the repo's single SQL predicate, so the
    # service is a pure passthrough).
    service, fake = _service_with_fake_repo()
    snapshot = [uuid.uuid4(), uuid.uuid4()]
    fake.clear_returns = 2
    result = service.clear_completed(snapshot)
    assert fake.cleared_with == snapshot
    assert result == 2


def test_clear_completed_forwards_none_for_clear_all() -> None:
    # Omitted body -> ids is None -> clear-all fallback forwarded as None.
    service, fake = _service_with_fake_repo()
    fake.clear_returns = 5
    result = service.clear_completed(None)
    assert fake.cleared_with is None
    assert result == 5


def test_clear_completed_forwards_empty_list() -> None:
    # Explicit empty snapshot forwarded verbatim (repo returns 0 no-op).
    service, fake = _service_with_fake_repo()
    fake.clear_returns = 0
    result = service.clear_completed([])
    assert fake.cleared_with == []
    assert result == 0

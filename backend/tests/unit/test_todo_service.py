"""Unit tests for TodoService (AD-2). No DB — the repository is stubbed.

Verifies the service passes the trimmed description to the repository, maps a
bypassed-schema validation failure to the AD-5 422 envelope, toggles completion
in both directions, and surfaces a not-found domain error (404) for unknown ids
on toggle and delete.
"""

from __future__ import annotations

import uuid

import pytest

from app.core.errors import AppError, NotFoundError
from app.schemas.todo import TodoCreate
from app.services.todo_service import TodoService


class _FakeRepo:
    """Records the description handed to create() and simulates get/toggle/delete.

    ``existing_ids`` controls which ids are treated as present: ``set_completed``
    and ``delete`` return None/False for anything not in the set (the missing-id
    paths the service maps to 404).
    """

    _UNSET = object()

    def __init__(self, existing_ids: set[uuid.UUID] | None = None) -> None:
        self.created_with: str | None = None
        self.listed = False
        self.existing_ids = existing_ids if existing_ids is not None else set()
        self.set_completed_args: tuple[uuid.UUID, bool] | None = None
        self.deleted_id: uuid.UUID | None = None
        # Sentinel so tests can distinguish "not called" from "called with None".
        self.cleared_with: object = self._UNSET
        self.clear_returns = 0

    def create(self, description: str):
        self.created_with = description
        return {"description": description}

    def list(self):
        self.listed = True
        return []

    def set_completed(self, todo_id: uuid.UUID, completed: bool):
        self.set_completed_args = (todo_id, completed)
        if todo_id not in self.existing_ids:
            return None
        # Echo the requested state so the service returns the updated row.
        return {"id": todo_id, "completed": completed}

    def clear_completed(self, ids):
        self.cleared_with = ids
        return self.clear_returns

    def delete(self, todo_id: uuid.UUID) -> bool:
        self.deleted_id = todo_id
        return todo_id in self.existing_ids


def _service_with_fake_repo(
    existing_ids: set[uuid.UUID] | None = None,
) -> tuple[TodoService, _FakeRepo]:
    service = TodoService.__new__(TodoService)  # bypass __init__ (no real Session)
    fake = _FakeRepo(existing_ids)
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


@pytest.mark.parametrize("completed", [True, False])
def test_toggle_todo_sets_completed_both_directions(completed: bool) -> None:
    todo_id = uuid.uuid4()
    service, fake = _service_with_fake_repo(existing_ids={todo_id})
    result = service.toggle_todo(todo_id, completed)
    assert fake.set_completed_args == (todo_id, completed)
    assert result["completed"] is completed  # type: ignore[index]


def test_toggle_todo_missing_id_raises_not_found() -> None:
    service, _ = _service_with_fake_repo(existing_ids=set())
    with pytest.raises(NotFoundError) as exc_info:
        service.toggle_todo(uuid.uuid4(), True)
    err = exc_info.value
    assert err.status_code == 404
    assert err.code == "not_found"


def test_delete_todo_existing_returns_none() -> None:
    todo_id = uuid.uuid4()
    service, fake = _service_with_fake_repo(existing_ids={todo_id})
    assert service.delete_todo(todo_id) is None
    assert fake.deleted_id == todo_id


def test_delete_todo_missing_id_raises_not_found() -> None:
    service, _ = _service_with_fake_repo(existing_ids=set())
    with pytest.raises(NotFoundError) as exc_info:
        service.delete_todo(uuid.uuid4())
    err = exc_info.value
    assert err.status_code == 404
    assert err.code == "not_found"


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

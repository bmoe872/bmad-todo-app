"""Unit tests for the Todo schema validation rules (AD-5). No DB.

Covers the single server-side description contract: required, trimmed,
non-empty, single-line (no control chars), <= 500 chars on the trimmed string.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.todo import (
    MAX_DESCRIPTION_LENGTH,
    TodoCreate,
    TodoUpdate,
    validate_description,
)


def test_valid_description_is_accepted() -> None:
    todo = TodoCreate(description="Buy milk")
    assert todo.description == "Buy milk"


def test_description_is_trimmed() -> None:
    todo = TodoCreate(description="   Buy milk   ")
    assert todo.description == "Buy milk"


@pytest.mark.parametrize(
    "raw",
    [
        "",  # empty
        "   ",  # whitespace-only
        "\t\n ",  # only control/whitespace
    ],
)
def test_empty_or_whitespace_rejected(raw: str) -> None:
    with pytest.raises(ValidationError):
        TodoCreate(description=raw)


@pytest.mark.parametrize(
    "raw",
    [
        "line1\nline2",  # embedded newline
        "line1\r\nline2",  # CRLF
        "a\tb",  # tab (a control char)
        "a\x00b",  # NUL
        "a\x07b",  # bell
        "a\x7fb",  # DEL
    ],
)
def test_control_chars_rejected(raw: str) -> None:
    with pytest.raises(ValidationError):
        TodoCreate(description=raw)


def test_max_length_boundary_accepted() -> None:
    at_limit = "x" * MAX_DESCRIPTION_LENGTH
    todo = TodoCreate(description=at_limit)
    assert len(todo.description) == MAX_DESCRIPTION_LENGTH


def test_over_length_rejected() -> None:
    too_long = "x" * (MAX_DESCRIPTION_LENGTH + 1)
    with pytest.raises(ValidationError):
        TodoCreate(description=too_long)


def test_length_measured_on_trimmed_string() -> None:
    # 500 real chars plus surrounding whitespace -> trimmed length is 500 -> OK.
    padded = "  " + ("x" * MAX_DESCRIPTION_LENGTH) + "  "
    todo = TodoCreate(description=padded)
    assert len(todo.description) == MAX_DESCRIPTION_LENGTH


def test_missing_field_rejected() -> None:
    with pytest.raises(ValidationError):
        TodoCreate()  # type: ignore[call-arg]


def test_validate_description_helper_returns_trimmed() -> None:
    assert validate_description("  hello  ") == "hello"


def test_validate_description_helper_raises_valueerror() -> None:
    with pytest.raises(ValueError):
        validate_description("   ")


def test_todo_update_accepts_boolean() -> None:
    assert TodoUpdate(completed=True).completed is True
    assert TodoUpdate(completed=False).completed is False


def test_todo_update_rejects_missing_field() -> None:
    with pytest.raises(ValidationError):
        TodoUpdate()  # type: ignore[call-arg]


@pytest.mark.parametrize("bad", ["yes", "true", 1, 0, None])
def test_todo_update_rejects_non_boolean(bad: object) -> None:
    # StrictBool rejects strings, ints, and None — only real JSON booleans pass.
    with pytest.raises(ValidationError):
        TodoUpdate(completed=bad)  # type: ignore[arg-type]

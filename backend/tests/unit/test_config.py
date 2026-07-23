"""Unit tests for env-based configuration parsing.

``core/config.py`` is coverage-omitted (12-factor plumbing), but the
comma-separated ``CORS_ORIGINS`` parsing is easy to get wrong, so it is smoke
-tested here via the real environment-variable source.
"""

from __future__ import annotations

import pytest

from app.core.config import Settings


def test_cors_origins_parsed_from_comma_separated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://todo:todo@localhost:5432/todo"
    )
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173, http://localhost:3000")
    monkeypatch.setenv("LOG_LEVEL", "info")
    settings = Settings(_env_file=None)
    assert settings.cors_origins == [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    assert settings.log_level == "info"


def test_cors_origins_empty_yields_empty_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://todo:todo@localhost:5432/todo"
    )
    monkeypatch.setenv("CORS_ORIGINS", "")
    settings = Settings(_env_file=None)
    assert settings.cors_origins == []

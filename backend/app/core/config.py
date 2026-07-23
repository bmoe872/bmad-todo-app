"""Application configuration via 12-factor environment variables.

Backend config is sourced exclusively from environment variables (optionally an
`.env` file for local development) and parsed with `pydantic-settings`. No
secrets are used in v1. See `backend/.env.example` for the canonical variable
names and dev-profile defaults.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import BeforeValidator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _split_origins(value: object) -> list[str]:
    """Parse the comma-separated ``CORS_ORIGINS`` env string into a list.

    Accepts either an already-parsed list or a comma-separated string so the
    setting can be supplied via a plain env var (12-factor) rather than JSON.
    """
    if value is None or value == "":
        return []
    if isinstance(value, (list, tuple)):
        return [str(v).strip() for v in value if str(v).strip()]
    return [item.strip() for item in str(value).split(",") if item.strip()]


class Settings(BaseSettings):
    """Typed application settings loaded from the environment.

    Fields mirror ``backend/.env.example`` exactly:
    - ``database_url`` <- ``DATABASE_URL`` (SQLAlchemy 2.0 + psycopg 3 sync DSN)
    - ``cors_origins`` <- ``CORS_ORIGINS`` (comma-separated; dev profile only)
    - ``log_level``   <- ``LOG_LEVEL``
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    database_url: str = "postgresql+psycopg://todo:todo@localhost:5432/todo"
    cors_origins: Annotated[list[str], NoDecode, BeforeValidator(_split_origins)] = []
    log_level: str = "info"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide cached ``Settings`` instance."""
    return Settings()

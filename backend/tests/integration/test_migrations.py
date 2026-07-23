"""Integration test: Alembic baseline cycle against the test Postgres.

Verifies ``alembic upgrade head`` then ``alembic downgrade base`` both succeed
(AD-11), confirming the migration environment is wired correctly.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from tests.integration.conftest import TEST_DATABASE_URL

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _run_alembic(*args: str) -> subprocess.CompletedProcess[str]:
    env = dict(os.environ, DATABASE_URL=TEST_DATABASE_URL)
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )


def test_alembic_upgrade_then_downgrade_cycle() -> None:
    up = _run_alembic("upgrade", "head")
    assert up.returncode == 0, f"upgrade failed:\n{up.stdout}\n{up.stderr}"

    current = _run_alembic("current")
    assert current.returncode == 0
    # head is now the todos revision (Story 2.1); the baseline is in the chain.
    assert "0002_create_todos" in current.stdout

    down = _run_alembic("downgrade", "base")
    assert down.returncode == 0, f"downgrade failed:\n{down.stdout}\n{down.stderr}"

    # Restore the schema to head so sibling integration tests (which rely on the
    # feature tables via the session-scoped schema fixture) are not left without
    # a schema regardless of collection order.
    restore = _run_alembic("upgrade", "head")
    assert restore.returncode == 0, f"restore failed:\n{restore.stdout}\n{restore.stderr}"

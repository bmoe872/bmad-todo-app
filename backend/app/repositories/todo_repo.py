"""Todo data-access repository — the AD-2 chokepoint.

This is the ONLY module (besides ``app.db``) where SQLAlchemy query/session
APIs touch Todos. All queries are parameterized SQLAlchemy constructs (no string
interpolation of user input) per NFR-Sec.

AD-9 seam: a future owner filter (multi-user) attaches here at the single
chokepoint (e.g. ``.where(Todo.owner_id == owner_id)``) without changing the
wire contract or the layers above.
"""

from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import Todo


class TodoRepository:
    """Parameterized data access for the ``todos`` table."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def list(self) -> list[Todo]:
        """Return all Todos newest-first: ``created_at`` DESC, ``id`` tiebreak.

        The ``id`` DESC tiebreak gives a deterministic total order when two rows
        share a ``created_at`` (AD-3, FR-5).
        """
        # AD-9 seam: owner scoping would add a `.where(Todo.owner_id == ...)` here.
        stmt = select(Todo).order_by(Todo.created_at.desc(), Todo.id.desc())
        return list(self._db.execute(stmt).scalars().all())

    def create(self, description: str) -> Todo:
        """Insert a new Todo and return it with server-set defaults populated.

        ``description`` is expected already trimmed/validated by the schema and
        service. Server defaults (``id``, ``completed``, ``created_at``) are
        populated by the DB, so we ``flush`` + ``refresh`` after commit.
        """
        todo = Todo(description=description)
        self._db.add(todo)
        self._db.commit()
        self._db.refresh(todo)
        return todo

    def clear_completed(self, ids: list[uuid.UUID] | None) -> int:
        """Bulk-delete completed Todos and return the number of rows removed.

        Encodes the AD-7 deferred-commit / id-snapshot rule in a single
        parameterized predicate::

            DELETE FROM todos WHERE completed = true [AND id IN (:ids)]

        - ``completed = true`` guarantees active Todos are never touched AND a
          snapshot id that has since been re-activated is skipped (it is no
          longer completed) — so a stale snapshot is always safe.
        - When ``ids is not None`` the delete is restricted to the snapshot via
          a parameterized ``IN`` (NFR-Sec — no string interpolation). When
          ``ids is None`` (body omitted) all completed Todos are cleared.
        - An explicit empty snapshot (``ids == []``) matches nothing by
          definition; we short-circuit to ``0`` rather than emit a degenerate
          ``IN ()`` construct.

        AD-9 seam: owner scoping would add a `.where(Todo.owner_id == ...)` here.
        """
        if ids is not None and len(ids) == 0:
            return 0
        stmt = delete(Todo).where(Todo.completed.is_(True))
        if ids is not None:
            stmt = stmt.where(Todo.id.in_(ids))
        result = self._db.execute(stmt, execution_options={"synchronize_session": False})
        self._db.commit()
        return result.rowcount

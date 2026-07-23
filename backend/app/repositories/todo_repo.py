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

from sqlalchemy import select
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

    def get(self, todo_id: uuid.UUID) -> Todo | None:
        """Fetch a single Todo by id, or ``None`` if it does not exist.

        Parameterized ``.where`` bind (never string interpolation), NFR-Sec.
        """
        # AD-9 seam: owner scoping would add `.where(Todo.owner_id == ...)` here.
        stmt = select(Todo).where(Todo.id == todo_id)
        return self._db.execute(stmt).scalar_one_or_none()

    def set_completed(self, todo_id: uuid.UUID, completed: bool) -> Todo | None:
        """Set a Todo's ``completed`` flag and persist; return the updated row.

        Returns ``None`` when no row matches (the service maps that to a 404).
        Only ``completed`` is touched — ``created_at``/``id`` are never mutated,
        so List ordering/position is unchanged (AD-3, FR-5). Mutation lives here
        (not in the service) so all SQLAlchemy interaction stays inside the
        AD-2 chokepoint.
        """
        todo = self.get(todo_id)
        if todo is None:
            return None
        todo.completed = completed
        self._db.commit()
        self._db.refresh(todo)
        return todo

    def delete(self, todo_id: uuid.UUID) -> bool:
        """Permanently delete a Todo by id; return ``True`` if a row was removed.

        Returns ``False`` when no row matches (the service maps that to a 404).
        """
        todo = self.get(todo_id)
        if todo is None:
            return False
        self._db.delete(todo)
        self._db.commit()
        return True

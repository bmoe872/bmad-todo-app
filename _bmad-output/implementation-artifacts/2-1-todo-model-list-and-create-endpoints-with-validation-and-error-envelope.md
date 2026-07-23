---
baseline_commit: 000c3de
---

# Story 2.1: Todo model, list, and create endpoints with validation and error envelope

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an API consumer,
I want to list all Todos newest-first and create a new Todo with validated input,
so that the client can render the persisted List on open and capture new Todos against server truth.

## Acceptance Criteria

1. **Schema migration (AD-3, AD-11).** An **additive** Alembic migration (revision after `0001_baseline`, `down_revision = "0001_baseline"`) creates the `todos` table:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500)`
   - `completed BOOLEAN NOT NULL DEFAULT false`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - an index on `created_at DESC` (for the ordering query).
   The `gen_random_uuid()` default requires the `pgcrypto` extension — the migration must `CREATE EXTENSION IF NOT EXISTS pgcrypto` in `upgrade()` before creating the table. `upgrade head` then `downgrade base` must both succeed (the downgrade drops the table; leaving the extension in place is acceptable and non-destructive).
2. **Layered artifacts created (AD-2).** The SQLAlchemy `Todo` model (`app/db/models.py`), Pydantic schemas (`app/schemas/todo.py`), the repository (`app/repositories/todo_repo.py`), and the service (`app/services/todo_service.py`) are created. SQLAlchemy query/session APIs appear **only** in `repositories`/`db`; routes and services never import SQLAlchemy query APIs (services orchestrate + validate, repositories run parameterized queries).
3. **Auth seam left open (AD-9).** No `owner_id` column and no auth are added. The repository is the single place a future owner filter would attach. Do not add an always-null column.
4. **List endpoint (FR-4, FR-5, AD-3).** `GET /api/todos` returns `200 { "todos": [Todo, …] }` ordered `created_at DESC` with `id` as tiebreak. Each `Todo` is shaped `{ id, description, completed, created_at }` with `snake_case` keys, `id` as a UUID string, and `created_at` as ISO-8601 UTC ending in `Z` (e.g. `2026-07-23T12:34:56.789012Z`).
5. **Create endpoint — valid (FR-1).** `POST /api/todos` with `{ "description": "<non-empty>" }` returns `201` with the created `Todo` object (bare `Todo`, not wrapped), `completed=false`, server-set `created_at`, after **trimming** the description (leading/trailing whitespace removed before persistence).
6. **Create endpoint — invalid (FR-1, FR-7, AD-5, NFR-Sec).** When the description is empty, whitespace-only, multi-line / contains control characters, or `> 500` chars measured on the **trimmed** string, the endpoint returns `422` with the AD-5 envelope `{ "error": { "code", "message", "details": [{ "field", "issue" }] } }` whose `details` name the field (`description`) and the issue. **No row is created.**
7. **Parameterized queries only (NFR-Sec).** All queries use parameterized SQLAlchemy constructs (ORM / `select()` / bound parameters) — no string interpolation of user input into SQL.
8. **Text-only storage (NFR-Sec, AD-5).** The description is stored and returned verbatim as text; it is never interpreted/executed as HTML on the server. (Client-side escaping is Epic 3.)

## Tasks / Subtasks

- [x] **Task 1 — SQLAlchemy `Todo` model (AC: 1, 2, 3)** in `backend/app/db/models.py`
  - [x] Define `Todo(Base)` with `__tablename__ = "todos"`. Import `Base` from `app.db.base`.
  - [x] Columns (SQLAlchemy 2.0 `Mapped` / `mapped_column` typed style — matches the `DeclarativeBase` in `app/db/base.py`):
    - `id: Mapped[uuid.UUID]` — `mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))`.
    - `description: Mapped[str]` — `mapped_column(Text, nullable=False)`.
    - `completed: Mapped[bool]` — `mapped_column(Boolean, nullable=False, server_default=text("false"))`.
    - `created_at: Mapped[datetime]` — `mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())`.
  - [x] Add the `CheckConstraint("char_length(description) BETWEEN 1 AND 500", name="ck_todos_description_length")` and an `Index("ix_todos_created_at_desc", created_at.desc())` in `__table_args__` so `Base.metadata` matches the migration (single source of truth for autogenerate).
  - [x] Import the model in `app/db/base.py` (or ensure it is imported before Alembic runs) so `Base.metadata` is populated for autogenerate. Prefer: add a light import in `migrations/env.py` (`import app.db.models  # noqa: F401`) OR re-export from `app/db/base.py`. Do **not** create circular imports.
- [x] **Task 2 — Alembic migration for `todos` (AC: 1)** in `backend/migrations/versions/`
  - [x] Create revision `0002_create_todos` with `down_revision = "0001_baseline"`. Hand-write it (do not rely on autogenerate for the CHECK/extension) or autogenerate then edit.
  - [x] `upgrade()`: `op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")`; then `op.create_table("todos", …)` with the four columns, PK, the `CheckConstraint`, server defaults (`gen_random_uuid()`, `false`, `now()`); then `op.create_index("ix_todos_created_at_desc", "todos", [sa.text("created_at DESC")])`.
  - [x] `downgrade()`: drop the index then `op.drop_table("todos")`. (Leave `pgcrypto` — dropping a shared extension is destructive/non-idempotent.)
  - [x] Verify `alembic upgrade head` then `alembic downgrade base` both exit 0 against the test DB.
- [x] **Task 3 — Pydantic schemas (AC: 4, 5, 6, 8)** in `backend/app/schemas/todo.py`
  - [x] `TodoCreate(BaseModel)`: single field `description: str`. Enforce the shared validation rules with a `field_validator` (mode="after" or a `BeforeValidator`) that: trims (`str.strip()`); rejects empty/whitespace-only; rejects embedded newlines / control chars (any char with `ord(c) < 32` other than none — i.e. no `\n`, `\r`, `\t`, or other C0 controls); rejects trimmed length `> 500`. On failure raise `ValueError` with a clear message — FastAPI turns validator `ValueError`s into `RequestValidationError`, which the existing AD-5 handler remaps to the `422` envelope with `details=[{field, issue}]`. **The validator must return the trimmed value** so the stored description is the trimmed form.
  - [x] `TodoRead(BaseModel)`: `id: uuid.UUID`, `description: str`, `completed: bool`, `created_at: datetime`. `model_config = ConfigDict(from_attributes=True)` so it serializes ORM rows. Ensure `created_at` serializes as ISO-8601 UTC with a `Z` suffix (see Dev Notes → "created_at Z-suffix").
  - [x] Keep validation logic reusable: expose a module-level constant `MAX_DESCRIPTION_LENGTH = 500` and, if convenient, a pure `validate_description(raw: str) -> str` helper the service can also call — this is the single validation definition mirrored client-side in Epic 3.
- [x] **Task 4 — Repository (AC: 2, 4, 5, 7)** in `backend/app/repositories/todo_repo.py`
  - [x] `TodoRepository` (or module functions) taking a `Session`. This is the ONLY place SQLAlchemy query APIs are used for Todos (AD-2 chokepoint; AD-9 owner-filter seam — add a comment marking where an `owner_id` filter would later attach).
  - [x] `list_todos(db) -> list[Todo]`: `select(Todo).order_by(Todo.created_at.desc(), Todo.id.desc())` executed via `db.execute(...).scalars().all()`. (id tiebreak — pick `.desc()` on id for a deterministic total order; document the choice.)
  - [x] `create_todo(db, description: str) -> Todo`: construct `Todo(description=description)`, `db.add(...)`, `db.flush()` then `db.refresh(obj)` so server defaults (`id`, `completed`, `created_at`) are populated; `db.commit()`. Use `flush`+`refresh` before commit, or commit then refresh — ensure the returned object has server-generated values. Parameterized construction only (no raw SQL string building).
- [x] **Task 5 — Service (AC: 2, 5, 6)** in `backend/app/services/todo_service.py`
  - [x] `TodoService` (or functions) holding domain rules; depends on the repository, never on SQLAlchemy query APIs.
  - [x] `list_todos(db) -> list[Todo]`: delegate to repo.
  - [x] `create_todo(db, data: TodoCreate) -> Todo`: the schema already validated+trimmed `description`; pass `data.description` to the repo. (Belt-and-suspenders: the service may re-assert non-empty/≤500 via the shared `validate_description` helper so validation is enforced even if a future caller bypasses the schema — raise a domain error mapping to `422` if so. Keep it DRY with the schema's helper.)
- [x] **Task 6 — Routes + router wiring (AC: 4, 5, 6)** in `backend/app/api/routes/todos.py`
  - [x] `router = APIRouter(tags=["todos"])`.
  - [x] `GET /todos` → depends on `get_db`; calls the service; returns `{"todos": [...]}` where each item is a `TodoRead`. Declare `response_model` appropriately (e.g. a `TodoListResponse` wrapper model `{ todos: list[TodoRead] }`) so the contract shape is enforced and documented. Status `200`.
  - [x] `POST /todos` → body `TodoCreate`; depends on `get_db`; calls the service; returns the created `TodoRead` with `status_code=201`. FastAPI validation of `TodoCreate` produces the `422` envelope automatically via the existing handler.
  - [x] Register the router in `app/api/router.py`: `api_router.include_router(todos.router)` (mounted under `/api`, so paths become `/api/todos`).
- [x] **Task 7 — Unit tests (AC: 5, 6)** in `backend/tests/unit/` (no DB)
  - [x] `test_todo_schema.py`: `TodoCreate` accepts a valid description and **stores the trimmed value**; rejects (raises `ValidationError`) for: empty `""`, whitespace-only `"   "`, embedded newline `"a\nb"`, other control chars (e.g. `"a\tb"`, `"a\x00b"` if you reject tab — align with the single validation rule), and a 501-char string; a 500-char string is accepted; a string that is 501 chars only because of untrimmed surrounding whitespace but ≤500 trimmed is **accepted** (length measured on trimmed).
  - [x] `test_todo_service.py`: service `create_todo` with a valid `TodoCreate` calls the repo with the trimmed description (use a fake/mock repo or a stub session — no real DB); the invalid-input rejection path (if the service re-asserts) surfaces the correct error code/detail. Keep unit tests DB-free and fast.
- [x] **Task 8 — Integration tests (AC: 1, 4, 5, 6, 7)** in `backend/tests/integration/` (real Postgres via the rollback fixture from Story 1.2)
  - [x] Reuse the existing `conftest.py` fixtures (`client`, `db_session`, transactional rollback). **The `todos` table must exist in the test DB** — see Dev Notes → "Integration test schema setup": add a session-scoped fixture that runs `alembic upgrade head` (or creates the schema) against the test DB before the suite, since the rollback fixture only wraps DML, not DDL.
  - [x] `test_todos_create.py`: `POST /api/todos` valid → `201`; body has `id` (uuid), `description` (trimmed), `completed == false`, `created_at` ending in `Z`; a follow-up read/`GET` shows exactly one row. `POST` with a leading/trailing-whitespace description persists the trimmed value.
  - [x] `test_todos_validation.py`: `POST` each invalid case (empty, whitespace-only, newline, >500) → `422` with envelope `{"error":{"code","message","details":[{"field","issue"}]}}`, `details[].field == "description"`, and **zero rows created** (assert via a subsequent `GET` count).
  - [x] `test_todos_list.py`: insert ≥3 todos with distinct `created_at`; `GET /api/todos` returns them in `created_at DESC` order with id tiebreak; keys are `snake_case`; every `created_at` ends with `Z`. Empty DB → `{"todos": []}`.
  - [x] Ensure the suite still skips honestly (existing `pytest_collection_modifyitems`) when no test Postgres is reachable — never fake green.
- [x] **Task 9 — Lint + full run**
  - [x] `ruff check .` clean (E, F, I, UP, B). Run `pytest` for unit + integration; capture pass/fail and coverage (report-only branch coverage per `pyproject.toml`).
- [x] **Task 10 — AI integration log**
  - [x] Append a brief Story 2.1 entry to `docs/AI-INTEGRATION-LOG.md` (what was AI-assisted: model, migration, schema validation, repo/service, routes, tests).

## Dev Notes

### Architecture patterns & constraints (FOLLOW EXACTLY)

- **AD-2 Layered backend + repository chokepoint.** `routes → services → repositories → db`, dependencies downward only. SQLAlchemy models/queries/sessions live ONLY in `app/repositories/` and `app/db/`. Routes and services must not `import sqlalchemy` query APIs (`select`, `Session.execute`, etc.). The repository is the single chokepoint where the future AD-9 owner filter attaches. [Source: architecture-spine §AD-2, §Design Paradigm]
- **AD-3 Todo canonical shape + ordering.** The sole entity is `Todo = { id: uuid, description: string, completed: bool, created_at: ISO-8601 UTC "…Z" }`. List ordered `created_at DESC`, `id` tiebreak (newest first). [Source: architecture-spine §AD-3]
- **AD-5 Uniform error envelope + shared validation.** Every non-2xx is `{ "error": { "code", "message", "details"?: [{field, issue}] } }` from the centralized handlers ALREADY implemented in `app/core/errors.py`. The `RequestValidationError` handler already maps Pydantic/body validation failures into this envelope with `details=[{field, issue}]` — so raising `ValueError` inside a Pydantic validator (or declaring `TodoCreate` as the body model) yields the correct `422` envelope with **no new handler needed**. `description` validation: required, trimmed, non-empty, single-line (no newline/control chars), ≤ 500 chars measured on the trimmed string. [Source: architecture-spine §AD-5; existing `app/core/errors.py`]
- **AD-9 Auth seam open, not built.** No `owner_id`, no auth in v1. Mark the repo query as the seam. [Source: architecture-spine §AD-9]
- **AD-12 Sync DB, one session per request.** Sync SQLAlchemy 2.0 + psycopg 3. Use the existing `get_db` dependency from `app/db/session.py` (yields one `Session` per request, closed in `finally`). No async. [Source: architecture-spine §AD-12; existing `app/db/session.py`]
- **AD-4 REST contract.** Versionless `/api` base; the aggregate router is mounted with prefix `/api` in `create_app()`. New todos router adds paths under `/api/todos`. Contract for this story: `GET /api/todos → 200 {todos:[…]}`; `POST /api/todos → 201 Todo` / `422`. [Source: architecture-spine §API Contract; existing `app/main.py`, `app/api/router.py`]
- **Success shapes (Consistency Conventions).** Single resource → the **bare** `Todo` object (POST returns the Todo directly, not wrapped). List → `{ "todos": [ … ] }` (envelope leaves room for pagination). Wire keys are `snake_case` end-to-end. [Source: architecture-spine §Consistency Conventions]
- **HTTP status codes.** 200 read, 201 create, 422 validation. [Source: architecture-spine §Consistency Conventions]
- **NFR-Sec.** Server-side validation of all writes; parameterized queries (SQLAlchemy ORM/`select()` bind params — never f-string SQL); text-only description (no HTML execution). [Source: architecture-spine §AD-5, §NFR-Sec]

### Existing code to build on (READ THESE — do not reinvent)

- `app/db/base.py` — `Base(DeclarativeBase)`. The `Todo` model inherits from this. `Base.metadata` is Alembic's `target_metadata` (see `migrations/env.py`), so the model must be imported before autogenerate/`env.py` runs.
- `app/db/session.py` — `engine`, `SessionLocal`, `get_db()` dependency, `check_connection`. Routes get their session via `Depends(get_db)` exactly like `app/api/routes/health.py`.
- `app/core/errors.py` — `AppError` base (carries `code`, `message`, `status_code`, `details`), `register_exception_handlers`. The `RequestValidationError` handler already builds `details=[{field, issue}]` by stripping the `body`/`query`/`path` loc prefix. If the service raises a domain validation error directly (not via Pydantic), raise an `AppError(code="validation_error", status_code=422, details=[{"field":"description","issue":…}])` so it flows through the same envelope. Prefer letting Pydantic do it.
- `app/api/router.py` — `api_router` currently includes only `health.router`. Add `todos.router` here.
- `app/api/routes/health.py` — the reference pattern for a route module: `APIRouter`, `Depends(get_db)`, thin route delegating data access downward (note it does NOT import SQLAlchemy query APIs — it calls `check_connection` in the db layer). Mirror this discipline: the todos route calls the service, not SQLAlchemy.
- `migrations/versions/0001_baseline.py` — the baseline (empty). New revision sets `down_revision = "0001_baseline"`.
- `migrations/env.py` — uses `Base.metadata` as `target_metadata`; injects `DATABASE_URL` via `get_settings()`. Ensure `Todo` is imported so metadata is populated (add `import app.db.models  # noqa: F401` to `env.py` if not re-exported from `base.py`).
- `tests/integration/conftest.py` — the transactional-rollback fixtures (`engine`, `db_session`, `client`) and honest skip via `pytest_collection_modifyitems` when no DB at `TEST_DATABASE_URL` (default `postgresql+psycopg://todo:todo@localhost:5433/todo`). Reuse as-is.

### created_at Z-suffix (AC 4)

Postgres `TIMESTAMPTZ` returns a timezone-aware `datetime` (UTC). Pydantic v2's default `datetime` JSON serialization emits `+00:00`, NOT `Z`. The contract requires a trailing `Z`. Implement a field serializer on `TodoRead`, e.g.:

```python
from pydantic import field_serializer

@field_serializer("created_at")
def _ser_created_at(self, dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
```

Test that the emitted string ends with `Z` (integration test AC 4). Guard against a naive datetime by assuming UTC if `tzinfo is None`.

### Integration test schema setup (Task 8 — IMPORTANT)

The Story 1.2 rollback fixture wraps each test in a transaction that is rolled back, giving DML isolation — but it does **not** create tables. The `todos` table must exist in the test database before the suite runs. Options (pick the simplest that keeps tests independent):
- **Preferred:** a `session`-scoped autouse fixture in the integration package that runs `alembic upgrade head` against `TEST_DATABASE_URL` once before tests (mirrors `test_migrations.py`'s `_run_alembic` subprocess helper), and optionally `downgrade base` on teardown. This exercises the real migration (also satisfies AC 1 end-to-end).
- Alternative: `Base.metadata.create_all(engine)` in a session fixture. This does NOT test the migration and may diverge from it (CHECK/extension) — if used, still keep `test_migrations.py`-style coverage of the migration cycle. Prefer the Alembic approach.

Note the rollback fixture uses `join_transaction_mode="create_savepoint"`; DDL inside a test would break isolation, so keep table creation at session scope OUTSIDE the per-test transaction. Also add a `0002` upgrade/downgrade cycle assertion (extend `test_migrations.py` or a new test) so the migration itself is verified.

### Postgres provisioning for integration tests

Docker is available. Provision a throwaway Postgres 17 (same approach as Story 1.2), host port `5433` to avoid colliding with a local `5432`:

```
docker run -d --name todo-test-pg \
  -e POSTGRES_USER=todo -e POSTGRES_PASSWORD=todo -e POSTGRES_DB=todo \
  -p 5433:5432 postgres:17
```

Then `export TEST_DATABASE_URL=postgresql+psycopg://todo:todo@localhost:5433/todo` (this is the conftest default) and, for the schema-setup fixture / manual `alembic` runs, `export DATABASE_URL=$TEST_DATABASE_URL`. Tear the container down after (`docker rm -f todo-test-pg`). If provisioning is impossible, the suite must skip honestly (already wired) — never fake a pass; report it.

### Source tree components to touch

```text
backend/app/
  db/models.py                 # NEW — SQLAlchemy Todo
  db/base.py                   # (maybe) re-export/import Todo for metadata
  schemas/todo.py              # NEW — TodoCreate, TodoRead, (TodoListResponse)
  repositories/todo_repo.py    # NEW — list/create, the AD-2/AD-9 chokepoint
  services/todo_service.py     # NEW — domain validation/orchestration
  api/routes/todos.py          # NEW — GET/POST /todos
  api/router.py                # UPDATE — include todos.router
backend/migrations/
  env.py                       # (maybe) import app.db.models for metadata
  versions/0002_create_todos.py# NEW — additive migration
backend/tests/
  unit/test_todo_schema.py     # NEW
  unit/test_todo_service.py    # NEW
  integration/test_todos_create.py     # NEW
  integration/test_todos_validation.py # NEW
  integration/test_todos_list.py       # NEW
  integration/conftest.py      # (maybe) add schema-setup fixture
docs/AI-INTEGRATION-LOG.md     # UPDATE — Story 2.1 entry
```

### Testing standards summary

- Backend `pytest`; unit in `tests/unit` (fast, no DB), integration in `tests/integration` (real Postgres, per-test transaction rollback). [Source: architecture-spine §Testing Architecture]
- Coverage: pytest-cov branch coverage, **report-only** at this stage (the enforcing ≥70% gate is Story 6.2). Do not add a `--cov-fail-under`. Established omits/excludes are in `pyproject.toml`. [Source: `backend/pyproject.toml`; sprint-status note]
- Contract check: assert response/error shapes against the API Contract per-endpoint. [Source: epics §Story 2.1 Test Scenarios]

### Project Structure Notes

- Paths align with the architecture source tree exactly. `db/models.py`, `schemas/todo.py`, `repositories/todo_repo.py`, `services/todo_service.py`, `api/routes/todos.py` are all named in the spine's Source tree. No variances.
- The `todos` table lands here (Story 2.1), NOT in Epic 1 — per the spine's "create tables only when needed" principle; Epic 1 shipped only the empty baseline. [Source: epics §"Todos migration placement"]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1] — ACs, test scenarios, traceability (AUTHORITATIVE).
- [Source: _bmad-output/planning-artifacts/epics.md#API Contract] — endpoint shapes/status codes.
- [Source: architecture-spine ARCHITECTURE-SPINE.md#AD-2/AD-3/AD-4/AD-5/AD-9/AD-12] — invariants.
- [Source: architecture-spine ARCHITECTURE-SPINE.md#Data model] — `todos` DDL (id/description/completed/created_at, CHECK, index).
- [Source: architecture-spine ARCHITECTURE-SPINE.md#Consistency Conventions] — snake_case wire, bare-Todo vs list envelope, UUID ids, `Z` dates.
- [Source: backend/app/core/errors.py] — existing AD-5 envelope + RequestValidationError remap.
- [Source: backend/app/db/session.py] — `get_db`, engine, session factory.
- [Source: backend/tests/integration/conftest.py] — rollback fixtures + honest skip.
- [Source: _bmad-output/implementation-artifacts/1-2-...md] — prior-story patterns (factory, envelope, Alembic, fixtures).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

- Migration cycle verified against test Postgres 17 (:5433): `alembic upgrade head` (0001 → 0002) then `downgrade base` both exit 0; `\d todos` confirms the four columns, PK, `ck_todos_description_length` CHECK, and `ix_todos_created_at_desc` index.
- Model ↔ migration parity confirmed: `alembic revision --autogenerate` produced an empty `upgrade()` (`pass`), proving `Base.metadata` matches the hand-written migration. The throwaway autogen file was deleted.
- Full suite (`pytest --cov=app`): 50 passed (28 unit + 22 integration), 96% branch coverage (report-only), ruff clean. Honest-skip re-verified: pointing `TEST_DATABASE_URL` at a dead DSN skips all 22 integration items (no false pass).

### Completion Notes List

Implemented the first Todo backend slice end-to-end following the layered architecture (AD-2: routes → services → repositories → db).

- **Model** (`app/db/models.py`): `Todo` (SQLAlchemy 2.0 `Mapped`/`mapped_column`) — `id` UUID PK `gen_random_uuid()`, `description` TEXT + `char_length BETWEEN 1 AND 500` CHECK, `completed` BOOL default false, `created_at` TIMESTAMPTZ default now(), plus `created_at DESC` index. Registered on `Base.metadata` via an import in `migrations/env.py`.
- **Migration** (`migrations/versions/0002_create_todos.py`): additive, `down_revision = 0001_baseline`; creates `pgcrypto` then the table + index; downgrade drops index + table, leaves the shared extension (non-destructive, AD-11).
- **Schemas** (`app/schemas/todo.py`): `TodoCreate` (validator trims + rejects empty/whitespace/control-chars/newlines/>500-on-trimmed via the shared `validate_description` helper — the single rule to be mirrored client-side); `TodoRead` (`from_attributes`, `created_at` serialized with a `Z` suffix); `TodoListResponse` wrapper.
- **Repository** (`app/repositories/todo_repo.py`): the AD-2 chokepoint / AD-9 owner-seam; `list()` (`select(Todo).order_by(created_at.desc(), id.desc())`) and `create()` (add/commit/refresh). Parameterized ORM constructs only (NFR-Sec).
- **Service** (`app/services/todo_service.py`): orchestration; re-asserts `validate_description` as defense-in-depth mapping bypassed-schema failures to the AD-5 422 envelope; never imports SQLAlchemy query APIs.
- **Routes** (`app/api/routes/todos.py` + `api/router.py`): `GET /api/todos` → 200 `{todos:[…]}`; `POST /api/todos` → 201 bare Todo. Body validation flows through the existing `RequestValidationError` → AD-5 handler (no new handler needed).
- **Tests**: unit `test_todo_schema.py`, `test_todo_service.py`; integration `test_todos_create.py`, `test_todos_validation.py`, `test_todos_list.py`. Extended the integration `conftest.py` with a session-scoped `alembic upgrade head` schema fixture (the rollback fixture only isolates DML, not DDL) and made `test_migrations.py` restore head after its downgrade so the suite is collection-order-independent.

Request/response shapes implemented:
- `GET /api/todos` → `200 { "todos": [ { "id": uuid, "description": str, "completed": bool, "created_at": "…Z" }, … ] }`, ordered `created_at DESC`, `id DESC` tiebreak.
- `POST /api/todos` `{ "description": str }` → `201 { "id", "description"(trimmed), "completed": false, "created_at": "…Z" }`.
- Validation failure → `422 { "error": { "code": "validation_error", "message", "details": [ { "field": "description", "issue" } ] } }`, zero rows created.
- Validation rules: required; trimmed; non-empty; no C0 control chars (incl. `\n`, `\r`, `\t`) or DEL; ≤ 500 chars measured on the trimmed string; stored/returned as text only.

### File List

**Added**
- `backend/app/db/models.py`
- `backend/app/schemas/todo.py`
- `backend/app/repositories/todo_repo.py`
- `backend/app/services/todo_service.py`
- `backend/app/api/routes/todos.py`
- `backend/migrations/versions/0002_create_todos.py`
- `backend/tests/unit/test_todo_schema.py`
- `backend/tests/unit/test_todo_service.py`
- `backend/tests/integration/test_todos_create.py`
- `backend/tests/integration/test_todos_validation.py`
- `backend/tests/integration/test_todos_list.py`

**Modified**
- `backend/app/api/router.py` (include `todos.router`)
- `backend/migrations/env.py` (import `app.db.models` for autogenerate metadata)
- `backend/tests/integration/conftest.py` (session-scoped schema fixture)
- `backend/tests/integration/test_migrations.py` (assert 0002 head; restore head after downgrade)
- `docs/AI-INTEGRATION-LOG.md` (Story 2.1 entries)

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-23 | Story 2.1 created (ready-for-dev). Context engine analysis of epics §Story 2.1, architecture spine (AD-2/3/4/5/9/12), and existing backend (errors, session, router, conftest). |
| 2026-07-23 | Story 2.1 implemented: `Todo` model + `0002_create_todos` migration (pgcrypto, CHECK, `created_at DESC` index), Pydantic schemas with shared description validation + `Z`-suffix serializer, repository chokepoint (AD-2/AD-9), domain service, and `GET`/`POST /api/todos` routes. Added 39 tests (17 unit + 22 integration) run against throwaway Postgres 17 on :5433; whole suite 50 passed, 96% branch coverage (report-only), ruff clean. Status → review. |
| 2026-07-23 | Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Approved. All 8 ACs verified. 1 Low patch applied (service `Session` import moved under `TYPE_CHECKING` — zero SQLAlchemy at runtime in the service, airtight AD-2). 2 Low findings dismissed (documented). Full suite re-run green (50 passed, 96% branch coverage, ruff clean). Status → done. |

## Tasks / Subtasks — Review Findings

### Review Findings

- [x] [Review][Patch] Service imported `sqlalchemy.orm.Session` at runtime for a type-only annotation [backend/app/services/todo_service.py:13] — FIXED. Moved under `TYPE_CHECKING`; with `from __future__ import annotations` the annotation is never evaluated at runtime, so the service layer now imports zero SQLAlchemy at runtime, matching its docstring and tightening the AD-2 chokepoint. Full suite re-run green.
- [x] [Review][Dismiss] Unicode line separators (U+2028/U+2029, NEL `\x85`) are not rejected by the C0+DEL control-char check [backend/app/schemas/todo.py:validate_description] — DISMISSED (Low, by-design for v1). The AC's stated rule and test scenarios cover "empty/whitespace-only/embedded-newline/control chars" (C0 + DEL + `\n`/`\r`/`\t`), all enforced and tested. Descriptions are stored/returned as text only (NFR-Sec) and the same rule is mirrored client-side (Epic 3). Extending to exotic Unicode separators is out of scope for single-user v1 (YAGNI); revisit if a real need surfaces.
- [x] [Review][Dismiss] Routes import `sqlalchemy.orm.Session` at runtime [backend/app/api/routes/todos.py] — DISMISSED (by-design, required). FastAPI resolves the `Annotated[Session, Depends(get_db)]` dependency via `get_type_hints` at route registration, so the runtime import is mandatory; `Session` is a session type, not a query API. Consistent with the accepted `health.py` pattern (per the Story 1.2 review precedent).

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.8 (1M context), acting across three adversarial layers (Blind Hunter / Edge Case Hunter / Acceptance Auditor). No subagent-spawn tool was available in this environment, so the layers were conducted in-session — the documented fallback.
**Date:** 2026-07-23
**Review mode:** full (spec = this story file). Diff target: working tree vs the Epic 1 baseline commit `000c3de` (`git diff HEAD` plus untracked new files) — 15 files, ~814 lines of backend code + tests.
**Outcome:** **Approve.** All eight acceptance criteria are satisfied and independently verified by the passing test suite (28 unit + 22 integration; 50 passed) plus direct schema inspection (`\d todos`) and an empty `--autogenerate` diff proving model ↔ migration parity. No High/Medium findings. One Low patch applied; two Low findings dismissed with rationale.

**Acceptance audit (all satisfied):**
- AC1 — `0002_create_todos` migration is additive (`down_revision = 0001_baseline`), creates `pgcrypto` then `todos` with the four columns, PK, `char_length BETWEEN 1 AND 500` CHECK, and `created_at DESC` index; `upgrade head`/`downgrade base` both verified.
- AC2 — model/schemas/repository/service all created; after the patch, SQLAlchemy query/session APIs are confined to `repositories`/`db` (service imports zero SQLAlchemy at runtime).
- AC3 — no `owner_id`, no auth; the repository query carries the AD-9 owner-seam comment.
- AC4 — `GET /api/todos` → `200 {todos:[…]}`, `created_at DESC` + `id DESC` tiebreak, `snake_case` keys, `created_at` `…Z` (tested for ordering, tiebreak, shape, and Z-suffix).
- AC5 — `POST /api/todos` → `201` bare Todo, `completed=false`, server `created_at`, trimmed description (tested incl. surrounding-whitespace trim).
- AC6 — invalid inputs (empty / whitespace / newline / tab / >500) → `422` AD-5 envelope with `details[].field == "description"` and zero rows created (tested per case).
- AC7 — parameterized ORM constructs only (`select()`, object construction); no string interpolation.
- AC8 — description stored/returned verbatim as text.

**Coverage note (report-only):** 96% branch overall; new modules `models.py`, `todos.py` route, `todo_repo.py`, `todo_service.py` at 100%; `schemas/todo.py` 95% (the single uncovered line is the naive-datetime defensive guard in the `created_at` serializer, unreachable with `TIMESTAMPTZ`).

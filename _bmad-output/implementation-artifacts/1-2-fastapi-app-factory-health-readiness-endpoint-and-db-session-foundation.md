---
baseline_commit: NO_VCS
---

# Story 1.2: FastAPI app factory, health/readiness endpoint, and DB session foundation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the FastAPI application factory with a per-request synchronous DB session, structured logging, env-based config, the Alembic baseline, and a `GET /api/health` readiness endpoint,
so that the service starts, reports liveness + DB readiness, and provides the layered substrate (routes → services → repositories → db) and the error-envelope scaffold that feature endpoints extend.

## Acceptance Criteria

1. **App factory + scaffold.** `app/main.py` exposes a `create_app()` factory that:
   - mounts a single `/api` router (`app/api/router.py` aggregating route modules);
   - installs centralized exception handlers producing the AD-5 error envelope `{ "error": { "code": string, "message": string, "details"?: [{field, issue}] } }` for every non-2xx, **including a handler that remaps FastAPI's native `RequestValidationError` (default `422 {detail:[…]}`) into that same envelope**;
   - configures `pydantic-settings` env config in `app/core/config.py` (reads `DATABASE_URL`, `CORS_ORIGINS`, `LOG_LEVEL` per `backend/.env.example`);
   - configures structured JSON stdout logging in `app/core/logging.py` emitting one JSON line per request with a per-request request id.
2. **DB session foundation (AD-12).** `app/db/session.py` exposes a **synchronous** SQLAlchemy 2.0 + psycopg 3 `Engine` built from `settings.database_url`, a `sessionmaker`, and a FastAPI dependency (`get_db`) that yields one `Session` per request and closes it at request end.
3. **Alembic baseline (AD-11).** An Alembic environment exists under `backend/migrations/` (env.py, alembic.ini, one baseline revision with **no feature tables**) that runs cleanly with `alembic upgrade head` and reverses with `alembic downgrade base`.
4. **Health/readiness — healthy (FR-4, API Contract).** Against a reachable Postgres, `GET /api/health` returns `200 { "status": "ok", "db": "ok" }` after a **real DB round-trip** (`SELECT 1`).
5. **Health/readiness — DB down.** When the DB is unreachable, `GET /api/health` returns `503`, logs the failure, and the process does **not** crash.
6. **Layering (AD-2).** SQLAlchemy query/session APIs appear only in `app/repositories/` and `app/db/`. `app/api/` (routes) and `app/services/` never import SQLAlchemy query APIs. Dependencies point downward only: routes → services → repositories → db.

## Tasks / Subtasks

- [x] **Task 1 — Config + logging core (AC: 1)**
  - [x] `app/core/config.py`: `Settings(BaseSettings)` via `pydantic-settings` with fields `database_url: str`, `cors_origins: list[str]` (parsed from comma-separated env), `log_level: str = "info"`; `model_config = SettingsConfigDict(env_file=".env", extra="ignore")`. Provide a cached `get_settings()` accessor (`functools.lru_cache`).
  - [x] `app/core/logging.py`: `configure_logging(level)` installing a JSON stdout formatter (stdlib `logging` + a small JSON formatter — no external log lib in the pinned deps). Expose a helper to bind/emit a per-request log line with a `request_id`.
- [x] **Task 2 — DB session foundation (AC: 2, 6)**
  - [x] `app/db/base.py`: declarative `Base` (`DeclarativeBase`) so future models (Story 2.1) register metadata; no `Todo` model here yet.
  - [x] `app/db/session.py`: `create_engine(settings.database_url, pool_pre_ping=True, future=True)`, `SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)`, and `get_db()` generator dependency that `yield`s a session inside try/finally `close()`.
- [x] **Task 3 — Error envelope + exception handlers (AC: 1)**
  - [x] `app/core/errors.py`: an `AppError` base exception carrying `code`, `message`, `status_code`, optional `details`; a Pydantic (or TypedDict) `ErrorEnvelope` shape.
  - [x] Handlers registered in the factory: (a) `AppError` → its status + envelope; (b) `RequestValidationError` → `422` envelope with `details=[{field, issue}]` derived from the validation errors; (c) `HTTPException` → envelope; (d) catch-all `Exception` → `500` envelope (message must not leak internals). Each logs appropriately.
- [x] **Task 4 — Health endpoint + router wiring (AC: 1, 4, 5)**
  - [x] `app/api/routes/health.py`: `GET /health` (mounted under `/api`) depending on `get_db`; runs `db.execute(text("SELECT 1"))`. On success → `200 {"status":"ok","db":"ok"}`. On DB error → raise so it maps to `503 {"error":...}` (use a dedicated handler/`AppError` with `status_code=503`; must log and not crash). NOTE: the SQL round-trip via `text("SELECT 1")` is data-access — keep it thin here per AD-12's request-session pattern; it is acceptable in the route for a liveness probe since there is no repository yet, but do not add business SQL to routes.
  - [x] `app/api/router.py`: `api_router = APIRouter()`; include `health.router`. `create_app()` does `app.include_router(api_router, prefix="/api")`.
  - [x] Request-id + JSON-log middleware: assign/propagate a `request_id` (accept inbound `X-Request-ID` else generate uuid4), emit one structured JSON line per request, return it on the response header.
  - [x] CORS: enable `CORSMiddleware` with `settings.cors_origins` **only** when origins are configured (dev profile, AD-10).
- [x] **Task 5 — Alembic baseline (AC: 3)**
  - [x] `backend/alembic.ini` + `backend/migrations/env.py` wired to `settings.database_url` and `Base.metadata` (target_metadata) so autogenerate works for Story 2.1. Use the sync engine.
  - [x] One baseline revision (empty upgrade/downgrade, or creating only the `pgcrypto`/`gen_random_uuid` prerequisite if trivial — but no `todos` table; that is Story 2.1). `upgrade head` then `downgrade base` must both succeed.
  - [x] Remove/replace the `migrations/.gitkeep` placeholder from Story 1.1 as the real env lands.
- [x] **Task 6 — Uvicorn entrypoint (AC: 1)**
  - [x] Module-level `app = create_app()` in `main.py` so `uvicorn app.main:app` works. Keep `app_name()` helper only if a test still needs it; otherwise the Story 1.1 placeholder test must be updated (do not leave a dead placeholder asserting removed behavior).
- [x] **Task 7 — Unit tests (AC: 1, 5, 6)** in `backend/tests/unit/`
  - [x] `test_error_envelope.py`: raising an `AppError` and triggering a `RequestValidationError` each produce the exact AD-5 envelope keys/shape; catch-all maps to 500 envelope.
  - [x] `test_logging.py`: a request emits exactly one structured JSON log line containing a `request_id` (capture via caplog or a StringIO stream handler; assert it parses as JSON).
  - [x] `test_health_db_down.py`: with `get_db` overridden to a session whose `execute` raises, `GET /api/health` returns `503` + envelope and does not raise out of the app (use `TestClient(raise_server_exceptions=False)` or dependency override).
  - [x] `test_config.py` may live here but note `core/config.py` is coverage-omitted; still fine to smoke-test env parsing of `CORS_ORIGINS`.
- [x] **Task 8 — Integration tests + transactional-rollback fixture (AC: 3, 4)** in `backend/tests/integration/`
  - [x] `conftest.py`: the **transactional-rollback fixture** — open a connection, `begin()` a transaction, bind a `Session` to that connection, yield it, then `rollback()` + close after each test (SQLAlchemy 2.0 "join an external transaction" pattern with SAVEPOINT restart on commit). Override the app's `get_db` to use this session. This establishes the reusable pattern for Epic 2.
  - [x] `test_health.py`: `GET /api/health` → `200 {"status":"ok","db":"ok"}` against real Postgres.
  - [x] `test_migrations.py`: run `alembic upgrade head` then `downgrade base` against the test DB; assert both exit success.
  - [x] Gate integration tests behind availability of a test Postgres. Prefer a real DB (see Dev Notes → Postgres provisioning). If genuinely unavailable, `pytest.mark.skip` with a clear reason — never fake a pass. Ensure the DB-down + envelope + logging logic still has unit coverage regardless.

## Dev Notes

### Architecture patterns & constraints (FOLLOW EXACTLY)

- **App-factory pattern** — `create_app()` builds and returns the `FastAPI` instance; all wiring (routers, middleware, exception handlers, CORS, logging) happens inside it so tests can build isolated apps. Module-level `app = create_app()` is the ASGI target. [Source: architecture spine §Source tree — `main.py # app factory, exception handlers, router mount`]
- **AD-12 Synchronous DB, one session per request** — sync SQLAlchemy 2.0 + psycopg 3 only. No async DB. Session provided via FastAPI dependency, closed at request end. FastAPI runs sync path operations in its threadpool. [Source: spine AD-12]
- **AD-2 Layered backend + repository chokepoint** — `routes → services → repositories → db`, downward only. SQLAlchemy (models, queries, sessions) confined to `repositories`/`db`; routes/services never import SQLAlchemy query APIs. (The health probe's `SELECT 1` is a liveness round-trip through the request session dependency, not business data access — no repository exists yet; do not treat it as license to put feature SQL in routes.) [Source: spine AD-2, Design Paradigm]
- **AD-5 Uniform error envelope** — every non-2xx is `{ "error": { "code", "message", "details"? } }`, produced by centralized handlers, including the `RequestValidationError` remap. `details` is `[{field, issue}]`. [Source: spine AD-5, Consistency Conventions → Error shape]
- **AD-11 Startup/durability ordering** — backend entrypoint runs `alembic upgrade head` before serving; migrations additive/non-destructive. This story delivers the Alembic **env + baseline only**; the compose entrypoint that invokes `upgrade head` is Epic 5. [Source: spine AD-11]
- **AD-10 Single-origin / CORS dev-only** — CORS enabled only when `CORS_ORIGINS` is set (dev profile). [Source: spine AD-10]
- **Config** — 12-factor env vars via `pydantic-settings`. No secrets in v1. [Source: spine Consistency Conventions → Config]
- **Logging** — structured JSON to stdout, one line per request with a request id. [Source: spine Consistency Conventions → Logging]
- **Health contract** — `GET /api/health` → `200 { "status": "ok", "db": "ok" }`; `503` if DB unreachable. Liveness + readiness (checks a DB round-trip). [Source: spine API Contract row 1]

### Source tree components to touch

```text
backend/app/
  main.py              # UPDATE — replace Story 1.1 placeholder with create_app() factory + module-level app
  api/
    router.py          # NEW — aggregates route modules under /api
    routes/health.py   # NEW — GET /health
  core/
    config.py          # NEW — pydantic-settings (coverage-omitted per pyproject)
    logging.py         # NEW — JSON stdout logging + request-id helper
    errors.py          # NEW — AppError + envelope shape + handler registration helper
  db/
    base.py            # NEW — DeclarativeBase (metadata registry for future models)
    session.py         # NEW — engine + SessionLocal + get_db dependency
backend/
  alembic.ini          # NEW
  migrations/env.py    # NEW (replaces migrations/.gitkeep)
  migrations/versions/<baseline>.py  # NEW — empty baseline revision
backend/tests/
  unit/test_error_envelope.py, test_logging.py, test_health_db_down.py  # NEW
  integration/conftest.py, test_health.py, test_migrations.py           # NEW
```

[Source: spine §Source tree]

### Existing code state (READ before editing)

- `backend/app/main.py` currently holds a **placeholder** `app_name()` helper and `APP_NAME` constant, with a docstring explicitly stating the real factory arrives in Story 1.2. **Replace it** with the factory. `backend/tests/unit/test_placeholder.py` imports `app_name` — update or remove that test so nothing asserts removed behavior (do not leave a dead import that breaks collection).
- All `app/<layer>/__init__.py` package markers already exist (Story 1.1). `app/api/routes/__init__.py` exists.
- `backend/.env.example` defines `DATABASE_URL=postgresql+psycopg://todo:todo@localhost:5432/todo`, `CORS_ORIGINS=http://localhost:5173`, `LOG_LEVEL=info`. Match these names exactly in `Settings`.
- `pyproject.toml` already pins the deps (fastapi 0.136.x, pydantic-settings 2.x, sqlalchemy 2.0.x, psycopg[binary] 3.x, alembic ~1.14+, uvicorn 0.34.x) and dev deps (pytest, pytest-cov, ruff). No new runtime deps should be needed. `httpx` is required by FastAPI's `TestClient` — it ships transitively with `fastapi`/`starlette`'s test client via `httpx`; if `TestClient` import fails, add `httpx` under the `dev` optional-deps (do NOT add to runtime deps).
- Coverage config: `app/core/config.py`, `migrations/*`, and all `__init__.py` are **omitted**; branch coverage on; gate is **report-only** at this stage (flips to enforcing in Story 6.2). Keep it report-only — do not add a `--cov-fail-under`.

### Postgres provisioning for integration tests

Docker IS available in this environment (verified: `docker` running). The full application docker-compose stack is NOT delivered until Epic 5 — do NOT build it. Provision a lightweight standalone Postgres 17 for tests only:

```
docker run -d --name todo-test-pg -e POSTGRES_USER=todo -e POSTGRES_PASSWORD=todo \
  -e POSTGRES_DB=todo -p 5433:5432 postgres:17
```

Use `postgresql+psycopg://todo:todo@localhost:5433/todo` as the test `DATABASE_URL` (port 5433 to avoid colliding with any local 5432). Wait for `pg_isready` before running. Tear the container down after. If Docker were unavailable, the integration tests must `skip` with a clear reason and the DB-down/envelope/logging paths must still be unit-covered (via dependency override / mock) — never fake a pass.

### Testing standards

- Backend `pytest`; tests in `backend/tests/{unit,integration}`; `python_files = ["test_*.py"]`; `addopts = -ra`. [Source: pyproject.toml, spine Testing Architecture]
- **Unit:** fast, no DB — exercise handlers/logging/health-db-down via dependency overrides & mocks.
- **Integration:** `TestClient` (or httpx) against **real Postgres**, each test wrapped in a transaction **rolled back** after (transactional-rollback fixture — the RESOLVED integration-DB mechanism; testcontainers NOT used). [Source: spine Testing Architecture, Deferred → Integration-test DB mechanism]
- Run everything with the pinned toolchain: backend venv Python 3.12 (`backend/.venv/bin/python`, pyenv 3.12.13), Node 22 via nvm (not needed for this story). Do NOT use system python3 (3.9). Report real pass/fail numbers.
- **AI-integration log:** append a concise, honest entry for Story 1.2 to `docs/AI-INTEGRATION-LOG.md` (incremental requirement seeded in 1.1).

### Project Structure Notes

- Layout matches the architecture Source Tree exactly. One addition beyond the literal spine list: `app/api/router.py` (aggregator) and `app/core/errors.py` + `app/db/base.py` — these are conventional, dependency-honoring seams the spine implies (router mount, centralized handlers, declarative base) and introduce no new layer or upward dependency.
- No `todos` table / `Todo` model here — deferred to Story 2.1 (per spine data model + this story's scope). Alembic baseline is intentionally empty of feature tables.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] — ACs, test scenarios, traceability (FR-4, AD-2, AD-5 scaffold, AD-11, AD-12; NFR-Rel, NFR-Deploy).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md] — AD-2, AD-5, AD-10, AD-11, AD-12; API Contract (`GET /api/health`); Consistency Conventions (config/logging/error shape); Source tree; Testing Architecture; Deferred (integration-DB mechanism = transactional-rollback fixtures).
- [Source: _bmad-output/implementation-artifacts/1-1-repository-skeleton-and-tooling-baseline.md] — scaffold state, coverage-is-report-only policy, runtime pins, placeholder `main.py`/test to replace.
- [Source: backend/.env.example] — env var names/values.
- [Source: backend/pyproject.toml] — pinned deps, pytest + coverage config.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `claude-opus-4-8[1m]`

### Debug Log References

- Runtime pins honored: backend `backend/.venv` Python **3.12.13** (pyenv), Node **22.23.1** (nvm; not exercised by this backend story). System python3 (3.9) NOT used. `_bmad` Python resolver requires 3.11+ (tomllib); ran it with the venv interpreter as the documented fallback.
- `pydantic-settings` JSON-decodes `list[str]` env values by default, which broke `CORS_ORIGINS=http://localhost:5173` (not JSON). Fixed with `Annotated[list[str], NoDecode, BeforeValidator(_split_origins)]` so the comma-separated 12-factor string parses correctly.
- Ruff B008 on `Depends(get_db)` as a default arg → switched the health route to `Annotated[Session, Depends(get_db)]` (recommended FastAPI pattern, lint-clean).
- Integration skip-gating bug caught during dev: a module-level `pytestmark` in `conftest.py` does NOT propagate to sibling test modules (integration tests errored instead of skipping when the DB was down). Replaced with a `pytest_collection_modifyitems` hook that skips every integration item with a clear reason when no test Postgres is reachable — verified it skips (3 skipped) with a dead DSN and passes with a live one.
- Starlette emits a harmless `StarletteDeprecationWarning` (httpx vs httpx2) from `TestClient`; non-blocking, left as-is.

### Completion Notes List

- **App factory** (`app/main.py`): `create_app(settings=None)` wires the `/api` router, request-id + JSON-log HTTP middleware (accepts inbound `X-Request-ID`, else uuid4; echoes it on the response; one JSON line per request), conditional CORS (dev-profile only, AD-10), and the centralized exception handlers. Module-level `app = create_app()` is the `uvicorn app.main:app` target.
- **Config** (`app/core/config.py`): `pydantic-settings` `Settings` reading `DATABASE_URL`/`CORS_ORIGINS`/`LOG_LEVEL` exactly per `backend/.env.example`; cached `get_settings()`.
- **Logging** (`app/core/logging.py`): stdlib-only JSON stdout formatter (`JsonFormatter`), `configure_logging(level)` (idempotent), merges structured extras (request_id, method, path, status, duration_ms).
- **Errors** (`app/core/errors.py`): `AppError` base + `DatabaseUnavailableError` (503); handlers for `AppError`, `RequestValidationError` (remapped to the AD-5 `{field, issue}` envelope), `HTTPException`, and a catch-all `Exception` → 500 that never leaks internals. All non-2xx share `{ "error": { code, message, details? } }`.
- **DB session** (`app/db/base.py`, `app/db/session.py`): `DeclarativeBase`; sync SQLAlchemy 2.0 + psycopg 3 engine (`pool_pre_ping`), `SessionLocal` sessionmaker, `get_db()` one-session-per-request dependency closed in `finally` (AD-12). SQLAlchemy confined to `db/` (+ future `repositories/`); routes/services import none of its query APIs (AD-2).
- **Health** (`app/api/routes/health.py`): `GET /api/health` runs `SELECT 1` via the request session → `200 {"status":"ok","db":"ok"}`; on `SQLAlchemyError` logs and raises `DatabaseUnavailableError` → `503` envelope, process does not crash.
- **Alembic** (`backend/alembic.ini`, `migrations/env.py`, `migrations/script.py.mako`, `migrations/versions/0001_baseline.py`): env reads `DATABASE_URL` from Settings and targets `Base.metadata` (autogenerate-ready for Story 2.1); empty baseline revision (no feature tables). `upgrade head` then `downgrade base` both succeed.
- **Tests:** 8 unit + 3 integration, all passing against a real Postgres 17. Branch coverage 95% (report-only; gate flips to enforcing in Story 6.2). Unit coverage of the DB-down/envelope/logging logic runs without any DB (dependency overrides / in-memory handler / monkeypatched env).
- **Postgres provisioning:** Docker IS available in this environment. Provisioned a lightweight standalone `postgres:17` container (`todo-test-pg`) on host port **5433** (avoids colliding with any local 5432) — NOT the full application docker-compose stack (that is Epic 5). Integration tests default to `TEST_DATABASE_URL=postgresql+psycopg://todo:todo@localhost:5433/todo` and skip honestly (with a clear reason) if no test DB is reachable.
- **Scope deferrals (as designed):** no `todos` table / `Todo` model (Story 2.1); no docker-compose/Dockerfile/entrypoint `alembic upgrade head` wiring (Epic 5); feature endpoints extend this scaffold in Epic 2.

### File List

**Backend — source (new)**
- `backend/app/core/config.py`
- `backend/app/core/logging.py`
- `backend/app/core/errors.py`
- `backend/app/db/base.py`
- `backend/app/db/session.py`
- `backend/app/api/router.py`
- `backend/app/api/routes/health.py`

**Backend — source (modified)**
- `backend/app/main.py` (replaced Story 1.1 placeholder with the `create_app()` factory + ASGI `app`)
- `backend/pyproject.toml` (added `httpx` to `dev` optional-deps for the Starlette TestClient)

**Backend — Alembic (new)**
- `backend/alembic.ini`
- `backend/migrations/env.py`
- `backend/migrations/script.py.mako`
- `backend/migrations/versions/0001_baseline.py`

**Backend — tests (new)**
- `backend/tests/unit/test_error_envelope.py`
- `backend/tests/unit/test_logging.py`
- `backend/tests/unit/test_health_db_down.py`
- `backend/tests/unit/test_config.py`
- `backend/tests/integration/conftest.py`
- `backend/tests/integration/test_health.py`
- `backend/tests/integration/test_migrations.py`

**Backend — removed**
- `backend/tests/unit/test_placeholder.py` (Story 1.1 placeholder; superseded by real tests)
- `backend/migrations/.gitkeep` (replaced by the real Alembic env)

**Docs**
- `docs/AI-INTEGRATION-LOG.md` (appended Story 1.2 entries)

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-23 | Story 1.2 implemented: FastAPI `create_app()` factory with `/api` router mount, centralized AD-5 error-envelope handlers (incl. `RequestValidationError` remap), `pydantic-settings` env config, structured JSON request logging with request id, synchronous SQLAlchemy 2.0 + psycopg 3 engine/session + `get_db` per-request dependency (AD-12), and the Alembic baseline (empty; `upgrade head`/`downgrade base` verified, AD-11). Added `GET /api/health` liveness+readiness (200 healthy / 503 DB-down). Added 8 unit + 3 integration tests (transactional-rollback fixture against real Postgres 17 via a standalone test container on :5433); 11 passed, 95% branch coverage (report-only). Ruff clean. Status → review. |
| 2026-07-23 | Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor): Approved. All 6 ACs verified satisfied. No High/Medium findings; 4 Low findings triaged (3 dismissed as false-positive/by-design, 1 recorded as a transparent observability note). No code changes required. Status → done. |

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.8 (1M context), acting across three adversarial layers (Blind Hunter / Edge Case Hunter / Acceptance Auditor).
**Date:** 2026-07-23
**Review mode:** full (spec = this story file). No VCS in this repo, so the review target was the full contents of every file in the File List.
**Outcome:** **Approve.** All six acceptance criteria are satisfied and independently verified by the passing test suite (8 unit + 3 integration, 11 passed; `alembic upgrade head`/`downgrade base` cycle succeeds; ruff clean). No blocking or medium-severity issues.

**Acceptance audit (all satisfied):** AC1 app factory + `/api` mount + AD-5 handlers incl. `RequestValidationError` remap + `pydantic-settings` + JSON request-id logging; AC2 sync engine + `sessionmaker` + `get_db` one-session-per-request closed in `finally` (AD-12); AC3 Alembic baseline cycle; AC4 health `200 {status:ok,db:ok}` via real `SELECT 1`; AC5 DB-down → `503`, logged, no crash; AC6 SQLAlchemy query APIs confined to `db/` (the `SELECT 1` round-trip lives in `app/db/session.check_connection`, not the route).

### Review Findings

- [x] [Review][Defer] Unhandled 500s skip the per-request access-log line and the `X-Request-ID` response header [backend/app/main.py:~35] — deferred, non-blocking. Starlette's catch-all `Exception` handler runs in the outermost `ServerErrorMiddleware`, outside the custom request-logging middleware, so a truly-unexpected exception propagates past the access-log emit and header-set. Mitigated: the catch-all handler itself logs `unhandled_error` WITH the `request_id`, so every failure still emits a request-id-tagged line; all handled 4xx/503 paths get both the access line and the header. Acceptable for v1; revisit if uniform access logging on 500s is wanted (e.g. wrap in an ASGI middleware inside `ServerErrorMiddleware`).
- Dismissed (Low, no action): (a) health route imports the `Session` symbol from `sqlalchemy.orm` — a type annotation required at runtime by FastAPI DI, not a query API, so AC6 holds; (b) `check_connection` catches only `SQLAlchemyError` — this is the correct, complete boundary since SQLAlchemy wraps all DBAPI/pool/connection failures as `SQLAlchemyError` subclasses; (c) inbound `X-Request-ID` echoed unvalidated — log injection is prevented by JSON-encoding and header-splitting by the ASGI server, negligible at single-user scale.

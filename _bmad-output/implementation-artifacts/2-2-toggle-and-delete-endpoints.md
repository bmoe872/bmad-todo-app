---
baseline_commit: 5f0c5f6
---

# Story 2.2: Toggle and delete endpoints

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an API consumer,
I want to toggle a Todo's completion in both directions and permanently delete a Todo,
so that the client can complete/reactivate and remove Todos with server-truth reconciliation.

## Acceptance Criteria

1. **Toggle endpoint — success (FR-2, FR-5, AD-3).** `PATCH /api/todos/{id}` with `{ "completed": true }` or `{ "completed": false }` returns `200` with the updated bare `Todo` object. The `completed` field is set to the requested value in **either direction** (active→completed and completed→active) and the change is **persisted**. Only `completed` is mutable — the description (and any other field) is never changed, even if extra keys are sent in the body. The row's List position/ordering is **unchanged** (no `created_at`/`id` mutation).
2. **Toggle endpoint — not found (AD-5).** `PATCH /api/todos/{id}` for an id that does not exist returns `404` in the uniform AD-5 envelope `{ "error": { "code", "message", "details"? } }`. No row is created or modified.
3. **Toggle endpoint — invalid body (AD-5).** When `completed` is missing or non-boolean, the endpoint returns `422` in the AD-5 envelope with `details` naming the field (`completed`). No row is modified.
4. **Delete endpoint — success (FR-3).** `DELETE /api/todos/{id}` for an existing id returns `204` (empty body) and the row is **permanently removed** from persistence.
5. **Delete endpoint — already gone (FR-3).** `DELETE /api/todos/{id}` for an id that does not exist (or was already deleted) returns `404` in the AD-5 envelope. The client treats `404` as already-gone and reconciles.
6. **UUID-typed path + route-ordering safety (AD-4).** `{id}` is typed as `uuid.UUID` so a malformed id yields `422` (via the path-validation → AD-5 envelope) rather than reaching the service. The parametric `/{id}` routes are declared **at the end** of the todos router so that the future static `DELETE /api/todos/completed` (Story 2.3) can be registered **above** them without being swallowed by `/{id}`. A code comment records this ordering requirement. **Do not add a `/completed` route in this story** — that is Story 2.3's scope.
7. **Layering + parameterized queries preserved (AD-2, NFR-Sec).** The new get/toggle/delete data access lives **only** in the repository (`app/repositories/todo_repo.py`) — the single AD-2 chokepoint / AD-9 owner seam. Routes and services never import SQLAlchemy query APIs. All queries are parameterized SQLAlchemy constructs (no string interpolation of the id).

## Tasks / Subtasks

- [x] **Task 1 — Not-found domain error (AC: 2, 5)** in `backend/app/core/errors.py`
  - [x] Added `NotFoundError(AppError)` with `code="not_found"`, `status_code=404`, overridable default `message="Todo not found"`. Flows through the existing `_handle_app_error` → AD-5 envelope with no new handler.
  - [x] Uses the domain error, not `HTTPException(404)`, for a clean stable `code`.
- [x] **Task 2 — Update schema (AC: 1, 3)** in `backend/app/schemas/todo.py`
  - [x] Added `TodoUpdate(BaseModel)` with `completed: StrictBool`. Rejects non-JSON-boolean (strings/ints) and missing field → AD-5 `422` with `details[].field == "completed"`.
  - [x] No other mutable fields; extra body keys ignored. `TodoRead` reused unchanged for the response.
- [x] **Task 3 — Repository get/toggle/delete (AC: 1, 4, 7)** in `backend/app/repositories/todo_repo.py`
  - [x] `get(todo_id) -> Todo | None`: `select(Todo).where(Todo.id == todo_id)` → `scalar_one_or_none()` (parameterized bind).
  - [x] `set_completed(todo_id, completed) -> Todo | None`: get, set flag, `commit`+`refresh`; `None` if absent. `created_at`/`id` untouched.
  - [x] `delete(todo_id) -> bool`: get, `db.delete`, `commit`; `False` if absent.
  - [x] AD-9 owner-seam comment carried on the `get` query.
- [x] **Task 4 — Service toggle/delete (AC: 1, 2, 4, 5)** in `backend/app/services/todo_service.py`
  - [x] `toggle_todo(todo_id, completed) -> Todo`: delegates to repo; raises `NotFoundError()` on `None`.
  - [x] `delete_todo(todo_id) -> None`: delegates to repo; raises `NotFoundError()` on `False`.
  - [x] `Session` import stays under `TYPE_CHECKING`; no runtime SQLAlchemy import added. Imports `NotFoundError`, `uuid`.
- [x] **Task 5 — Routes (AC: 1, 2, 3, 4, 5, 6)** in `backend/app/api/routes/todos.py`
  - [x] `PATCH /todos/{todo_id}` (`uuid.UUID`), body `TodoUpdate`, `response_model=TodoRead`, `200`.
  - [x] `DELETE /todos/{todo_id}` (`uuid.UUID`), `status_code=204`, returns `None` (empty body).
  - [x] Both `/{todo_id}` routes declared LAST with a route-order comment marking the `/completed` (2.3) seam.
  - [x] No router-wiring change needed.
- [x] **Task 6 — Unit tests (AC: 1, 2, 5)** in `backend/tests/unit/` (no DB)
  - [x] Extended `test_todo_service.py`: `_FakeRepo` gains `get`/`set_completed`/`delete`; toggle both directions; toggle/delete missing → `NotFoundError` (404, `not_found`); delete present → `None`.
  - [x] Added `TodoUpdate` schema tests in `test_todo_schema.py`: accepts bool; rejects missing + non-bool (`"yes"`, `1`, `0`, `None`).
- [x] **Task 7 — Integration tests (AC: 1, 2, 3, 4, 5)** in `backend/tests/integration/` (real Postgres, rollback fixture)
  - [x] Reused existing `conftest.py` fixtures unchanged (todos table already migrated by Story 2.1).
  - [x] `test_todos_toggle.py` (8 tests): both-direction flip persisted; only-`completed`-mutable (extra key ignored); no reorder on toggle; missing → 404 envelope; missing/non-bool body → 422; malformed UUID → 422.
  - [x] `test_todos_delete.py` (6 tests): 204 + empty body; row gone; missing → 404; double-delete second → 404; other rows untouched; malformed UUID → 422.
  - [x] Honest skip re-verified against a dead DSN (36 integration items skipped, no false pass).
- [x] **Task 8 — Lint + full run (AC: all)**
  - [x] `ruff check .` clean. Full suite against throwaway Postgres 17 on host port **5434**: 76 passed (40 unit + 36 integration), 97% branch coverage (report-only). Container torn down after.

## Dev Notes

### Architecture patterns & constraints (FOLLOW EXACTLY)

- **AD-2 Layered backend + repository chokepoint.** `routes → services → repositories → db`, downward only. The new `get`/`set_completed`/`delete` SQLAlchemy access lives ONLY in `app/repositories/todo_repo.py`. Routes and services must not import SQLAlchemy query APIs. Mutate the ORM attribute (`todo.completed = …`) inside the repository, not the service, so the chokepoint stays airtight (the service's `Session` import remains under `TYPE_CHECKING`). [Source: architecture-spine §AD-2; existing `app/services/todo_service.py` review precedent in Story 2.1]
- **AD-3 Todo canonical shape + ordering.** `Todo = { id, description, completed, created_at }`. **Toggling `completed` never reorders or removes a row** — completed items stay in place, only their flag flips. Do not touch `created_at` or `id` on update. [Source: architecture-spine §AD-3]
- **AD-4 REST contract + route ordering.** `PATCH /api/todos/{id}` → `200 Todo` / `404` / `422`; `DELETE /api/todos/{id}` → `204` / `404`. `{id}` typed as UUID. The static `DELETE /api/todos/completed` (Story 2.3) must register **before** the parametric `/{id}` — so declare `/{id}` routes last and leave the seam open. [Source: architecture-spine §AD-4, §API Contract]
- **AD-5 Uniform error envelope.** Every non-2xx is `{ "error": { "code", "message", "details"? } }` from the centralized handlers ALREADY in `app/core/errors.py`. A raised `AppError` subclass (new `NotFoundError`, status 404) flows through `_handle_app_error`; body-validation failures (missing/non-bool `completed`) flow through the existing `RequestValidationError` handler → `422` with `details=[{field, issue}]`; a malformed UUID in the path is also a `RequestValidationError` → `422`. **No new handler is required.** [Source: architecture-spine §AD-5; existing `app/core/errors.py`]
- **AD-9 Auth seam open.** No `owner_id`, no auth. A future owner filter attaches at the repository `get` `.where(...)`. [Source: architecture-spine §AD-9]
- **AD-12 Sync DB, one session per request.** Use the existing `get_db` dependency; sync SQLAlchemy 2.0 + psycopg 3; no async. [Source: architecture-spine §AD-12; existing `app/db/session.py`]
- **Success/status conventions.** Single resource → the **bare** `Todo` object (PATCH returns the Todo directly, not wrapped). 200 update, 204 delete, 404 not-found, 422 validation. `snake_case` wire keys; `created_at` ends in `Z` (already handled by `TodoRead`'s serializer). [Source: architecture-spine §Consistency Conventions]
- **NFR-Sec.** Parameterized `.where(Todo.id == todo_id)` bind — never string-interpolate the id. Only `completed` is mutable server-side (no text editing path exists). [Source: architecture-spine §AD-5, §NFR-Sec]

### Existing code to build on (READ THESE — do not reinvent)

- `app/core/errors.py` — `AppError` base (`code`, `message`, `status_code`, `details`) + `DatabaseUnavailableError` show the subclass pattern; `_handle_app_error` already renders any `AppError` into the envelope and logs 4xx at warning. Add `NotFoundError(AppError)` here in the same style. The `StarletteHTTPException` handler exists but prefer the domain error for a clean `code`.
- `app/schemas/todo.py` — `TodoCreate`, `TodoRead` (with the `created_at` `Z`-suffix serializer, `from_attributes`), `TodoListResponse`, and the shared `validate_description` helper. Add `TodoUpdate` here; reuse `TodoRead` for the PATCH response.
- `app/repositories/todo_repo.py` — `TodoRepository(db)` with `list()` and `create(description)`; the AD-2 chokepoint / AD-9 seam. Add `get`, `set_completed`, `delete` following the same `self._db.execute(...)` / `commit` / `refresh` style. Note `create()` uses `commit`+`refresh`; mirror that for `set_completed`.
- `app/services/todo_service.py` — `TodoService(db)` wrapping the repo; `list_todos`, `create_todo`. The `Session` import is under `TYPE_CHECKING` (keep it that way). Add `toggle_todo`, `delete_todo` raising `NotFoundError`.
- `app/api/routes/todos.py` — `router = APIRouter(tags=["todos"])` with `GET`/`POST /todos` using `Annotated[Session, Depends(get_db)]` and returning schema-typed responses. Add the two `/{todo_id}` routes at the end. `router` is already included in `app/api/router.py` (no wiring change).
- `tests/integration/conftest.py` — transactional-rollback fixtures (`engine`, `db_session`, `client`), the session-scoped `alembic upgrade head` schema fixture, and honest skip via `pytest_collection_modifyitems` when no DB at `TEST_DATABASE_URL`. **Reuse as-is** — the `todos` table already exists (Story 2.1 migration `0002`).
- `tests/unit/test_todo_service.py` — the `_FakeRepo` / `TodoService.__new__` pattern for DB-free service tests. Extend `_FakeRepo` with `get`/`set_completed`/`delete` for the toggle/delete unit tests.

### PATCH semantics — set-to-value, not server-side flip

The contract body is `{ "completed": bool }` — the **client sends the desired state** (from its optimistic toggle), so the server *sets* `completed` to the given value; it does not read-then-invert. This is why `set_completed(id, value)` is the right repository primitive and why both `true` and `false` are exercised. `StrictBool` guarantees only real JSON booleans are accepted.

### DELETE 204 — empty body

FastAPI: decorate with `status_code=status.HTTP_204_NO_CONTENT` and `return None` (no `response_model`). The `TestClient` will see status `204` and an empty body; assert `resp.status_code == 204` and `resp.content == b""`.

### 404 semantics (AC 2, 5)

Both PATCH-missing and DELETE-missing return `404` with the AD-5 envelope and `code == "not_found"`. The delete `404` is deliberate and reconcile-friendly: the Epic 3 client treats a `404` on delete as "already gone" and reconciles the List (per API Contract note). We return `404` (not a silent `204`) so the contract stays uniform and the delete of a truly-missing id is observably distinct.

### Route-ordering hazard (AC 6) — the important one

Story 2.3 will add the **static** `DELETE /api/todos/completed`. FastAPI matches routes in **declaration order**, and `{todo_id}` is UUID-typed — so if `/{todo_id}` were declared first, a request to `/api/todos/completed` would attempt UUID conversion on `"completed"`, fail, and return `422` **instead of falling through** to the static route. Mitigation in THIS story: declare the two `/{todo_id}` routes **last** in `app/api/routes/todos.py` and leave a comment marking that any literal sub-path must be registered above them. This makes 2.3's insert a clean prepend with no reordering churn. Do not add `/completed` here.

### Integration test schema + Postgres provisioning

Docker is available. Provision a throwaway Postgres 17 on host port **5434** (avoids colliding with any local `5432`/`5433`):

```
docker run -d --name todo-test-pg-22 \
  -e POSTGRES_USER=todo -e POSTGRES_PASSWORD=todo -e POSTGRES_DB=todo \
  -p 5434:5432 postgres:17
```

Then `export TEST_DATABASE_URL=postgresql+psycopg://todo:todo@localhost:5434/todo` (the conftest reads this env at import; it also drives the session-scoped `alembic upgrade head` fixture). Tear down after: `docker rm -f todo-test-pg-22`. If provisioning is impossible, the suite skips honestly (already wired) — never fake a pass; report it.

### Source tree components to touch

```text
backend/app/
  core/errors.py               # UPDATE — add NotFoundError(AppError)
  schemas/todo.py              # UPDATE — add TodoUpdate(completed: StrictBool)
  repositories/todo_repo.py    # UPDATE — add get / set_completed / delete
  services/todo_service.py     # UPDATE — add toggle_todo / delete_todo
  api/routes/todos.py          # UPDATE — add PATCH/DELETE /{todo_id} (declared LAST)
backend/tests/
  unit/test_todo_service.py    # UPDATE — toggle/delete service unit tests (extend _FakeRepo)
  integration/test_todos_toggle.py   # NEW
  integration/test_todos_delete.py   # NEW
```

Note: `app/api/router.py` needs no change (todos router already mounted). Migrations need no change (no schema change — `completed` column already exists). `docs/AI-INTEGRATION-LOG.md` is intentionally **not** edited in this worktree (the orchestrator reconciles it after merge to avoid conflicts).

### Testing standards summary

- Backend `pytest`; unit in `tests/unit` (fast, no DB), integration in `tests/integration` (real Postgres, per-test transaction rollback). [Source: architecture-spine §Testing Architecture]
- Coverage: pytest-cov branch coverage, **report-only** (the enforcing ≥70% gate is Story 6.2). Do not add `--cov-fail-under`. Omits/excludes are in `pyproject.toml`. [Source: `backend/pyproject.toml`; sprint-status note]
- Per-endpoint contract checks: assert status codes and envelope shapes against the API Contract. [Source: epics §Story 2.2 Test Scenarios]

### Project Structure Notes

- All touched paths are existing files from Story 2.1 plus two new integration test modules — fully aligned with the architecture source tree. No new top-level modules, no variances.
- No migration is needed: toggle/delete operate on the existing `todos` schema (the `completed` column and PK already exist).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2] — ACs, test scenarios, traceability (AUTHORITATIVE).
- [Source: _bmad-output/planning-artifacts/epics.md#API Contract] — `PATCH`/`DELETE {id}` shapes/status codes; `/completed` registered before `/{id}`.
- [Source: architecture-spine ARCHITECTURE-SPINE.md#AD-2/AD-3/AD-4/AD-5/AD-9/AD-12] — invariants.
- [Source: architecture-spine ARCHITECTURE-SPINE.md#Consistency Conventions] — bare-Todo response, status codes, snake_case, `Z` dates.
- [Source: backend/app/core/errors.py] — `AppError` + centralized handlers (no new handler needed for 404/422).
- [Source: backend/app/repositories/todo_repo.py] — chokepoint pattern to extend.
- [Source: backend/app/services/todo_service.py] — service pattern; `Session` under `TYPE_CHECKING`.
- [Source: backend/app/api/routes/todos.py] — route module pattern; add `/{todo_id}` routes last.
- [Source: backend/tests/integration/conftest.py] — rollback fixtures + honest skip (reuse as-is).
- [Source: _bmad-output/implementation-artifacts/2-1-...md] — prior-story patterns (model, schemas, repo/service/routes, envelope, fixtures).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

- Full suite against throwaway Postgres 17 on host port 5434 (`TEST_DATABASE_URL=postgresql+psycopg://todo:todo@localhost:5434/todo`): **76 passed** (40 unit + 36 integration), **97% branch coverage** (report-only), `ruff check .` clean. New modules `app/api/routes/todos.py`, `app/repositories/todo_repo.py`, `app/services/todo_service.py` at 100%; `app/schemas/todo.py` 96% (the single uncovered line is the pre-existing naive-datetime guard in the `created_at` serializer).
- Honest-skip re-verified: pointing `TEST_DATABASE_URL` at a dead DSN (`:5999`) skips all 36 integration items with a clear reason — no false pass. Container `todo-test-pg-22` removed after the run.

### Completion Notes List

Implemented the toggle + delete backend slice, extending the Story 2.1 layered stack (AD-2: routes → services → repositories → db). No migration needed (operates on the existing `todos` schema).

- **Error** (`app/core/errors.py`): added `NotFoundError(AppError)` (`code="not_found"`, `404`). Flows through the existing centralized handler → AD-5 envelope; no new handler.
- **Schema** (`app/schemas/todo.py`): added `TodoUpdate` with `completed: StrictBool` — only `completed` is mutable; missing/non-boolean bodies become the AD-5 `422` via the existing `RequestValidationError` remap.
- **Repository** (`app/repositories/todo_repo.py`): added `get` (parameterized `.where(Todo.id == …)`), `set_completed` (mutate flag + commit + refresh; `created_at`/`id` untouched so ordering is stable), and `delete`. All SQLAlchemy interaction stays inside the AD-2 chokepoint / AD-9 seam.
- **Service** (`app/services/todo_service.py`): added `toggle_todo` and `delete_todo`, raising `NotFoundError` on unknown ids. `Session` import remains under `TYPE_CHECKING` (zero runtime SQLAlchemy in the service).
- **Routes** (`app/api/routes/todos.py`): `PATCH /api/todos/{id}` → `200` bare Todo / `404` / `422`; `DELETE /api/todos/{id}` → `204` / `404`. `{id}` typed as `uuid.UUID` (malformed → `422`). Both parametric routes declared LAST with a route-order comment reserving the seam for the static `DELETE /api/todos/completed` (Story 2.3).

Endpoint shapes implemented:
- `PATCH /api/todos/{id}` `{ "completed": <bool> }` → `200 { id, description, completed(flipped), created_at }`; unknown id → `404 {"error":{"code":"not_found",...}}`; missing/non-bool body or malformed UUID → `422` AD-5 envelope. Only `completed` mutable; list position unchanged.
- `DELETE /api/todos/{id}` → `204` empty body; unknown/already-deleted id → `404` AD-5 envelope (client treats as already-gone).

**Route-ordering hazard handling:** the two `/{todo_id}` routes are declared at the very end of `app/api/routes/todos.py`, below `GET`/`POST /todos`, with a block comment explaining that any literal sub-path (e.g. Story 2.3's `DELETE /todos/completed`) must be registered ABOVE them because FastAPI matches in declaration order and a UUID-typed `{id}` would otherwise `422` the literal path. No `/completed` route added (2.3's scope).

Note: `docs/AI-INTEGRATION-LOG.md` and `sprint-status.yaml` were intentionally left unmodified in this worktree — the orchestrator reconciles them after merge to avoid conflicts.

### File List

**Added**
- `backend/tests/integration/test_todos_toggle.py`
- `backend/tests/integration/test_todos_delete.py`

**Modified**
- `backend/app/core/errors.py` (add `NotFoundError`)
- `backend/app/schemas/todo.py` (add `TodoUpdate`; import `StrictBool`)
- `backend/app/repositories/todo_repo.py` (add `get`/`set_completed`/`delete`)
- `backend/app/services/todo_service.py` (add `toggle_todo`/`delete_todo`)
- `backend/app/api/routes/todos.py` (add `PATCH`/`DELETE /{todo_id}`, route-order comment)
- `backend/tests/unit/test_todo_service.py` (toggle/delete service unit tests; extend `_FakeRepo`)
- `backend/tests/unit/test_todo_schema.py` (`TodoUpdate` schema tests)

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-23 | Story 2.2 created (ready-for-dev). Context engine analysis of epics §Story 2.2, architecture spine (AD-2/3/4/5/9/12), and the Story 2.1 backend (errors, schemas, repo, service, routes, conftest). Route-ordering hazard for the future `/completed` (Story 2.3) captured in AC 6. |
| 2026-07-23 | Story 2.2 implemented: `NotFoundError` (404), `TodoUpdate` (`StrictBool`), repository `get`/`set_completed`/`delete`, service `toggle_todo`/`delete_todo`, and `PATCH`/`DELETE /api/todos/{id}` routes (declared last, route-order comment reserving the `/completed` seam). Added 26 tests (12 unit + 14 integration) run against throwaway Postgres 17 on :5434; whole suite 76 passed, 97% branch coverage (report-only), ruff clean. Status → review. |
| 2026-07-23 | Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, in-session fallback). **Clean review — Approve.** All 7 ACs verified against passing tests; route order confirmed at runtime (parametric `/{todo_id}` last). Zero patch/decision findings; 2 Low observations dismissed with rationale. Status → done. |
| 2026-07-23 | Post-review determinism fix: `test_patch_does_not_reorder_list` had assumed API-`POST` creation order maps to `created_at DESC`, but the rollback fixture runs one transaction so DB `now()` is identical for all rows and order fell to the random `id` tiebreak (intermittent failure). Rewrote it to insert two rows with explicit distinct `created_at` via `db_session` (mirroring `test_todos_list.py`). Suite now deterministic: 3× consecutive 76 passed, 97% branch coverage, ruff clean. |

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.8 (1M context), acting across three adversarial layers (Blind Hunter / Edge Case Hunter / Acceptance Auditor). No subagent-spawn tool was available in this environment, so the layers were conducted in-session — the documented fallback (same as Story 2.1).
**Date:** 2026-07-23
**Review mode:** full (spec = this story file). Diff target: working tree vs the Story 2.1 baseline `HEAD` (`5f0c5f6`) — 7 files modified + 2 new integration test files (~230 + ~160 lines).
**Outcome:** **Approve (clean review).** All seven acceptance criteria are satisfied and independently verified by the passing suite (40 unit + 36 integration; 76 passed) plus a runtime route-order check. No High/Medium/Low findings required action; two Low observations were dismissed with rationale.

**Acceptance audit (all satisfied):**
- AC1 — `PATCH` sets `completed` in both directions and persists (verified via follow-up `GET`); description/`created_at` untouched even with extra body keys; toggling the older item does not reorder the List. Tests: `test_patch_sets_completed_true_then_false`, `test_patch_persists_completed_flag`, `test_patch_extra_keys_do_not_edit_description`, `test_patch_does_not_reorder_list`.
- AC2 — `PATCH` unknown id → `404` with `{"error":{"code":"not_found",...}}`. Test: `test_patch_missing_id_returns_404_envelope`.
- AC3 — missing / non-boolean `completed` → `422` AD-5 envelope with `details[].field == "completed"` (`StrictBool`). Tests: `test_patch_missing_completed_returns_422`, `test_patch_non_boolean_completed_returns_422`.
- AC4 — `DELETE` existing → `204` empty body, row permanently gone. Tests: `test_delete_existing_returns_204_and_empty_body`, `test_delete_removes_row`.
- AC5 — `DELETE` unknown/already-deleted → `404` envelope. Tests: `test_delete_missing_id_returns_404_envelope`, `test_delete_twice_second_is_404`; unrelated rows survive (`test_delete_leaves_other_rows_untouched`).
- AC6 — `{todo_id}` typed `uuid.UUID`; malformed id → `422` AD-5 envelope (tested both verbs); parametric routes declared last with a route-order comment reserving the `/completed` seam (Story 2.3); confirmed at runtime that `/api/todos` literal routes register before `/api/todos/{todo_id}`. No `/completed` route added.
- AC7 — SQLAlchemy query APIs confined to the repository (`get`/`set_completed`/`delete`); the service `Session` import stays under `TYPE_CHECKING` (zero runtime SQLAlchemy in the service); parameterized `.where(Todo.id == todo_id)` bind only.

**Coverage note (report-only):** 97% branch overall; new `app/api/routes/todos.py`, `app/repositories/todo_repo.py`, `app/services/todo_service.py` at 100%; `app/schemas/todo.py` 96% (single uncovered line is the pre-existing naive-datetime guard in the `created_at` serializer).

**Low observations (dismissed):**
- `NotFoundError`'s default message is fixed to "Todo not found" though the docstring says it is reusable — cosmetic; `message` is a constructor arg so it is already reusable. No change.
- The `PATCH` handler is named `toggle_todo` while semantically performing a set-to-value (client sends the desired state) — matches the domain term used in the epic/story ("Toggle completion") and the docstring clarifies the set-to-value semantics. No change.

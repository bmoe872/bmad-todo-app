---
baseline_commit: 5f0c5f6
---

# Story 2.3: Clear-completed bulk endpoint with id snapshot

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an API consumer,
I want a single bulk endpoint to delete completed Todos, optionally scoped to an explicit id snapshot,
so that the client can clear all completed items in one call and, under the deferred-commit model, delete only the intended snapshot.

## Acceptance Criteria

1. **Route ordering + typing (AD-4).** The static `DELETE /api/todos/completed` is registered **before** the parametric `DELETE /api/todos/{id}` (added by sibling Story 2.2) so the literal `/completed` path is never captured as `{id} == "completed"`. The `/{id}` route (2.2) types `{id}` as `uuid.UUID`; this story places `/completed` above where `{id}` routes live and carries a code comment marking the hazard.
2. **Snapshot-scoped delete (FR-9, AD-7).** When a client calls `DELETE /api/todos/completed` with body `{ "ids": [uuid, …] }`, the endpoint returns `200 { "deleted": <int> }` and deletes only the rows whose id is **in the snapshot AND still `completed = true`**. Active Todos are never touched; completed Todos NOT in the snapshot are untouched; and an id in the snapshot that has since been re-activated (`completed = false`) is NOT deleted. `deleted` is the exact count actually removed.
3. **Omitted-body fallback (FR-9).** When the body is omitted (or `ids` is `null`), the endpoint deletes **all currently-completed** Todos and returns the count. (An empty list `{"ids": []}` is a valid explicit empty snapshot → deletes nothing → `deleted: 0`; see AC 4.)
4. **No-op is valid (FR-9).** When no completed Todo matches (nothing completed, or the snapshot intersects no still-completed rows, or `ids: []`), the endpoint returns `200 { "deleted": 0 }` with no error and no effect on active Todos.
5. **Layered artifacts (AD-2).** The bulk-clear is added to the repository (the sole SQLAlchemy chokepoint) and the service; the route stays thin and imports no SQLAlchemy query API. A future owner filter (AD-9) would attach at the same repository chokepoint.
6. **Parameterized queries only (NFR-Sec).** The bulk delete uses parameterized SQLAlchemy constructs (`delete(Todo).where(...)` with bound parameters / `IN` on the id list) — no string interpolation of ids into SQL.
7. **Uniform error envelope (AD-5).** A malformed body (e.g. `ids` not a list, or a non-UUID element) returns `422` with the AD-5 envelope `{ "error": { "code", "message", "details": [{ "field", "issue" }] } }` via the existing centralized handler (no new handler needed). Unexpected failures map to the AD-5 `500` envelope.

## Tasks / Subtasks

- [x] **Task 1 — Request schema for the id snapshot (AC: 2, 3, 7)** in `backend/app/schemas/todo.py`
  - [x] Add `ClearCompletedRequest(BaseModel)` with a single optional field `ids: list[uuid.UUID] | None = None`. Pydantic coerces/validates each element as a UUID; a non-UUID element or non-list yields FastAPI's `RequestValidationError` → the existing AD-5 `422` handler (no new handler).
  - [x] Add `ClearCompletedResponse(BaseModel)` with `deleted: int` so the `200` contract shape is enforced/documented via `response_model`.
  - [x] Distinguish "omitted body" from "explicit empty list": `ids is None` → clear-all fallback (AC 3); `ids == []` → explicit empty snapshot → deletes nothing (AC 4).
- [x] **Task 2 — Repository bulk-clear (AC: 2, 3, 4, 5, 6)** in `backend/app/repositories/todo_repo.py`
  - [x] Add `clear_completed(self, ids: list[uuid.UUID] | None) -> int`. This is the AD-2 chokepoint (mark the AD-9 owner-seam next to the existing comment).
  - [x] Build `delete(Todo).where(Todo.completed.is_(True))`; when `ids is not None`, add `.where(Todo.id.in_(ids))` (parameterized `IN`; NFR-Sec). When `ids is None`, delete all completed (no id filter).
  - [x] Execute with `execution_options(synchronize_session=False)` (bulk DELETE; no ORM objects loaded), `commit()`, and return `result.rowcount` as the deleted count.
  - [x] Short-circuit `ids == []` to return `0` WITHOUT issuing a delete (an empty `IN ()` is a degenerate/ambiguous SQL construct across dialects) — an explicit empty snapshot matches nothing by definition.
- [x] **Task 3 — Service orchestration (AC: 2, 3, 4, 5)** in `backend/app/services/todo_service.py`
  - [x] Add `clear_completed(self, ids: list[uuid.UUID] | None) -> int` delegating to the repo. Never import SQLAlchemy query APIs (keep the `Session` import under `TYPE_CHECKING`, matching the existing pattern). The "still-completed" and snapshot-intersection filtering is expressed as the single SQL predicate in the repo — the service passes the snapshot through unchanged.
- [x] **Task 4 — Route + placement (AC: 1, 2, 3, 4, 7)** in `backend/app/api/routes/todos.py`
  - [x] Add `DELETE /todos/completed` → `response_model=ClearCompletedResponse`, status `200`. Body param `ClearCompletedRequest | None = None` (Body(default=None)) so an omitted body is accepted (→ `ids=None` → clear-all). Depends on `get_db`; calls `TodoService(db).clear_completed(...)`; returns `ClearCompletedResponse(deleted=n)`.
  - [x] **Place this route near the TOP of the router, ABOVE where the `DELETE /{id}` route (Story 2.2) will live**, and add the exact comment: `# MUST precede /{id} route — static path, see AD route-ordering hazard.` (AD-4).
  - [x] Keep the route thin: no SQLAlchemy query imports (AD-2).
- [x] **Task 5 — Unit tests (AC: 2, 3, 4, 5)** in `backend/tests/unit/test_todo_service.py` (extend; no DB)
  - [x] Extend the fake repo with a `clear_completed` recorder. Assert the service passes the snapshot through unchanged: a concrete id list is forwarded verbatim; `None` is forwarded as `None` (clear-all); `[]` is forwarded as `[]`.
  - [x] Assert the service returns the repo's integer count.
- [x] **Task 6 — Integration tests (AC: 1, 2, 3, 4, 6, 7)** in `backend/tests/integration/test_todos_clear_completed.py` (NEW; real Postgres via the rollback fixture)
  - [x] Seed a mix of active + completed rows via a small helper (insert directly with the `db_session`, setting `completed` explicitly, since there is no toggle endpoint in this worktree). Reuse the existing `client`/`db_session` fixtures.
  - [x] **Snapshot subset:** with 3 completed + 2 active, send `{"ids": [two of the completed ids]}` → `200 {"deleted": 2}`; a follow-up `GET` shows the third completed + both active survive.
  - [x] **Re-activated id not swept:** include in the snapshot an id that is `completed = false` at request time → it is NOT deleted; only still-completed snapshot ids are removed (proves AD-7 "still completed" semantics).
  - [x] **Omitted body clears all completed:** no body → deletes every completed row, actives survive, `deleted` == number completed.
  - [x] **No-op:** all-active DB → `{"deleted": 0}`, nothing removed; and `{"ids": []}` → `{"deleted": 0}`.
  - [x] **Actives always survive:** assert active count unchanged across every case.
  - [x] **Route-ordering guard (AC 1):** assert `DELETE /api/todos/completed` clears completed (returns `{"deleted": n}`) rather than being interpreted as a single-id delete of id `"completed"` (which, once 2.2's UUID-typed `{id}` route exists, would be a `422`/`404`). This test must pass on THIS branch (only `/completed` exists) AND remain correct after the 2.2 merge — assert the response is the clear-completed body shape (`"deleted" in body`), NOT a 404/422. Add a comment tying it to the merge hazard.
  - [x] Ensure honest skip still holds when no test Postgres is reachable (existing `pytest_collection_modifyitems`).
- [x] **Task 7 — Lint + full run**
  - [x] `ruff check .` clean (E, F, I, UP, B). Run `pytest` (unit + integration) against a throwaway Postgres 17 on host port **5435**; capture real pass/fail + branch coverage (report-only per `pyproject.toml` — do NOT add `--cov-fail-under`).
- [x] **Task 8 — AI integration log** — SKIP editing `docs/AI-INTEGRATION-LOG.md` (orchestrator reconciles it post-merge per this run's constraints). Do not edit `sprint-status.yaml` either.

## Dev Notes

### Architecture patterns & constraints (FOLLOW EXACTLY)

- **AD-7 — Clear-completed is a deferred bulk-delete of an explicit id snapshot.** The client captures the set of currently-completed ids, hides them optimistically, shows a ~6s Undo toast, and only on toast-dismiss issues **one** `DELETE /api/todos/completed` carrying that id snapshot. **The server deletes only those snapshot ids that are still `completed`.** A Todo completed *after* the click is never in the snapshot → never cleared. Nothing is deleted server-side until dismiss, so a crash/refresh during the window safely restores items on reload. This story implements the SERVER half: the snapshot-scoped, still-completed-only bulk delete. [Source: architecture-spine §AD-7]
- **AD-4 — REST contract, route ordering.** Endpoints/methods/status codes are fixed. **The static `DELETE /api/todos/completed` is registered BEFORE the parametric `DELETE /api/todos/{id}`, and `{id}` is typed as UUID so they never collide.** In FastAPI, declaration order within a router decides which route matches a literal path; a `{id}` declared first would swallow `/completed`. Sibling Story 2.2 adds `/{id}` on its own branch that merges with this one — so place `/completed` at the top of the router with the hazard comment to survive the merge. [Source: architecture-spine §AD-4, §API Contract]
- **AD-2 — Layered backend + repository chokepoint.** `routes → services → repositories → db`, dependencies downward only. SQLAlchemy query/session APIs live ONLY in `app/repositories/` and `app/db/`. The route and service must not import `select`/`delete`/`Session.execute`. The repository is the single chokepoint where a future AD-9 owner filter attaches (`.where(Todo.owner_id == ...)`). [Source: architecture-spine §AD-2]
- **AD-5 — Uniform error envelope + shared validation.** Every non-2xx is `{ "error": { "code", "message", "details"?: [{field, issue}] } }` from the centralized handlers ALREADY in `app/core/errors.py`. Declaring the body as a Pydantic model (`ClearCompletedRequest`) makes malformed input (non-list `ids`, non-UUID element) flow through the existing `RequestValidationError` → `422` envelope with `details=[{field, issue}]` — no new handler. [Source: architecture-spine §AD-5; existing `app/core/errors.py`]
- **AD-9 — Auth seam open, not built.** No `owner_id`, no auth in v1. Mark the new repo query as the seam alongside the existing `list`/`create` comments. [Source: architecture-spine §AD-9]
- **AD-12 — Sync DB, one session per request.** Sync SQLAlchemy 2.0 + psycopg 3. Use the existing `get_db` dependency exactly like the existing routes. No async. [Source: architecture-spine §AD-12; existing `app/db/session.py`]
- **API Contract row (AUTHORITATIVE):** `DELETE /api/todos/completed` | body `{ "ids": [uuid, …] }` (optional) | `200 { "deleted": <int> }` | error `500` | "When `ids` given, deletes only those that are still completed; when omitted, deletes all completed. Client always sends the snapshot. Registered before `/{id}`." [Source: architecture-spine §API Contract]
- **Success shapes / status codes.** Bulk clear → `200 { "deleted": <int> }` (an object, not a bare int). Wire keys snake_case. [Source: architecture-spine §Consistency Conventions]

### Existing code to build on (READ THESE — do not reinvent)

- `app/api/routes/todos.py` — the todos router (`APIRouter(tags=["todos"])`) with `GET /todos` and `POST /todos`. Thin routes: `Depends(get_db)`, call `TodoService`, return schema models; NO SQLAlchemy query imports. The `Session` import here is required (FastAPI resolves the `Annotated[Session, Depends(get_db)]` dependency at registration) and is precedented/accepted. Add the `/completed` route AT THE TOP.
- `app/repositories/todo_repo.py` — `TodoRepository(db)` with `list()` and `create()`. Uses `select(...)`, `db.execute(...)`, `db.commit()`. Add `clear_completed(...)` here using `delete(...)`. Carries the AD-9 owner-seam comment already — extend it.
- `app/services/todo_service.py` — `TodoService(db)` holding domain ops; `Session` import is under `TYPE_CHECKING` so the service imports ZERO SQLAlchemy at runtime (AD-2). Keep it that way — do not import `delete`/`Session` at runtime.
- `app/schemas/todo.py` — `TodoCreate`, `TodoRead`, `TodoListResponse` and the shared `validate_description` helper + `MAX_DESCRIPTION_LENGTH`. Add `ClearCompletedRequest` / `ClearCompletedResponse` here.
- `app/db/models.py` — `Todo` (`id: uuid.UUID`, `description`, `completed: bool`, `created_at`). `completed` has no server-side setter here; integration tests set it directly on inserted rows.
- `app/core/errors.py` — `AppError` + `register_exception_handlers`; the `RequestValidationError` handler already builds `details=[{field, issue}]`. No new handler needed for this story.
- `app/api/router.py` — already includes `todos.router`; no change needed (the new route is added inside the existing todos router).
- `tests/integration/conftest.py` — transactional-rollback fixtures (`engine`, `db_session`, `client`) + honest skip via `pytest_collection_modifyitems` when no DB at `TEST_DATABASE_URL` (default `postgresql+psycopg://todo:todo@localhost:5433/todo`). Session-scoped `_migrated_schema` runs `alembic upgrade head`. **For this run set `TEST_DATABASE_URL` to the port-5435 container** so the fixtures target it.

### Snapshot semantics — the one predicate that encodes AD-7

The entire AD-7 "still-completed, snapshot-scoped" rule collapses to ONE SQL predicate in the repository:

```
DELETE FROM todos WHERE completed = true [AND id IN (:ids)]
```

- `completed = true` guarantees active rows are never touched AND a re-activated snapshot id is skipped (it is no longer `completed`) — no separate re-check needed. This is why the client can send a stale snapshot safely.
- `id IN (:ids)` (parameterized) restricts to the snapshot; omitting it (when `ids is None`) clears all completed.
- `rowcount` from the DELETE is the exact `deleted` count returned.
- `ids == []` is short-circuited to `0` in Python (never issues `IN ()`).

### No toggle endpoint in this worktree

This worktree's HEAD is the Story 2.1 commit. The toggle/`PATCH` endpoint (Story 2.2) is NOT present here. Integration tests must set `completed = true/false` **directly on inserted rows** via the test `db_session` (e.g. build `Todo(...)`, set `.completed`, add, flush) rather than calling a toggle endpoint. This keeps the story self-contained and testable pre-merge.

### Postgres provisioning for integration tests (port 5435 for THIS story)

Docker is available. Provision a throwaway Postgres 17 on host port **5435** (avoids colliding with any local 5432 and with the sibling 2.2 worktree's container):

```
docker run -d --name todo-test-pg-2-3 \
  -e POSTGRES_USER=todo -e POSTGRES_PASSWORD=todo -e POSTGRES_DB=todo \
  -p 5435:5432 postgres:17
```

Then `export TEST_DATABASE_URL=postgresql+psycopg://todo:todo@localhost:5435/todo` and `export DATABASE_URL=$TEST_DATABASE_URL`; wait for readiness (`pg_isready`), run `alembic upgrade head` (the conftest session fixture also does this), run the suite, and **tear the container down** (`docker rm -f todo-test-pg-2-3`) when done. If provisioning is impossible, the suite must skip honestly (already wired) — never fake a pass; report it.

### Source tree components to touch

```text
backend/app/
  schemas/todo.py                 # UPDATE — ClearCompletedRequest / ClearCompletedResponse
  repositories/todo_repo.py       # UPDATE — clear_completed() (AD-2/AD-9 chokepoint, delete())
  services/todo_service.py        # UPDATE — clear_completed() passthrough
  api/routes/todos.py             # UPDATE — DELETE /todos/completed at TOP (route-ordering comment)
backend/tests/
  unit/test_todo_service.py                   # UPDATE — snapshot passthrough + count
  integration/test_todos_clear_completed.py   # NEW — endpoint + route-ordering guard
```

No migration is needed (the `todos` table already exists from Story 2.1's `0002_create_todos`).

### Testing standards summary

- Backend `pytest`; unit in `tests/unit` (fast, no DB), integration in `tests/integration` (real Postgres, per-test transaction rollback). [Source: architecture-spine §Testing Architecture]
- Coverage: pytest-cov branch coverage, **report-only** at this stage (enforcing ≥70% gate is Story 6.2). Do not add `--cov-fail-under`. Established omits/excludes live in `pyproject.toml`. [Source: `backend/pyproject.toml`]
- Contract check: assert response/error shapes against the API Contract per-endpoint. [Source: epics §Story 2.3 Test Scenarios]

### Project Structure Notes

- Paths align with the architecture source tree exactly; all files already exist except the new integration test. No variances.
- This story is additive to Story 2.1's slice; it introduces the third mutation endpoint. It deliberately anticipates the Story 2.2 `/{id}` routes via route placement + the guard test, without depending on 2.2's code.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3] — ACs, test scenarios, traceability (AUTHORITATIVE).
- [Source: architecture-spine ARCHITECTURE-SPINE.md#AD-7] — deferred-commit + id-snapshot semantics (still-completed only).
- [Source: architecture-spine ARCHITECTURE-SPINE.md#AD-4] — route ordering (`/completed` before `/{id}`, UUID-typed).
- [Source: architecture-spine ARCHITECTURE-SPINE.md#AD-2/AD-5/AD-9/AD-12] — layering chokepoint, error envelope, owner seam, sync session.
- [Source: architecture-spine ARCHITECTURE-SPINE.md#API Contract] — `DELETE /api/todos/completed` row.
- [Source: _bmad-output/implementation-artifacts/2-1-...md] — model/repository/service/route/schema patterns to extend.
- [Source: backend/app/repositories/todo_repo.py, app/services/todo_service.py, app/api/routes/todos.py, app/schemas/todo.py] — the exact modules extended.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

- Full suite (`pytest --cov=app`) against throwaway Postgres 17 on host port **5435** (`docker run -d --name todo-test-pg-2-3 … -p 5435:5432 postgres:17`): **61 passed** (31 unit + 30 integration), **96% branch coverage** (report-only), ruff clean. New modules `app/api/routes/todos.py`, `app/repositories/todo_repo.py`, `app/services/todo_service.py` at 100%; `app/schemas/todo.py` 96% (the one uncovered line is the pre-existing naive-datetime guard in the `created_at` serializer, unrelated to this story). Container torn down after the run.
- Honest-skip re-verified: pointing `TEST_DATABASE_URL` at a dead DSN skips all 30 integration items (no false pass).
- One test-only fix during the RED/GREEN cycle: seeded ORM instances are expired by the endpoint's `commit()` (the fixture yields the same session), so reading a deleted row's `.id` afterward raised `ObjectDeletedError`. Fixed by capturing ids as strings before issuing the DELETE — not a production-code change.

### Completion Notes List

Implemented the server half of the AD-7 deferred-commit / id-snapshot model: `DELETE /api/todos/completed`.

- **Schemas** (`app/schemas/todo.py`): `ClearCompletedRequest { ids: list[uuid.UUID] | None = None }` (Pydantic validates each element as a UUID; malformed input flows through the existing AD-5 `422` handler — no new handler) and `ClearCompletedResponse { deleted: int }`. `ids is None` (omitted body) = clear-all; `ids == []` = explicit empty snapshot (no-op).
- **Repository** (`app/repositories/todo_repo.py`): `clear_completed(ids)` — the AD-2 chokepoint / AD-9 owner-seam. One parameterized predicate encodes the whole rule: `delete(Todo).where(Todo.completed.is_(True))` plus `.where(Todo.id.in_(ids))` when a snapshot is given. `completed = true` guarantees actives are never touched AND a re-activated snapshot id is skipped (no longer completed). `ids == []` short-circuits to `0` (never emits a degenerate `IN ()`). Returns `result.rowcount` as the deleted count. `synchronize_session=False` (bulk DELETE).
- **Service** (`app/services/todo_service.py`): `clear_completed(ids)` — pure passthrough to the repo (the still-completed/intersection filter is the repo's single SQL predicate). `Session` import stays under `TYPE_CHECKING`; the service imports zero SQLAlchemy at runtime (AD-2).
- **Route** (`app/api/routes/todos.py`): `DELETE /todos/completed` → `200 ClearCompletedResponse`. Optional `Body()` so an omitted body yields `ids=None` (clear-all). **Placed at the TOP of the router, above where the Story 2.2 `DELETE /{id}` route will live**, with the exact comment `# MUST precede /{id} route — static path, see AD route-ordering hazard.` Thin route, no SQLAlchemy query imports.
- **Tests**: 3 new unit tests (`tests/unit/test_todo_service.py`) — snapshot forwarded verbatim, `None` forwarded for clear-all, `[]` forwarded; count returned. 8 new integration tests (`tests/integration/test_todos_clear_completed.py`) — snapshot subset, re-activated-id-not-swept (AD-7), omitted-body-clears-all, no-completed no-op, empty-snapshot no-op, unknown-ids intersection-only, malformed-`ids` `422` envelope, and the **route-ordering merge-guard** (proves `/completed` returns the clear-completed body shape, not a `404`/`422` from being captured as `{id}="completed"`).

Endpoint shape/semantics:
- `DELETE /api/todos/completed` body `{ "ids": [uuid, …] }` (optional) → `200 { "deleted": <int> }`.
- Snapshot given → deletes only ids that are **still** `completed`; active rows and completed rows not in the snapshot survive; a re-activated snapshot id is not swept.
- Body omitted / `ids: null` → deletes all currently-completed rows.
- `ids: []` or no match → `200 { "deleted": 0 }` (valid no-op, actives untouched).
- Malformed body → `422` AD-5 envelope (`details[].field == "ids.0"`).

Per this run's constraints, `docs/AI-INTEGRATION-LOG.md` and `_bmad-output/implementation-artifacts/sprint-status.yaml` were intentionally NOT edited (the orchestrator reconciles them after merge).

### File List

**Added**
- `backend/tests/integration/test_todos_clear_completed.py`

**Modified**
- `backend/app/schemas/todo.py` (ClearCompletedRequest / ClearCompletedResponse)
- `backend/app/repositories/todo_repo.py` (clear_completed — delete() at the AD-2 chokepoint)
- `backend/app/services/todo_service.py` (clear_completed passthrough)
- `backend/app/api/routes/todos.py` (DELETE /todos/completed at top of router + route-ordering comment)
- `backend/tests/unit/test_todo_service.py` (clear_completed passthrough tests)
- `_bmad-output/implementation-artifacts/2-3-clear-completed-bulk-endpoint-with-id-snapshot.md` (this story file)

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-23 | Story 2.3 created (ready-for-dev). Context engine analysis of epics §Story 2.3, architecture spine (AD-2/4/5/7/9/12 + API Contract), and the Story 2.1 backend slice (schemas/repository/service/routes). |
| 2026-07-23 | Story 2.3 implemented: `DELETE /api/todos/completed` — `ClearCompletedRequest/Response` schemas, repository `clear_completed()` (single parameterized `DELETE … WHERE completed = true [AND id IN (:ids)]`), service passthrough, and the route placed at the top of the todos router with the AD-4 route-ordering guard comment. Added 11 tests (3 unit + 8 integration) run against throwaway Postgres 17 on :5435; whole suite 61 passed, 96% branch coverage (report-only), ruff clean; honest-skip re-verified. Status → review. |
| 2026-07-23 | Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, conducted in-session — the documented fallback, no subagent-spawn tool in this environment). **Approve — clean review**, all 7 ACs verified. Zero patch/decision findings; several Low observations dismissed with rationale (see review section). Empirically proved the AD-4 route-ordering discipline (see below). Status → done. |

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.8 (1M context), across three adversarial layers (Blind Hunter / Edge Case Hunter / Acceptance Auditor). No subagent-spawn tool was available in this environment, so the layers were conducted in-session — the documented fallback (Story 2.1 precedent).
**Date:** 2026-07-23
**Review mode:** full (spec = this story file). Diff target: working tree vs the story's `baseline_commit` `5f0c5f6` — 6 files, ~141 lines of backend code + tests plus the new integration test.
**Outcome:** **Approve — clean review.** All seven acceptance criteria are satisfied and independently verified by the passing suite (31 unit + 30 integration = 61 passed) against throwaway Postgres 17 on :5435; 96% branch coverage (report-only); ruff clean; honest-skip re-verified. No High/Medium findings; no patches required.

**Acceptance audit (all satisfied):**
- AC1 — `DELETE /api/todos/completed` is declared at the TOP of the todos router (above where Story 2.2's `DELETE /{id}` will merge) with the required hazard comment. **Empirically proved** via a throwaway routing harness: with `/completed` declared before a UUID-typed `/{id}`, `/api/todos/completed` resolves to the clear-completed handler and a UUID path resolves to `/{id}`. The harness also showed the failure mode — with the parametric route declared FIRST, `/completed` is captured by `/{id}` (FastAPI matches path segments before Pydantic UUID coercion, so UUID typing alone does NOT prevent the collision; **declaration order is the real protection**). The merge-guard integration test detects exactly that failure (asserts `deleted` body, not a 404/422).
- AC2 — snapshot-scoped, still-completed-only delete via the single predicate `DELETE … WHERE completed = true AND id IN (:ids)`; verified by the subset, re-activated-id, and unknown-ids tests (actives and out-of-snapshot completed rows survive).
- AC3 — omitted body clears all completed (verified).
- AC4 — no-op returns `{"deleted": 0}` for no-completed and explicit empty snapshot (verified).
- AC5 — layered: `clear_completed` added to repo (chokepoint) + service passthrough; route thin; service imports zero SQLAlchemy at runtime (`Session` under `TYPE_CHECKING`).
- AC6 — parameterized `delete(Todo).where(...).where(Todo.id.in_(ids))`; no string interpolation.
- AC7 — malformed `ids` → `422` AD-5 envelope (`details[].field == "ids.0"`, verified); unexpected failures → `500` catch-all.

**Findings (all dismissed — Low, by-design):**
- `synchronize_session=False` leaves the session identity map stale after the bulk DELETE. DISMISSED — correct/idiomatic for a bulk delete; production uses a fresh per-request session with no loaded objects (AD-12). The only visible effect was test-side (seeded ORM instances expire on commit), handled by capturing ids as strings before the DELETE.
- `result.rowcount` reliability for the bulk DELETE. DISMISSED — reliable for psycopg3 + Postgres DELETE; the integration tests assert exact counts (2, 1, 0) and pass.
- `ids == []` short-circuit returns 0 without a DB round-trip. DISMISSED — correct: an explicit empty snapshot matches nothing by definition, and avoids a degenerate `IN ()`.
- Merge-guard test cannot fail on THIS branch (no `/{id}` route yet). DISMISSED — by-design; it is a forward merge-guard, documented in the test, and the routing harness above confirms it detects the real failure mode post-merge.

**Coverage note (report-only):** new code paths in `app/api/routes/todos.py`, `app/repositories/todo_repo.py`, `app/services/todo_service.py` at 100%; `app/schemas/todo.py` 96% (the single uncovered line is a pre-existing naive-datetime guard unrelated to this story).

**Sprint status:** `sprint-status.yaml` intentionally NOT edited (this run's orchestrator reconciles it after merge).

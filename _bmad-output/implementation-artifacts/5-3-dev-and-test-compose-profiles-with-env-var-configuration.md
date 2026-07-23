---
baseline_commit: 11db326
---

# Story 5.3: Dev and test compose profiles with env-var configuration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want compose profiles for local development and for running the test suites,
so that I get HMR + exposed ports + CORS locally and a reproducible test environment in CI, all via env vars.

## Acceptance Criteria

1. **`dev` profile: source mounts + Vite HMR (frontend :5173) + backend (:8000) with exposed ports, CORS enabled ONLY here.** Activating the `dev` profile brings up a live-reload developer stack: the frontend runs the Vite dev server with HMR on host port 5173 (source bind-mounted so edits hot-reload), the backend runs with source bind-mounted + auto-reload on host port 8000, and CORS is enabled **only** in this path via `CORS_ORIGINS` so the cross-origin Vite dev server (`http://localhost:5173`) can call the backend at `http://localhost:8000`. The default (no-profile) prod-like stack has **no** CORS. (epics.md §680-682 AC-1; ARCHITECTURE-SPINE.md AD-10, Container topology; NFR-Deploy)
2. **`test` profile: ephemeral Postgres that runs the suites (transactional-rollback backend integration).** Activating the `test` profile provides an **ephemeral/throwaway** Postgres (no durable named volume) that the backend integration suite runs against using the existing transactional-rollback fixtures (`backend/tests/integration/conftest.py`), plus a documented path for Playwright against the composed app. The integration suite — currently 44 tests skipped for lack of a reachable test DB — must actually RUN and PASS against the compose-managed test Postgres. (epics.md §684-686 AC-2; ARCHITECTURE-SPINE.md "Integration-test DB mechanism — transactional-rollback on test-profile Postgres"; NFR-Deploy, NFR-Quality)
3. **All config is 12-factor env vars; no committed secrets; structured JSON logs to stdout.** Every service is configured via environment variables (backend `pydantic-settings`; frontend build-time / dev-server `VITE_*`), with non-secret `${VAR:-default}` defaults so a bare invocation works and no secret values are committed. New vars are documented in the relevant `.env.example`. Logs remain structured JSON to stdout, viewable via `docker compose logs`. (epics.md §688-690 AC-3; ARCHITECTURE-SPINE.md Cross-cutting "Config: 12-factor env vars only"; NFR-Deploy, NFR-Sec)

## Test Scenarios (authoritative — from epics.md §692-694)

- **Ops:** `--profile dev` brings up HMR + exposed ports with CORS working from `:5173`; the production (default) profile has **no** CORS.
- **Ops/CI:** `--profile test` runs the backend integration suite (and, out of this story's scope for authoring but supported, Playwright) against the ephemeral DB and passes; this is the environment CI (Story 1.3 / Epic 6) invokes.

**Traceability:** NFR-Deploy, NFR-Quality, NFR-Sec; AD-10; integration-test DB mechanism (transactional-rollback on test-profile Postgres).

## Tasks / Subtasks

- [x] **Task 1 — Add a `dev` build target to `backend/Dockerfile`** (AC: #1)
  - [x] Append a stage `FROM runtime AS dev` (extends the existing non-root slim runtime). As `USER root`, `pip install watchfiles` into `/opt/venv` so `uvicorn --reload` uses the efficient file watcher rather than the polling fallback; then drop back to `USER appuser`. Keep prod (`runtime`, the default final stage) untouched — the prod image must NOT gain watchfiles.
  - [x] Do not change the `runtime` stage's `ENTRYPOINT`; the `dev` service overrides `entrypoint` in compose (Task 3). `watchfiles` is the only addition.
- [x] **Task 2 — Add a `dev` build target to `frontend/Dockerfile` (Vite dev server, linux node_modules)** (AC: #1)
  - [x] Add a stage `FROM node:22-slim AS dev` BEFORE the nginx runtime is selected as default (the last stage in the file stays the nginx `runtime` so a bare `docker build ./frontend` still yields the prod image). `WORKDIR /app`; `COPY package.json package-lock.json ./`; `RUN npm ci` so the container has **linux** native binaries (esbuild/rollup/vite) — the host `frontend/node_modules` is darwin/arm and cannot be reused in the linux container, so it must never be bind-mounted over the container's install.
  - [x] `EXPOSE 5173`; `CMD ["npm","run","dev","--","--host","0.0.0.0","--port","5173"]`. Runs as root inside the dev container (dev-only convenience; prod nginx stays non-root) — acceptable for a throwaway dev image.
- [x] **Task 3 — Extend root `docker-compose.yml` with `dev`-profile services** (AC: #1, #3)
  - [x] Do NOT touch the profile-free `db`, `backend`, `frontend` services — a bare `docker compose up` must remain the unchanged prod-like single-origin stack. ADD new services that carry `profiles: ["dev"]` so they are excluded from the default `up`.
  - [x] `backend-dev` (`profiles: ["dev"]`): `build: { context: ./backend, target: dev }`; `depends_on: { db: { condition: service_healthy } }`; attach to `appnet`; publish `ports: ["${BACKEND_PORT:-8000}:8000"]`; bind-mount source for reload: `volumes: [ ./backend/app:/app/app, ./backend/migrations:/app/migrations, ./backend/alembic.ini:/app/alembic.ini ]`. Set environment: same `DATABASE_URL` DSN as the prod backend (host `db`), `LOG_LEVEL`, and crucially `CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:5173}` (AD-10: CORS ON only in dev). Override `entrypoint` to migrate-then-reload: `["sh","-c","alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app/app"]`.
  - [x] `frontend-dev` (`profiles: ["dev"]`): `build: { context: ./frontend, target: dev }`; `depends_on: { backend-dev: { condition: service_started } }`; attach to `appnet`; publish `ports: ["${FRONTEND_DEV_PORT:-5173}:5173"]`. Bind-mount source but PRESERVE the container's linux `node_modules` with an anonymous volume: `volumes: [ ./frontend:/app, /app/node_modules ]`. Set `environment: VITE_API_BASE_URL: ${VITE_API_BASE_URL:-http://localhost:8000/api}` (browser at :5173 calls the backend origin directly — this is the cross-origin path CORS enables) and `VITE_DEV_POLLING: ${VITE_DEV_POLLING:-1}` (Docker Desktop on macOS needs polling for reliable file-watch HMR over bind mounts).
  - [x] No port clash with the prod services because dev and prod services are never started together: dev is invoked either as `docker compose --profile dev up` (only if the prod services are down) OR, per the doc comment, targeting `docker compose --profile dev up backend-dev frontend-dev` which starts only those + `db` (their dependency), leaving the prod `backend`/`frontend` unstarted. Document the recommended command in the compose comments.
- [x] **Task 4 — Extend root `docker-compose.yml` with `test`-profile services (ephemeral Postgres + test runner)** (AC: #2, #3)
  - [x] `db-test` (`profiles: ["test"]`): `image: postgres:17`; **ephemeral** — `tmpfs: [/var/lib/postgresql/data]` (throwaway, no `pgdata` named volume) so each run starts clean; same `POSTGRES_*` env; `pg_isready` healthcheck; attach to `appnet`; publish `ports: ["${TEST_DB_PORT:-5433}:5432"]` so the HOST-side backend venv can reach it at `localhost:5433` — this is exactly the default `TEST_DATABASE_URL` the existing `conftest.py` looks for (`postgresql+psycopg://todo:todo@localhost:5433/todo`).
  - [x] `backend-test` (`profiles: ["test"]`): a one-shot CI test runner using `build: { context: ./backend, target: dev }` (dev target has the app; add pytest via the dev extra — see Task 6) — actually the prod/dev image does NOT install the `dev` extra (pytest/httpx). Use a dedicated approach: `build: { context: ./backend, target: dev }` is insufficient for pytest. Instead give `backend-test` its own minimal setup: reuse the dev target but override the command to install and run tests is fragile. PREFER: add a `test` stage to `backend/Dockerfile` (`FROM runtime AS test`, `USER root`, `pip install <dev extra: pytest, pytest-cov, httpx>`, keep source) OR simply run the host venv against `db-test` (primary verification path). Implement `backend-test` with a `test` Dockerfile stage: `depends_on: { db-test: { condition: service_healthy } }`; `environment: { TEST_DATABASE_URL: postgresql+psycopg://${POSTGRES_USER:-todo}:${POSTGRES_PASSWORD:-todo}@db-test:5432/${POSTGRES_DB:-todo} }`; `command: ["python","-m","pytest","tests","-q"]`; `working_dir: /app`; bind-mount `./backend/tests:/app/tests` so the suite is present (the prod image omits tests). Attach to `appnet`. This service is run via `docker compose --profile test run --rm backend-test`.
  - [x] Keep the base `db` (named volume) and `db-test` (tmpfs) entirely separate so tests never touch prod data and prod durability (Story 5.1 AC) is unaffected.
- [x] **Task 5 — Add a `test` build target to `backend/Dockerfile`** (AC: #2)
  - [x] `FROM runtime AS test`: `USER root`; `pip install pytest pytest-cov httpx` (the runtime deps for the suite — mirror the `dev` optional-dependencies in `pyproject.toml`; pin ranges consistently). Copy is unnecessary (source is bind-mounted by `backend-test`), but ensure `alembic` is present (it is, a runtime dep) for the `_migrated_schema` fixture. Leave `USER root` acceptable for the throwaway CI runner, or drop to `appuser` if bind-mount perms allow. Keep the final default stage as `runtime` (prod) so a bare backend build is unchanged.
- [x] **Task 6 — Wire Vite dev-server host + polling in `frontend/vite.config.ts`** (AC: #1)
  - [x] Set `server.host: true` (bind 0.0.0.0 so the mapped port is reachable from the host browser) and keep `server.port: 5173`. Enable file-watch polling when running in the container: `server.watch.usePolling` driven by an env flag (e.g. `process.env.VITE_DEV_POLLING === '1'`) so local (non-docker) `npm run dev` is unaffected. Do NOT hard-code polling always-on (wastes CPU locally). Keep the existing `preview.port: 4173`.
  - [x] Confirm the API client already resolves `import.meta.env.VITE_API_BASE_URL ?? '/api'` (it does — `src/api/client.ts`), so the dev env var flows through with no code change.
- [x] **Task 7 — Env-var documentation: update `.env.example`(s)** (AC: #3)
  - [x] Root: if no root `.env.example` exists, add one documenting the compose-level vars with non-secret defaults: `POSTGRES_USER/PASSWORD/DB`, `BACKEND_PORT` (8000), `FRONTEND_PORT` (8080), `LOG_LEVEL` (info), and the new `CORS_ORIGINS` (http://localhost:5173, dev only), `FRONTEND_DEV_PORT` (5173), `TEST_DB_PORT` (5433), `VITE_API_BASE_URL` (http://localhost:8000/api), `VITE_DEV_POLLING` (1). Note which are dev/test-only.
  - [x] `backend/.env.example`: already has `DATABASE_URL`, `CORS_ORIGINS`, `LOG_LEVEL` — verify/keep; add a comment clarifying CORS_ORIGINS is dev-profile only.
  - [x] `frontend/.env.example`: already has `VITE_API_BASE_URL`; add `VITE_DEV_POLLING` with a one-line comment. No secrets anywhere; `.env`/`.env.*` stay gitignored (already are, with `!.env.example`).
- [x] **Task 8 — Update the compose header comment (profiles documented, seam closed)** (AC: #1, #2, #3)
  - [x] The existing "Extension seam … Story 5.3 adds dev/test profiles" note should change from a TODO to describing the now-implemented `dev`/`test` profiles: what each brings up, the recommended commands, and that the base stays profile-free. Keep it concise (full README is Story 6.4). Note the CORS-on-in-dev-only decision (AD-10) inline.
- [x] **Task 9 — Verify for real (Docker available)** (AC: #1, #2, #3)
  - [x] `docker compose config` valid; `docker compose --profile dev config` and `docker compose --profile test config` valid.
  - [x] **Default path unchanged:** `docker compose up -d` → `db`, `backend`, `frontend` become healthy; `curl http://localhost:8080/api/health` → 200 `{"status":"ok","db":"ok"}`; confirm **NO** `Access-Control-*` headers on the prod backend (`curl -si http://localhost:8000/api/health` with an `Origin` header shows no `Access-Control-Allow-Origin`). Tear down.
  - [x] **dev profile:** `docker compose --profile dev up -d backend-dev frontend-dev` → db + backend-dev + frontend-dev up; backend-dev reachable at `http://localhost:8000/api/health` (200); Vite dev server reachable at `http://localhost:5173/`. **Prove CORS ON in dev:** a preflight `curl -si -X OPTIONS http://localhost:8000/api/todos -H 'Origin: http://localhost:5173' -H 'Access-Control-Request-Method: GET'` (or a GET with `Origin`) returns `Access-Control-Allow-Origin: http://localhost:5173`. Optionally confirm reload/mounts are active (edit-triggered reload or presence of `--reload` in the process). Tear down.
  - [x] **test profile:** `docker compose --profile test up -d db-test` (ephemeral pg on 5433) → then from the backend venv `cd backend && .venv/bin/python -m pytest tests/integration -q` runs the 44 integration tests (NOT skipped) and they PASS. Paste the observed counts and contrast with the prior "44 skipped". Also (optional) `docker compose --profile test run --rm backend-test` runs the full suite in-container against `db-test`. Tear down with `-v`.
  - [x] **Teardown:** `docker compose --profile dev --profile test down -v`; confirm `docker ps` shows no leftover project containers and `docker volume ls` shows no leftover test volumes.
  - [x] Existing app suites still green: backend host unit+integration and frontend Vitest unaffected.

### Review Findings

Adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, run in-session — subagents unavailable in this harness) of the working-tree diff vs baseline `11db326`. Outcome: **0 decision-needed, 0 patch, 1 defer, 2 dismissed**. No actionable code changes — all three ACs verified live.

- [x] [Review][Defer] Playwright run under the `test` profile is not wired up here [docker-compose.yml] — deferred to Story 6.1 (Playwright E2E suite). AC2's core (compose-managed ephemeral Postgres + transactional-rollback integration suite) is fully implemented and verified (44 passed vs prior 44 skipped); the Playwright-against-composed-app clause of AC2 is forward-looking and explicitly Epic-6 scope per the story's own Test Scenarios note.
- Dismissed (by-design / documented, no change):
  1. A bare `docker compose --profile dev up` (no service args) would map both prod `backend` and `backend-dev` to host :8000 and fail on the clash. This is inherent to the mandated "profile-free base + additive profiles" design; the compose header documents the correct service-scoped command (`docker compose --profile dev up backend-dev frontend-dev`), which starts only the dev services + their `db` dependency. Verified the recommended command starts exactly db + backend-dev + frontend-dev with no prod containers.
  2. `backend-dev` defaults `LOG_LEVEL` to `debug` (vs `info` for prod) — intentional dev verbosity, still env-overridable; not a defect.

## Dev Notes

### Architecture patterns & constraints (authoritative)

- **AD-10 — Single-origin delivery, CORS dev-only** [Source: ARCHITECTURE-SPINE.md#AD-10]: "In the composed stack, nginx serves the built SPA and reverse-proxies `/api/*` to the backend, so the browser sees one origin and no CORS is needed. CORS is enabled **only** in the dev profile (via `CORS_ORIGINS`) where the Vite dev server (:5173) calls the backend (:8000)." The prod path MUST stay CORS-free; dev MUST enable it.
- **Integration-test DB mechanism** [Source: ARCHITECTURE-SPINE.md#Testing & "Decisions"]: RESOLVED (human) — **transactional-rollback fixtures against a compose `test`-profile Postgres** (testcontainers NOT used). The fixtures already exist in `backend/tests/integration/conftest.py`; this story's job is to provide the compose-managed Postgres they connect to. The conftest default DSN is `postgresql+psycopg://todo:todo@localhost:5433/todo` — the `db-test` service MUST publish host port **5433** to satisfy it with zero conftest changes.
- **Config: 12-factor env vars only** [Source: ARCHITECTURE-SPINE.md#Cross-cutting]: backend via `pydantic-settings`, frontend build-time/dev `VITE_*`. No secrets in v1. Use `${VAR:-default}` non-secret defaults everywhere.
- **Container topology** [Source: ARCHITECTURE-SPINE.md#Container topology]: "Compose profiles: `dev` (source mounts, Vite HMR, exposed ports, CORS on) and `test` (ephemeral DB, runs the suites)."
- **Base stays profile-free** [Source: existing `docker-compose.yml` header + Story 5.2 note]: a bare `docker compose up` is the production-like single-origin stack. Profiles are additive; do NOT put a profile on `db`/`backend`/`frontend`.

### Source tree components to touch

- `docker-compose.yml` (UPDATE) — add `backend-dev`, `frontend-dev` (profile `dev`); `db-test`, `backend-test` (profile `test`); update header comment. Leave `db`/`backend`/`frontend` untouched.
- `backend/Dockerfile` (UPDATE) — add `dev` stage (+watchfiles) and `test` stage (+pytest/httpx). Keep `runtime` as the default final stage.
- `frontend/Dockerfile` (UPDATE) — add `dev` stage (node + npm ci + vite). Keep nginx `runtime` as the default final stage.
- `frontend/vite.config.ts` (UPDATE) — `server.host: true` + env-gated `server.watch.usePolling`.
- `frontend/.env.example`, `backend/.env.example` (UPDATE), root `.env.example` (NEW) — document env vars.

### Current state of key UPDATE files (read before editing)

- **`docker-compose.yml`**: profile-free 3-service stack. `db` (postgres:17, named volume `pgdata`, no host port, pg_isready), `backend` (`build: ./backend`, DATABASE_URL to `db:5432`, `CORS_ORIGINS` intentionally unset, host `${BACKEND_PORT:-8000}:8000`, depends_on db healthy), `frontend` (`build: ./frontend`, host `${FRONTEND_PORT:-8080}:8080`, depends_on backend healthy). Networks: `appnet` bridge. Must-preserve: durability via `pgdata`, migrate-before-serve, single-origin no-CORS prod path.
- **`backend/Dockerfile`**: multi-stage `builder` → `runtime` (non-root `appuser` uid 10001, WORKDIR `/app`, venv at `/opt/venv` on PATH, HEALTHCHECK on `/api/health`, ENTRYPOINT `docker-entrypoint.sh` = `alembic upgrade head` then `uvicorn app.main:app --host 0.0.0.0 --port 8000`). `pip install .` installs only runtime deps (NOT the `dev` extra). New stages must extend `runtime` and not alter it.
- **`backend/tests/integration/conftest.py`**: reads `TEST_DATABASE_URL` (default `…@localhost:5433/todo`), gates the whole suite via `pytest_collection_modifyitems` — SKIPS all integration items when the DB is unreachable, otherwise RUNS them. Session-scoped `_migrated_schema` runs real `alembic upgrade head` against the test DB; per-test `db_session` uses SQLAlchemy "join external transaction + savepoint" rollback. No change needed — just make `localhost:5433` reachable.
- **`backend/app/main.py` / `app/core/config.py`**: CORS middleware added ONLY when `settings.cors_origins` is non-empty; `CORS_ORIGINS` is comma-split into a list. So enabling CORS in dev = set `CORS_ORIGINS=http://localhost:5173` on `backend-dev`; leaving it unset on prod `backend` = no CORS. No code change.
- **`frontend/src/api/client.ts`**: `API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'`. Prod build leaves it unset → same-origin `/api` (nginx proxy). Dev sets `VITE_API_BASE_URL=http://localhost:8000/api` → cross-origin to backend-dev (needs CORS). No code change.
- **`frontend/vite.config.ts`**: `server.port: 5173`, `preview.port: 4173`. Needs `host: true` + polling for docker HMR.
- **`frontend/Dockerfile`**: `builder` (node:22-slim, npm ci, npm run build) → `runtime` (nginx:stable-alpine, non-root). New `dev` stage is node-based; must not become the default final stage.

### Compose profiles behavior (avoid the port-clash trap)

- Services with **no** `profiles:` key always start on `docker compose up`. Services WITH a profile only start when that profile is enabled (`--profile <name>`) or when named explicitly on the command line.
- `docker compose up SERVICE...` starts only the named services + their `depends_on` — NOT every service. This is how the dev stack avoids clashing on host port 8000 with the prod backend: start `backend-dev frontend-dev` (which pull in `db`), never the prod `backend`.
- The `test` runner is a one-shot: `docker compose --profile test run --rm backend-test`. The ephemeral `db-test` is started with `docker compose --profile test up -d db-test` for the host-venv path.

### Testing standards

- Backend: pytest; unit suite runs with no DB; integration suite is DB-gated (see conftest). Host command: `cd backend && ../backend/.venv/bin/python -m pytest`. The venv (Python 3.12) has the `dev` extra installed. Prior state: 31 unit pass + 44 integration SKIPPED (no DB). Target: 44 integration RUN + PASS against `db-test`.
- Frontend: Vitest (`npm run test`) — unaffected by this story (114 tests).
- Python resolver fallback: system `python3` is 3.9 (no `tomllib`); use `backend/.venv/bin/python` for any BMAD script that parses TOML.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3 (§672-696)] — ACs + test scenarios (authoritative).
- [Source: ARCHITECTURE-SPINE.md#AD-10, #Container topology, #Testing, #Decisions] — CORS-dev-only, profiles, transactional-rollback test DB.
- [Source: docker-compose.yml, backend/Dockerfile, backend/docker-entrypoint.sh, frontend/Dockerfile, frontend/nginx.conf, backend/tests/integration/conftest.py] — existing implementation to extend.
- [Source: sprint-status.yaml note for 5.2] — base compose is profile-free; dev/test profiles are this story.

### Project Structure Notes

- All new compose services live in the single root `docker-compose.yml` (profiles), consistent with 5.1/5.2 extending one file. No new compose files (`-f` overrides) — the story mandates Compose `profiles:`.
- New Dockerfile stages are additive; the default (last) stage of each Dockerfile remains the prod image so bare `docker build` and the profile-free compose are unchanged.

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

- `docker compose config` / `--profile dev config` / `--profile test config` → all valid; service sets per profile confirmed (default: db/backend/frontend; dev adds backend-dev/frontend-dev; test adds db-test/backend-test).
- One iteration needed on `backend-test`: the `test` stage inherits the prod `ENTRYPOINT` (`docker-entrypoint.sh`), which ran `alembic upgrade head` against the default `localhost:5432` and swallowed the pytest `command`. Fixed by overriding `entrypoint: ["python","-m","pytest"]` on the service (the integration suite migrates the test DB itself via the `_migrated_schema` fixture using `TEST_DATABASE_URL`).

### Completion Notes List

**What was implemented (all 3 ACs satisfied, verified live):**

- **AC1 dev profile.** `backend-dev` (Dockerfile `dev` stage = runtime + `watchfiles`) runs migrate-then-`uvicorn --reload` over bind-mounted source on host :8000 with `CORS_ORIGINS=http://localhost:5173`; `frontend-dev` (Dockerfile `dev` stage = node:22 + `npm ci`) runs the Vite dev server (HMR) on host :5173 with a bind-mount + anonymous `node_modules` volume (linux binaries preserved). `vite.config.ts` gained `server.host: true` + env-gated `server.watch.usePolling`.
- **AC2 test profile.** `db-test` = ephemeral tmpfs `postgres:17` published on host :5433 (the exact DSN `conftest.py` defaults to) — the 44 previously-skipped integration tests now RUN + PASS. `backend-test` (Dockerfile `test` stage = runtime + pytest/pytest-cov/httpx) is a one-shot in-container runner against `db-test:5432` for CI.
- **AC3 12-factor env.** Everything is `${VAR:-default}`; new root `.env.example` documents all knobs; `backend/.env.example` + `frontend/.env.example` updated (CORS dev-only note, `TEST_DATABASE_URL`, `VITE_DEV_POLLING`). No secrets committed. Base `backend`/`frontend` builds pinned `target: runtime` so the profile-free prod stack is byte-for-byte the prod image despite the new Dockerfile stages.

**Verification (Docker 29.6.2 / Compose v5.3.1, real runs):**

- Default stack: `docker compose up -d` → db/backend/frontend all healthy; `curl :8080/` → 200; `curl :8080/api/health` → `{"status":"ok","db":"ok"}`; prod backend OPTIONS preflight → **405, NO `Access-Control-*`** (single-origin, CORS off).
- Dev: `docker compose --profile dev up -d backend-dev frontend-dev` → only db + backend-dev + frontend-dev start (prod backend/frontend NOT started → no :8000 clash). Backend log shows `Started reloader process ... using WatchFiles`; touching `app/main.py` → `WatchFiles detected changes ... Reloading`. **CORS ON**: preflight + GET from `Origin: http://localhost:5173` return `access-control-allow-origin: http://localhost:5173`. Vite serves HTML with `/@vite/client` + `/@react-refresh` (HMR), `/@vite/client` → 200.
- Test: `docker compose --profile test up -d db-test` (healthy on :5433) → host venv `pytest tests/integration` → **44 passed** (prior state: 44 skipped); full backend suite **87 passed**. In-container `docker compose --profile test run --rm backend-test` → **87 passed** against `db-test:5432`.
- Teardown: `docker compose --profile dev --profile test down -v` → zero leftover project containers/volumes.
- No regressions: frontend **114 Vitest passed** + lint clean (eslint + tsc); backend **ruff clean**. No app source changed (the `app/main.py` touch during reload verification left no diff).

### File List

- `docker-compose.yml` (modified) — pinned `target: runtime` on base backend/frontend; added `backend-dev`+`frontend-dev` (profile `dev`), `db-test`+`backend-test` (profile `test`); rewrote the header profile documentation.
- `backend/Dockerfile` (modified) — added `dev` stage (+watchfiles) and `test` stage (+pytest/pytest-cov/httpx), both extending `runtime`.
- `frontend/Dockerfile` (modified) — added node-based `dev` stage (Vite dev server).
- `frontend/vite.config.ts` (modified) — `server.host: true` + env-gated polling.
- `.env.example` (new) — root compose env-var reference.
- `backend/.env.example` (modified) — CORS dev-only clarification + `TEST_DATABASE_URL`.
- `frontend/.env.example` (modified) — added `VITE_DEV_POLLING`.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — 5.3 status transitions.

## Change Log

- 2026-07-23: Implemented Story 5.3 — dev/test compose profiles + env-var configuration. Dev profile (bind-mount live-reload, Vite HMR, CORS-on per AD-10), test profile (ephemeral tmpfs Postgres, transactional-rollback integration suite now runs: 44 passed vs prior 44 skipped, in-container CI runner). Base profile-free prod stack unchanged and re-verified. All tasks complete; verified live with Docker.

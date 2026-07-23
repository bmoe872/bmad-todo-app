---
baseline_commit: e81d46ecd3be46991a0d1262b0a702588dc50dc5
---

# Story 5.1: Backend & database containers with health checks, named volume, and migrate-before-serve

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want the backend and Postgres running as containers with durable storage, health checks, and automatic migrations on start,
so that data survives restarts and the API only serves once its schema is ready.

## Acceptance Criteria

1. **Backend Dockerfile is multi-stage, non-root, migrate-before-serve.** `backend/Dockerfile` builds in two stages (deps/builder → slim runtime), runs the process as a **non-root** user, and its entrypoint runs `alembic upgrade head` **before** launching Uvicorn. (epics.md §615 AC-1; AD-11; NFR-Deploy)
2. **`db` service is postgres:17 on a named volume with a pg_isready healthcheck and 12-factor env config; no committed secrets.** The Compose `db` service uses `postgres:17`, persists data on a **named volume** (`pgdata`), declares a Docker `healthcheck` using `pg_isready`, and is configured entirely via environment variables with dev defaults (no secret values committed). (epics.md §615 AC-2; AD-11; NFR-Rel; NFR-Deploy)
3. **Startup ordering + backend healthcheck.** The `backend` service `depends_on` the `db` with `condition: service_healthy`, and the `backend` service declares a Docker `healthcheck` hitting `GET /api/health`. (epics.md §615 AC-3; AD-11; NFR-Deploy)
4. **Durability across restart.** After `docker compose down` then `up`, previously persisted Todos are still present (volume-backed). (epics.md §615 AC-4; NFR-Rel; SM-3)

## Test Scenarios (authoritative — from epics.md §639-642)

- **Integration/ops:** `docker compose up` (backend + db) → `GET /api/health` returns `200` after migrations; container runs as non-root (verified via `id`/inspect); logs are viewable via `docker compose logs`.
- **Durability:** create Todos, `docker compose down` then `up`, confirm data persists on the named volume.
- **E2E hook:** full-stack E2E runs against the composed stack in Story 6.1 (out of scope here).

**Traceability:** NFR-Deploy, NFR-Rel; AD-11; SM-3, SM-7 (partial).

## Tasks / Subtasks

- [x] **Task 1 — `backend/.dockerignore`** (AC: #1)
  - [x] Exclude build/runtime cruft so the image is small and reproducible: `.venv/`, `__pycache__/`, `*.py[cod]`, `.pytest_cache/`, `.ruff_cache/`, `.coverage*`, `*.egg-info/`, `tests/`, `.env`, `.env.*` (but the image needs `app/`, `migrations/`, `alembic.ini`, `pyproject.toml`).
- [x] **Task 2 — `backend/Dockerfile` (multi-stage, non-root, healthcheck)** (AC: #1, #3)
  - [x] Builder stage `FROM python:3.12-slim` (matches pinned `backend/.python-version` = 3.12.13; `psycopg[binary]` ships wheels so no compiler toolchain is needed — keep it slim).
  - [x] Builder installs runtime deps into an isolated venv at `/opt/venv` (`python -m venv /opt/venv`; `pip install --no-cache-dir .` after copying `pyproject.toml`, `app/`, `migrations/`, `alembic.ini`). This installs the exact pinned dependency ranges from `pyproject.toml` (fastapi, uvicorn, sqlalchemy, psycopg[binary], alembic, pydantic-settings). Do NOT install the `dev` optional extra (no pytest/ruff in the runtime image).
  - [x] Runtime stage `FROM python:3.12-slim`; copy `/opt/venv` from builder; set `ENV PATH=/opt/venv/bin:$PATH` and `PYTHONUNBUFFERED=1` (so JSON logs flush to stdout for `docker compose logs`).
  - [x] Copy application source into `WORKDIR /app`: `app/`, `migrations/`, `alembic.ini` (and `pyproject.toml` is optional at runtime). `alembic.ini` has `prepend_sys_path = .` and `script_location = migrations`, so alembic must run with CWD `/app`.
  - [x] Create a **non-root** user (e.g. `appuser`, a fixed high UID like 10001) and `USER appuser` before the entrypoint. Ensure the copied files are readable by that user.
  - [x] `EXPOSE 8000`.
  - [x] `HEALTHCHECK` hitting `GET /api/health` — the slim image has **no curl/wget**, so use Python stdlib: `CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health').status==200 else 1)"`. Use sensible `--interval`, `--timeout`, `--retries`, and a `--start-period` (~10-20s) to cover migration + boot time.
  - [x] `ENTRYPOINT` runs the entrypoint script (Task 3); no `CMD` args needed (or use CMD for the uvicorn invocation the script `exec`s).
- [x] **Task 3 — `backend/docker-entrypoint.sh` (migrate-before-serve, AD-11)** (AC: #1)
  - [x] `#!/bin/sh` + `set -e` so a failed migration aborts startup (never serve on a bad schema).
  - [x] Run `alembic upgrade head` (CWD `/app`; `migrations/env.py` reads `DATABASE_URL` via `get_settings()` — single source of truth, AD-11).
  - [x] Then `exec uvicorn app.main:app --host 0.0.0.0 --port 8000` — `exec` so uvicorn becomes PID 1's process and receives SIGTERM/SIGINT for clean shutdown.
  - [x] Make it executable (`chmod +x`) and ensure the COPY preserves the exec bit (or `chmod` in the Dockerfile).
- [x] **Task 4 — root `docker-compose.yml` (db + backend only)** (AC: #2, #3)
  - [x] `db` service: `image: postgres:17`; `environment` with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` using env indirection + dev defaults (`${POSTGRES_USER:-todo}` etc.); `volumes: [pgdata:/var/lib/postgresql/data]`; `healthcheck` using `pg_isready -U <user> -d <db>` with interval/timeout/retries/start_period; attach to the internal network.
  - [x] `backend` service: `build: ./backend`; `environment.DATABASE_URL=postgresql+psycopg://${POSTGRES_USER:-todo}:${POSTGRES_PASSWORD:-todo}@db:5432/${POSTGRES_DB:-todo}` (host `db`, the compose service name — NOT localhost); `LOG_LEVEL=${LOG_LEVEL:-info}`; leave `CORS_ORIGINS` **unset/empty** (single-origin; CORS is a dev-profile concern deferred to 5.3, AD-10); `depends_on: { db: { condition: service_healthy } }`; map `ports: ["8000:8000"]` so the API is reachable for verification; attach to the internal network. The backend healthcheck comes from the Dockerfile `HEALTHCHECK` (no need to duplicate in compose).
  - [x] Declare the named volume `pgdata` under top-level `volumes:` and an internal `networks:` entry (e.g. `appnet`, default bridge driver).
  - [x] **Structure for clean extension:** 5.2 will add a `frontend` service (nginx, single-origin proxy, `depends_on` backend healthy) and 5.3 will add `dev`/`test` **profiles** + env-var config. Keep services/volumes/networks laid out so those are additive. Do NOT add the frontend service or profiles in this story.
  - [x] No `version:` key is required (Compose v2 ignores it); omit it or keep it minimal.
- [x] **Task 5 — Verify for real (Docker is available)** (AC: #1, #2, #3, #4)
  - [x] `docker compose build` — both stages build cleanly.
  - [x] `docker compose up -d db backend`; wait for both `healthy` (`docker compose ps`).
  - [x] Confirm migrations ran: exec into db (`psql`) or backend and confirm the `todos` table exists (`alembic_version` at head `0002`).
  - [x] `curl http://localhost:8000/api/health` → `200 {"status":"ok","db":"ok"}`.
  - [x] Confirm non-root: `docker compose exec backend id` → non-zero uid (not `uid=0(root)`).
  - [x] Confirm logs: `docker compose logs backend` shows the alembic upgrade line then uvicorn startup + JSON request logs.
  - [x] **Durability:** `POST /api/todos` a couple items → `docker compose down` (NO `-v`; keep the volume) → `docker compose up -d` → `GET /api/todos` shows the same items.
  - [x] **Tear down:** `docker compose down` to stop the run (keep the `pgdata` volume *definition* in the file). Remove any ad-hoc test volume you created. Do NOT leave containers running. (You MAY `docker compose down -v` at the very end to drop the test data volume from your machine — the volume *definition* stays in the compose file either way.)
- [x] **Task 6 — Regression guard** (AC: all)
  - [x] Confirm the existing backend pytest suite still passes (`backend/.venv/bin/python -m pytest` from `backend/`) — this story adds infra files only and must not touch app code. Frontend/e2e untouched.
  - [x] Note (do not run GitHub): the CI `build-images` job (`.github/workflows/ci.yml`) is already authored to `docker build ... backend` **only when `backend/Dockerfile` exists** — creating the Dockerfile activates that step. Verify the Dockerfile builds standalone with `docker build -t nearform-todo-backend:ci backend` (the exact CI invocation, context = `backend/`).

### Review Findings

Adversarial code review (2026-07-23) — Blind Hunter, Edge Case Hunter, and Acceptance Auditor lenses run in-session against `backend/Dockerfile`, `backend/.dockerignore`, `backend/docker-entrypoint.sh`, `docker-compose.yml` (diff vs baseline `e81d46e`). All 4 ACs audited as met against the live composed stack. No `decision-needed` or `patch` findings.

- [x] [Review][Defer] Base image `python:3.12-slim` pinned by tag, not by digest [backend/Dockerfile:12,29] — deferred: reproducibility hardening (digest pin) belongs to the Epic 6 Story 6.3 security/supply-chain pass; the story only required matching the 3.12 pin, which the tag satisfies.

Dismissed as noise / by-design (5): backend port `8000:8000` host-exposed (in-scope for 5.1 verification; nginx fronts it in 5.2); dev default DB password `todo` (AC-permitted non-secret dev default via env indirection, mirrors `.env.example`); project package also installed into the venv alongside the copied `/app` source (harmless duplicate; `uvicorn app.main:app` runs from WORKDIR `/app`, verified); HEALTHCHECK `urllib.urlopen` raising on a 503 (correct — yields `unhealthy` when the DB is down); `restart: unless-stopped` (crash-loop still surfaces via `unhealthy` + logs).

## Dev Notes

### Architecture / invariants this story implements

- **AD-11 (Startup and durability ordering)** — the load-bearing constraint. Postgres data on a **named volume**; backend `depends_on` db healthy (`pg_isready`); backend entrypoint runs `alembic upgrade head` **before** Uvicorn; migrations are additive/non-destructive. [Source: ARCHITECTURE-SPINE.md#AD-11]
- **Container topology** — 3 containers total (`frontend`, `backend`, `db`); this story delivers **`backend` + `db` only**. Backend is uvicorn/FastAPI, **non-root**. `db` is `postgres:17` with the `pgdata` named volume. Multi-stage Dockerfile (deps → slim runtime). [Source: ARCHITECTURE-SPINE.md#Container topology, lines 180-190]
- **Health contract** — `GET /api/health` → `200 {"status":"ok","db":"ok"}` after a real DB round-trip; `503` if DB unreachable. The route is mounted at `/api` (router prefix in `app/main.py`) + `/health` (health router) = `/api/health`. [Source: ARCHITECTURE-SPINE.md#API Contract, line 146; backend/app/main.py; backend/app/api/routes/health.py]
- **12-factor config** — env vars only, parsed by `pydantic-settings`; **no secrets in v1**. Var names mirror `backend/.env.example`: `DATABASE_URL`, `CORS_ORIGINS`, `LOG_LEVEL`. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions, line 134; backend/.env.example]
- **AD-10 (single-origin)** — CORS is enabled ONLY in the dev profile (5.3). For 5.1's plain db+backend bring-up, leave `CORS_ORIGINS` empty. Do not add nginx here (5.2). [Source: ARCHITECTURE-SPINE.md#AD-10]
- **Logging** — structured JSON to stdout, one line per request with a request id, viewable via `docker compose logs`. Set `PYTHONUNBUFFERED=1` so lines are not buffered. [Source: ARCHITECTURE-SPINE.md line 135; backend/app/main.py request_context middleware]

### Files to CREATE (all NEW — this story adds no changes to app code)

- `backend/Dockerfile` (NEW)
- `backend/.dockerignore` (NEW)
- `backend/docker-entrypoint.sh` (NEW, executable)
- `docker-compose.yml` (root, NEW)

### Existing backend facts the dev MUST respect (read before writing)

- **Python pin:** `backend/.python-version` = `3.12.13`; `pyproject.toml` `requires-python = ">=3.12,<3.13"`. Use a `python:3.12-slim` base. [Source: backend/pyproject.toml, backend/.python-version]
- **Dependencies (pinned ranges in `pyproject.toml`):** fastapi, pydantic, pydantic-settings, sqlalchemy 2.0, **psycopg[binary]** (binary wheels → no gcc needed), alembic, uvicorn. The `dev` extra (pytest/pytest-cov/ruff/httpx) must NOT be installed in the runtime image. [Source: backend/pyproject.toml]
- **Package layout:** `[tool.setuptools.packages.find] include = ["app*"]` — only `app` is packaged. `migrations/` and `alembic.ini` are NOT part of the wheel, so they must be **copied explicitly** into the runtime image; they cannot be relied upon from site-packages. [Source: backend/pyproject.toml]
- **Alembic wiring:** `alembic.ini` has `script_location = migrations` and `prepend_sys_path = .`; `migrations/env.py` does `config.set_main_option("sqlalchemy.url", get_settings().database_url)` and imports `app.db.models`/`app.core.config`/`app.db.base`. So `alembic upgrade head` must run with CWD `/app` and with `DATABASE_URL` set in the environment; do NOT put a URL in `alembic.ini`. Migrations at head = revision `0002_create_todos` (baseline `0001` + todos `0002`). [Source: backend/alembic.ini, backend/migrations/env.py, backend/migrations/versions/]
- **ASGI target:** module-level `app = create_app()` in `app/main.py` → `uvicorn app.main:app`. [Source: backend/app/main.py]
- **DB DSN scheme:** SQLAlchemy 2.0 + psycopg 3 sync DSN = `postgresql+psycopg://user:pass@host:5432/db`. The app default targets `localhost`; in compose it MUST target host `db` (the service name). [Source: backend/.env.example, backend/app/core/config.py]
- **Health does a real DB round-trip** (`check_connection` → `SELECT 1`), so the backend only reports healthy once the DB is reachable AND migrations have run — exactly the AD-11 gate. [Source: backend/app/api/routes/health.py, backend/app/db/session.py]
- **`pool_pre_ping=True`** is already set on the engine, so a DB restart (durability test) surfaces as a clean reconnect. [Source: backend/app/db/session.py]

### Slim-image gotchas (prevent wasted review cycles)

- `python:3.12-slim` has **no `curl`/`wget`** — the HEALTHCHECK must use Python stdlib (`urllib.request`), not curl. (Alternatively `pg_isready` lives only in the postgres image, not the backend image.)
- Copy `app/`, `migrations/`, `alembic.ini` — a common miss is copying only `app/`, which makes `alembic upgrade head` fail at container start with "No such file or directory: migrations" or an alembic config error.
- Run the entrypoint with `sh` (slim has no bash by default) — use `#!/bin/sh`.
- Set the non-root `USER` AFTER copying files; ensure permissions allow read + execute of the entrypoint.
- `exec uvicorn …` (not plain `uvicorn …`) so SIGTERM from `docker compose down` reaches uvicorn and shutdown is graceful.

### Compose extension seam (for 5.2 / 5.3 — do not build now)

- **5.2** adds a `frontend` service (multi-stage node build → nginx stable-alpine, `nginx.conf` reverse-proxying `/api/*` to `backend`, healthcheck on `GET /`), and `frontend depends_on backend: service_healthy`. Lay out `docker-compose.yml` so this is a clean addition.
- **5.3** adds `dev` and `test` **profiles** (source mounts, Vite HMR, exposed ports, `CORS_ORIGINS` on for dev; ephemeral test DB). Keep base config profile-free so the default `docker compose up` = the production-like stack.

### Project Structure Notes

- Matches the architecture source tree exactly: `backend/Dockerfile`, root `docker-compose.yml`. [Source: ARCHITECTURE-SPINE.md#Source tree, lines 226/241]. The entrypoint script (`backend/docker-entrypoint.sh`) and `backend/.dockerignore` are unlisted-but-implied support files — standard and non-conflicting.
- `.gitignore` already ignores `.env`/`.env.*` (keeps `.env.example`); no secret files will be committed. [Source: .gitignore]
- The root `Makefile` and `.github/workflows/ci.yml` already reference "compose-backed run lands in Epic 5" and a conditional `docker build … backend` — this story is the trigger that makes the CI image-build step active. No Makefile/CI edits are required by the ACs (a compose convenience target can be deferred to 5.2/5.3 when the full stack exists).

### Testing standards summary

- This is an **infrastructure** story; its verification is the ops procedure in Task 5 (real `docker compose build` + `up` + health + durability + non-root + logs). Capture the actual command output.
- The existing `backend/tests/{unit,integration}` pytest suite must still pass unchanged — do not modify app code. Integration tests use transactional-rollback fixtures against a Postgres; running them is not required inside a container for this story. [Source: ARCHITECTURE-SPINE.md#Testing lines 269/279]
- No new automated unit test is mandated by the ACs. If adding a lightweight guard, a shell/lint of the entrypoint (`sh -n docker-entrypoint.sh`) is sufficient — do not over-engineer.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1 (lines 615-644)] — authoritative ACs + test scenarios
- [Source: _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md#AD-11 (112-115), #AD-10 (107-110), #Container topology (180-190), #API Contract (146), #Consistency Conventions (134-135), #Stack (159-175)]
- [Source: _bmad-output/planning-artifacts/prds/prd-nearform_todo_app-2026-07-23/addendum.md (lines 9-10)] — multi-stage Dockerfiles, non-root users, health checks, volume-backed Postgres, `docker-compose up`, logs via `docker-compose logs`
- [Source: backend/pyproject.toml, backend/.python-version, backend/alembic.ini, backend/migrations/env.py, backend/app/main.py, backend/app/core/config.py, backend/app/db/session.py, backend/app/api/routes/health.py, backend/.env.example, .gitignore, .github/workflows/ci.yml]

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

Real verification against Docker (Docker 29.6.2, Compose v5.3.1). Key observed output:

- `docker compose build` — builder stage installed the exact pinned deps into `/opt/venv` (fastapi 0.136.3, uvicorn 0.34.3, sqlalchemy 2.0.51, psycopg 3.3.4 + psycopg-binary, alembic 1.18.5, pydantic 2.13.4, pydantic-settings 2.14.2); runtime stage assembled slim + non-root. Build clean.
- `docker compose up -d db backend` — `db` reported **Healthy** BEFORE `backend` started (the `depends_on: condition: service_healthy` gate). Backend reached `healthy` within ~7s (start-period 20s covers migrate+boot).
- `GET /api/health` → `200 {"status":"ok","db":"ok"}` (real DB round-trip).
- Non-root confirmed: `docker compose exec backend id` → `uid=10001(appuser) gid=10001(appuser)`.
- Migrations ran: `alembic_version` = `0002_create_todos`; `\dt` lists `alembic_version` + `todos`.
- Migrate-before-serve log ordering (viewable via `docker compose logs backend`):
  `entrypoint: applying database migrations (alembic upgrade head)` →
  `Running upgrade -> 0001_baseline` → `Running upgrade 0001_baseline -> 0002_create_todos` →
  `entrypoint: starting uvicorn on 0.0.0.0:8000` → `Uvicorn running on http://0.0.0.0:8000`.
- Durability: POSTed 2 todos → `docker compose down` (volume kept) → `docker compose up -d` → `GET /api/todos` returned the same 2 todos (created_at preserved). On restart the entrypoint ran `alembic upgrade head` as a no-op (already at head — idempotent, no "Running upgrade" lines).
- CI-exact standalone build `docker build -t nearform-todo-backend:ci backend` succeeded (context = `backend/`), confirming the `.github/workflows/ci.yml` `build-images` step will now activate.
- Teardown: `docker compose down -v` removed containers + the ad-hoc test-data volume; the ad-hoc `:ci` image tag removed. No leftover `nearform_todo_app` containers. The `pgdata` volume *definition* remains in `docker-compose.yml`.
- Regression: `backend/.venv/bin/python -m pytest -q` → **43 passed, 44 skipped**. The skips are pre-existing (integration tests require a test-profile Postgres on `localhost:5433`, a Story 5.3/CI concern) — not a regression; this story changed no app code.

### Completion Notes List

- All 4 ACs verified against a live composed stack; all 6 tasks complete.
- Key choices: base image `python:3.12-slim` (matches 3.12.13 pin); two stages (builder installs project+deps into `/opt/venv`, runtime copies the venv + `app/`+`migrations/`+`alembic.ini`); non-root `appuser` (uid/gid 10001); HEALTHCHECK via Python `urllib` stdlib (slim image has no curl/wget) on `GET /api/health`; entrypoint `docker-entrypoint.sh` (`#!/bin/sh`, `set -e`) runs `alembic upgrade head` then `exec uvicorn` (AD-11, clean SIGTERM); `postgres:17` `db` on named volume `pgdata` with `pg_isready` healthcheck; backend `depends_on db: condition: service_healthy`; 12-factor env with `${VAR:-default}` indirection, no committed secrets; `DATABASE_URL` host `db`; `CORS_ORIGINS` left empty (single-origin, AD-10); internal bridge network `appnet`.
- Scoped to db+backend only. Compose is structured for clean extension: 5.2 adds the `frontend`/nginx single-origin service (`depends_on backend: service_healthy`); 5.3 adds `dev`/`test` profiles + CORS-on-in-dev. Base config is profile-free so a plain `docker compose up` is the production-like stack.
- No app code, tests, Makefile, or CI files were modified — infrastructure files only.

### File List

- `backend/Dockerfile` (NEW)
- `backend/.dockerignore` (NEW)
- `backend/docker-entrypoint.sh` (NEW, executable)
- `docker-compose.yml` (NEW, repo root)
- `_bmad-output/implementation-artifacts/5-1-backend-database-containers-with-health-checks-named-volume-and-migrate-before-serve.md` (story file — status/records)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status tracking)

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-23 | Implemented Story 5.1: multi-stage non-root backend Dockerfile with migrate-before-serve entrypoint + `GET /api/health` HEALTHCHECK; `.dockerignore`; root `docker-compose.yml` (postgres:17 `db` on named volume `pgdata` + `pg_isready` healthcheck, `backend` gated on `db` healthy). Verified live: build, healthy bring-up, migrations at head, health 200 `db:ok`, non-root uid 10001, durability across down/up. All ACs met; backend suite green (43 passed, 44 pre-existing skips). Status → review. |

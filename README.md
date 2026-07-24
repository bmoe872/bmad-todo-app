# TODO APP

A deliberately **minimal single-user Todo app**, built end-to-end with the
[BMAD](#how-bmad-guided-the-build) spec-driven method to demonstrate an
AI-assisted delivery workflow with QA baked in from day one.

The list floats in space over a slow-drifting field of cube "stars" (three.js) —
a cosmetic delighter that never compromises the core loop's performance or
accessibility.

- **Frontend:** React 19 + Vite + TypeScript SPA, TanStack Query for server-state,
  three.js for the decorative backdrop.
- **Backend:** FastAPI (Python 3.12), layered `routes → services → repositories → db`,
  synchronous SQLAlchemy 2.0 + psycopg 3.
- **Persistence:** PostgreSQL 17 on a named Docker volume.
- **Delivery:** multi-stage Dockerfiles, non-root containers, health-checked,
  orchestrated by Docker Compose. **Single origin** — nginx serves the built SPA
  and reverse-proxies `/api/*` to the backend, so the browser sees one origin and
  no CORS is needed.

The feature set is intentionally small: create, view, toggle-complete (in place),
delete, and clear-completed (with a deferred-commit Undo). There is no auth and a
single implicit global list — the multi-user seam is documented but not built
(see [architecture AD-9](#architecture)).

---

## Prerequisites

- **Docker** with the `docker compose` CLI (the only requirement for the primary
  run path). Verified against Docker 29.6.2 / Docker Compose v5.3.1.

For local (non-Docker) development you additionally need:

- **Node.js 22 LTS** — pinned via `.nvmrc` (run `nvm use`).
- **Python 3.12** — pinned via `backend/.python-version` (pyenv); the backend uses
  a project-local virtualenv at `backend/.venv`.

---

## Quick start — `docker compose up`

The primary, production-like path. From the repo root:

```bash
docker compose up --build
```

This builds and starts three health-checked services in dependency order —
`db` (Postgres, waits healthy) → `backend` (runs `alembic upgrade head` before
serving) → `frontend` (nginx). Then open:

```
http://localhost:8080
```

That single origin serves the SPA and proxies the API. Verify the backend through
the proxy:

```bash
curl http://localhost:8080/api/health      # -> {"status":"ok","db":"ok"}
```

Tear down (data persists on the `pgdata` volume across restarts):

```bash
docker compose down          # keep data
docker compose down -v        # also remove the pgdata volume
```

> The `backend` service also maps host `:8000` for debugging/inspection, but the
> browser never uses it — all app traffic goes through `:8080`.

### Dev profile (live reload, HMR, CORS on)

For iterating on source with hot-reload. Because the profile-free `backend`/
`frontend` services always start, use the `up SERVICE…` form so only the dev
services (plus their `db` dependency) come up — a bare `--profile dev up` would
port-clash the prod `backend` on `:8000`:

```bash
docker compose --profile dev up backend-dev frontend-dev
```

- Vite dev server with HMR at **http://localhost:5173** (cross-origin to the
  backend at `:8000`).
- Backend runs under `uvicorn --reload` (WatchFiles) with **CORS enabled** for
  `http://localhost:5173` (this is the only place CORS is on — see AD-10).

### Test profile (ephemeral DB + in-container suites)

Spins up an ephemeral tmpfs Postgres on `:5433` (the DSN the backend test suite
defaults to) and a one-shot pytest runner:

```bash
docker compose --profile test up db-test backend-test
```

This is the environment CI uses to run the integration suite against a real
Postgres.

### Configuration (environment variables)

All configuration is 12-factor via env vars, documented in **`.env.example`**.
Every variable has a non-secret default baked into `docker-compose.yml` via
`${VAR:-default}`, so the stack runs with none of them set. Copy to `.env` to
override (`.env` is gitignored; **there are no secrets in v1**).

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `todo` / `todo` / `todo` | Database credentials |
| `FRONTEND_PORT` | `8080` | Public app origin (nginx, single-origin) |
| `BACKEND_PORT` | `8000` | Backend debug port (browser does NOT use it) |
| `FRONTEND_DEV_PORT` | `5173` | Vite dev server (dev profile) |
| `TEST_DB_PORT` | `5433` | Ephemeral test Postgres (test profile) |
| `LOG_LEVEL` | `info` | Structured JSON stdout log level |
| `CORS_ORIGINS` | *(unset in prod)* | Allowed origins; set only for `backend-dev` |
| `VITE_API_BASE_URL` | *(unset in prod → `/api`)* | Where the browser reaches the API in dev |
| `VITE_DEV_POLLING` | `1` | Poll for file changes so HMR works over bind mounts |

Logs: `docker compose logs -f`.

---

## Local development (without Docker)

Runtimes are pinned; activate them first (`nvm use` reads `.nvmrc`; pyenv reads
`backend/.python-version`). The root **Makefile** is the single task runner and is
CI-agnostic (GitHub Actions calls the same targets).

```bash
make install     # backend venv (3.12) + deps, frontend deps, e2e deps + Chromium
make test        # backend pytest (unit) + frontend Vitest
make coverage    # both suites with branch coverage; ENFORCES the >=70% gate
make lint        # ruff (backend) + eslint & tsc (frontend)
make e2e         # Playwright E2E + a11y against an isolated composed stack
make ci          # lint + test + coverage + e2e (local mirror of the pipeline)
make help        # list all targets
```

Run `make help` to see everything.

---

## Running the tests

| Suite | Command | Notes |
|---|---|---|
| **Backend unit** | `make test-backend` | pytest; runs without a database. |
| **Backend integration** | `docker compose --profile test up db-test backend-test` (or `make test-backend` with a test Postgres on `:5433`) | Transactional-rollback fixtures against a real Postgres 17. Skips cleanly when no test DB is reachable. |
| **Frontend unit** | `make test-frontend` | Vitest + jsdom. |
| **Coverage gate** | `make coverage` | Branch coverage; fails under 70% (Story 6.2). Backend via pytest-cov, frontend via Vitest v8. |
| **Lint / typecheck** | `make lint` | ruff, then eslint + `tsc --noEmit`. |
| **E2E + accessibility** | `make e2e` | Playwright drives the real UI against an **isolated** composed stack (its own compose project `nftodo_e2e` on ports `:8090`/`:8010` with its own volume), plus an `@axe-core/playwright` zero-critical-WCAG gate with the backdrop active. Always tears the isolated stack down afterward. It never touches a default-project stack on `:8080`. |

**"Meaningful coverage"** (SM-5) is measured as **branch** coverage of real
application logic, **excluding** generated code, config, Alembic migrations, and
device-dependent three.js visual tuning. The exclusions are configured in
`backend/pyproject.toml` and `frontend/vitest.config.ts`.

> **Note on integration tests:** with no test Postgres running, the backend
> integration suite skips (by design) and the enforced coverage gate still passes
> on the unit suite alone. Running the integration suite (test profile / CI)
> raises backend coverage substantially — see the [QA reports](docs/qa/).

---

## Architecture

The system is a three-tier client–server app with **server-authoritative state**:
the SPA holds a derivative cache that it updates optimistically and always
reconciles back to the API; PostgreSQL, reached only through the API, is the
single source of truth.

The full design — invariants, architectural decisions (AD-1…AD-12), the API
contract, and the source tree — lives in the **architecture spine**:

- [`_bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md`](_bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md)

Key decisions worth knowing up front:

- **AD-7 — Clear-completed is a deferred bulk-delete.** On "Clear completed" the
  client snapshots the completed ids, hides them, and shows a ~6s Undo toast.
  Undo cancels with **no server call**; on dismiss the client issues **one**
  `DELETE /api/todos/completed` with that id snapshot. Nothing is deleted
  server-side until dismiss, so a crash mid-window safely restores on reload.
- **AD-8 — The backdrop is fully isolated.** three.js is code-split into a lazy
  chunk, mounted after the core loop is interactive, `aria-hidden`,
  `pointer-events:none`, with a mandatory degradation ladder
  (reduced-motion → static frame; no WebGL → CSS gradient; frame-budget watchdog
  steps down DPR then cube count) and an error boundary — a backdrop failure can
  never take down the todo loop.
- **AD-10 — Single origin.** nginx serves the SPA and proxies `/api/*`; no CORS
  in production. CORS is enabled only in the dev profile.

### API contract summary

Base path `/api` (versionless). `Todo = { id: uuid, description: string,
completed: bool, created_at: ISO-8601 UTC "…Z" }`. Every non-2xx response uses a
uniform envelope: `{ "error": { "code", "message", "details"? } }`.

| Method + path | Body | Success | Errors |
|---|---|---|---|
| `GET /api/health` | — | `200 {status:"ok", db:"ok"}` | `503` if DB unreachable |
| `GET /api/todos` | — | `200 {todos:[Todo,…]}` (newest first) | `500` |
| `POST /api/todos` | `{description}` | `201 Todo` | `422` (trims; rejects empty/multiline/>500 chars) |
| `PATCH /api/todos/{id}` | `{completed}` | `200 Todo` | `404` / `422` |
| `DELETE /api/todos/{id}` | — | `204` | `404` |
| `DELETE /api/todos/completed` | `{ids:[uuid,…]}` (optional) | `200 {deleted:int}` | `500` |

The static `DELETE /api/todos/completed` route is registered before the parametric
`DELETE /api/todos/{id}` (which is UUID-typed) so they never collide.

### Project structure

```
backend/     FastAPI service (Python 3.12)
  app/
    api/routes/     HTTP layer (todos.py, health.py)
    services/       domain rules / validation
    repositories/   data access — the ONLY place SQL lives
    db/             SQLAlchemy engine / session / models
    core/           config, error envelope, logging
    schemas/        Pydantic models
  migrations/       Alembic (baseline + create_todos)
  tests/            unit/ + integration/
frontend/    React + Vite SPA (Node 22)
  src/
    components/     presentational UI
    hooks/          TanStack Query server-state hooks
    api/            thin typed API client
    backdrop/       isolated three.js layer (scene, degradation, boundary)
    styles/         Orbit design tokens + global CSS
e2e/         Playwright end-to-end + @axe-core/playwright a11y specs
docs/        QA reports (docs/qa/) + AI-INTEGRATION-LOG.md
docker-compose.yml   prod-like base + dev/test profiles
Makefile             single task runner (mirrors CI)
_bmad-output/        all BMAD planning + implementation artifacts
```

---

## How BMAD guided the build

This project was delivered with the **BMAD Method** — a spec-driven, persona-driven
workflow where each phase produces a durable artifact that the next phase builds
on, rather than jumping straight to code. AI agents played specific personas
(analyst, PM, architect, UX designer, developer, reviewer) at each stage.

The flow, and where each artifact lives under `_bmad-output/planning-artifacts/`:

1. **Product brief** (analyst) — framing, goals, the activity spec's hard quality
   bars → `briefs/`.
2. **PRD** (PM) — functional requirements (FR-1…FR-9), NFRs, and success metrics
   (SM-1…SM-9), plus a technical addendum → `prds/`.
3. **UX design** (UX designer) — the "Orbit" panel, interaction/EXPERIENCE specs,
   design decisions → `ux-designs/`.
4. **Architecture spine** (architect) — the lean set of invariants (AD-1…AD-12),
   the API contract, and the source tree that keep everything consistent →
   `architecture/`.
5. **Epics & stories** (PM/architect) — the work broken into 6 epics / 20 stories,
   each with BDD acceptance criteria and traceability back to FRs/NFRs →
   `epics.md`.
6. **Implementation readiness** — a gate confirming the PRD, UX, architecture, and
   epics are complete and consistent before building.
7. **Sprint planning** — status tracking generated from the epics →
   `_bmad-output/implementation-artifacts/sprint-status.yaml`.
8. **Build** — per story: `create-story` (assemble full context) → `dev-story`
   (implement) → `code-review` (adversarial review, fix, mark done). Each story's
   record lives in `_bmad-output/implementation-artifacts/`.

The six epics: (1) Foundation & test harness, (2) Todo CRUD API, (3) Core frontend
loop, (4) Space backdrop & graceful degradation, (5) Containerized delivery,
(6) Quality/accessibility/security/documentation sign-off.

How AI was actually used across the build — the effective agent/MCP usage,
test-generation hits and misses, real debugging cases, and the honest limitations
where human/orchestrator judgment was required — is documented in the
**[AI integration log](docs/AI-INTEGRATION-LOG.md)**.

---

## Quality & QA reports

QA was integrated from day one, not bolted on. The documented passes from the
sign-off epic live in **[`docs/qa/`](docs/qa/)**:

- [Security review](docs/qa/security-review-6.3.md) — XSS, injection, validation
  parity, CORS, headers, dependencies, container hardening.
- [Performance pass](docs/qa/performance-pass-6.3.md) — API latency, bundle
  isolation, backdrop guardrails.
- [Accessibility pass](docs/qa/accessibility-pass-6.3.md) — WCAG 2.1 AA beyond the
  automated axe gate.

Each report labels every finding **MEASURED** vs **DESIGN-ANALYSIS**, so
device-dependent items (live-GPU frame rate, in-browser CSP console) that could
not be instrumented in this environment are called out honestly rather than
presented as benchmarks.

### Success criteria

How this project meets the activity-spec success criteria (with honest caveats):

| Criterion | Target | Status |
|---|---|---|
| Working application | Full CRUD Todo app | **Met** — prod stack healthy on `:8080`; create / toggle / delete / clear-completed verified end-to-end. |
| Test coverage | ≥ 70% meaningful | **Met** — enforced branch-coverage gate (`make coverage` fails under 70%). |
| E2E tests | ≥ 5 passing Playwright | **Met** — 6 journey specs (create, complete/toggle-back, delete, clear-completed+undo, empty state, load/action error) + the axe gate. |
| Docker deployment | Runs via `docker compose up` | **Met** — profile-free single-origin stack. |
| Accessibility | Zero critical WCAG | **Met** — axe reports 0 critical (0 total) with the backdrop active. |
| Documentation | README + AI-integration log | **Met** — this README + [AI-integration log](docs/AI-INTEGRATION-LOG.md). |
| CI pipeline | GitHub Actions | **Present, not run here** — `.github/workflows/ci.yml` invokes the same Makefile targets; this environment has no GitHub remote, so it was validated locally, not on GitHub. |

---

## License

Internal project — no license specified.

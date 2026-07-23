# AI Integration Log — nearform_todo_app

This log records how AI assistance was used to build this project. It is seeded in
Story 1.1 and appended to incrementally as each story is delivered, then finalized
in Story 6.4. Each section below accumulates dated entries over the life of the
project; keep entries concise, concrete, and honest (including where AI fell short).

---

## 1. Agent usage

How AI coding agents were used to plan, scaffold, and implement work — which
agents/workflows, what they produced, and how their output was reviewed.

- **2026-07-23 — Story 1.1 (Repository skeleton and tooling baseline):** Ran the
  BMAD story cycle (`create-story` → `dev-story` → `code-review`). The agent
  scaffolded the `backend/`, `frontend/`, and `e2e/` trees per the architecture
  Source Tree, wrote the pinned `pyproject.toml` / `package.json` manifests, the
  root `Makefile`, placeholder tests for all three packages, and this log. All
  runner output was executed and verified, not assumed.

- **2026-07-23 — Story 1.1 (code review):** Ran the `code-review` workflow with
  three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor).
  It caught a real defect — `make install-backend` created the venv with the
  repo-root `python3` (3.9) rather than the pyenv-pinned 3.12 — which was fixed
  and re-verified. All acceptance criteria confirmed satisfied.

- **2026-07-23 — Story 1.2 (FastAPI app factory, health/readiness, DB session
  foundation):** Ran the BMAD story cycle (`create-story` → `dev-story` →
  `code-review`). The agent implemented the `create_app()` factory, the `/api`
  router mount, centralized AD-5 error-envelope handlers (including the
  `RequestValidationError` remap), `pydantic-settings` config, structured JSON
  request logging with a request id, the synchronous SQLAlchemy 2.0 + psycopg 3
  engine/session with a per-request `get_db` dependency (AD-12), the Alembic
  baseline, and `GET /api/health`. Integration tests ran against a real
  Postgres 17 provisioned as a lightweight standalone container (NOT the full
  Epic-5 compose stack). All runner output was executed and verified.

- **2026-07-23 — Story 1.3 (GitHub Actions CI pipeline):** Ran the BMAD story
  cycle (`create-story` → `dev-story` → `code-review`). The agent authored
  `.github/workflows/ci.yml` (three jobs: `backend` lint + unit/integration +
  coverage against a `postgres:17` service container; `frontend` lint + unit +
  coverage; `build-images` build-only, guarded) and added `--cov-report=xml` to
  the `coverage-backend` Makefile target for a reproducible coverage artifact.
  The workflow invokes only the existing CI-agnostic Makefile targets — no
  lint/test logic duplicated in YAML. Since this environment is not a git repo
  and has no GitHub remote, the workflow was NOT executed on GitHub; instead the
  YAML was parsed for well-formedness and every command the workflow invokes was
  run locally the same way CI runs it (backend against a real Postgres 17 mirror
  on :5432, torn down afterward). Results: backend 11 passed (2 integration + 1
  alembic migration cycle against real Postgres) at 94% branch coverage; frontend
  1 passed at 100%; lint clean both sides; the Dockerfile-existence guard skips
  cleanly (exit 0) and the negative check confirmed an injected lint error fails
  the invoked command (non-zero exit).

- **2026-07-23 — Story 2.1 (Todo model, list, and create endpoints):** Ran the
  BMAD story cycle (`create-story` → `dev-story` → `code-review`). The agent
  authored the full backend slice for the first Todo endpoints: the SQLAlchemy
  `Todo` model (`app/db/models.py`), the additive Alembic migration
  `0002_create_todos` (pgcrypto + `todos` table with the `char_length` CHECK and
  a `created_at DESC` index), Pydantic schemas with the single shared
  description-validation rule (`app/schemas/todo.py`), the repository chokepoint
  (`app/repositories/todo_repo.py`, AD-2/AD-9), the domain service
  (`app/services/todo_service.py`), and the `GET`/`POST /api/todos` routes. Model
  ↔ migration parity was verified by an empty `--autogenerate` diff. 39 new tests
  (17 unit + 22 integration) were generated and run against a throwaway
  `postgres:17` container on :5433; whole-suite result 50 passed at 96% branch
  coverage (report-only), ruff clean.

- **2026-07-23 — Story 3.1 (Panel shell, tokens, API client, List + states):**
  Ran the BMAD story cycle (`create-story` → `dev-story` → `code-review`). First
  real frontend story — built on the Story 1.1 scaffold (did not recreate it).
  The agent authored the Orbit design-token layer (`styles/tokens.css` +
  `global.css`: the 18 colours, type/spacing/radius scales, 7 component token
  groups, dark-only), the typed API client + one AD-5 error shape
  (`api/client.ts`, `api/todos.ts`), the TanStack Query List hook
  (`hooks/useTodos.ts`), the floating translucent Panel with placeholder
  add-input/footer slots, and the `TodoList` state machine
  (skeleton / empty / loaded / inline-error+Retry) with minimal read-only rows.
  Exact EXPERIENCE.md microcopy was used verbatim. A clean `aria-hidden`
  backdrop mount point was left for Epic 4 (no three.js imported). 21 Vitest
  tests generated and run; 100% coverage on the covered set (report-only);
  eslint + `tsc` clean; production build succeeds. Node 22.23.1 (nvm).

- **2026-07-23 — Story 5.1 (Backend & database containers):** Ran the full BMAD
  story cycle (`create-story` → `dev-story` → `code-review`). First Epic 5
  (containerization) story — added `backend/Dockerfile`, `backend/.dockerignore`,
  `backend/docker-entrypoint.sh`, and the root `docker-compose.yml`; no
  application code changed. The agent built a multi-stage image (`python:3.12-slim`
  builder installs deps into `/opt/venv`, slim runtime copies the venv + `app/` +
  `migrations/` + `alembic.ini`), a non-root `appuser` (uid/gid 10001), a
  `HEALTHCHECK` hitting `GET /api/health` via Python `urllib` (the slim image has
  no curl/wget), and a `#!/bin/sh` entrypoint enforcing migrate-before-serve
  (AD-11): `alembic upgrade head` then `exec uvicorn`. Compose brings up
  `postgres:17` on the named volume `pgdata` with a `pg_isready` healthcheck and a
  `backend` gated on `depends_on: condition: service_healthy`. Scoped to db+backend
  only, structured so 5.2 (frontend/nginx single-origin) and 5.3 (dev/test
  profiles) bolt on. VERIFIED FOR REAL against Docker 29.6.2 / Compose v5.3.1:
  `docker compose build` + `up` brought both services healthy (db healthy before
  backend started, proving the gate); migrations reached `0002_create_todos`;
  `GET /api/health` returned `200 {"status":"ok","db":"ok"}`; `id` inside the
  container showed `uid=10001(appuser)`; durability held across `down`/`up` (two
  POSTed todos survived on the volume, migration idempotent on restart). The
  CI-exact `docker build -t nearform-todo-backend:ci backend` also succeeded,
  confirming the previously-dormant `build-images` CI step now activates. Backend
  pytest suite stayed green (43 passed, 44 pre-existing skips — the integration
  tests need a test-profile Postgres on :5433, a 5.3/CI concern). Containers and
  the ad-hoc test volume were torn down after verification; the `pgdata` volume
  *definition* stays in the compose file. Code review (in-session Blind Hunter /
  Edge Case Hunter / Acceptance Auditor lenses) found no patch or decision items;
  one low deferral (base image pinned by tag not digest → Epic 6 Story 6.3).

- **2026-07-23 — Story 5.2 (Frontend container + single-origin `docker compose
  up`):** Ran the full BMAD cycle (`create-story` → `dev-story` → `code-review`).
  Added `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/nginx.conf`, and
  EXTENDED (did not rewrite) the 5.1 `docker-compose.yml` with a `frontend`
  service — no application code changed. The agent built a multi-stage image
  (`node:22-slim` builder runs `npm ci` + `npm run build` → static `dist/`;
  `nginx:stable-alpine` runtime serves it), running nginx **non-root** (uid 101)
  by listening on the unprivileged port 8080 and chowning the cache/log/pid paths,
  with a `HEALTHCHECK` on `GET /` via busybox `wget`. `nginx.conf` implements the
  AD-10 single origin: it serves the SPA with a `try_files … /index.html` fallback
  and reverse-proxies `location /api/ { proxy_pass http://backend:8000; }` — no
  trailing slash, so the `/api` prefix is preserved — forwarding method/body/headers
  by default so the clear-completed `DELETE /api/todos/completed` request BODY passes
  through. No CORS headers anywhere (single origin). A notable non-obvious point:
  **zero frontend code changed** — the API client already defaults its base to
  `/api` when `VITE_API_BASE_URL` is unset, so an unset build env var IS the correct
  single-origin production build. VERIFIED FOR REAL against Docker 29.6.2 / Compose
  v5.3.1: `docker compose build` + `up` brought all three services healthy in order
  (db → backend → frontend via `depends_on: service_healthy`); the SPA loaded at
  `http://localhost:8080/`; `GET :8080/api/health` returned `200
  {"status":"ok","db":"ok"}` PROXIED through nginx with **no `Access-Control-*`
  headers**; a full CRUD round-trip through the proxy passed (POST 201 → GET → PATCH
  200 → DELETE 204) plus the clear-completed DELETE-with-body (`{"deleted":1}`); and
  the SPA deep-link fallback returned `index.html` while unknown `/api/*` correctly
  proxied to the backend 404. The CI-exact `docker build -t
  nearform-todo-frontend:ci frontend` also succeeded, activating the dormant
  frontend `build-images` CI step. The real bring-up caught a genuine bug the
  reviewer would have missed statically: the frontend went `unhealthy` because the
  in-container healthcheck probed `http://localhost:8080/`, and in
  `nginx:stable-alpine` `localhost` resolves to IPv6 `::1` first while nginx binds
  IPv4 `0.0.0.0:8080` only → connection refused (host `curl` worked, masking it);
  fixed by probing `127.0.0.1`. Test suites stayed green (frontend 114 Vitest;
  backend 43 passed / 44 pre-existing skips). Stack torn down with `docker compose
  down -v`, no leftovers; the compose file + `frontend` service + `pgdata` volume
  definition stay in the repo. Code review (in-session Blind Hunter / Edge Case
  Hunter / Acceptance Auditor lenses) found no patch or decision items; two low
  deferrals to Epic 6 Story 6.3 (nginx static-DNS resolution of the `backend`
  upstream; base images pinned by tag not digest). Left for Story 5.3: `dev`/`test`
  compose profiles — base config kept profile-free so a plain `docker compose up`
  is the production-like single-origin stack.
- **2026-07-23 — Story 5.3 (Dev & test compose profiles + env-var config):** Final
  Epic 5 story; full BMAD cycle (`create-story` → `dev-story` → `code-review`) with
  no application code changed. EXTENDED (did not rewrite) `docker-compose.yml` with
  two additive Compose `profiles:` on top of the profile-free base: a **dev**
  profile (`backend-dev` + `frontend-dev`) and a **test** profile (`db-test` +
  `backend-test`), plus new `dev`/`test` build stages in each Dockerfile,
  `server.host`/env-gated polling in `vite.config.ts`, and 12-factor env docs
  (new root `.env.example`, updated backend/frontend examples). The agent worked
  through a genuine Docker Compose design tension: the story required BOTH a
  profile-free default (`docker compose up` = prod) AND profiles that "replace"
  services for dev — but a no-profile service always starts, so a naive
  `--profile dev up` port-clashes the prod `backend` and `backend-dev` on :8000.
  Resolved WITHOUT a hack by leaning on `docker compose up SERVICE…` semantics
  (starts only named services + their `depends_on`): the documented dev command
  `docker compose --profile dev up backend-dev frontend-dev` brings up exactly
  db + the two dev services, never the prod pair — verified live. CORS-on-in-dev
  (AD-10) fell out of existing code for free: `app/main.py` already adds the CORS
  middleware only when `CORS_ORIGINS` is non-empty, so the whole feature is one
  env var on `backend-dev` (dev) vs unset (prod) — no code change. VERIFIED FOR
  REAL (Docker 29.6.2 / Compose v5.3.1): default stack still healthy with the prod
  backend preflight returning `405` and **no `Access-Control-*`** header; the dev
  stack showed WatchFiles reloading on a source `touch` and returned
  `access-control-allow-origin: http://localhost:5173` on both an OPTIONS preflight
  and a GET, with Vite serving `/@vite/client` + `/@react-refresh` for HMR; and the
  test profile finally **closed the long-standing 44-skip gap** — `pytest
  tests/integration` went from *44 skipped* to *44 passed* against the ephemeral
  tmpfs `db-test` on :5433 (the exact DSN the existing `conftest.py` defaults to,
  so zero test-code changes), the full backend suite passing 87 both on the host
  venv and in the in-container `backend-test` runner. Teardown `-v` left zero
  containers/volumes; frontend 114 Vitest + lint clean; ruff clean. Code review
  (in-session Blind Hunter / Edge Case Hunter / Acceptance Auditor lenses): 0 patch,
  0 decision-needed, 1 defer (Playwright under the test profile → Story 6.1), 2
  dismissed (the bare-`--profile dev up` clash is documented/by-design; the
  `backend-dev` `LOG_LEVEL=debug` default is intentional). Epic 5 is DONE.

- **2026-07-23 — Story 6.1 (Playwright E2E suite + automated accessibility gate):**
  First Epic 6 story; full BMAD cycle (`create-story` → `dev-story` →
  `code-review`) with **no application code changed** — all work landed in `e2e/`,
  the `Makefile`, and docs. The agent built the real end-to-end suite that Epic 1
  only scaffolded: **7 spec files / 13 tests** exercising the six mandated journeys
  through the actual UI against a fully composed, running stack — create (FR-1),
  complete/toggle-back in place (FR-2/FR-5), delete (FR-3), clear-completed + undo
  with the AD-7 deferred-commit model (FR-9), empty state (FR-6), and a load +
  action error path with reconcile (FR-7) — plus an `@axe-core/playwright`
  accessibility gate asserting **zero critical WCAG 2.1 AA violations with the
  three.js Backdrop ACTIVE** (loaded + loaded-empty states) and a reduced-motion
  functional run (FR-8). The suite is deterministic: it runs against an **isolated**
  copy of the production-like stack (a separate compose project `nftodo_e2e` on
  host ports 8090/8010 with its own `pgdata` volume, brought up/torn down by
  `make e2e`), never the developer's live inspection stack; a `resetState()`
  API-level fixture empties the single global List before each test and Playwright
  runs single-worker so specs never race on shared server state. VERIFIED FOR REAL
  (headless Chromium, SwiftShader WebGL forced on so the Backdrop genuinely
  initializes): **13/13 passed**, axe **0 total violations (0 critical, 0 serious)**
  on both states with WebGL confirmed available, and `make e2e` tore the isolated
  stack fully down (containers + volume + network) afterward while the live
  inspection stack stayed healthy and untouched. No regressions: frontend 114
  Vitest + eslint/tsc clean, backend 43 passed (44 integration DB-gated skips, the
  standing baseline), e2e `tsc` clean. Closes two items previously deferred:
  axe-with-Backdrop-active (Epics 3/4) and Playwright-against-the-composed-app
  (Story 5.3).

## 2. MCP usage

Model Context Protocol servers/tools used during development (e.g. issue
trackers, design tools, browser automation) and what they contributed.

- **2026-07-23 — Story 1.1:** None used. No MCP servers were required for the
  repository skeleton.

- **2026-07-23 — Story 1.2:** None used. Local Docker (standalone `postgres:17`
  container) provided the integration-test database; no MCP servers were
  required.

- **2026-07-23 — Story 1.3:** None used. Local Docker mirrored the CI Postgres
  service container for validation; no MCP servers were required.

- **2026-07-23 — Story 2.1:** None used. A standalone `postgres:17` container
  on :5433 provided the integration-test database; no MCP servers were required.

- **2026-07-23 — Story 5.1:** None used. Local Docker (Compose v5.3.1) ran the
  full db+backend stack directly for real verification; no MCP servers were
  required.

- **2026-07-23 — Story 5.2:** None used. Local Docker (Compose v5.3.1) ran the
  full db+backend+frontend stack directly for real single-origin verification
  (SPA, `/api` proxy, CRUD round-trip); no MCP servers were required.

- **2026-07-23 — Story 5.3:** None used. Local Docker (Compose v5.3.1) ran the
  default, `dev`, and `test` profiles directly for real verification (CORS
  preflight/headers via `curl`, WatchFiles reload, the integration suite against
  the compose test Postgres); no MCP servers were required.

- **2026-07-23 — Story 6.1:** None used. Local Docker (Compose v5.3.1) stood up an
  isolated production-like stack (`docker compose -p nftodo_e2e` on :8090/:8010)
  and headless Playwright/Chromium drove the browser directly for real E2E + axe
  verification; no MCP servers (e.g. Chrome DevTools MCP) were required — that
  deeper performance instrumentation is Story 6.3's scope.

## 3. Test-generation hits and misses

Where AI-generated tests were valuable (hits) and where they were wrong,
redundant, or missed cases (misses) and needed human correction.

- **2026-07-23 — Story 1.1:** Hits — trivial placeholder tests for pytest,
  Vitest, and Playwright were generated correctly and pass, proving each runner
  and its coverage collection work. Misses — none material yet; substantive
  test generation begins with feature work in Story 1.2 / Epic 2.

- **2026-07-23 — Story 1.2:** Hits — the error-envelope, DB-down (503), and
  request-logging unit tests plus the transactional-rollback integration
  fixture were generated correctly and establish the reusable Epic-2 test
  pattern. Misses — the first integration `conftest.py` used a module-level
  `pytestmark` to skip on an unreachable DB, but `pytestmark` in a `conftest`
  does NOT propagate to sibling test modules, so integration tests errored
  instead of skipping when the DB was down. Caught by deliberately pointing the
  suite at a dead DSN; fixed with a `pytest_collection_modifyitems` skip hook
  and re-verified (skips cleanly with no DB, passes with one).

- **2026-07-23 — Story 1.3:** No new application tests — this is a CI
  orchestration story. The verification instead confirmed the existing suites
  run correctly under the exact conditions CI uses: the 1.2 integration suite,
  which honestly *skips* when no DB is reachable, was proven to actually *run*
  (2 integration + 1 alembic-cycle test, not skipped) once `TEST_DATABASE_URL`
  pointed at the Postgres 17 service mirror — validating that the workflow's
  service-container wiring exercises the real integration path rather than
  silently skipping it.

- **2026-07-23 — Story 2.1:** Hits — schema-validation unit tests (trim, empty,
  whitespace, control-char/newline, 500/501 boundary, length-measured-on-trimmed)
  and the endpoint integration tests (201 + persisted row, 422 envelope with
  zero rows created, `created_at DESC` ordering with id tiebreak, Z-suffixed
  timestamps) were generated correctly. Miss caught by the agent — the Story 1.2
  transactional-rollback fixture provides DML isolation but does NOT create
  tables, and the pre-existing `test_migrations.py` ends at `downgrade base`
  (empty schema), which would drop `todos` for any later test depending on
  collection order. Fixed by adding a session-scoped `alembic upgrade head`
  schema fixture in the integration `conftest.py` and restoring head at the end
  of the migration test, making the suite order-independent.

- **2026-07-23 — Story 3.1 (frontend):** Hits — the four List states, the
  Retry→refetch transition, newest-first order preservation, long-description
  wrapping, and XSS-safety (an `<img onerror>` description asserted to render as
  literal text with no real `<img>` element created) were all covered with a
  mocked API/query layer (`vi.mock('../api/todos')`) and no real network. Miss
  the agent had to correct: the first attempt asserted the dark-only token layer
  by importing the CSS as a `?raw` string, but Vitest stubs CSS imports so the
  raw content came back empty; and reading the file via `node:fs` failed `tsc`
  (no `@types/node`, which is out of scope to add). Resolved by enabling Vitest
  `css: true` and asserting the tokens are actually *applied* — injected into the
  jsdom document and resolvable via `getComputedStyle(:root)` — a stronger check
  than string-matching the source file.

- **2026-07-23 — Story 6.1 (E2E):** Hits — running the six journeys through the
  real UI against a live composed stack immediately validated the optimistic +
  reconcile paths end to end (newest-first ordering, in-place toggle without
  reorder, AD-7 deferred commit where the server delete fires only on toast
  dismiss and Undo is client-only, load/action-error rollback). Fault injection
  for the error journeys used `page.route(...).abort()` to force the failure while
  the retry/reconcile still hit the real backend — a deterministic error path that
  is not "mocked business logic". Misses the agent had to correct (see §4):
  Playwright's `.check()` double-toggled the label-wrapped checkbox, and a
  keyboard toggle raced the create-reconcile refetch. Both were **test-harness**
  bugs, not app bugs — the app behaves correctly for real users — and were fixed
  in the specs (click the label hit-target off-center; wait for the optimistic row
  to reconcile to its real id before toggling).

## 4. AI-debugging cases

Concrete bugs or failures where AI assistance helped diagnose or fix an issue —
what broke, how AI helped, and the resolution.

- **2026-07-23 — Story 1.1:** The E2E TypeScript typecheck (`tsc --noEmit`)
  failed with `TS2688: Cannot find type definition file for 'node'` because
  `playwright.config.ts` references Node globals while `@types/node` was not yet
  a dependency. Diagnosed from the compiler error and fixed by adding
  `@types/node ^22` to `e2e/package.json`; the lint target then exits 0.

- **2026-07-23 — Story 1.2:** `pydantic-settings` raised
  `SettingsError: error parsing value for field "cors_origins"` because it
  JSON-decodes `list[str]` env values by default, and `CORS_ORIGINS=http://…`
  is not JSON. Diagnosed from the traceback (`json.loads` in the env source) and
  fixed by annotating the field `Annotated[list[str], NoDecode,
  BeforeValidator(_split_origins)]` so the comma-separated 12-factor string is
  split by our own validator. Verified against multi-origin and empty inputs.

- **2026-07-23 — Story 1.3:** The backend venv lacks PyYAML, so the initial
  attempt to parse `ci.yml` for well-formedness raised `ModuleNotFoundError: No
  module named 'yaml'`. Rather than install an unpinned dependency into the
  project venv, validated the YAML with the system Ruby's built-in `yaml`
  library instead (confirmed jobs `backend`/`frontend`/`build-images` and
  triggers `push`/`pull_request` parse correctly).

- **2026-07-23 — Story 5.3:** The in-container `backend-test` runner failed at
  startup trying to connect to `localhost:5432` even though its `TEST_DATABASE_URL`
  correctly pointed at `db-test:5432`. The clue in the logs was the line
  `entrypoint: applying database migrations (alembic upgrade head)` — proof the
  prod `docker-entrypoint.sh` was running. Root cause: the `test` Dockerfile stage
  is `FROM runtime`, so it INHERITS the runtime stage's `ENTRYPOINT`; Docker then
  passed the pytest `command:` as mere args to that entrypoint, which ignores its
  args and runs its own hardcoded `alembic upgrade head` against the default DSN
  (`localhost:5432`). Fixed by overriding `entrypoint: ["python","-m","pytest"]`
  on the `backend-test` service (the integration suite migrates its own DB via the
  `_migrated_schema` fixture using `TEST_DATABASE_URL`). Only surfaced because the
  runner was actually executed — a static read of the compose `command:` would
  have looked correct. After the fix: 87 passed in-container.

- **2026-07-23 — Story 6.1:** Two E2E specs failed with Playwright's `locator.check:
  Clicking the checkbox did not change its state`. The clue was the DOM: the real
  `<input type="checkbox">` is nested INSIDE its 44px `<label>` hit-target, and
  clicking the input directly fires the toggle twice (the wrapping label forwards
  a second synthetic click), netting no change. Reproduced/diagnosed by inspecting
  the failing locator and the row markup rather than guessing; fixed by clicking
  the label region offset from the centered input (`position: {x:5,y:22}`), which
  forwards exactly one toggle — the same single-toggle a real user gets from the
  hit area. A second, subtler failure: a keyboard `Space` toggle intermittently
  reverted because it fired while the just-created row was still the OPTIMISTIC one
  (`aria-labelledby="todo-text-optimistic-…"`) and the create's reconcile refetch
  swapped the node, discarding the toggle. Fixed by waiting for the row's
  `aria-labelledby` to no longer match `/optimistic/` (i.e. the create had
  reconciled to its real server id) before the keyboard interaction. Both only
  surfaced because the suite was actually executed against a live stack.

## 5. Limitations — where human expertise was critical

Places where AI output was insufficient, misleading, or required human judgment
to correct — architecture decisions, domain nuance, security, or correctness
calls that a human owned.

- **2026-07-23 — Story 1.1:** Runtime version pinning (Node 22 LTS via nvm,
  Python 3.12 via pyenv with a project-local venv) and the meaningful-coverage
  exclusion policy follow explicit project conventions and the architecture
  spine rather than AI defaults; a human owns confirming these hold as the stack
  is exercised.

- **2026-07-23 — Story 1.2:** The health probe runs `SELECT 1` directly through
  the request session in the route rather than a repository. A human owns the
  judgment that this respects AD-2 (no repository/model exists yet; the probe is
  liveness/readiness, not feature data access) and that feature SQL must NOT
  follow it into routes once repositories land in Epic 2. Likewise, the choice
  to provision a standalone `postgres:17` test container (rather than the
  Epic-5 compose stack) for integration tests now is a sequencing call a human
  should confirm as the delivery stack is built out.

- **2026-07-23 — Story 1.3:** Two sequencing/environment calls a human owns.
  (1) The story AC says CI "builds the frontend and backend Docker images",
  but the multi-stage Dockerfiles are an Epic-5 deliverable and do not exist
  yet, while the same story requires the pipeline to be green on the current
  1.1/1.2 scaffold. Resolved by authoring the build step now and guarding it on
  Dockerfile existence (skips with a GitHub `::notice::` today, activates
  automatically in Epic 5) — a deliberate forward-compat seam a human should
  confirm rather than a hard `docker build` that would red the pipeline.
  (2) This repo has no VCS/remote, so the workflow could not be executed on
  GitHub; validation was limited to YAML well-formedness, pinned action/version
  correctness, and running every invoked command locally exactly as CI would.
  No claim is made that the pipeline "passed on GitHub".

- **2026-07-23 — Story 2.1:** Two correctness/security calls a human owns.
  (1) Validation is defined once in `app/schemas/todo.py` (`validate_description`)
  and the service re-asserts it as defense-in-depth so a future caller that
  bypasses the Pydantic body model still cannot persist an invalid Todo; a human
  owns confirming this shared rule stays the single source mirrored client-side
  in Epic 3, and that the control-char policy (reject all C0 controls incl. tab,
  plus DEL) matches the intended "single-line plain text" contract. (2) The wire
  contract requires `created_at` to end in `Z`, but Pydantic v2 serializes
  tz-aware datetimes as `+00:00`; a field serializer normalizes to `Z`. A human
  owns confirming this presentation choice is correct and that storing/returning
  the description as text only (never interpreted as HTML server-side) is
  sufficient for NFR-Sec at this layer, with output escaping owned by the Epic 3
  React client.

- **2026-07-23 — Stories 2.2 & 2.3 (built in parallel):** These two stories were
  implemented concurrently by separate AI agents in isolated git worktrees
  (branches `story-2.2`, `story-2.3`) to increase throughput, then merged.
  What worked: because 2.2 added the parametric `/{id}` routes at the *bottom*
  of the router and 2.3 added the literal `/completed` route at the *top* (each
  with explicit route-ordering comments), the router body auto-merged with the
  correct FastAPI declaration order; 2.3 also contributed a merge-guard
  integration test asserting `/completed` is not captured as `{id}`. Human/
  orchestrator judgment owned: (1) resolving the additive merge conflicts in
  `todos.py`, `todo_repo.py`, `todo_service.py`, and `test_todo_service.py`
  (union of both sides — notably merging the two divergent `_FakeRepo` unit-test
  fakes into one), and (2) running the full combined suite against a fresh
  Postgres post-merge (87 passed, 97% branch coverage) since neither agent could
  see the other's changes. Limitation encountered: the story sub-agents could
  not spawn their own sub-agents, so parallelism had to be orchestrated one
  level up; and each worktree had to rebuild its own venv (venvs are gitignored).

- **2026-07-23 — Stories 3.2, 3.3, 3.4 (built in parallel):** Three frontend
  stories implemented concurrently by separate AI agents in isolated git
  worktrees (branches `story-3.2/3.3/3.4`) on top of the 3.1 foundation, then
  merged. What worked: each agent put its optimistic mutation in its OWN new
  hook file (`useCreateTodo`, `useTodoMutations`, `useClearCompleted`) and left
  the shared `useTodos.ts` untouched, so there were zero hook conflicts; App.tsx
  auto-merged (only 3.4 touched it). Orchestrator judgment owned: resolving
  additive conflicts in `api/todos.ts` (union of create/toggle/delete/clear),
  `Panel.tsx` (compose the real AddInput slot from 3.2 with the toastSlot from
  3.4), and `global.css` — which git interleaved badly on shared CSS property
  lines, so it was reconstructed as "pre-3.4 file + 3.4's appended block
  verbatim" rather than resolved hunk-by-hunk. Full merged suite verified green
  post-merge (56 Vitest tests, 97% stmts, lint clean, production build OK) since
  no agent could see the others' changes. Limitation: sub-agents still can't
  spawn sub-agents, so parallelism is orchestrated one level up; each worktree
  re-ran `npm ci` (node_modules gitignored). AD-7 deferred-commit (undo = client
  timer cancel, single DELETE on dismiss with id snapshot) built cleanly in 3.4.

- **2026-07-23 — Story 3.5 (cross-cutting a11y / keyboard / responsive):** The
  final Epic 3 story ran as a single AI agent through the full BMAD cycle
  (create-story, dev-story, clean code-review) as a hardening pass over the
  already-merged 3.1–3.4 frontend — enhance/verify, not rebuild. What worked:
  the surface-area was tiny and additive because 3.1–3.4 had already done most
  per-component a11y (labeled list/rows, polite count live region, toast focus-
  pause + real Undo button, global `:focus-visible` ring, reduced-motion CSS,
  desktop-only autofocus). The only genuine code gaps were (1) associating
  errors with their control via `aria-describedby`/`aria-invalid` (added an
  optional `id` to `InlineError`, wired from the add-input and row checkbox only
  while a message shows) and (2) keyboard-safe delete focus (move focus to a
  surviving sibling delete → else the add-input BEFORE optimistic removal, gated
  on the delete button holding focus). Everything else was locked in with tests
  rather than changed. jsdom limitation owned by the agent: it neither lays out
  CSS nor implements sequential Tab navigation, so tab order was asserted as
  DOM/reading order + "no positive tabindex", and focus-ring / reduced-motion /
  hover-reveal / responsive-frame were asserted structurally against the
  injected stylesheet text (the `tokens.test.ts` pattern). Human/Epic-6 judgment
  deferred: the axe-core zero-critical WCAG AA gate and Playwright keyboard-only
  E2E walkthrough (Story 6.1), 200%-zoom/real-viewport visual proof (6.3), and
  flipping the coverage gate to enforcing (6.2). Full suite green post-change
  (83 Vitest tests, up from 56; 97.22% stmts / 86.79% branch, report-only), lint
  clean, production build OK. Epic 3 is now complete.

- **2026-07-23 — Story 4.1 (isolated three.js cube-star Backdrop):** First Epic 4
  story, run by a single AI agent through the full BMAD cycle (create-story,
  dev-story, code-review). The signature delighter — a slow-drifting field of
  cube "stars" over the deep-space void — built as a strictly isolated,
  code-split layer per AD-8. What worked: putting ALL `three` usage in one
  framework-free module (`backdrop/scene.ts`, a `createCubeStarField` factory
  exposing `start/stop/resize/renderStaticFrame/dispose`) and reaching it from
  `Backdrop.tsx` ONLY via a dynamic `import('./scene')` inside an effect. The
  build confirmed the isolation quantitatively: `three` (r185) lands entirely in
  a separate lazy chunk `scene-*.js` (~520 kB / 130 kB gzip) with ZERO three
  markers in the entry `index-*.js` (~237 kB / 74 kB gzip) — the core loop paints
  without it. The rAF loop lives inside the scene module, outside React's render
  cycle (no per-frame re-render, reads no Todo data); cubes drift toward the
  camera on an InstancedMesh and recycle to the far plane (infinite, cheap), with
  near=bright/large → far=dim/small from the `star-cube` tokens for depth. The
  ~72% scrim panel already guarantees the readability contract, so no
  scene-side "keep cubes off text" logic was needed. Test-generation hits: the
  isolation/lifecycle contract is fully assertable under jsdom by mocking the
  scene module — mount-after-async-import (code-split proof), aria-hidden +
  non-interactive, no data props, clean dispose on unmount, the reduced-motion
  guard (static frame, no loop), the no-WebGL degrade-without-throw path, and the
  unmount-before-import async race. AI-debugging cases the agent owned itself:
  (1) two legacy tests hard-coded the old placeholder contract
  (`toBeEmptyDOMElement()` on the backdrop) in `App.test.tsx` and `a11y.test.tsx`
  — updated to the new "owns a canvas but exposes no focusable/interactive nodes"
  contract; (2) jsdom's unimplemented `HTMLCanvasElement.getContext` printed noisy
  "Not implemented" errors when the real scene probed for WebGL — stubbed
  `getContext` to return `null` in `test-setup.ts`, which is exactly the no-WebGL
  environment the fallback must handle, making it deterministic and quiet; (3) a
  three-way TS typing snag on the Vitest mock (spread args / tuple index /
  unused-param lint) resolved with `vi.hoisted` + a typed `vi.fn` signature.
  jsdom/WebGL limitation owned by the agent and deferred to Epic 6: jsdom has no
  WebGL and does no layout, so real cube rendering, ~60fps drift, and the
  interaction-latency budget are NOT proven here — they land in the Story 6.3
  performance pass, with axe-with-backdrop-active in Story 6.1. Deliberately left
  for Story 4.2 (structured so they bolt on cleanly): the full ordered
  degradation ladder (adaptive DPR→cube-count→static frame-budget watchdog), the
  `visibilitychange` pause, and a React error boundary around the backdrop; 4.1
  ships only a static DPR cap and a basic reduced-motion / no-WebGL guard, and
  keeps the 3.1 void-gradient as the base fallback. Full suite green (90 Vitest
  tests, up from 83; 97.22% stmts / 86.79% branch, report-only — `backdrop/**`
  stays excluded from coverage per config as device-dependent visual tuning),
  lint clean, production build OK with the verified lazy `three` chunk.

- **2026-07-23 — Story 4.2 (mandatory degradation, perf guardrails, error
  boundary):** The final Epic 4 story, and the first with a mid-run agent
  failure worth logging. The initial dev agent implemented ~90% of the story —
  the pure `degradation.ts` ladder decider (DPR → cube-count → static, with
  hysteresis + floors), the `scene.ts` watchdog + WebGL context-loss/restore
  wiring, the `Backdrop.tsx` visibility-pause and runtime reduced-motion toggle,
  the `BackdropBoundary` class component wired into `App.tsx`, and the extended
  `Backdrop.test.tsx` / `degradation.test.ts` — then **died on an API error**
  right at "Now the BackdropBoundary test", leaving the work UNCOMMITTED with no
  boundary test, no code-review, and status still `in-progress`. A separate
  finishing agent (same model) picked up the uncommitted tree, read the diff and
  the AD-8 spine, and completed only the missing pieces rather than rebuilding:
  it wrote `BackdropBoundary.test.tsx` (throwing child is caught, the fallback
  renders nothing/non-interactive, a sibling core-loop stand-in survives — the
  AC6/AC7 never-degrade-core proof), then ran the adversarial code-review lenses
  (Blind Hunter / Edge Case Hunter / Acceptance Auditor) IN-SESSION because
  subagents aren't available in that harness. The review surfaced no blocking or
  should-fix findings — the prior implementation was sound as-found — and two
  legitimate Epic-6 deferrals: the watchdog budget is hardcoded to a ~60fps
  target (a 30Hz / power-saver display would degrade toward static; safe
  direction, but real-device calibration is Story 6.3) and live-GPU
  context-loss / real-FPS behaviour can't be exercised under jsdom (asserted via
  the pure decider + mocked scene handle; live proof + axe-with-backdrop defer to
  6.3 / 6.1). Test-generation hit: the AC5 watchdog decision is a PURE function
  over simulated frame-time arrays, so it unit-tests to 100% stmt/branch under
  jsdom with zero WebGL — the `vitest.config.ts` coverage exclusion was narrowed
  from all of `src/backdrop/**` to just the device-dependent `scene.ts`, pulling
  the decider, host, and boundary INTO coverage. Verification (Node 22 via nvm):
  full suite green (114 Vitest tests, up from 90), lint clean, build OK, and the
  AD-8/AC8 isolation re-confirmed quantitatively — `three` still lands only in
  the lazy `scene-*.js` (520.88 kB / 130.81 kB gz) with ZERO three markers in the
  entry `index-*.js` (238.10 kB / 74.25 kB gz). Process lesson: because the prior
  agent left a clean, lint-passing working tree and a detailed story file, a
  fresh agent could resume deterministically from a hard API failure without
  losing or re-doing work — the uncommitted diff plus the story's Dev Notes were
  enough context to finish safely.

- **2026-07-23 — Stories 6.2 & 6.3 (built in parallel):** Coverage-gate enforcement
  (6.2) and the security/perf/a11y pass (6.3) ran concurrently in isolated
  worktrees. Deliberately partitioned the shared surface — 6.2 owned
  ci.yml/Makefile/coverage config, 6.3 owned nginx/Dockerfiles/docs — so the
  merge was CONFLICT-FREE (disjoint files). Orchestrator then re-ran BOTH
  coverage gates first-hand to confirm (backend 96.76%, frontend 85.35% branch,
  both >70; negative check at 99% correctly exits non-zero). 6.3 findings: no
  High/Critical security issues (XSS inert, injection parameterized, CORS
  correct, 0 npm-audit vulns); applied nginx security headers + dynamic-DNS
  resolver + base-image digest pins; API p95 <7ms measured through the proxy.
  Verification residuals honestly labeled: in-browser CSP console check and
  live-GPU 60fps were design-analysis (no browser/GPU tooling in harness), not
  fabricated measurements.

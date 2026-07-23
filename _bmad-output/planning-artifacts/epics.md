---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-nearform_todo_app-2026-07-23/prd.md
  - _bmad-output/planning-artifacts/prds/prd-nearform_todo_app-2026-07-23/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/EXPERIENCE.md
  - _bmad-output/planning-artifacts/briefs/brief-nearform_todo_app-2026-07-23/brief.md
generationMode: fast-path-headless
---

# nearform_todo_app - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for **nearform_todo_app** (product name **Orbit**), decomposing the requirements from the PRD, the Orbit UX design contract (DESIGN + EXPERIENCE spines), and the Architecture Spine into implementable stories. Every story traces back to one or more Functional Requirements (FR), Architecture Decisions (AD), UX requirements (UX-DR), and/or User Journeys (UJ), and every story carries explicit acceptance criteria plus unit / integration / E2E test scenarios in line with the QA-from-day-one mandate (NFR-Quality, SM-5..SM-9).

> **Generation note:** This breakdown was produced autonomously from the finalized planning artifacts. Genuine inferences are tagged `[ASSUMPTION]` inline and indexed in the [Assumptions](#assumptions-fast-path-inferences) section; items needing a human decision are collected in [Open Questions](#open-questions-for-human-review). No blocking questions were left unanswered — sensible defaults were taken and flagged.

## Requirements Inventory

### Functional Requirements

- **FR-1: Create a Todo** — Enter a non-empty, trimmed, single-line Description (≤ 500 chars) and submit; a new active Todo is persisted with server-set creation-time metadata and appears at the top of the List without a full page reload. Empty/whitespace-only and over-length are rejected client- and server-side. Realizes UJ-1.
- **FR-2: Toggle completion status** — Mark an active Todo completed and a completed Todo back to active. The change persists, is reflected optimistically then reconciled, and a completed Todo is rendered visually distinct (checked + strikethrough + de-emphasized ink) at AA contrast. Realizes UJ-2.
- **FR-3: Delete a Todo** — Permanently delete a Todo from the List and persistence without a full page reload. No undo. Deleting an already-gone Todo fails gracefully and the List reconciles. Realizes UJ-2.
- **FR-4: View the List on open** — On open the app fetches and renders the persisted List with no auth, onboarding, or manual load step; loading and error states are shown as appropriate. Realizes UJ-1, UJ-3.
- **FR-5: List ordering** — Deterministic `created_at` DESC (newest first), `id` as tiebreak; toggling completion never reorders or removes a Todo (completed items stay in place, only restyled).
- **FR-6: Empty and loading states** — A friendly empty state when the List has zero Todos; a loading indication while the List or an action is in flight, always resolving to loaded / empty / error (never a hanging spinner).
- **FR-7: Error states and graceful failure** — Clear, non-disruptive, non-modal error states on client and server; failed load offers retry without crashing; failed create/toggle/delete rolls back the optimistic update and reconciles to true state; client-side validation errors are shown inline and never reach the server as valid writes. Realizes UJ-3.
- **FR-8: Animated backdrop with mandatory reduced-motion / static fallback** — Animated three.js cube-star Backdrop by default; static fallback under `prefers-reduced-motion` or capability constraints; the core loop remains fully usable regardless of Backdrop state, including with no WebGL; zero critical WCAG AA violations with the Backdrop active; stays within the performance budget. Realizes UJ-3.
- **FR-9: Clear completed** — Remove all completed Todos in one bulk action; active Todos unaffected; reflected without a full page reload and reconciled to true state; inert when zero completed; bulk failure surfaces an error and reconciles; guarded by an Undo affordance (transient Undo toast). Realizes UJ-4.

### NonFunctional Requirements

- **NFR-Perf** — Optimistic UI reflects a change within ~100ms; API responses p95 < 300ms under normal single-user conditions; Backdrop targets ~60fps with graceful step-down and never pushes interaction latency past budget. `[Working default per PRD OQ5-7; confirmed in the performance pass.]`
- **NFR-A11y** — Zero critical WCAG 2.1 AA violations across the app (including Backdrop active), verified by axe-core / Lighthouse via Playwright; full keyboard operability; sufficient contrast of Todo content over the Backdrop; mandatory reduced-motion fallback.
- **NFR-Resp** — UI works on desktop and mobile viewports (~320px → desktop); core loop fully usable via touch and keyboard; evergreen Chrome/Firefox/Safari/Edge.
- **NFR-Rel** — Todo data persisted durably (volume-backed Postgres); survives refresh, session, and container restart; no silent data loss on failed writes.
- **NFR-Deploy** — Builds and runs from a single `docker-compose up`; multi-stage Docker builds; non-root container users; per-service health checks; status/logs via `docker-compose logs`; dev/test config via env vars and compose profiles.
- **NFR-Quality** — QA integrated from day one: unit + integration + E2E suites wired to commands; ≥ 70% meaningful coverage (SM-5); ≥ 5 passing Playwright E2E tests (SM-6); API contracts validated; documented security review; documented performance and accessibility pass.
- **NFR-Sec** — Server-side validation of all writes; parameterized queries (no injection at the persistence boundary); XSS-safe text-only rendering of Todo Description; no secrets/PII/auth tokens in v1.
- **NFR-Maint** — Solution stays simple; data model and API boundary leave room for a later owner/user dimension (auth/multi-user) without a rewrite, without building it now.

### Additional Requirements

*From the Architecture Spine — the "how" that stories must respect.*

- **AD-1** — Server-authoritative state; all mutation through the `/api` REST contract; the client cache is derivative and always reconciles to server truth.
- **AD-2** — Layered backend `routes → services → repositories → db`, dependencies downward only; SQLAlchemy confined to `repositories`/`db`; the repository is the single chokepoint (where the future owner-scoping seam lands).
- **AD-3** — `Todo` is the only entity: `{ id: uuid, description: string, completed: bool, created_at: ISO-8601 UTC "…Z" }`. List ordered `created_at` DESC, `id` tiebreak. Toggling never reorders/removes.
- **AD-4** — Fixed REST contract on a versionless `/api` base (see API Contract below). `DELETE /api/todos/completed` registered **before** parametric `DELETE /api/todos/{id}`; `{id}` typed as UUID.
- **AD-5** — Uniform JSON error envelope `{ "error": { "code", "message", "details"? } }` from centralized exception handlers, including a remap of FastAPI's native `RequestValidationError`. `description` validated identically both sides: required, trimmed, non-empty, single-line, ≤ 500 chars. Todo text rendered as text only (React auto-escaping).
- **AD-6** — Optimistic mutation via TanStack Query: `onMutate` snapshots + applies (≤ ~100ms), `onError` rolls back + surfaces non-blocking inline error (never a modal), `onSettled` invalidates the List to reconcile. Every loading state resolves.
- **AD-7** — Clear-completed is a **deferred** bulk-delete of an explicit id snapshot: capture completed ids → hide optimistically → ~6s Undo toast → Undo cancels the timer with **no server call** → on toast dismiss issue **one** `DELETE /api/todos/completed` with the id snapshot. Server deletes only ids still completed. Crash/refresh mid-window safely restores on reload.
- **AD-8** — Backdrop is a fixed, full-viewport, `aria-hidden`, `pointer-events:none` layer below the panel; code-split and mounted **after** the loop is interactive; owns its canvas + `requestAnimationFrame` loop outside React's render cycle; reads no Todo data. Mandatory ordered degradation: `prefers-reduced-motion` → single static frame; no WebGL → CSS `surface-void → surface-void-far` radial gradient; frame-budget watchdog steps down DPR then cube count then static; pause on `visibilitychange`; error boundary falls back to the static gradient.
- **AD-9** — Auth/multi-user seam left open, not built: no `owner_id` and no auth in v1; future owner-scoping is three additive changes (users table + FK migration, repository-chokepoint filter, optional `/api` auth middleware). Wire contract unchanged.
- **AD-10** — Single-origin delivery: nginx serves the built SPA and reverse-proxies `/api/*` to the backend (no CORS in prod). CORS enabled **only** in the dev profile via `CORS_ORIGINS`.
- **AD-11** — Startup/durability ordering: Postgres on a named volume; backend `depends_on` db healthy (`pg_isready`); backend entrypoint runs `alembic upgrade head` **before** launching Uvicorn; migrations additive/non-destructive.
- **AD-12** — Synchronous SQLAlchemy 2.0 + psycopg 3; one session per request via a FastAPI dependency; no async DB layer in v1.
- **Stack** (fixed): Python 3.12, FastAPI 0.136.x, Pydantic 2.x, SQLAlchemy 2.0.x sync, psycopg 3.x, Alembic, Uvicorn; Node 22 LTS, React 19.2.x, Vite 8.0.x, TypeScript 5.x, three.js 0.185.x, TanStack Query v5, Vitest, Playwright + @axe-core/playwright; PostgreSQL 17; nginx stable-alpine.
- **CI** — GitHub Actions (lint, test, coverage, build) calling CI-agnostic package scripts + a root Makefile.
- **Integration-test DB mechanism** — transactional-rollback fixtures against a compose `test`-profile Postgres (not testcontainers).
- **Source tree & container topology** — three containers (`frontend`, `backend`, `db`) as specified in the spine's Structural Seed; directory layout per the spine's source tree.

#### API Contract (fixed — stories must implement exactly)

| Method & Path | Request body | Success | Errors | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/health` | — | `200 { "status": "ok", "db": "ok" }` | `503` if DB unreachable | Liveness + readiness (DB round-trip). |
| `GET /api/todos` | — | `200 { "todos": [Todo, …] }` | `500` | Ordered `created_at` DESC, id tiebreak. |
| `POST /api/todos` | `{ "description": string }` | `201 Todo` | `422` invalid | Trims; rejects empty/whitespace/multi-line/>500. New: `completed=false`, server `created_at`. |
| `PATCH /api/todos/{id}` | `{ "completed": bool }` | `200 Todo` | `404`, `422` | Only `completed` mutable; toggles both directions. |
| `DELETE /api/todos/{id}` | — | `204` | `404` | Permanent, no undo; client treats `404` as already-gone. |
| `DELETE /api/todos/completed` | `{ "ids": [uuid, …] }` (optional) | `200 { "deleted": <int> }` | `500` | Bulk clear; with `ids` deletes only those still completed; registered before `/{id}`. |

### UX Design Requirements

*From the Orbit DESIGN.md (visual identity / tokens) and EXPERIENCE.md (behavior / states / a11y). First-class inputs. Orbit is dark-only in v1 (resolved).*

- **UX-DR1: Design tokens & dark-only theme** — Implement the Orbit token set as the single source of visual truth: the void/scrim/raised surface ladder, ink ramp (primary/secondary/completed/disabled), single `accent` (+ strong/ink), `danger`, `border-hairline`/`border-focus`, star-cube colors; the Inter type scale (title/input/body/meta/button with system-ui fallback); the 4→48px spacing scale; the `sm/md/lg/full` radius scale; `panel-max-width` 560px. Dark-only; no light theme.
- **UX-DR2: Floating Panel shell** — Single centered translucent panel (`surface-scrim` ~72% opacity, `rounded.lg`, 1px hairline border, one soft ambient shadow beneath), capped at 560px, floating upper-middle over the void, holding title → input → list → footer. Single column at every size.
- **UX-DR3: Add-input** — Full-width `surface-raised` field, `rounded.md`, placeholder "What needs doing?"; Enter submits, Escape clears text; autofocus desktop-only; 2px `accent` focus ring; clears + refocuses on success; blocks empty/whitespace/>500 client-side with inline message.
- **UX-DR4: Todo row** — Checkbox + `body` description + delete affordance; hairline divider; `surface-raised-hover` on hover/focus; clicking the description does nothing (no edit); only checkbox and × are hit targets.
- **UX-DR5: Checkbox** — Soft-square `rounded.sm`; idle 2px `ink-secondary` border/transparent, checked `accent` fill + `accent-ink` mark; ≥ 24px visual box in a ≥ 44px target; `border-focus` ring; announces new state.
- **UX-DR6: Delete affordance** — Low-emphasis × in `ink-secondary` → `ink-primary`/`danger` on hover/focus; hover-revealed on pointer, **always visible on touch**; ≥ 44px target.
- **UX-DR7: Clear-completed button** — Ghost/text button in the footer (`button` type), `ink-secondary` → `ink-primary` hover, no fill/border; disabled/absent when zero completed.
- **UX-DR8: Undo toast** — Transient bar, `surface-raised`, `rounded.md`, `ink-primary` text + `accent-strong` "Undo" action; auto-dismiss ~6s; pauses on hover/focus; announced and keyboard-reachable; near-full-width above the thumb zone on mobile.
- **UX-DR9: Inline error** — `danger` text in `meta` size under the input (validation) or under the list header (load/action failure, with Retry); never a modal or full-screen error.
- **UX-DR10: Skeleton rows** — 3–5 shimmer placeholders in `surface-raised` at row height during cold load; resolve to rows / empty / error.
- **UX-DR11: Empty state** — "Nothing to do — add something above." centered in the panel with the input focused; not a blank void.
- **UX-DR12: Backdrop** — Full-viewport fixed `aria-hidden`, non-interactive three.js cube-star field over `surface-void`; degrades to static starfield (reduced motion) or `surface-void → surface-void-far` radial gradient (no WebGL); carries no Todo data.
- **UX-DR13: Microcopy / voice** — Calm, plain, quietly warm; no exclamation marks, no emoji. Exact strings from EXPERIENCE.md Voice & Tone table (placeholder, empty, load error "Couldn't load your list. Retry", validation "Type something first." / "That's a bit long — keep it under 500 characters.", action error "Couldn't save that — try again.", toast "Cleared N completed. Undo", footer count "N completed" / "No completed items").
- **UX-DR14: Accessibility floor** — Keyboard-operable full loop in reading order (input → each row's checkbox → its delete → Clear completed → toast Undo); 2px AA focus rings derived from the panel; List is a labeled list; each row exposes description + completion state; completed count via polite `aria-live`; errors associated + announced; Backdrop never in tab order; ≥ 44px targets; survives 200% zoom and font scaling; completion signaled by three redundant cues (never color alone).
- **UX-DR15: Responsive layout** — Desktop/tablet (≥ 640px) centered 560px panel with wide void margin, hover-revealed delete, autofocus; mobile (320–639px) panel fills width minus 16px gutter each side, delete always visible, no forced autofocus, toast near-full-width. Single column always.
- **UX-DR16: Reduced-motion micro-transitions** — Under `prefers-reduced-motion`, UI micro-transitions (toast slide, row fade) drop to instant, in addition to the Backdrop static fallback.

### FR Coverage Map

- **FR-1 (Create):** Epic 2 (Story 2.1 — `POST /api/todos`, validation, error envelope) · Epic 3 (Story 3.2 — AddInput optimistic create) · Epic 6 (Story 6.1 — E2E create).
- **FR-2 (Toggle):** Epic 2 (Story 2.2 — `PATCH /api/todos/{id}`) · Epic 3 (Story 3.3 — Checkbox optimistic toggle in place) · Epic 6 (Story 6.1 — E2E complete/toggle-back).
- **FR-3 (Delete):** Epic 2 (Story 2.2 — `DELETE /api/todos/{id}`) · Epic 3 (Story 3.3 — delete affordance) · Epic 6 (Story 6.1 — E2E delete).
- **FR-4 (View on open):** Epic 1 (Story 1.2 — health/DB round-trip readiness) · Epic 2 (Story 2.1 — `GET /api/todos`) · Epic 3 (Story 3.1 — fetch + render on open).
- **FR-5 (Ordering):** Epic 2 (Story 2.1 — repository ordered query) · Epic 3 (Story 3.1 / 3.3 — render newest-first, restyle in place).
- **FR-6 (Empty/loading):** Epic 3 (Story 3.1 — skeleton + empty states).
- **FR-7 (Error/graceful):** Epic 2 (Story 2.1 — server error envelope + validation) · Epic 3 (Stories 3.1–3.4 — load/create/toggle/delete/clear rollback + inline errors) · Epic 6 (Story 6.1 — E2E error path).
- **FR-8 (Backdrop + fallbacks):** Epic 4 (Stories 4.1, 4.2).
- **FR-9 (Clear completed):** Epic 2 (Story 2.3 — `DELETE /api/todos/completed`) · Epic 3 (Story 3.4 — footer + deferred bulk-delete + Undo toast) · Epic 6 (Story 6.1 — E2E clear-completed + undo).

## Epic List

### Epic 1: Project Foundation & Test Harness
Stand up the monorepo skeleton (backend / frontend / e2e), the FastAPI app factory with health/readiness and per-request DB session, the Alembic baseline, and all three test runners plus coverage tooling wired to commands and a green GitHub Actions CI — so every subsequent story ships with tests from day one (QA from day one).
**FRs covered:** FR-4 (health/readiness portion). **NFRs:** NFR-Quality, NFR-Deploy (partial), NFR-Maint. **ADs:** AD-2, AD-11 (Alembic baseline), AD-12, AD-5 (envelope scaffold). **SMs:** SM-5 (gate wiring), SM-7 (partial).

### Epic 2: Todo CRUD & Clear-Completed API
Deliver the complete, tested backend REST surface for Todos — list, create, toggle, delete, and bulk clear-completed — with server-side validation, the uniform error envelope, deterministic ordering, and the repository chokepoint, so a client can drive the full data loop against server truth.
**FRs covered:** FR-1, FR-2, FR-3, FR-4 (list), FR-5, FR-7 (server), FR-9 (bulk endpoint). **NFRs:** NFR-Sec, NFR-Rel, NFR-Maint. **ADs:** AD-1, AD-2, AD-3, AD-4, AD-5, AD-7 (server), AD-9 (seam), AD-12.

### Epic 3: Core Todo Experience (Frontend)
Deliver the Orbit single-screen UI and the full usable product loop in the browser (excluding the Backdrop): design tokens + floating panel shell, the typed API client and TanStack Query optimistic hooks, all core components, and the empty / loading / error states with rollback + reconcile, keyboard operation, and responsive layout.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-9 (client + Undo toast). **NFRs:** NFR-Perf, NFR-Resp, NFR-A11y (loop), NFR-Sec (text render). **ADs:** AD-1, AD-6, AD-7 (client). **UX-DRs:** UX-DR1–11, 13–16. **UJs:** UJ-1, UJ-2, UJ-4.

### Epic 4: Space Backdrop & Graceful Degradation
Add the signature three.js cube-star Backdrop as a fully isolated, decorative, code-split layer that mounts after the loop is interactive and never compromises it — with the mandatory reduced-motion static fallback, no-WebGL gradient fallback, frame-budget watchdog, visibility pause, and error boundary.
**FRs covered:** FR-8. **NFRs:** NFR-Perf, NFR-A11y. **ADs:** AD-8. **UX-DRs:** UX-DR12, UX-DR16. **SM:** SM-C2. **UJ:** UJ-3.

### Epic 5: Containerized Delivery
Package and orchestrate the system so it builds and runs from a single `docker-compose up`: multi-stage non-root Dockerfiles, three services with health checks, named-volume Postgres, migrations-before-serve, single-origin nginx `/api` proxy, and dev/test compose profiles with env-var config.
**FRs covered:** (delivery of all FRs). **NFRs:** NFR-Deploy, NFR-Rel. **ADs:** AD-10, AD-11. **SM:** SM-7.

### Epic 6: Quality, Accessibility, Security & Documentation Sign-off
Bring the day-one QA obligations to their acceptance bars against the composed stack: ≥ 5 Playwright E2E specs (incl. axe zero-critical WCAG AA with Backdrop active), the ≥ 70% coverage gate, a documented security review and performance/accessibility pass, the README, and the AI-integration log.
**FRs covered:** FR-1..FR-9 (E2E verification). **NFRs:** NFR-Quality, NFR-A11y, NFR-Sec, NFR-Perf, NFR-Deploy (docs). **SMs:** SM-1..SM-9.

---

## Epic 1: Project Foundation & Test Harness

Stand up the repository skeleton and the full test/CI harness before feature work, so quality is integrated from day one rather than bolted on. After this epic the repo has a running FastAPI health/readiness endpoint backed by a real per-request Postgres session, an Alembic baseline ready for feature migrations, executable unit/integration/E2E runners with coverage tooling, and a green GitHub Actions pipeline. No Todo feature behavior yet — only the substrate that every later story builds on.

### Story 1.1: Repository skeleton and tooling baseline

As a developer,
I want the monorepo directory structure and all build/test tooling scaffolded per the architecture source tree,
So that backend, frontend, and E2E packages exist with runnable (if initially trivial) test and lint commands and a single root command to reproduce CI locally.

**Acceptance Criteria:**

**Given** an empty repository
**When** the skeleton is created
**Then** the `backend/`, `frontend/`, and `e2e/` trees exist matching the architecture source tree (app factory dirs, `api/routes`, `core`, `db`, `repositories`, `services`, `schemas`, `migrations`, `tests/{unit,integration}` for backend; `src/{api,hooks,components,backdrop,styles}`, `types.ts`, colocated test convention for frontend; `tests/` + `playwright.config.ts` for e2e)
**And** backend uses Python 3.12 with `pyproject.toml` pinning FastAPI 0.136.x, Pydantic 2.x, SQLAlchemy 2.0.x, psycopg 3.x, Alembic, Uvicorn, pytest, pytest-cov
**And** frontend uses Node 22 LTS with `package.json` pinning React 19.2.x, Vite 8.0.x, TypeScript 5.x, TanStack Query v5, Vitest + @testing-library/react, and three.js 0.185.x
**And** `e2e/` pins Playwright + @axe-core/playwright.

**Given** the scaffolded packages
**When** a developer runs each package's `test`, `coverage`, and `lint` scripts and the root Makefile (or root npm scripts) target
**Then** each command executes and exits 0 against at least one placeholder test per package
**And** a single documented root command runs backend + frontend + the Playwright smoke spec in sequence, where the Epic 1 Playwright run targets a simple locally-served page (Vite dev/preview or static serve), **not** docker-compose — the compose-backed root command and full-journey E2E land in Epic 5 (stack) and Epic 6 (journeys).

**Given** naming conventions from the spine
**When** files are created
**Then** Python is `snake_case`, TS components are `PascalCase` one-per-file, wire/config placeholders use `snake_case` keys and 12-factor env vars, and no secrets are committed.

**Given** the AI-assisted delivery mandate (SM-9)
**When** the skeleton is created
**Then** `docs/AI-INTEGRATION-LOG.md` is seeded with its section structure — agent usage, MCP usage, test-generation hits/misses, AI-debugging cases, and limitations where human expertise was critical — ready to be appended to incrementally from Epic 1 onward (finalized in Story 6.4).

**Test Scenarios:**
- **Unit (backend, pytest):** a trivial passing test in `backend/tests/unit` proves the runner + coverage collection work.
- **Unit (frontend, Vitest):** a trivial colocated `*.test.tsx` proves Vitest + coverage (v8) work.
- **E2E smoke (Playwright):** a placeholder spec that loads a served page/asset proves the Playwright runner and config work (full journeys land in Epic 6).
- **Tooling check:** CI-agnostic scripts + root Makefile target run all runners; lint passes on the scaffold.

**Traceability:** NFR-Quality, NFR-Maint; architecture Source Tree, Stack, Consistency Conventions. `[ASSUMPTION: frontend renders a placeholder page until Epic 3.]`

### Story 1.2: FastAPI app factory, health/readiness endpoint, and DB session foundation

As a developer,
I want the FastAPI application factory with a per-request synchronous DB session, structured logging, env-based config, the Alembic baseline, and a `GET /api/health` readiness endpoint,
So that the service starts, reports liveness + DB readiness, and provides the layered substrate (routes → services → repositories → db) and the error-envelope scaffold that feature endpoints extend.

**Acceptance Criteria:**

**Given** the backend package
**When** the app factory is built
**Then** `main.py` mounts an `/api` router, installs centralized exception handlers producing the AD-5 error envelope `{ "error": { "code", "message", "details"? } }` (including a `RequestValidationError` remap), configures `pydantic-settings` env config (`core/config.py`) and structured JSON stdout logging with a per-request request id (`core/logging.py`)
**And** `db/session.py` exposes a synchronous SQLAlchemy 2.0 + psycopg 3 engine and a one-session-per-request FastAPI dependency closed at request end (AD-12)
**And** an Alembic environment exists with a baseline revision (no feature tables yet) that runs cleanly with `alembic upgrade head` (AD-11).

**Given** the service is running against a reachable Postgres
**When** a client calls `GET /api/health`
**Then** it returns `200 { "status": "ok", "db": "ok" }` after a real DB round-trip.

**Given** the database is unreachable
**When** a client calls `GET /api/health`
**Then** it returns `503` and the failure is logged, without the process crashing.

**Given** the layering rules
**When** code is organized
**Then** SQLAlchemy query APIs appear only in `repositories`/`db`; routes and services never import them; dependencies point downward only (AD-2).

**Test Scenarios:**
- **Unit (backend):** exception handlers map a raised domain/validation error and a `RequestValidationError` into the exact AD-5 envelope shape/keys; logging emits one structured JSON line with a request id.
- **Integration (backend, TestClient + real test-profile Postgres, transactional-rollback fixture):** `GET /api/health` returns `200 {status:"ok",db:"ok"}` on a healthy DB; returns `503` when the DB round-trip is forced to fail; each test wraps in a transaction rolled back after (establishes the fixture pattern for Epic 2).
- **Migration check:** `alembic upgrade head` then `downgrade base` succeed against the test DB.

**Traceability:** FR-4 (readiness), AD-2, AD-5 (scaffold), AD-11, AD-12; API Contract `GET /api/health`; NFR-Rel, NFR-Deploy.

### Story 1.3: GitHub Actions CI pipeline

As a developer,
I want a GitHub Actions workflow that lints, runs the unit + integration suites (full compose E2E is deferred to Epic 6), enforces coverage, and builds both images,
So that every push is gated by the same commands a developer runs locally and quality regressions are caught automatically.

**Acceptance Criteria:**

**Given** the wired package scripts and root Makefile from Story 1.1
**When** a push or PR triggers CI
**Then** the workflow runs lint, backend unit + integration tests (spinning up a `test`-profile Postgres service), frontend unit tests, and coverage collection for both, calling the CI-agnostic scripts (no logic duplicated in the workflow)
**And** the workflow builds the frontend and backend Docker images (build only; full compose E2E is exercised in Epic 6).

**Given** the coverage tooling
**When** CI runs
**Then** a coverage step reports backend (pytest-cov) and frontend (Vitest v8) coverage; the ≥ 70% gate is configured (enforced/tightened in Story 6.2) `[ASSUMPTION: gate may start as report-only until Epic 6 fills coverage, then flip to enforcing.]`
**And** even while report-only at this stage, the coverage tool config must already apply the meaningful-coverage rules (measure **branch** coverage; **exclude** generated code, config, Alembic migrations, and three.js visual tuning) so the same definition is in force when the gate flips to enforcing in Story 6.2 (Open Question #4).

**Given** a failing test or lint error
**When** CI runs
**Then** the pipeline fails visibly and blocks merge.

**Test Scenarios:**
- **Pipeline smoke:** CI green on the Story 1.1/1.2 scaffold (placeholder + health tests pass).
- **Negative check:** an intentionally failing test causes the pipeline to fail (verified once, then removed).
- **Coverage report present:** coverage artifacts/summaries are produced for both packages.

**Traceability:** NFR-Quality, NFR-Deploy; architecture "CI provider — GitHub Actions"; SM-5 (gate wiring), SM-6/SM-7 (later stages).

---

## Epic 2: Todo CRUD & Clear-Completed API

Deliver the complete backend REST surface behind the fixed `/api` contract, each endpoint tested per-endpoint against a real Postgres with transactional-rollback fixtures. Server-side validation, the uniform error envelope, deterministic ordering, and the repository chokepoint (with the AD-9 owner seam left open) all live here. After this epic the full data loop is drivable by any client and reconciles to server truth.

### Story 2.1: Todo model, list, and create endpoints with validation and error envelope

As an API consumer,
I want to list all Todos newest-first and create a new Todo with validated input,
So that the client can render the persisted List on open and capture new Todos against server truth.

**Acceptance Criteria:**

**Given** no `todos` table yet
**When** this story is implemented
**Then** an additive Alembic migration creates `todos` = `id UUID PK default gen_random_uuid()`, `description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500)`, `completed BOOLEAN NOT NULL DEFAULT false`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, and an index on `created_at DESC`; the SQLAlchemy `Todo` model, `schemas/todo.py`, `repositories/todo_repo.py`, and `services/todo_service.py` are created (AD-2, AD-3)
**And** no `owner_id` column and no auth are added; the repository is the single place a future owner filter would attach (AD-9).

**Given** persisted Todos
**When** a client calls `GET /api/todos`
**Then** it returns `200 { "todos": [Todo, …] }` ordered `created_at` DESC with `id` tiebreak, each Todo shaped `{ id, description, completed, created_at }` with `created_at` as ISO-8601 UTC "…Z" (AD-3, FR-4, FR-5).

**Given** a create request
**When** a client calls `POST /api/todos` with `{ "description": "<non-empty>" }`
**Then** it returns `201` with the created `Todo` (`completed=false`, server-set `created_at`) after trimming the description (FR-1).

**Given** invalid input
**When** the description is empty, whitespace-only, multi-line/contains control chars, or > 500 chars on the trimmed string
**Then** the endpoint returns `422` with the AD-5 envelope whose `details` name the field and issue; no row is created (FR-1, FR-7, AD-5, NFR-Sec).

**Given** the persistence boundary
**When** any query runs
**Then** it uses parameterized SQLAlchemy queries only (no string interpolation) (NFR-Sec).

**Test Scenarios:**
- **Unit (service):** validation accepts a trimmed valid description; rejects empty, whitespace-only, embedded-newline, and 501-char inputs with the correct error code/detail.
- **Integration (real test-profile Postgres, rollback fixture):** `POST` valid → `201` + correct body and DB row; `POST` each invalid case → `422` envelope, zero rows; `GET` returns items in `created_at` DESC order with id tiebreak; response keys are `snake_case` and `created_at` ends with `Z`.
- **Contract check:** response/error shapes validated against the API Contract (per-endpoint contract test).

**Traceability:** FR-1, FR-4, FR-5, FR-7 (server); AD-2, AD-3, AD-4, AD-5, AD-9, AD-12; NFR-Sec, NFR-Rel.

### Story 2.2: Toggle and delete endpoints

As an API consumer,
I want to toggle a Todo's completion in both directions and permanently delete a Todo,
So that the client can complete/reactivate and remove Todos with server truth reconciliation.

**Acceptance Criteria:**

**Given** an existing Todo
**When** a client calls `PATCH /api/todos/{id}` with `{ "completed": true|false }`
**Then** it returns `200` with the updated `Todo`, flipping `completed` in either direction and persisting it; only `completed` is mutable (no text editing); ordering/position is unchanged (FR-2, FR-5, AD-3).

**Given** a non-existent id
**When** a client calls `PATCH /api/todos/{id}`
**Then** it returns `404` in the AD-5 envelope.

**Given** an invalid body
**When** `completed` is missing or non-boolean
**Then** it returns `422` in the AD-5 envelope.

**Given** an existing Todo
**When** a client calls `DELETE /api/todos/{id}`
**Then** it returns `204` and the row is permanently removed from persistence (FR-3).

**Given** an already-deleted id
**When** a client calls `DELETE /api/todos/{id}`
**Then** it returns `404`, which the client may treat as already-gone (FR-3).

**Test Scenarios:**
- **Unit (service):** toggle flips both directions; delete of missing id surfaces the not-found domain error.
- **Integration (rollback fixture):** `PATCH` existing → `200` + persisted flip both ways; `PATCH` missing → `404` envelope; `PATCH` bad body → `422`; `DELETE` existing → `204` + row gone; `DELETE` missing → `404`; a toggled item keeps its List position on a subsequent `GET`.

**Traceability:** FR-2, FR-3, FR-5; AD-3, AD-4, AD-5; API Contract `PATCH`/`DELETE {id}`.

### Story 2.3: Clear-completed bulk endpoint with id snapshot

As an API consumer,
I want a single bulk endpoint to delete completed Todos, optionally scoped to an explicit id snapshot,
So that the client can clear all completed items in one call and, under the deferred-commit model, delete only the intended snapshot.

**Acceptance Criteria:**

**Given** the router
**When** routes are registered
**Then** the static `DELETE /api/todos/completed` is registered **before** the parametric `DELETE /api/todos/{id}` and `{id}` is typed as UUID, so the two never collide (AD-4).

**Given** completed and active Todos exist
**When** a client calls `DELETE /api/todos/completed` with `{ "ids": [uuid, …] }`
**Then** it returns `200 { "deleted": <int> }` and deletes only those ids that are **still completed**; active Todos and completed Todos not in the snapshot are untouched (FR-9, AD-7).

**Given** the body is omitted
**When** a client calls `DELETE /api/todos/completed`
**Then** it deletes all currently-completed Todos and returns the count (FR-9).

**Given** no completed Todos match
**When** the endpoint is called
**Then** it returns `200 { "deleted": 0 }` with no error and no effect on active Todos.

**Test Scenarios:**
- **Unit (service):** deletion filters to intersection of snapshot ids and still-completed rows; empty result returns 0.
- **Integration (rollback fixture):** with a mix of active/completed, `ids` snapshot deletes only still-completed snapshot rows and returns the correct count; omitted body deletes all completed; an id that was re-activated after snapshot is NOT deleted; active rows always survive; route-ordering test proves `/completed` is not swallowed by `/{id}`.

**Traceability:** FR-9; AD-4, AD-7; API Contract `DELETE /api/todos/completed`.

---

## Epic 3: Core Todo Experience (Frontend)

Build the Orbit single-screen UI and the complete usable loop in the browser against the Epic 2 API — excluding the Backdrop, which is added in Epic 4 without touching this loop. Optimistic mutations with mandatory rollback and reconcile (AD-6), all Orbit components and states, the exact microcopy, keyboard operation, and responsive layout. After this epic Maya can add, complete, toggle-back, delete, and clear-completed entirely in the browser.

### Story 3.1: Panel shell, design tokens, API client, and List view with loading/empty/error states

As Maya,
I want to open the app and immediately see my List (or a calm empty state) inside the floating Orbit panel, with clear loading and retryable error states,
So that I can view my Todos on open with no login, onboarding, or manual load step.

**Acceptance Criteria:**

**Given** a first visit
**When** the app loads
**Then** the Orbit design tokens (surfaces, ink ramp, single accent, danger, borders, Inter type scale with system-ui fallback, spacing, radius, 560px panel cap) are implemented as the single source of visual truth, dark-only, and the translucent `surface-scrim` ~72% panel renders title → input placeholder → list → footer, centered and capped at 560px over a plain `surface-void → surface-void-far` background (UX-DR1, UX-DR2)
**And** no login, signup, or onboarding is ever shown (FR-4).

**Given** the app is fetching the List
**When** the request is in flight (cold load)
**Then** 3–5 skeleton shimmer rows are shown, always resolving to loaded / empty / error — never a hanging spinner (FR-6, UX-DR10).

**Given** the List has zero Todos
**When** the fetch resolves empty
**Then** the empty state "Nothing to do — add something above." is centered in the panel with the input focused (desktop) (FR-6, UX-DR11, UX-DR13).

**Given** persisted Todos
**When** the fetch resolves
**Then** rows render newest-first (server order) with Todo text rendered as text only via React auto-escaping (no HTML interpolation) (FR-4, FR-5, NFR-Sec).

**Given** the List fetch fails
**When** the error resolves
**Then** the panel frame + input still render and an inline "Couldn't load your list. Retry" appears under the list header; Retry re-fetches; the app never crashes (FR-7, UX-DR9, UX-DR13).

**Given** the data layer
**When** it is built
**Then** a thin typed `api/client.ts` + `api/todos.ts` wrap `fetch` over `/api`, TS types mirror the wire exactly (`snake_case`, no mapping layer), a TanStack Query provider owns the List query, and one error shape is parsed everywhere (AD-1, AD-5, AD-6).

**Test Scenarios:**
- **Unit (Vitest + TL):** api client parses success + AD-5 error envelope; List renders skeleton → loaded, → empty, and → error+Retry based on query state; retry triggers refetch; long description wraps (no truncation).
- **Unit:** tokens/theme applied (dark-only); Todo text with HTML-like characters renders escaped (XSS-safe).
- **E2E hook:** empty-state and load-error journeys are exercised in Epic 6 (Story 6.1) against this UI.

**Traceability:** FR-4, FR-5, FR-6, FR-7; AD-1, AD-5, AD-6; UX-DR1, 2, 9, 10, 11, 13; NFR-Sec; UJ-3.

### Story 3.2: Add-input with optimistic create and client validation

As Maya,
I want to type a task and press Enter to add it instantly to the top of my List,
So that I can capture what's on my mind with zero ceremony.

**Acceptance Criteria:**

**Given** the always-visible add-input ("What needs doing?", autofocus desktop-only, not force-focused on touch)
**When** I type a non-empty description and press Enter
**Then** the new Todo appears optimistically at the top of the List within ~100ms, the field clears and refocuses, and the create is issued to `POST /api/todos`; on success the optimistic row reconciles to the server Todo (temporary local id replaced) (FR-1, AD-6, NFR-Perf, UX-DR3).

**Given** invalid input
**When** I submit empty/whitespace-only text
**Then** it is blocked client-side with inline "Type something first." and no request is sent (FR-1, FR-7, UX-DR9, UX-DR13).

**Given** over-length input
**When** I submit > 500 characters (trimmed)
**Then** it is blocked client-side with inline "That's a bit long — keep it under 500 characters." and no request is sent (FR-1, FR-7).

**Given** the create request fails server-side
**When** the mutation errors
**Then** the optimistic row rolls back, "Couldn't save that — try again." shows under the input, and my typed text is preserved (FR-7, AD-6, UX-DR13).

**Given** the keyboard
**When** I press Escape in the input
**Then** the input's current text clears without submitting (UX-DR3, Interaction Primitives).

**Test Scenarios:**
- **Unit (Vitest + TL):** valid submit adds optimistic top row + clears/refocuses; empty and >500 blocked with exact microcopy and no network call; Escape clears; on mocked mutation error the row rolls back and typed text is preserved; single-line enforced.
- **Unit (hook):** `useTodos` create mutation `onMutate` inserts optimistic row with temp id, `onError` rolls back to snapshot, `onSettled` invalidates the List (AD-6).
- **E2E hook:** create journey exercised in Story 6.1.

**Traceability:** FR-1, FR-7; AD-6; UX-DR3, 9, 13; NFR-Perf; UJ-1.

### Story 3.3: Todo row — toggle completion in place and delete

As Maya,
I want to check off a task (and uncheck it) and delete a task, with the change reflected instantly,
So that I can track progress and remove what's no longer relevant.

**Acceptance Criteria:**

**Given** a Todo row (checkbox + description + delete ×; clicking the description does nothing)
**When** I click/tap the checkbox
**Then** it toggles completion optimistically within ~100ms and restyles the row **in place** — checked box + strikethrough + `ink-completed` de-emphasized ink (three redundant cues), never reordering or moving it — issuing `PATCH /api/todos/{id}`; it toggles back to active the same way (FR-2, FR-5, AD-6, UX-DR4, UX-DR5).

**Given** a completed Todo
**When** rendered
**Then** completed ink stays ≥ 4.5:1 on the scrim (legible, not a ghost), and completion is never signaled by color alone (UX-DR5, UX-DR14, NFR-A11y).

**Given** a Todo row
**When** I click/tap the delete ×
**Then** the row is removed optimistically and `DELETE /api/todos/{id}` is issued; a `404` is treated as already-gone and reconciled (FR-3, AD-6).

**Given** the delete affordance
**When** on a pointer device it is hover-revealed; on touch it is always visible; every hit target (checkbox, ×) is ≥ 44px (UX-DR6, UX-DR15, NFR-A11y).

**Given** a toggle or delete fails server-side
**When** the mutation errors
**Then** the row reverts to its prior state/position in place and a brief inline "Couldn't save that — try again." shows near the row; the List reconciles to true server state (FR-2, FR-3, FR-7, AD-6, UX-DR13).

**Test Scenarios:**
- **Unit (Vitest + TL):** checkbox toggles both directions optimistically and restyles in place without reordering; clicking description does nothing; delete removes optimistically; delete affordance visibility differs pointer vs touch (mocked); targets ≥ 44px.
- **Unit (hook):** toggle and delete mutations snapshot/rollback/reconcile; `404` on delete treated as already-gone.
- **Unit (a11y):** checkbox announces new state; completion carries three cues.
- **E2E hook:** complete, toggle-back, and delete journeys exercised in Story 6.1.

**Traceability:** FR-2, FR-3, FR-5, FR-7; AD-6; UX-DR4, 5, 6, 13, 14, 15; NFR-A11y, NFR-Perf; UJ-2.

### Story 3.4: Footer bar, Clear-completed, and deferred Undo toast

As Maya,
I want to clear all completed tasks in one action with a brief chance to undo,
So that I can tidy a day's finished work without deleting items one by one or risking accidental loss.

**Acceptance Criteria:**

**Given** the footer bar
**When** the List renders
**Then** the left shows the completed count via a polite `aria-live` region ("N completed" / "No completed items") and the right shows the ghost "Clear completed" button, which is inert/absent when zero completed (FR-9, UX-DR7, UX-DR13, UX-DR14).

**Given** completed Todos exist
**When** I click "Clear completed"
**Then** the client (1) captures the exact set of currently-completed ids, (2) hides them optimistically while active Todos stay put, and (3) shows the Undo toast "Cleared N completed. Undo" (~6s, pauses on hover/focus) — with **no server call yet** (FR-9, AD-7, UX-DR8).

**Given** the Undo toast is visible
**When** I click "Undo" within the window
**Then** the client cancels the pending timer with **no server call** and restores every cleared Todo to its prior position and state (FR-9, AD-7).

**Given** the Undo toast dismisses (timeout or manual)
**When** the window closes without Undo
**Then** the client issues exactly **one** `DELETE /api/todos/completed` carrying the id snapshot; the server deletes only ids still completed; the List reconciles (FR-9, AD-7).

**Given** the deferred bulk delete fails server-side
**When** the mutation errors
**Then** the cleared rows return to their positions, an inline error shows, and the List reconciles to true persisted state (FR-9, FR-7, AD-7).

**Given** a refresh/crash during the undo window
**When** the app reloads
**Then** the not-yet-committed items are still present (safe failure) (AD-7, NFR-Rel).

**Test Scenarios:**
- **Unit (Vitest + TL):** clear hides only completed and shows toast with correct count; Undo restores exact prior positions/states and makes no network call; toast auto-dismisses ~6s and pauses on hover/focus; on dismiss exactly one `DELETE /api/todos/completed` fires with the captured id snapshot; a Todo completed after the click is not in the snapshot; bulk failure returns rows + inline error; footer count updates via `aria-live`; button inert at zero completed.
- **E2E hook:** clear-completed + undo journey exercised in Story 6.1.

**Traceability:** FR-9, FR-7; AD-7; UX-DR7, 8, 13, 14; NFR-Rel; UJ-4.

### Story 3.5: Cross-cutting keyboard navigation, screen-reader semantics, and responsive layout

As a keyboard, screen-reader, or mobile user,
I want the whole loop operable by keyboard and touch with correct semantics and a layout that adapts from 320px to desktop,
So that Orbit is fully usable regardless of input method or device (foundation for the automated a11y gate in Epic 6).

**Acceptance Criteria:**

**Given** all core components exist (Stories 3.1–3.4)
**When** I navigate by keyboard
**Then** Tab order follows reading order: input → each row's checkbox → its delete → Clear completed → toast Undo (newest-first); Enter/Space activate controls; Escape clears the input; focus never lands on any `aria-hidden` region; a 2px `border-focus` ring at AA contrast (derived from the panel) is visible on every interactive element (UX-DR14, NFR-A11y).

**Given** assistive tech
**When** the app is used
**Then** the List is a labeled list; each row exposes its description and completion state (labeled checkbox); the completed count is announced via a polite `aria-live` region; validation and action errors are associated with their control (`aria-describedby`) and announced; the Undo toast is announced and its action is a real focusable button (UX-DR14).

**Given** a mobile viewport (320–639px)
**When** the app renders
**Then** the panel fills width minus a 16px gutter each side, void shows top/bottom, delete affordances are always visible, the input is not force-focused, and the toast spans near-full-width above the thumb zone; single column at every size (UX-DR15, NFR-Resp).

**Given** a desktop/tablet viewport (≥ 640px)
**When** the app renders
**Then** the panel is centered and capped at 560px with wide void margins, delete is hover-revealed, and the input is autofocused (UX-DR15).

**Given** browser zoom / font scaling
**When** set to 200%
**Then** the layout survives without clipping controls or content (UX-DR14, NFR-A11y).

**Given** `prefers-reduced-motion: reduce`
**When** UI micro-transitions would run
**Then** the toast slide and row fade drop to instant (UX-DR16).

**Test Scenarios:**
- **Unit/component (Vitest + TL + jsdom):** roles/labels present on list, rows, checkboxes, errors, toast; `aria-live` region announces count; focus order assertions across the composed panel; reduced-motion path removes transition classes (mocked matchMedia).
- **Responsive (component/viewport):** delete visibility and autofocus differ by breakpoint (mocked); layout is single-column at 320px and desktop.
- **E2E/axe hook:** the zero-critical WCAG AA assertion runs in Story 6.1 against this fully wired UI.

**Traceability:** NFR-A11y, NFR-Resp; UX-DR14, 15, 16; AD-6 (states resolve).

---

## Epic 4: Space Backdrop & Graceful Degradation

Add the signature three.js cube-star Backdrop as a fully isolated decorative layer that renders behind the panel, mounts only after the loop is interactive, and can be switched off entirely without affecting the loop. Degradation is mandatory and ordered. This epic touches only the `backdrop/` layer and a mount point — it shares no state with the loop (AD-8).

### Story 4.1: Isolated three.js cube-star Backdrop

As Maya,
I want a slow drift of cube-shaped stars behind my list,
So that opening the app is quietly delightful — without the effect ever slowing or blocking the core loop.

**Acceptance Criteria:**

**Given** WebGL is available and motion is allowed
**When** the app has become interactive
**Then** a fixed, full-viewport `aria-hidden`, `pointer-events:none` Backdrop layer below the panel renders a three.js cube-star field over the `surface-void` gradient, drifting slowly (targets ~60fps), mounted **after** first interactivity via code-splitting so it never blocks first paint or input (FR-8, AD-8, UX-DR12).

**Given** the Backdrop
**When** it runs
**Then** it owns its canvas imperatively inside an effect with its own `requestAnimationFrame` loop **outside** React's render cycle, reads no Todo data, and causes no per-frame re-render of the core UI (AD-8).

**Given** Todo content over the Backdrop
**When** displayed
**Then** text sits on the ~72% scrim panel; no bright cube ever sits directly behind text, so contrast is independent of what drifts behind (UX-DR12, NFR-A11y).

**Test Scenarios:**
- **Unit (Vitest, mocked WebGL/three):** the Backdrop component mounts after an "interactive" signal (lazy/code-split boundary), sets `aria-hidden` + `pointer-events:none`, and never exposes Todo data props.
- **Unit:** the rAF loop starts/stops via the effect lifecycle (mounts/unmounts cleanly, no leaked loop).
- **E2E/perf hook:** frame-rate/interaction-budget behavior verified in the performance pass (Story 6.3); axe with Backdrop active in Story 6.1.

**Traceability:** FR-8; AD-8; UX-DR12; NFR-Perf, NFR-A11y; UJ-3.

### Story 4.2: Mandatory degradation, performance guardrails, and error boundary

As any user (reduced-motion, no-WebGL, low-power, or hit by a Backdrop failure),
I want the Backdrop to degrade gracefully to a static fallback and never break or slow the app,
So that accessibility and the interaction budget always win over visual flourish.

**Acceptance Criteria:**

**Given** `prefers-reduced-motion: reduce`
**When** the app loads
**Then** no looping animation runs — a single static frame (static starfield) is shown with identical layout and contrast; only motion is removed (FR-8, AD-8, UX-DR12, UX-DR16).

**Given** WebGL is unavailable or context creation fails
**When** the app loads
**Then** the Backdrop degrades to the plain `surface-void → surface-void-far` radial gradient rather than erroring; the loop is unaffected (FR-8, AD-8, UX-DR12).

**Given** the animation is running
**When** the tab becomes hidden (`visibilitychange`)
**Then** the loop pauses/throttles and resumes when visible again (AD-8, NFR-Perf).

**Given** a low-power device or a missed frame budget
**When** rendering
**Then** a watchdog steps down device-pixel-ratio, then cube count, then falls back to static rather than stutter; frame rate is reduced before input responsiveness is ever dropped (AD-8, NFR-Perf, SM-C2).

**Given** the Backdrop throws at any point
**When** the error occurs
**Then** an error boundary wrapping the Backdrop falls back to the static gradient; the core loop is never taken down (FR-8, AD-8, FR-7).

**Test Scenarios:**
- **Unit (Vitest, mocked matchMedia/WebGL):** fallback selection — reduced-motion → static frame (no loop); no-WebGL context → gradient; both leave the loop mounted and interactive.
- **Unit:** `visibilitychange` pauses/resumes the rAF loop; the error boundary catches a thrown Backdrop and renders the gradient fallback without unmounting the app.
- **Unit:** the watchdog step-down sequence (DPR → cube count → static) fires under a simulated dropped-frame budget.
- **E2E/axe hook (Story 6.1):** zero critical WCAG AA with Backdrop active; **E2E (Story 6.1):** with reduced-motion emulated, the loop remains fully functional.

**Traceability:** FR-8, FR-7; AD-8; UX-DR12, UX-DR16; NFR-Perf, NFR-A11y, SM-C2; UJ-3.

---

## Epic 5: Containerized Delivery

Package and orchestrate the three-tier system so the whole thing builds and runs from a single `docker-compose up`, with durable data, health checks, single-origin serving, and dev/test profiles. This epic adds Dockerfiles, `nginx.conf`, `docker-compose.yml`, and entrypoint wiring; it does not change application behavior.

### Story 5.1: Backend & database containers with health checks, named volume, and migrate-before-serve

As an operator,
I want the backend and Postgres running as containers with durable storage, health checks, and automatic migrations on start,
So that data survives restarts and the API only serves once its schema is ready.

**Acceptance Criteria:**

**Given** a backend Dockerfile
**When** it is built
**Then** it is multi-stage (deps → slim runtime), runs as a **non-root** user, and its entrypoint runs `alembic upgrade head` **before** launching Uvicorn (AD-11, NFR-Deploy).

**Given** the `db` service
**When** composed
**Then** it is `postgres:17` with data on a **named volume** (`pgdata`), a `pg_isready` Docker `healthcheck`, and 12-factor env-var config; no secrets committed (AD-11, NFR-Rel, NFR-Deploy).

**Given** startup ordering
**When** the stack comes up
**Then** `backend` `depends_on` the `db` being healthy, and the `backend` service declares a Docker `healthcheck` hitting `GET /api/health` (AD-11, NFR-Deploy).

**Given** durability
**When** the stack is stopped and restarted
**Then** previously persisted Todos are still present (volume-backed) (NFR-Rel, SM-3).

**Test Scenarios:**
- **Integration/ops:** `docker compose up` (backend + db) → `GET /api/health` returns `200` after migrations; container runs as non-root (verified via `id`/inspect); logs are viewable via `docker-compose logs`.
- **Durability:** create Todos, `docker compose down` then `up`, confirm data persists on the named volume.
- **E2E hook:** full-stack E2E runs against the composed stack in Story 6.1.

**Traceability:** NFR-Deploy, NFR-Rel; AD-11; SM-3, SM-7 (partial).

### Story 5.2: Frontend container and single-origin `docker-compose up`

As an operator,
I want the built SPA served by nginx which reverse-proxies `/api`, and the whole three-service stack to come up with one command,
So that the browser sees a single origin (no CORS) and the system runs from `docker-compose up`.

**Acceptance Criteria:**

**Given** a frontend Dockerfile
**When** it is built
**Then** it is multi-stage (Node build → nginx stable-alpine runtime), producing the static SPA served by nginx (NFR-Deploy).

**Given** `nginx.conf`
**When** the frontend serves
**Then** nginx serves the built SPA and reverse-proxies `/api/*` to the `backend` service so the browser sees one origin and no CORS is needed in the composed stack; a Docker `healthcheck` hits nginx `GET /` returning 200 (AD-10, NFR-Deploy).

**Given** the full stack
**When** a developer runs a single `docker-compose up`
**Then** three containers (`frontend`, `backend`, `db`) start, become healthy in the correct order, and the app is fully usable end-to-end at the frontend origin (SM-7, NFR-Deploy).

**Test Scenarios:**
- **Integration/ops:** `docker compose up` → the SPA loads at `:80`, `/api/*` calls succeed through the proxy with no CORS headers required; all three healthchecks report healthy.
- **E2E:** the Playwright suite (Story 6.1) runs green against this composed single-origin stack.

**Traceability:** NFR-Deploy; AD-10; SM-7.

### Story 5.3: Dev and test compose profiles with env-var configuration

As a developer,
I want compose profiles for local development and for running the test suites,
So that I get HMR + exposed ports + CORS locally and a reproducible test environment in CI, all via env vars.

**Acceptance Criteria:**

**Given** the `dev` profile
**When** activated
**Then** it mounts source, runs Vite HMR (frontend :5173) and the backend (:8000) with exposed ports, and enables CORS **only** here via `CORS_ORIGINS` so the Vite dev server can call the backend (AD-10, NFR-Deploy).

**Given** the `test` profile
**When** activated
**Then** it provides an ephemeral Postgres and runs the suites (backend integration uses transactional-rollback fixtures against this DB; Playwright runs against the composed app) (NFR-Deploy, NFR-Quality).

**Given** configuration
**When** any service starts
**Then** all config is via 12-factor env vars (backend `pydantic-settings`, frontend build-time `VITE_*`); logs are structured JSON to stdout viewable via `docker-compose logs`; no secrets in v1 (NFR-Deploy, NFR-Sec).

**Test Scenarios:**
- **Ops:** `--profile dev` brings up HMR + exposed ports with CORS working from :5173; production (default) profile has no CORS.
- **Ops/CI:** `--profile test` runs backend integration + Playwright against the ephemeral DB and passes; this is the environment CI (Story 1.3 / Epic 6) invokes.

**Traceability:** NFR-Deploy, NFR-Quality, NFR-Sec; AD-10; integration-test DB mechanism (transactional-rollback on test-profile Postgres).

---

## Epic 6: Quality, Accessibility, Security & Documentation Sign-off

Bring the day-one QA obligations to their hard acceptance bars and produce the required deliverables. This epic verifies the whole system end-to-end against the composed stack, closes the coverage gate, documents the security and performance/accessibility passes, and writes the README and AI-integration log.

### Story 6.1: Playwright E2E suite and automated accessibility gate

As a QA stakeholder,
I want ≥ 5 Playwright E2E tests covering the core journeys plus an automated zero-critical WCAG AA assertion with the Backdrop active,
So that the product's core actions are proven unaided and accessibility is gated automatically (SM-1, SM-4, SM-6).

**Acceptance Criteria:**

**Given** the composed stack (Epic 5) and the full UI (Epics 3–4)
**When** the Playwright suite runs against the running app
**Then** at least the following journeys pass as distinct specs (≥ 5): **create** (FR-1), **complete/toggle** incl. toggle-back in place (FR-2, FR-5), **delete** (FR-3), **clear-completed + undo** incl. deferred commit on dismiss (FR-9, AD-7), **empty state** (FR-6), and a **load/action error path** with reconcile (FR-7) (SM-6).

**Given** the app with the Backdrop active
**When** `@axe-core/playwright` runs on the loaded/loaded-empty states
**Then** there are **zero critical WCAG 2.1 AA violations**, including text contrast of Todo content over the Backdrop (SM-4, NFR-A11y).

**Given** reduced-motion emulation
**When** the E2E runs
**Then** the loop remains fully functional and the Backdrop is static (FR-8).

**Test Scenarios:**
- **E2E (Playwright, ≥ 5 specs):** the six journeys above against the compose stack; assertions on optimistic update + reconcile and on error rollback.
- **E2E (axe):** zero critical violations with Backdrop active; keyboard-only completion of the loop.
- **Contract:** API responses observed in E2E match the fixed `/api` contract shapes/status codes.

**Traceability:** FR-1..FR-9; AD-6, AD-7; NFR-A11y, NFR-Quality; SM-1, SM-4, SM-6.

### Story 6.2: Coverage gate at ≥ 70% meaningful coverage

As a QA stakeholder,
I want backend and frontend coverage measured and enforced at ≥ 70% meaningful coverage in CI,
So that the test suite genuinely exercises the code and regressions are caught (SM-5).

**Acceptance Criteria:**

**Given** pytest-cov (backend) and Vitest v8 coverage (frontend)
**When** the suites run in CI
**Then** each reports coverage and the pipeline **fails** if meaningful coverage drops below 70% (SM-5, NFR-Quality).

**Given** the "meaningful coverage" definition (Open Question #4)
**When** the ≥ 70% target is measured
**Then** it is **branch** coverage of real application logic — API handlers, validation, the repository layer, and the frontend optimistic-update / undo logic — **excluding** generated code, config, Alembic migrations, and three.js visual tuning; trivial-assertion padding does not count toward the bar (SM-5).

**Given** coverage gaps found
**When** measured
**Then** meaningful tests (not assertion-free filler) are added to reach the bar across services/validation, hooks (optimistic/rollback/reconcile), components, and backdrop fallback selection.

**Given** the CI config from Story 1.3
**When** this story completes
**Then** any report-only coverage step is flipped to enforcing.

**Test Scenarios:**
- **CI gate:** a simulated drop below 70% fails the pipeline; at/above 70% passes.
- **Coverage review:** report confirms coverage spans the AD-6 optimistic paths and AD-5 error mapping, not just happy paths.

**Traceability:** NFR-Quality; SM-5.

### Story 6.3: Security review and performance/accessibility pass (documented)

As a QA stakeholder,
I want a documented security review and a documented performance + accessibility pass with findings and remediations,
So that XSS/injection risks are closed and the interaction/frame budgets and WCAG AA bar are verified beyond the automated gate (NFR-Sec, NFR-Perf, NFR-A11y).

**Acceptance Criteria:**

**Given** a security review
**When** conducted
**Then** it covers XSS (Todo text rendered as text only, React auto-escaping — AD-5), injection (parameterized queries at the persistence boundary — AD-2/NFR-Sec), input validation parity client/server, and error-envelope information disclosure; findings and remediations are documented in a QA report.

**Given** a performance pass
**When** conducted (e.g. Chrome DevTools MCP)
**Then** it verifies optimistic UI within ~100ms, API p95 < 300ms under normal single-user conditions, and Backdrop ~60fps with graceful step-down that never pushes interaction latency past budget on a mid-range laptop and mid-range phone; issues and the confirmed numeric budgets/representative devices are documented (NFR-Perf; resolves PRD OQ5–7).

**Given** an accessibility pass
**When** conducted (Lighthouse / axe beyond the automated E2E gate)
**Then** keyboard operability, focus visibility, `aria-live` announcements, 44px targets, and 200% zoom are verified; findings/remediations documented (NFR-A11y).

**Test Scenarios:**
- **Security:** attempt an XSS payload as a Todo description via E2E/manual — it renders inert as text; attempt an injection-style description — persisted safely via parameterized query; documented.
- **Performance:** recorded traces / measurements against the budgets on representative devices; documented with remediations.
- **Accessibility:** Lighthouse/axe run + keyboard walkthrough documented; zero critical AA confirmed.

**Traceability:** NFR-Sec, NFR-Perf, NFR-A11y; AD-2, AD-5, AD-8; SM-2, SM-4; resolves PRD Open Questions 5–7.

### Story 6.4: README and AI-integration log

As a new developer or reviewer,
I want an accurate README with setup instructions and a maintained AI-integration log,
So that the system can be run from scratch and the AI-assisted delivery process is documented (SM-8, SM-9).

**Acceptance Criteria:**

**Given** the repository
**When** the README is written
**Then** it documents prerequisites (Docker), the single `docker-compose up` run path, dev/test profile usage, how to run each test suite and view coverage, env-var configuration, and the API contract summary; a fresh clone can be brought up following it exactly (SM-8, NFR-Deploy).

**Given** the AI-assisted build and the AI-integration log seeded in Story 1.1 and appended to incrementally across Epics 1–5
**When** the AI-integration log (`docs/AI-INTEGRATION-LOG.md`) is **finalized/polished** here (not authored from scratch)
**Then** the incrementally-maintained log is completed so it records agent/MCP usage, prompts that worked, test-generation hits/misses, AI debugging cases, and limitations where human expertise was critical (SM-9).

**Test Scenarios:**
- **Docs validation:** a clean-environment walkthrough follows the README end-to-end and reaches a working app (documented smoke check).
- **Completeness check:** the AI-integration log contains all required categories with concrete entries.

**Traceability:** NFR-Deploy; SM-8, SM-9; deliverables checklist (PRD addendum).

---

## Validation Summary

- **FR coverage:** All FR-1..FR-9 are covered by at least one story with acceptance criteria addressing the FR's testable consequences (see [FR Coverage Map](#fr-coverage-map)). No FR is left uncovered.
- **NFR coverage:** NFR-Perf (3.2/3.3/4.x/6.3), NFR-A11y (3.5/4.2/6.1/6.3), NFR-Resp (3.5), NFR-Rel (2.x/5.1), NFR-Deploy (1.x/5.x/6.4), NFR-Quality (1.x/6.1/6.2/6.3), NFR-Sec (2.1/3.1/6.3), NFR-Maint (1.x/2.1 seam).
- **UX-DR coverage:** UX-DR1–2 (3.1), 3 (3.2), 4–6 (3.3), 7–8 (3.4), 9–11 (3.1), 12 (4.1/4.2), 13 (3.1–3.4), 14 (3.5), 15 (3.5), 16 (3.5/4.2). All UX-DRs covered.
- **Playwright E2E ≥ 5 (SM-6):** Story 6.1 defines six specs — create, complete/toggle-back, delete, clear-completed + undo, empty state, load/action error — plus the axe zero-critical gate.
- **QA hard bars:** ≥ 70% coverage (6.2), ≥ 5 E2E (6.1), zero critical WCAG AA (6.1/6.3), unit+integration+E2E suites (1.1/1.2/2.x/3.x/6.1), security + perf/a11y reports (6.3), README + AI log (6.4), GitHub Actions CI (1.3), transactional-rollback integration fixtures on a test-profile Postgres (1.2/2.x/5.3).
- **Sequencing:** Foundation + test infra + CI first (Epic 1); backend before dependent frontend (Epic 2 → Epic 3); Backdrop isolated after the loop (Epic 4); containerization (Epic 5); QA/docs sign-off last (Epic 6). Within each epic, story N.M depends only on prior stories (verified — see per-story ACs).
- **Dependency notes:** Epic 3 depends on Epic 2's API; a developer may stub the API for early frontend work, but the intended order is backend-first. Epic 6 verifies against Epic 5's composed stack. Story 1.3 sets up the coverage gate as report-only, flipped to enforcing in 6.2 — a deliberate forward reference to a *later* story that does not block 1.3's completion. `[ASSUMPTION]`
- **Standing convention — AI-integration log (SM-9):** `docs/AI-INTEGRATION-LOG.md` is seeded in Story 1.1 and, as a cross-cutting definition-of-done, **every epic appends its AI-collaboration notes (agent/MCP usage, effective prompts, test-generation hits/misses, AI-debugging cases, limitations) as the work happens** — the log is maintained incrementally from Epic 1 onward and only finalized/polished in Story 6.4, never authored once at the end.

## Assumptions (fast-path inferences)

*Genuine inferences made to complete this breakdown autonomously. Everything else traces directly to the source artifacts.*

- **Epic/story granularity:** The six-epic structure (two of which — Epic 1 Foundation and Epic 6 QA/Docs — are enabling/hardening rather than pure end-user-value epics) was chosen because the architecture, UX, and test design are fully validated (favoring fewer, larger epics) and because QA-from-day-one and containerized delivery are hard, explicit deliverables. A human normally approves this structure at Step 2. `[ASSUMPTION]`
- **Todos migration placement:** The `todos` table migration lands in Story 2.1 (first story needing it), not in Epic 1, per the "create tables only when needed" principle; Epic 1 ships only the Alembic baseline. `[ASSUMPTION]`
- **Frontend placeholder before Epic 3:** Story 1.1 renders a trivial placeholder page so the Vitest/Playwright runners have something to load before the real UI exists. `[ASSUMPTION]`
- **Coverage gate lifecycle:** Story 1.3 wires the coverage gate as report-only initially, and Story 6.2 flips it to enforcing once coverage is filled, to avoid a red pipeline through early feature stories. `[ASSUMPTION]`
- **Test-count distribution:** Beyond the hard bars (≥ 70% coverage, ≥ 5 E2E), the specific per-story test scenarios are the author's reasonable decomposition, not dictated by the sources. `[ASSUMPTION]`
- **E2E "≥ 5" satisfied with six specs:** Six journeys are specified (one more than the floor) so create/complete/delete/clear/empty/error are each their own spec. `[ASSUMPTION on count; the six journeys themselves are from the PRD/architecture.]`
- **Standing PRD assumptions carried through** (already flagged in the PRD, restated for traceability): single implicit global List / no `owner_id` in v1 (AD-9); no light theme in v1 (resolved in UX); desktop-only autofocus (resolved); evergreen-browser support target.

## Open Questions (resolved 2026-07-23)

*Resolved by human review; recorded here for traceability.*

1. **Epic structure approval — RESOLVED (human): approved as-is.** The six-epic breakdown, including the dedicated Foundation (Epic 1) and QA/Docs (Epic 6) epics, is approved. Proceed to Implementation Readiness.
2. **Numeric performance budgets & representative devices** (PRD Open Questions 5–7, architecture "Deferred"): DEFERRED to the Story 6.3 performance pass (accepted). Working defaults (~100ms optimistic, API p95 < 300ms, ~60fps backdrop with step-down) stand; exact mid-range test devices/viewports confirmed at the performance pass.
3. **Coverage gate timing — RESOLVED (human): report-only then enforcing.** The ≥ 70% coverage gate is report-only in early CI (Story 1.3) and becomes enforcing in Story 6.2. Accepted.
4. **"Meaningful coverage" definition (SM-5) — RESOLVED (human): behavior/branch coverage of core logic.** The ≥ 70% target is measured as **branch coverage of real application logic** — API handlers, validation, the repository layer, and the frontend optimistic-update / undo logic — **excluding** generated code, config, Alembic migrations, and three.js visual tuning. Trivial-assertion padding does not count. The coverage gate configuration (Story 1.3 / 6.2) must apply these exclusions.
5. **AI-integration log ongoing capture (SM-9) — RESOLVED (human): incremental.** The AI-integration log is seeded and maintained **incrementally from Epic 1 onward** (appended as work happens), then finalized/polished in Story 6.4 — not authored once at the end.

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

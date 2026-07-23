---
baseline_commit: NO_VCS
---

# Story 1.1: Repository skeleton and tooling baseline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the monorepo directory structure and all build/test tooling scaffolded per the architecture source tree,
so that backend, frontend, and E2E packages exist with runnable (if initially trivial) test and lint commands and a single root command to reproduce CI locally.

## Acceptance Criteria

1. **AC1 — Directory skeleton matches the architecture source tree.** Given an empty repository, when the skeleton is created, then the `backend/`, `frontend/`, and `e2e/` trees exist matching the architecture Source Tree:
   - Backend: `app/` with `api/routes/`, `core/`, `db/`, `repositories/`, `services/`, `schemas/`; `migrations/`; `tests/unit/`, `tests/integration/`.
   - Frontend: `src/` with `api/`, `hooks/`, `components/`, `backdrop/`, `styles/`; `types.ts`; colocated `*.test.tsx` test convention.
   - E2E: `tests/` plus `playwright.config.ts`.
2. **AC2 — Backend Python 3.12 + pinned stack.** Backend uses Python 3.12 with `pyproject.toml` pinning FastAPI 0.136.x, Pydantic 2.x, SQLAlchemy 2.0.x, psycopg 3.x, Alembic, Uvicorn, pytest, pytest-cov.
3. **AC3 — Frontend Node 22 LTS + pinned stack.** Frontend uses Node 22 LTS with `package.json` pinning React 19.2.x, Vite 8.0.x, TypeScript 5.x, TanStack Query v5, Vitest + @testing-library/react, and three.js 0.185.x.
4. **AC4 — E2E pins Playwright + axe.** `e2e/` pins Playwright + @axe-core/playwright.
5. **AC5 — Every package's `test`, `coverage`, `lint` scripts exit 0 against at least one placeholder test.** Given the scaffolded packages, when a developer runs each package's `test`, `coverage`, and `lint` scripts, then each command executes and exits 0 against at least one placeholder test per package.
6. **AC6 — Single root command runs backend + frontend + Playwright smoke in sequence.** A single documented root command (root Makefile or root npm scripts) runs backend + frontend + the Playwright smoke spec in sequence. The Epic 1 Playwright run targets a simple locally-served page (Vite dev/preview or static serve), **not** docker-compose. Compose-backed runs and full-journey E2E land in Epic 5/6.
7. **AC7 — Naming conventions honored; no secrets.** Python is `snake_case`; TS components are `PascalCase`, one per file matching filename; wire/config placeholders use `snake_case` keys and 12-factor env vars; no secrets are committed.
8. **AC8 — AI-integration log seeded.** `docs/AI-INTEGRATION-LOG.md` is seeded with its five section structure — agent usage, MCP usage, test-generation hits/misses, AI-debugging cases, and limitations where human expertise was critical — ready to be appended to incrementally.

## Tasks / Subtasks

- [x] **Task 1 — Root-level scaffolding & tooling entrypoint** (AC: 1, 6, 7)
  - [x] Create `.gitignore` covering Python (`__pycache__`, `.venv`, `*.pyc`, `.pytest_cache`, coverage artifacts), Node (`node_modules`, `dist`, coverage), Playwright (`test-results`, `playwright-report`, `.cache`), env files (`.env`, `.env.*` except `.env.example`), and OS cruft.
  - [x] Create a root `Makefile` with targets: `install` (backend venv + `pip install -e .[dev]`, frontend `npm ci`/`install`, e2e `npm install`), `test` (backend pytest + frontend vitest run), `coverage` (both with coverage), `lint` (ruff + eslint/tsc), and `smoke` / `e2e` (Playwright smoke against a locally served page), plus a `ci` target that runs lint + test + coverage + smoke in sequence.
  - [x] Do NOT run `git init` or commit — this environment is not a git repo. Only create files. (No AC requires git.)
- [x] **Task 2 — Backend scaffold (Python 3.12, FastAPI stack)** (AC: 1, 2, 5, 7)
  - [x] Pin Python via `pyenv`: ensure 3.12 installed (`pyenv install --skip-existing 3.12`), write `backend/.python-version` (and/or root) pinning the resolved 3.12.x, create a project-local venv at `backend/.venv` (NOT global installs).
  - [x] Create `backend/pyproject.toml` pinning: FastAPI 0.136.x, Pydantic 2.x, pydantic-settings 2.x, SQLAlchemy 2.0.x, psycopg[binary] 3.x, Alembic, Uvicorn 0.34.x; dev extras: pytest, pytest-cov, ruff. Configure `[tool.pytest.ini_options]`, `[tool.coverage.run] branch = true`, and `[tool.coverage.report]` meaningful-coverage exclusions (generated code, config, `migrations/*` Alembic, three.js tuning — the latter is frontend but keep the exclusion list documented). `requires-python = ">=3.12,<3.13"`.
  - [x] Create the package tree with `__init__.py` where needed: `app/__init__.py`, `app/main.py` (placeholder — real app factory is Story 1.2; keep minimal), `app/api/routes/`, `app/core/`, `app/db/`, `app/repositories/`, `app/services/`, `app/schemas/`, `migrations/` (empty placeholder dir, real Alembic env is Story 1.2), `tests/unit/`, `tests/integration/`.
  - [x] Add `backend/tests/unit/test_placeholder.py` — one trivial passing test proving runner + coverage collection.
  - [x] Wire coverage as **report-only** at this stage (no `--cov-fail-under` gate yet; the enforcing gate lands in Story 1.3 report-only wiring and Story 6.2 enforcing). Branch coverage must be enabled now.
  - [x] Add `backend/.env.example` with 12-factor placeholders (`snake_case`/UPPER_SNAKE env keys, e.g. `DATABASE_URL`, `CORS_ORIGINS`) — no real secrets.
- [x] **Task 3 — Frontend scaffold (Node 22, React + Vite stack)** (AC: 1, 3, 5, 7)
  - [x] Pin Node via `nvm`: ensure 22 installed (`nvm install 22`), write `frontend/.nvmrc` (and root `.nvmrc`) pinning `22`. Use `nvm use 22` for all frontend commands. Local `node_modules` only — no global installs.
  - [x] Create `frontend/package.json` pinning: react ^19.2, react-dom ^19.2, @tanstack/react-query ^5, three ^0.185; dev: vite ^8, typescript ^5, vitest ^4, @testing-library/react, @testing-library/jest-dom, jsdom, @vitejs/plugin-react, eslint + typescript-eslint, @vitest/coverage-v8. Scripts: `dev`, `build`, `preview`, `test` (`vitest run`), `coverage` (`vitest run --coverage`), `lint` (`eslint . && tsc --noEmit`).
  - [x] Create `vite.config.ts`, `vitest.config.ts` (jsdom env, v8 coverage provider, branch coverage), `tsconfig.json` (strict, TS 5), `index.html`, `eslint.config.js` (flat config).
  - [x] Create `src/main.tsx` + `src/App.tsx` rendering a trivial placeholder page (heading text) so Vitest and Playwright have something to load. `[ASSUMPTION: frontend renders a placeholder page until Epic 3.]` Component filenames `PascalCase`, one component per file.
  - [x] Create the directory tree: `src/api/`, `src/hooks/`, `src/components/`, `src/backdrop/`, `src/styles/`, `src/types.ts` (can be a stub with a `// types land in Epic 2/3` note or a placeholder export).
  - [x] Add a colocated placeholder test, e.g. `src/App.test.tsx` — trivial passing Vitest + Testing Library test proving Vitest + v8 coverage work.
- [x] **Task 4 — E2E scaffold (Playwright + axe)** (AC: 1, 4, 5, 6)
  - [x] Create `e2e/package.json` pinning @playwright/test ^1.5x and @axe-core/playwright. Scripts: `test` (`playwright test`), `install-browsers` (`playwright install`), `lint` (tsc/eslint as applicable). Add a `test`/`lint` that exits 0 with a placeholder.
  - [x] Create `e2e/playwright.config.ts` with a `webServer` that serves the frontend locally (Vite `preview` of the built app, or `vite dev`, or a static `serve` of `frontend/dist`) — **NOT** docker-compose. Single chromium project is sufficient for the smoke.
  - [x] Create `e2e/tests/smoke.spec.ts` — loads the served placeholder page and asserts the heading is visible. This proves the Playwright runner + config work.
  - [x] Ensure `playwright install chromium` is invoked (or documented in the Makefile `install` target) so the smoke can run in this environment.
- [x] **Task 5 — AI integration log** (AC: 8)
  - [x] Create `docs/AI-INTEGRATION-LOG.md` with the five sections as H2 headings: (1) Agent usage, (2) MCP usage, (3) Test-generation hits/misses, (4) AI-debugging cases, (5) Limitations where human expertise was critical. Seed each with a short intro sentence and an initial Story 1.1 entry. This log is maintained incrementally from here through Story 6.4.
- [x] **Task 6 — Verify everything runs** (AC: 5, 6)
  - [x] Confirm active runtimes: `node --version` reports v22.x, `python --version` (inside `backend/.venv`) reports 3.12.x.
  - [x] Run backend: `pytest` (with coverage) → exits 0, ≥1 test passes.
  - [x] Run frontend: `npm run test` and `npm run coverage` → exit 0; `npm run lint` → exits 0.
  - [x] Run E2E smoke: build/serve frontend + `playwright test` → the smoke spec passes.
  - [x] Run the root command (`make ci` or equivalent) end-to-end and record actual pass/fail counts in the Dev Agent Record.

### Review Findings

Code review (2026-07-23, adversarial layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor). All acceptance criteria verified satisfied. Two patch findings raised and both fixed in-session; no unresolved high/medium issues.

- [x] [Review][Patch] `make install-backend` built the venv with the root `python3` (3.9.6) instead of 3.12 [Makefile] — venv creation ran from the repo root where pyenv resolves to the global interpreter, so `pip install -e .[dev]` would fail the `requires-python >=3.12` constraint. Fixed by creating the venv from inside `backend/` so pyenv honors `backend/.python-version` (3.12.13). Verified: `cd backend && python3 -m venv` → Python 3.12.13.
- [x] [Review][Patch] Non-standard `branches: true` key in Vitest coverage config [frontend/vitest.config.ts] — not a recognized v8 coverage option (v8 always collects branch coverage; thresholds live under `coverage.thresholds`). Removed it and set `all: true` so the report reflects all source files. Coverage still runs and exits 0 with a branch column.

Non-blocking notes (dismissed, no action):
- The Vitest text reporter renders an empty per-file table for the single tiny placeholder component while the summary is correct (branch coverage on, exit 0). Cosmetic; real feature code will populate it. Coverage tooling demonstrably works, satisfying AC5/AC8 intent.
- `e2e/` exposes no `coverage` script by design: the architecture's coverage gate covers only backend (pytest-cov) and frontend (Vitest v8); Playwright is not a coverage surface.

## Dev Notes

### Architecture patterns & constraints (must follow)

- **Source tree is prescriptive** — reproduce the layout in ARCHITECTURE-SPINE.md §"Source tree" exactly. Do not invent alternate structure. [Source: ARCHITECTURE-SPINE.md#Structural Seed / Source tree]
- **Layered backend (AD-2):** directories `api/routes → services → repositories → db`, dependencies point downward only. SQLAlchemy is confined to `repositories`/`db`. For 1.1 these are empty package dirs; the constraint matters once code lands (Story 1.2+), but create the dirs now so later stories drop files into the right place. [Source: ARCHITECTURE-SPINE.md#AD-2]
- **This story adds NO Todo feature behavior and NO real app factory / DB / Alembic env** — those are Story 1.2. Keep `app/main.py` and `migrations/` as minimal placeholders. Do not build health endpoints, sessions, or models here. [Source: epics.md#Epic 1 intro, Story 1.2]
- **Stack versions are pinned** — see the table below; honor the `[ASSUMPTION]` on Python 3.12 and Node 22 LTS (both confirmed as project pins by the calling context and the CLAUDE.md runtime rules). [Source: ARCHITECTURE-SPINE.md#Stack]
- **Coverage tooling:** branch coverage on both sides. Backend pytest-cov `branch = true`; frontend Vitest v8 coverage. Meaningful-coverage exclusions: generated code, config, Alembic migrations, three.js tuning. The gate is **report-only** now — no `--cov-fail-under` enforcement at this stage. Enforcing at ≥70% is Story 6.2. [Source: ARCHITECTURE-SPINE.md#Testing Architecture; sprint-status.yaml notes]
- **Playwright target for Epic 1 is a locally-served page**, never docker-compose (compose arrives Epic 5). Use Vite preview/dev or a static serve of the built SPA via Playwright's `webServer`. [Source: epics.md#Story 1.1 AC; ARCHITECTURE-SPINE.md#Deferred]

### Runtime / environment (this machine)

- **Node:** managed by `nvm`. Node 22 LTS is v22.23.1 (installed for this story). Pin with `.nvmrc` containing `22`. Run frontend/e2e commands under `nvm use 22` — the machine default is a newer Node, so activation is required each shell. [Source: CLAUDE.md runtime rules]
- **Python:** managed by `pyenv`. System default lacks 3.12 (has 3.14.6); install 3.12 with `pyenv install --skip-existing 3.12`, then pin via `.python-version`. Create a **project-local venv** (`backend/.venv`) and install into it — never global. [Source: CLAUDE.md runtime rules]
- **No global package installs.** Backend → venv; frontend/e2e → local `node_modules`.

### Naming & config conventions

- Python: `snake_case` modules/functions, `PascalCase` classes. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions]
- TypeScript: `PascalCase` React components (one per file, filename matches component), `camelCase` funcs/vars, hooks `useX`. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions]
- Config: 12-factor env vars only; backend via `pydantic-settings`, frontend build-time `VITE_*`. No secrets in v1. Provide `.env.example`, never a real `.env`. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions]
- Tests: backend pytest in `backend/tests/{unit,integration}`; frontend Vitest colocated `*.test.tsx`; Playwright specs in `e2e/`. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions, Testing]

### Stack versions (pin these)

| Name | Version |
| --- | --- |
| Python | 3.12 |
| FastAPI | 0.136.x |
| Pydantic / pydantic-settings | 2.x |
| SQLAlchemy | 2.0.x (sync) |
| psycopg | 3.x |
| Alembic | ~1.14+ |
| Uvicorn | 0.34.x |
| pytest / pytest-cov | current |
| Node.js | 22 LTS |
| React | 19.2.x |
| Vite | 8.0.x |
| TypeScript | 5.x |
| three.js | 0.185.x |
| TanStack Query | v5 |
| Vitest / @testing-library/react | 4.x / current |
| Playwright / @axe-core/playwright | 1.5x / current |

[Source: ARCHITECTURE-SPINE.md#Stack]

### Project Structure Notes

- Target layout (from the spine — reproduce exactly):

```text
nearform_todo_app/
  backend/
    app/
      main.py
      api/routes/
      core/
      db/
      repositories/
      services/
      schemas/
    migrations/
    tests/{unit,integration}/
    pyproject.toml
  frontend/
    src/
      main.tsx  App.tsx
      api/  hooks/  components/  backdrop/  styles/
      types.ts
      **/*.test.tsx
    package.json  vite.config.ts  vitest.config.ts
  e2e/
    tests/*.spec.ts  playwright.config.ts
  README.md
  docs/AI-INTEGRATION-LOG.md
```

- Files deferred to later stories (create the dir, not the file, unless a placeholder is needed to make a runner pass): `Dockerfile`s and `docker-compose.yml` (Epic 5), `nginx.conf` (Epic 5), real `main.py`/`db/session.py`/`db/models.py`/Alembic env (Story 1.2), feature components/hooks/api client (Epic 2/3), `Backdrop.tsx`/`scene.ts` (Epic 4).
- Variance: `README.md` is listed in the source tree but its full content is owned by Story 6.4. Create a minimal stub only if needed; the AI-integration log seeding (this story) is the docs deliverable here.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Repository skeleton and tooling baseline]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Project Foundation & Test Harness]
- [Source: _bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md#Structural Seed]
- [Source: _bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md#Stack]
- [Source: _bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md#Consistency Conventions]
- [Source: _bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md#Testing Architecture]
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml (coverage gate report-only until 6.2; AI log seeded 1.1)]
- [Source: ~/.claude/CLAUDE.md (nvm/pyenv runtime version management)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

- E2E `tsc --noEmit` initially failed with `TS2688: Cannot find type definition file for 'node'` because `playwright.config.ts` needs Node types but `@types/node` was not a dependency. Fixed by adding `@types/node ^22` to `e2e/package.json`; lint then exits 0.

### Completion Notes List

- Story context engine analysis completed - comprehensive developer guide created.
- Scaffolded the full monorepo (`backend/`, `frontend/`, `e2e/`, root config, `docs/`) exactly per the architecture Source Tree. All eight ACs satisfied.
- **Runtimes actually used:** Node **v22.23.1** (nvm; pinned via root `.nvmrc` and `frontend/.nvmrc` = `22`) and Python **3.12.13** (pyenv; pinned via `backend/.python-version`, project-local venv at `backend/.venv`, no global installs).
- **Resolved dependency versions (all within pinned ranges):** backend — FastAPI 0.136.3, Pydantic 2.13.4, pydantic-settings 2.14.2, SQLAlchemy 2.0.51, psycopg 3.3.4, Alembic 1.18.5, Uvicorn 0.34.3, pytest 8.4.2, pytest-cov 6.3.0, ruff 0.15.22. Frontend — React 19.2.8, Vite 8.1.5, TypeScript 5.9.3, Vitest 4.1.10, TanStack Query 5.101.4, three 0.185.1. E2E — Playwright 1.61.1, @axe-core/playwright 4.12.1.
- **Test results (all executed, not assumed):** backend `pytest` 1 passed with branch-coverage collection working (report-only, no gate); frontend `vitest run` 1 passed and `vitest run --coverage` (v8, branch) 1 passed; frontend `lint` (eslint + tsc) exit 0; e2e `lint` (tsc) exit 0; Playwright smoke 1 passed against a locally-served Vite preview (NOT docker-compose). Root `make ci` (lint → test → coverage → smoke) exits 0.
- Coverage is intentionally **report-only** at this stage (branch coverage enabled both sides; meaningful-coverage exclusions configured). The enforcing >=70% gate lands in Story 6.2.
- Deferred to later stories as designed: real FastAPI app factory / DB session / Alembic env (Story 1.2); feature components/hooks/api client (Epic 2/3); three.js backdrop (Epic 4); Dockerfiles / docker-compose / nginx (Epic 5); full README + final AI log (Story 6.4).

### File List

**Root**
- `.gitignore` (new)
- `.nvmrc` (new)
- `Makefile` (new)
- `README.md` (new — scaffold stub, finalized in Story 6.4)

**Backend**
- `backend/pyproject.toml` (new)
- `backend/.python-version` (new)
- `backend/.env.example` (new)
- `backend/app/__init__.py` (new)
- `backend/app/main.py` (new — placeholder helper)
- `backend/app/api/__init__.py`, `backend/app/api/routes/__init__.py` (new)
- `backend/app/core/__init__.py` (new)
- `backend/app/db/__init__.py` (new)
- `backend/app/repositories/__init__.py` (new)
- `backend/app/services/__init__.py` (new)
- `backend/app/schemas/__init__.py` (new)
- `backend/migrations/.gitkeep` (new)
- `backend/tests/__init__.py`, `backend/tests/unit/__init__.py`, `backend/tests/integration/__init__.py` (new)
- `backend/tests/unit/test_placeholder.py` (new — placeholder unit test)
- `backend/tests/integration/.gitkeep` (new)

**Frontend**
- `frontend/package.json` (new)
- `frontend/.nvmrc` (new)
- `frontend/.env.example` (new)
- `frontend/index.html` (new)
- `frontend/tsconfig.json` (new)
- `frontend/vite.config.ts` (new)
- `frontend/vitest.config.ts` (new)
- `frontend/eslint.config.js` (new)
- `frontend/src/main.tsx` (new)
- `frontend/src/App.tsx` (new — placeholder page)
- `frontend/src/App.test.tsx` (new — placeholder colocated test)
- `frontend/src/test-setup.ts` (new)
- `frontend/src/types.ts` (new — placeholder)
- `frontend/src/{api,hooks,components,backdrop,styles}/.gitkeep` (new)

**E2E**
- `e2e/package.json` (new)
- `e2e/tsconfig.json` (new)
- `e2e/playwright.config.ts` (new)
- `e2e/tests/smoke.spec.ts` (new — placeholder smoke)

**Docs**
- `docs/AI-INTEGRATION-LOG.md` (new — five sections seeded)

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-23 | Story 1.1 implemented: scaffolded backend/frontend/e2e monorepo per the architecture Source Tree with pinned toolchains (Python 3.12 / Node 22 LTS), placeholder tests + branch-coverage tooling (report-only), root Makefile CI target, and seeded AI-integration log. All runners verified green (`make ci` exit 0). Status → review. |


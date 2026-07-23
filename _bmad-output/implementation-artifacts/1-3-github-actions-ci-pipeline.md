---
baseline_commit: NO_VCS
---

# Story 1.3: GitHub Actions CI pipeline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a GitHub Actions workflow that lints, runs the unit + integration suites (full compose E2E is deferred to Epic 6), reports coverage, and builds both images,
so that every push is gated by the same commands a developer runs locally and quality regressions are caught automatically.

## Acceptance Criteria

1. **Pipeline runs the wired scripts (no duplicated logic).** A GitHub Actions workflow (`.github/workflows/ci.yml`) triggers on push and pull_request and runs: lint (backend + frontend), backend unit + integration tests, frontend unit tests, and coverage collection for both — invoking the CI-agnostic root **Makefile** targets / package scripts from Story 1.1 (`make lint-backend`, `make lint-frontend`, `make coverage-backend`, `make coverage-frontend`). No test/lint logic is re-expressed inline in the workflow YAML. [epics.md#Story 1.3 AC1; spine "CI provider — GitHub Actions"]
2. **Integration tests get a real Postgres.** The backend job provisions a `postgres:17` **service container** (matching the AD/spec Postgres 17 pin and the `test`-profile DB the 1.2 transactional-rollback fixtures expect) with a `pg_isready` healthcheck, and exports `TEST_DATABASE_URL` (and `DATABASE_URL`) pointing at it so the integration suite runs against a real DB rather than skipping. The alembic `upgrade head`/`downgrade base` integration test runs against this service. [epics.md#Story 1.3 AC1 ("spinning up a `test`-profile Postgres service"); 1.2 conftest.py `TEST_DATABASE_URL`; spine Testing Architecture; Tech-stack Postgres 17]
3. **Docker image build (build-only).** The workflow builds the frontend and backend Docker images (build only; full compose E2E is exercised in Epic 6). Because the multi-stage Dockerfiles are delivered in **Epic 5** (spine §Deployment topology / Source tree), the build step is authored now and guarded to activate automatically once `backend/Dockerfile` / `frontend/Dockerfile` exist — keeping the pipeline green on the current 1.1/1.2 scaffold while satisfying the "build both images" contract for when the Dockerfiles land. [epics.md#Story 1.3 AC1 ("builds the frontend and backend Docker images (build only …)"); spine Deployment topology; sprint-status dependency note]
4. **Coverage reported with the meaningful-coverage config (report-only now).** A coverage step reports backend (pytest-cov) and frontend (Vitest v8) coverage; the ≥ 70% gate is *configured* but **report-only** at this stage (flipped to enforcing in Story 6.2). The coverage tool config already applies the meaningful-coverage rules — **branch** coverage on, **excluding** generated code, config, Alembic migrations, and three.js visual tuning — so the same definition is in force when the gate flips. No `--cov-fail-under` / no failing threshold is introduced here. Coverage summaries/artifacts are produced for both packages. [epics.md#Story 1.3 AC2; backend/pyproject.toml `[tool.coverage.*]`; frontend/vitest.config.ts coverage block; sprint-status "Story 1.3 wires the coverage gate report-only; Story 6.2 flips it to enforcing"]
5. **Fails visibly and blocks merge on lint/test failure.** A failing test or lint error makes the pipeline fail (non-zero job exit). Verified via a negative check (intentionally break one command, confirm the invoked command exits non-zero, then revert). [epics.md#Story 1.3 AC3 + Test Scenarios "Negative check"]
6. **Pinned + reproducible.** All actions are version-pinned (`actions/checkout`, `actions/setup-python`, `actions/setup-node`, `actions/upload-artifact`), the Python setup uses **3.12** and Node setup uses **22** to match the repo pins (`.nvmrc`, `backend/.python-version`, `requires-python`), and the workflow YAML is well-formed. The pipeline is green on the Story 1.1/1.2 scaffold (placeholder + health tests pass). [epics.md#Story 1.3 Test Scenarios "Pipeline smoke"; CLAUDE.md runtime pins; .nvmrc; backend pyproject `requires-python`]

## Tasks / Subtasks

- [x] **Task 1 — Author `.github/workflows/ci.yml` (AC: 1, 6)**
  - [x] `name: CI`; triggers `on: [push, pull_request]` (push on all branches). Add a `concurrency` group keyed on the ref with `cancel-in-progress: true` (cheap, boring guard against redundant runs).
  - [x] Pin every action to a major tag: `actions/checkout@v4`, `actions/setup-python@v5`, `actions/setup-node@v4`, `actions/upload-artifact@v4`.
- [x] **Task 2 — `backend` job (AC: 1, 2, 4, 6)**
  - [x] `runs-on: ubuntu-latest`. Add a `services.postgres` = `postgres:17` with `POSTGRES_USER/PASSWORD/DB = todo/todo/todo`, `ports: 5432:5432`, and `options` health-check `pg_isready -U todo -d todo` (interval/timeout/retries) so the job waits for a healthy DB.
  - [x] Job `env`: `TEST_DATABASE_URL: postgresql+psycopg://todo:todo@localhost:5432/todo` and `DATABASE_URL` same (the alembic migration integration test reads `DATABASE_URL`). This matches the 1.2 conftest `TEST_DATABASE_URL` contract (defaults to :5433 locally; CI overrides to the service on :5432).
  - [x] Steps: `checkout` → `setup-python` (`python-version: '3.12'`) → `make install-backend` → `make lint-backend` (ruff) → `make coverage-backend` (pytest unit+integration with branch coverage; report-only) → upload `backend/coverage.xml` as an artifact (`if: always()`).
  - [x] Do NOT run the Playwright/e2e smoke here — 1.3 scope is unit + integration only; full compose E2E is Epic 6.
- [x] **Task 3 — `frontend` job (AC: 1, 4, 6)**
  - [x] `runs-on: ubuntu-latest`. Steps: `checkout` → `setup-node` (`node-version: '22'`, `cache: npm`, `cache-dependency-path: frontend/package-lock.json`) → `make install-frontend` → `make lint-frontend` (eslint + `tsc --noEmit`) → `make coverage-frontend` (Vitest v8 branch coverage; report-only) → upload `frontend/coverage` as an artifact (`if: always()`).
- [x] **Task 4 — `build-images` job, build-only + guarded (AC: 3)**
  - [x] `runs-on: ubuntu-latest`, `needs: [backend, frontend]` (only build after quality gates pass). `checkout`, then a step per image that runs `docker build` **iff** the Dockerfile exists, else emits a GitHub `::notice::` explaining the Dockerfile arrives in Epic 5 and skips. This satisfies the "build both images (build only)" AC while keeping the pipeline green now (test scenario: green on the 1.1/1.2 scaffold).
- [x] **Task 5 — Make coverage artifact reproducible (AC: 4)**
  - [x] Add `--cov-report=xml` to the `coverage-backend` Makefile target (alongside the existing `term-missing`) so both local runs and CI emit `backend/coverage.xml` — single source of truth, no logic duplicated in the workflow. Frontend already emits `frontend/coverage` (html) via the pinned vitest reporter. Confirm `coverage.xml` is git-ignored (the root `.gitignore` already ignores `coverage.xml`).
- [x] **Task 6 — Local validation (AC: 1, 2, 4, 5, 6)**
  - [x] Parse `ci.yml` to confirm it is well-formed YAML.
  - [x] Run the exact commands the workflow invokes, the same way it invokes them, with the pinned toolchain: `make lint-backend`, `make lint-frontend`, `make coverage-frontend`, and `make coverage-backend` against a real `postgres:17` (start a standalone container mapped to the CI DSN — `todo/todo/todo` on localhost:5432 — set `TEST_DATABASE_URL`/`DATABASE_URL`, run, then tear the container down). Record real pass/fail + coverage numbers.
  - [x] Negative check: temporarily break one invoked command (e.g. inject a lint error) and confirm the command exits non-zero (proving the job would fail), then revert. Verified once, not committed.
  - [x] Exercise the Dockerfile-existence guard locally (no Dockerfiles present ⇒ the step prints the skip notice and exits 0).
  - [x] NOTE the environment reality: this repo is **not** a git repo and has no GitHub remote, so the workflow cannot actually execute on GitHub here. Validation is limited to YAML well-formedness, action/version correctness, and that every invoked command passes locally exactly as CI would run it. Do NOT claim a GitHub run passed.
- [x] **Task 7 — AI-integration log (standing convention SM-9)**
  - [x] Append a concise, honest Story 1.3 entry to `docs/AI-INTEGRATION-LOG.md` (agent/tooling usage, prompts, any AI-debugging cases, limitations/human-owned calls).

### Review Findings

- [x] [Review][Patch] Least-privilege `GITHUB_TOKEN` — added workflow-level `permissions: contents: read` [.github/workflows/ci.yml] — FIXED. Default token grants broad scopes; this pipeline only reads the repo (lint/test/coverage/build-only), so a read-only token is the correct least-privilege default. Zero behavior change. YAML re-validated.
- [x] [Review][Defer] AC3 image build currently *skips* (Dockerfiles are an Epic-5 deliverable) [.github/workflows/ci.yml `build-images`] — deferred, by-design. The step is authored and guarded on Dockerfile existence; it activates automatically in Epic 5. A hard `docker build` today would red the pipeline and contradict the "green on the 1.1/1.2 scaffold" test scenario and the sprint-status sequencing note. Consistent with this story's AC3 text.
- [x] [Review][Defer] `make install-frontend` uses `npm install` rather than `npm ci` [Makefile / .github/workflows/ci.yml] — deferred, non-blocking. AC1 mandates calling the wired CI-agnostic scripts with no logic duplicated in the workflow; switching to `npm ci` would either fork CI-only install logic or change local-dev behavior. Reproducibility hardening belongs with the Epic-6 CI/quality pass; the committed `package-lock.json` + setup-node npm cache already give good determinism.
- [x] [Review][Defer] `push` + `pull_request` triggers double-run a branch that also has an open PR [.github/workflows/ci.yml] — deferred, cosmetic. Standard GitHub Actions trade-off; `concurrency` with `cancel-in-progress` already trims redundant runs. Not worth trigger gymnastics at this stage.

## Dev Notes

### Architecture patterns & constraints (FOLLOW EXACTLY)

- **CI provider = GitHub Actions**, running **lint, test, coverage, build**; commands stay wired CI-agnostically (package scripts + root Makefile) and the workflow *calls those* — no logic duplicated inline. [Source: spine §Deferred "CI provider & pipeline — RESOLVED (human): GitHub Actions"; spine Testing Architecture §Wiring]
- **Integration-DB mechanism = transactional-rollback fixtures against a `test`-profile Postgres** (testcontainers NOT used). CI supplies that Postgres as a service container. [Source: spine §Deferred "Integration-test DB mechanism — RESOLVED"; 1.2 `backend/tests/integration/conftest.py`]
- **Postgres 17** is the pinned DB version. Use `postgres:17` for the service container. [Source: spine Tech-stack table "PostgreSQL | 17"; deployment topology "db - postgres:17"]
- **Coverage = pytest-cov (backend) + Vitest v8 (frontend), branch coverage, meaningful-coverage exclusions, report-only until Story 6.2.** The exclusion policy (generated code, config, Alembic migrations, three.js visual tuning) is already encoded in `backend/pyproject.toml` `[tool.coverage.*]` and `frontend/vitest.config.ts`. Do NOT add a failing threshold here. [Source: spine Testing Architecture §Coverage; epics.md#Story 1.3 AC2; backend/pyproject.toml; frontend/vitest.config.ts; sprint-status.yaml note]
- **Docker images are build-only in CI at this stage; full compose E2E is Epic 6.** Multi-stage Dockerfiles (frontend: node build → nginx; backend: deps → slim, non-root) are delivered in **Epic 5** — they do not exist yet, so the build step must be authored-and-guarded, not hard-failing. [Source: spine Deployment topology; epics.md#Story 1.3 AC1 + Story 5.1/5.2; sprint-status dependency note]
- **Runtime pins:** Node **22** (`.nvmrc` = `22`, `engines.node ">=22 <23"`), Python **3.12** (`backend/.python-version`, `requires-python ">=3.12,<3.13"`). The workflow must set up exactly these. [Source: .nvmrc; frontend/package.json engines; backend/pyproject.toml requires-python; CLAUDE.md]

### Source tree components to touch

```text
.github/workflows/ci.yml   # NEW — the CI pipeline (backend / frontend / build-images jobs)
Makefile                   # UPDATE — add --cov-report=xml to coverage-backend (reproducible artifact; no logic duplicated in CI)
docs/AI-INTEGRATION-LOG.md # UPDATE — append Story 1.3 entry (standing convention)
```

No application/source code changes. This story only adds CI orchestration over the existing, already-passing Story 1.1/1.2 commands.

### Existing code state (READ before editing)

- **Root `Makefile`** already exposes the CI-agnostic targets the workflow calls: `install-backend`, `install-frontend`, `lint-backend` (`ruff check .`), `lint-frontend` (`eslint . && tsc --noEmit` via `npm run lint`), `coverage-backend` (`pytest --cov=app --cov-report=term-missing`), `coverage-frontend` (`npm run coverage`). `install-backend` creates `backend/.venv` from inside `backend/` (so pyenv/`python3` resolves 3.12); on the CI runner `setup-python@v5` supplies `python3` = 3.12, so the same target works. The `ci` aggregate target *also* includes `smoke` (Playwright) — the workflow must **not** call `make ci`; it calls the granular lint/coverage targets so the e2e smoke stays out of 1.3 scope. [Source: Makefile]
- **`backend/tests/integration/conftest.py`** reads `TEST_DATABASE_URL` (default `postgresql+psycopg://todo:todo@localhost:5433/todo`) and, via a `pytest_collection_modifyitems` hook, **skips the whole integration suite** if no DB is reachable (honest gating, never a faked pass). In CI we set `TEST_DATABASE_URL` to the service DSN on **:5432** so integration tests actually run. [Source: 1.2 conftest.py]
- **`backend/tests/integration/test_migrations.py`** shells out to `alembic upgrade head`/`current`/`downgrade base` with `env DATABASE_URL=TEST_DATABASE_URL`. It relies on `TEST_DATABASE_URL` being importable from conftest; setting the CI env var is sufficient. [Source: 1.2 test_migrations.py]
- **Coverage config is report-only:** `backend/pyproject.toml` has `[tool.coverage.run] branch = true`, `source = ["app"]`, omits `migrations/*`, `app/core/config.py`, `__init__.py`; `[tool.coverage.report]` has meaningful `exclude_lines`. `frontend/vitest.config.ts` uses the v8 provider, `all: true`, and excludes `src/main.tsx`, `src/types.ts`, tests, `src/test-setup.ts`, and `src/backdrop/**` (three.js tuning, added Epic 4). Neither sets a fail-under. Keep it that way. [Source: backend/pyproject.toml; frontend/vitest.config.ts]
- **No `.github/` directory exists yet.** No Dockerfiles exist yet (Epic 5). Docker IS available in this environment for local mirroring of the Postgres service. [Verified]
- **`.gitignore`** already ignores `coverage.xml`, `frontend/coverage/`, `.venv/`, `node_modules/` — the new coverage artifact won't be accidentally committed. [Source: .gitignore]

### CI DB provisioning — CI vs. local mirror

- **In CI (authored):** a `services.postgres` container `postgres:17` with `pg_isready` health gating; GitHub maps it to `localhost:5432` on the job host. Job `env` sets `TEST_DATABASE_URL`/`DATABASE_URL` to `postgresql+psycopg://todo:todo@localhost:5432/todo`.
- **Local validation mirror:** this repo has no VCS/remote, so the workflow can't run on GitHub. Mirror the service locally with a standalone container, then tear it down:
  ```
  docker run -d --name todo-ci-pg -e POSTGRES_USER=todo -e POSTGRES_PASSWORD=todo \
    -e POSTGRES_DB=todo -p 5432:5432 postgres:17
  # wait for pg_isready, then:
  TEST_DATABASE_URL=postgresql+psycopg://todo:todo@localhost:5432/todo \
  DATABASE_URL=postgresql+psycopg://todo:todo@localhost:5432/todo make coverage-backend
  docker rm -f todo-ci-pg
  ```
  (If host :5432 is occupied, the 1.2 test container may be on :5433 — pick a free port and set the DSN to match. Always tear down after.)

### Testing standards

- **This is a CI-orchestration story** — the "tests" are (a) the existing unit+integration+frontend suites passing when invoked exactly as the workflow invokes them, and (b) the workflow YAML being well-formed with correct action/version references. There is no new application code to unit-test.
- Run with the pinned toolchain only: backend `backend/.venv/bin/python` (Python **3.12.13**, pyenv), Node **22** via nvm. Do NOT use system python3 (3.9). Report real pass/fail + coverage numbers.
- **Honest reporting:** explicitly state the workflow was NOT executed on GitHub (no git repo / no remote in this environment) and that validation covered YAML validity, version pins, and local execution of every invoked command. Never claim a GitHub run.
- **AI-integration log:** append a Story 1.3 entry to `docs/AI-INTEGRATION-LOG.md`.

### Project Structure Notes

- The workflow lives at `.github/workflows/ci.yml` (GitHub's required path). It orchestrates only; all real logic stays in the Makefile/package scripts, honoring the spine's "commands stay wired CI-agnostically … the workflow calls those."
- The three CI jobs (`backend`, `frontend`, `build-images`) map cleanly to the spine's lint/test/coverage/build stages. E2E is intentionally absent (Epic 6). The image build is guarded because its inputs (Dockerfiles) are Epic-5 deliverables — a deliberate, documented forward-compat seam, not scope creep.
- Coverage stays report-only: a deliberate forward reference to Story 6.2 (gate flips to enforcing) that does not block 1.3.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: GitHub Actions CI pipeline] — ACs (lint/test/coverage/build; Postgres service; coverage report-only w/ meaningful-coverage config; fail-blocks-merge), Test Scenarios (pipeline smoke green on 1.1/1.2, negative check, coverage artifacts), Traceability (NFR-Quality, NFR-Deploy; SM-5/6/7).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md] — §Deferred (CI provider = GitHub Actions; integration-DB = transactional-rollback fixtures), Testing Architecture (unit/integration/coverage/wiring), Tech-stack (Postgres 17, Node 22, Python 3.12), Deployment topology (multi-stage Dockerfiles — Epic 5).
- [Source: _bmad-output/implementation-artifacts/1-2-...md] — transactional-rollback fixture + `TEST_DATABASE_URL` contract, coverage-is-report-only policy, standalone test Postgres pattern, runtime pins.
- [Source: Makefile] — CI-agnostic targets the workflow calls (install/lint/coverage) and the `ci` aggregate (includes `smoke` — excluded from 1.3).
- [Source: backend/pyproject.toml; frontend/vitest.config.ts] — coverage (branch + meaningful-coverage exclusions, report-only).
- [Source: .nvmrc; backend/.python-version; frontend/package.json engines] — Node 22 / Python 3.12 pins.
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml] — "Story 1.3 wires the coverage gate report-only; Story 6.2 flips it to enforcing"; dependency notes.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `claude-opus-4-8[1m]`

### Debug Log References

- Runtime pins honored: backend `backend/.venv` Python **3.12.13** (pyenv), Node **22.23.1** (nvm via `.nvmrc`). System python3 (3.9) NOT used. The `_bmad` customization resolver requires 3.11+ (tomllib); ran it with the venv interpreter as the documented fallback (resolved empty override blocks for both create-story and dev-story).
- **YAML validation:** the backend venv has no PyYAML (`ModuleNotFoundError: No module named 'yaml'`). Rather than install an unpinned dep, validated `ci.yml` with the system Ruby's built-in `yaml` — parses cleanly; jobs = `backend`, `frontend`, `build-images`; triggers = `push`, `pull_request`. (Note the YAML 1.1 `on:`→boolean-`true` quirk in generic parsers; GitHub's own parser treats `on` as the trigger key — standard and correct.)
- **Local CI mirror:** started a standalone `postgres:17` container (`todo-ci-pg`) mapped to host **:5432** (the exact CI service DSN), waited for `pg_isready`, ran the backend job commands with `TEST_DATABASE_URL`/`DATABASE_URL=postgresql+psycopg://todo:todo@localhost:5432/todo`, then removed the container. No Epic-5 compose stack used.
- **Negative check (AC5):** injected an unused-import lint violation into a throwaway `backend/app/_ci_negcheck.py`; `make lint-backend` failed with `make: *** [lint-backend] Error 1` (non-zero) — proving a lint failure reds the job. Removed the file; lint returns clean ("All checks passed!"). Not committed.
- **Build-images guard:** with no Dockerfiles present, both build steps emit a GitHub `::notice::` and exit 0 — pipeline stays green now, activates automatically when Epic 5 adds the Dockerfiles.
- **Environment reality:** this repo is NOT a git repo and has no GitHub remote, so `ci.yml` was NOT executed on GitHub. Validation was limited to (a) YAML well-formedness, (b) pinned action/version correctness, and (c) running every command the workflow invokes locally, exactly as CI runs it. No claim is made that the pipeline "passed on GitHub".

### Completion Notes List

- **Workflow** (`.github/workflows/ci.yml`): three jobs, all invoking the CI-agnostic Makefile targets (no lint/test logic duplicated in YAML). Triggers `push` (all branches) + `pull_request`; `concurrency` cancels superseded runs. Actions pinned: `actions/checkout@v4`, `actions/setup-python@v5`, `actions/setup-node@v4`, `actions/upload-artifact@v4`.
  - `backend`: `postgres:17` service container (`todo/todo/todo`, `pg_isready` health gate, `:5432`); job env sets `TEST_DATABASE_URL`/`DATABASE_URL` to the service; steps = checkout → setup-python 3.12 → `make install-backend` → `make lint-backend` → `make coverage-backend` → upload `backend/coverage.xml` (`if: always()`).
  - `frontend`: setup-node 22 (npm cache on `frontend/package-lock.json`); steps = `make install-frontend` → `make lint-frontend` → `make coverage-frontend` → upload `frontend/coverage` (`if: always()`).
  - `build-images` (`needs: [backend, frontend]`): build-only, each image guarded on Dockerfile existence (skips with a `::notice::` until Epic 5).
- **Makefile:** added `--cov-report=xml` to `coverage-backend` so both local runs and CI emit `backend/coverage.xml` (single source of truth; the workflow just uploads it). `coverage.xml` is already git-ignored.
- **Scope adherence:** the workflow does NOT run `make ci` (which includes the Playwright `smoke`) — it calls the granular lint/coverage targets so the e2e/compose suite stays deferred to Epic 6. Coverage is report-only (no `--cov-fail-under`); the ≥70% gate config lives in `pyproject.toml`/`vitest.config.ts` and flips to enforcing in Story 6.2.
- **Local validation results (real):**
  - `make lint-backend` → ruff "All checks passed!" (exit 0).
  - `make coverage-backend` (against real Postgres 17) → **11 passed** (2 integration + 1 alembic upgrade/downgrade cycle actually ran, not skipped), branch coverage **94%** (report-only); `backend/coverage.xml` produced.
  - `make lint-frontend` → eslint + `tsc --noEmit` clean (exit 0).
  - `make coverage-frontend` → **1 passed**, coverage **100%** (trivial placeholder `App`), `frontend/coverage/` html produced.
  - YAML well-formed; build-guard skips cleanly; negative check fails as expected.
- **Not done here (by design):** Dockerfiles (Epic 5) so the image build is dormant; enforcing coverage gate (Story 6.2); compose-backed E2E/a11y (Epic 6); actual GitHub execution (no VCS/remote in this environment).

### File List

**CI (new)**
- `.github/workflows/ci.yml`

**Modified**
- `Makefile` (added `--cov-report=xml` to the `coverage-backend` target)
- `docs/AI-INTEGRATION-LOG.md` (appended Story 1.3 entries across sections 1–5)

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-23 | Story 1.3 created (context engine): GitHub Actions CI pipeline — lint + unit/integration + frontend + coverage (report-only) via the CI-agnostic Makefile targets, `postgres:17` service for integration tests, guarded build-only Docker step (Dockerfiles land in Epic 5). Status → ready-for-dev. |
| 2026-07-23 | Story 1.3 implemented: authored `.github/workflows/ci.yml` (backend/frontend/build-images jobs; push+PR triggers; `postgres:17` service; pinned checkout@v4/setup-python@v5/setup-node@v4/upload-artifact@v4; Python 3.12 / Node 22). Added `--cov-report=xml` to `coverage-backend`. Validated locally against a real Postgres 17 mirror (then torn down): backend 11 passed / 94% branch coverage; frontend 1 passed / 100%; lint clean both sides; YAML well-formed; build-guard + negative check verified. Not executed on GitHub (no VCS/remote here). Appended AI-integration log. Status → review. |
| 2026-07-23 | Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor): Approved. All 6 ACs verified satisfied. 1 Low patch applied (workflow-level least-privilege `permissions: contents: read`; YAML re-validated); 3 Low findings deferred as by-design/non-blocking (guarded Epic-5 image build, `npm install` vs `npm ci`, push+PR double-run). No High/Medium findings. Status → done. |

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.8 (1M context), acting across three adversarial layers (Blind Hunter / Edge Case Hunter / Acceptance Auditor).
**Date:** 2026-07-23
**Review mode:** full (spec = this story file). No VCS in this repo, so the review target was the full contents of every file in the File List (`.github/workflows/ci.yml`, the `Makefile` change, the AI-log append).
**Outcome:** **Approve.** All six acceptance criteria are satisfied and independently verified by running every command the workflow invokes, locally, exactly as CI would (backend 11 passed at 94% branch coverage against a real Postgres 17 service mirror — integration + alembic-cycle tests actually ran, not skipped; frontend 1 passed at 100%; lint clean; YAML well-formed; negative check fails the job as required; build-guard skips cleanly). One low-severity security hardening was applied during review; no blocking or medium-severity issues.

**Acceptance audit (all satisfied):** AC1 lint + backend unit/integration + frontend unit + coverage via the CI-agnostic Makefile targets, no logic duplicated in YAML; AC2 `postgres:17` service container with `pg_isready` gate + `TEST_DATABASE_URL`/`DATABASE_URL` wired so integration tests run against a real DB; AC3 build-only Docker step authored and guarded (activates in Epic 5 when the Dockerfiles land) — keeps the pipeline green on the 1.1/1.2 scaffold; AC4 pytest-cov + Vitest v8 branch coverage with the meaningful-coverage exclusions, report-only (no fail-under), coverage artifacts uploaded; AC5 lint/test failure exits non-zero and fails the job (negative check verified); AC6 all actions pinned, Python 3.12 / Node 22 to match repo pins, YAML well-formed, green on scaffold.

**Environment note (expected, not a defect):** this repo is not a git repository and has no GitHub remote, so `ci.yml` was NOT executed on GitHub. Review confidence rests on YAML validity, pinned action/version correctness, and local execution of every invoked command under the same conditions CI uses. No claim is made that the pipeline ran on GitHub.

### Review Findings

- [x] [Patch][Low] Added workflow-level `permissions: contents: read` — least-privilege `GITHUB_TOKEN` for a read-only build/test pipeline. Applied and re-validated.
- [x] [Defer][Low] Guarded image build currently skips (Dockerfiles = Epic 5) — by-design; required to keep the pipeline green now.
- [x] [Defer][Low] `npm install` vs `npm ci` — deferred to Epic-6 CI hardening; AC mandates calling the wired scripts without duplicating logic.
- [x] [Defer][Low] `push` + `pull_request` double-run — cosmetic; `concurrency`/`cancel-in-progress` mitigates.
- Dismissed (noise): theoretical service-container reachability and coverage-artifact-missing concerns — both verified fine locally (`if: always()` + `if-no-files-found: warn`; pytest-cov writes `coverage.xml` alongside the run).

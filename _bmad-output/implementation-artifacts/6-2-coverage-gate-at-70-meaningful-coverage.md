---
baseline_commit: 99c1e01ba50f793c082c347023aba0009b705c8e
---

# Story 6.2: Coverage gate at ≥ 70% meaningful coverage

Status: review

## Story

As a QA stakeholder,
I want backend and frontend coverage measured and **enforced** at ≥ 70% meaningful coverage in CI,
so that the test suite genuinely exercises the code and regressions are caught (SM-5, NFR-Quality).

## Acceptance Criteria

1. **Enforcing gate (backend + frontend):** pytest-cov (backend) and Vitest v8 coverage (frontend) each report coverage AND fail the run when meaningful coverage drops below 70%. The CI pipeline consequently fails on a below-threshold drop (was report-only in Story 1.3).
2. **Meaningful-coverage definition applied (Open Question #4):** the ≥ 70% target is measured as **branch** coverage of real application logic — API handlers, validation, the repository layer, and the frontend optimistic-update / undo logic — **excluding** generated code, config, Alembic migrations, and three.js visual tuning (`scene.ts` and backdrop visual tuning only; the `degradation.ts` DECISION logic is NOT excluded). Trivial-assertion padding does not count toward the bar.
3. **Gaps closed with meaningful tests:** where a genuinely-meaningful module falls below the bar, real tests (not assertion-free filler) are added across services/validation, hooks (optimistic/rollback/reconcile), components, and backdrop fallback selection. Exclusions are NOT widened to game the number.
4. **CI flip:** the report-only coverage steps from Story 1.3 (`.github/workflows/ci.yml`, `Makefile`) are flipped to enforcing.
5. **Negative check:** a simulated drop below 70% is verified to fail the pipeline; at/above 70% passes.

## Tasks / Subtasks

- [x] Backend gate (AC: 1, 2, 4)
  - [x] Add `--cov-branch` and `--cov-fail-under=70` to the enforcing backend coverage invocation (pyproject `fail_under=70` + Makefile `--cov-branch --cov-fail-under=70`).
  - [x] Confirm `omit`/`exclude_lines` match the agreed definition (migrations, config, `__init__`, defensive guards) — no real logic excluded.
- [x] Frontend gate (AC: 1, 2, 4)
  - [x] Add Vitest v8 `coverage.thresholds` with `branches: 70` (global), keeping `all: true`.
  - [x] Confirm `exclude` globs match the definition (entrypoint, type-only, tests, `scene.ts`) — `degradation.ts`/`Backdrop.tsx`/`BackdropBoundary.tsx` stay COVERED.
- [x] Close meaningful gaps (AC: 3)
  - [x] Lift `useClearCompleted.ts` (undo/rollback logic — explicitly in-scope) from 56.25% → 81.25% branch with real hook-level tests exercising the inert-clear and resume guard branches unreachable via the Footer UI.
- [x] CI + Makefile flip (AC: 4)
  - [x] Update `.github/workflows/ci.yml` step names/comments so the gate is enforcing (not report-only).
  - [x] Update `Makefile` coverage targets + comments.
- [x] Verify (AC: 1, 5)
  - [x] Run backend coverage against a real test Postgres (integration tests count) — 96.76% total, ~93.8% branch (30/32).
  - [x] Run frontend coverage — 85.35% branch (134/157).
  - [x] Negative check: threshold raised above current coverage → non-zero exit on both (backend fail_under=99 → exit 1; frontend branches=99 → exit 1); positive at 70 → exit 0.

## Dev Notes

### Current state of the coverage tooling (Story 1.3 wired it report-only)

- **`backend/pyproject.toml`** — `[tool.coverage.run]` already has `branch = true`, `source = ["app"]`, and `omit` for `migrations/*`, `app/core/config.py`, `app/**/__init__.py`. `[tool.coverage.report]` has `exclude_lines` (pragma, `__repr__`, `if TYPE_CHECKING:`, `raise NotImplementedError`, `__main__`). There is NO `fail_under` yet — that is the flip.
- **`frontend/vitest.config.ts`** — v8 provider, `all: true`, `include: ['src/**/*.{ts,tsx}']`, `exclude` lists `main.tsx`, `types.ts`, `*.d.ts`, tests, `test-setup.ts`, `test-utils.tsx`, `backdrop/scene.ts`. There is NO `thresholds` block yet — that is the flip.
- **`Makefile`** — `coverage-backend` runs `pytest --cov=app --cov-report=term-missing --cov-report=xml` (no `--cov-branch`, no fail-under). `coverage-frontend` runs `npm run coverage` (= `vitest run --coverage`). Comments say "report-only until Story 6.2".
- **`.github/workflows/ci.yml`** — backend/frontend jobs call `make coverage-backend` / `make coverage-frontend`; step names say "(report-only)". Backend job provides a Postgres 17 service and sets `TEST_DATABASE_URL`/`DATABASE_URL` to it so integration tests run and count.

### Meaningful-coverage definition (AUTHORITATIVE — epics.md Open Question #4, RESOLVED by human)

≥ 70% measured as **branch coverage of real application logic** — API handlers, validation, repository, frontend optimistic-update/undo logic — **EXCLUDING** generated code, config, Alembic migrations, and three.js visual tuning. Trivial-assertion padding does not count. `scene.ts` (WebGL render loop / cube density / DPR caps — jsdom cannot exercise) is excluded; `degradation.ts` (the pure fallback-ladder DECISION logic) is NOT excluded and is unit-tested (Story 4.2).

### Baseline numbers (measured this story, before any additions)

- Backend: 87 tests pass against a real Postgres 17; TOTAL 97% (branch 30/32 taken → ~93.8% branch). Comfortably ≥ 70%.
- Frontend: 114 tests pass; overall branch 82.8%. Comfortably ≥ 70% globally, BUT `src/hooks/useClearCompleted.ts` is 56.25% branch — a genuinely-meaningful undo/rollback module explicitly named in the definition. Add real tests there (AC 3) rather than relying only on the global average.

### Implementation guidance

- Prefer configuring the gate in the config files (`pyproject.toml` `fail_under`, `vitest.config.ts` `thresholds`) so any invocation enforces it, then keep the Makefile/CI flags consistent. `--cov-fail-under=70` on the backend measures the combined line+branch TOTAL; with branch enabled that reflects branch behavior. Set `[tool.coverage.report] fail_under = 70` too for belt-and-suspenders.
- Frontend `thresholds: { branches: 70 }` (global) is the gate that matches "branch coverage". Do not set per-file thresholds that would force padding of excluded-in-spirit files.
- Do NOT add trivial assertions or widen exclusions to pass. If a module can't clear the bar with meaningful tests, report it honestly.

### Testing standards

- Backend: pytest; integration tests use transactional-rollback fixtures against a real Postgres (conftest skips honestly if no DB). Run with `TEST_DATABASE_URL`/`DATABASE_URL` pointed at a throwaway PG on a spare port (NOT 8080/5433).
- Frontend: Vitest + Testing Library + jsdom; fake timers for the undo window (`CLEAR_UNDO_MS = 6000`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2: Coverage gate at ≥ 70% meaningful coverage]
- [Source: _bmad-output/planning-artifacts/epics.md#Open Questions — resolved #4]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2 traceability — NFR-Quality; SM-5]
- [Source: backend/pyproject.toml#[tool.coverage]]
- [Source: frontend/vitest.config.ts#coverage]
- [Source: Makefile#coverage targets]
- [Source: .github/workflows/ci.yml#backend/frontend coverage steps]

### Project Structure Notes

- Shared files touched (merge-sensitive across sibling worktrees): `backend/pyproject.toml`, `frontend/vitest.config.ts`, `.github/workflows/ci.yml`, `Makefile`.
- Story 1.3 deliberately deferred the enforcing flip to this story to avoid a red pipeline through early feature stories.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

- Backend coverage run against a throwaway Postgres 17 (`docker run … -p 5455:5432 postgres:17`, migrated via `alembic upgrade head` by the session fixture, torn down after). NON-8080 / NON-5433 port to avoid the human's running stack.
- Isolated `useClearCompleted.ts` measurement before/after: 56.25% → 81.25% branch.

### Completion Notes List

- Flipped the coverage gate from report-only (Story 1.3) to ENFORCING at ≥70% branch on the meaningful set, backend and frontend.
- Backend: added `fail_under = 70` + `precision = 2` to `[tool.coverage.report]`; Makefile `coverage-backend` now runs `--cov-branch --cov-fail-under=70`. Exclusions unchanged and confirmed correct (Alembic `migrations/*`, `app/core/config.py`, `__init__` markers; `exclude_lines` for pragmas / `__repr__` / `TYPE_CHECKING` / `NotImplementedError` / `__main__`). No real logic excluded.
- Frontend: added `coverage.thresholds.branches = 70` to `vitest.config.ts`, keeping `all: true`. Exclusions unchanged and confirmed correct: only `backdrop/scene.ts` (WebGL render loop / DPR caps — visual tuning) excluded; `degradation.ts` decision logic, `Backdrop.tsx`, `BackdropBoundary.tsx` remain COVERED.
- Closed the one genuinely-meaningful gap: `useClearCompleted.ts` (deferred-clear undo/rollback, AD-7) was 56.25% branch because the Footer only renders the Clear button when completedCount > 0, leaving the hook's inert-guard and resume-guard branches UI-unreachable. Added 4 hook-level tests (`renderHook`) proving the guard contract: `clear()` is inert with an empty cache and with zero completed; `resumeTimer()` is a no-op with no open window and after `undo()`. These are real decision-branch tests, not assertion-free padding. Remaining uncovered branches (defensive `if preClearListRef.current` false-paths and the double-commit guard) are unreachable defensive nulls — left honest rather than gamed.
- ACTUAL numbers (real runs, integration tests counted): backend 96.76% total / ~93.8% branch (30/32); frontend 85.35% branch (134/157). Both ≥70%.
- Negative check confirmed the gate FAILS below threshold (backend exit 1 at fail_under=99; frontend exit 1 at branches=99) and PASSES at 70 (both exit 0).
- Full suites green: backend 87 passed, frontend 118 passed (114 pre-existing + 4 new). Backend ruff + frontend eslint/tsc clean.
- CI (`.github/workflows/ci.yml`) header + both coverage step names updated from "(report-only)" to "(gate >=70%)"; the enforcement itself is carried by the Makefile targets CI invokes.

### File List

- `backend/pyproject.toml` (modified — `[tool.coverage]` enforcing gate; SHARED)
- `frontend/vitest.config.ts` (modified — v8 branch threshold; SHARED)
- `Makefile` (modified — coverage targets flipped to enforcing; SHARED)
- `.github/workflows/ci.yml` (modified — step names/comments flipped to enforcing; SHARED)
- `frontend/src/hooks/useClearCompleted.test.tsx` (modified — +4 hook-level guard tests)
- `_bmad-output/implementation-artifacts/6-2-coverage-gate-at-70-meaningful-coverage.md` (new — story file)

## Change Log

| Date       | Change                                                                 |
|------------|------------------------------------------------------------------------|
| 2026-07-23 | Story 6.2 implemented: flipped coverage gate to enforcing ≥70% branch (backend + frontend), applied meaningful-coverage exclusions, lifted `useClearCompleted` branch coverage 56%→81%. Backend 96.76% total / ~93.8% branch; frontend 85.35% branch. Negative check verified. Status → review. |

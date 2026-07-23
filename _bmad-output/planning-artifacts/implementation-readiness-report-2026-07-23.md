---
stepsCompleted: [step-01-document-discovery, step-02-prd-analysis, step-03-epic-coverage-validation, step-04-ux-alignment, step-05-epic-quality-review, step-06-final-assessment]
project: nearform_todo_app
assessor: John (PM) — bmad-check-implementation-readiness (autonomous run)
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-nearform_todo_app-2026-07-23/prd.md
  - _bmad-output/planning-artifacts/prds/prd-nearform_todo_app-2026-07-23/addendum.md
  - _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/EXPERIENCE.md
  - _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-23
**Project:** nearform_todo_app (product name: **Orbit**)
**Assessor:** John (Product Manager) — Implementation Readiness workflow, autonomous run

---

## Document Inventory

All required planning artifacts were found exactly once each in canonical form. **No duplicates** (no competing whole + sharded versions) and **no missing required documents**.

| Type | File | Status |
| --- | --- | --- |
| PRD | `prds/prd-nearform_todo_app-2026-07-23/prd.md` + `addendum.md` | Found (final) |
| UX | `ux-designs/ux-nearform_todo_app-2026-07-23/DESIGN.md` + `EXPERIENCE.md` | Found (final) |
| Architecture | `architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md` | Found (final) |
| Epics & Stories | `epics.md` | Found (final, human-approved) |
| Supporting | `briefs/brief-…/brief.md` + `addendum.md`; architecture `reviews/` | Found (context) |

The UX `imports/` folder is empty and the mocks under `.working/` are explicitly illustrative-only (both spines win on conflict). No unresolved discovery issues.

> **Autonomous-run note:** Step 1 and Step 6 of the skill define interactive `[C] Continue` gates. No duplicates or missing docs were found, so the Step 1 gate was passed with the obvious default (proceed). The Step 6 completion gate was likewise auto-satisfied. No decision required user input.

---

## PRD Analysis

### Functional Requirements (9)

- **FR-1 Create a Todo** — non-empty, trimmed, single-line Description (≤ 500 chars); new active Todo persisted with server-set `created_at`, appears at top without full reload; empty/whitespace/over-length rejected both sides.
- **FR-2 Toggle completion status** — active↔completed both directions; persisted; optimistic then reconciled; completed rendered visually distinct at AA contrast.
- **FR-3 Delete a Todo** — permanent delete from List + persistence without full reload; no undo; already-gone deletes fail gracefully and reconcile.
- **FR-4 View the List on open** — fetch + render persisted List on open, no auth/onboarding/manual load; loading + error states as appropriate.
- **FR-5 List ordering** — deterministic `created_at` DESC, `id` tiebreak; toggling never reorders/removes (completed stay in place, restyled).
- **FR-6 Empty and loading states** — friendly empty state; loading indication always resolving to loaded/empty/error (no hanging spinner).
- **FR-7 Error states / graceful failure** — clear non-modal client + server errors; failed load retryable; failed mutations roll back + reconcile; client validation inline, never reaches server.
- **FR-8 Animated backdrop + mandatory reduced-motion / static fallback** — three.js cube-star backdrop by default; static fallback under `prefers-reduced-motion` / no-WebGL; core loop usable regardless; zero critical WCAG AA with backdrop active; within perf budget.
- **FR-9 Clear completed** — one bulk action removing all completed; active unaffected; reconciles; inert at zero; failure surfaces error; guarded by transient Undo affordance.

(Note: the PRD numbering intentionally skips "FR-8" placement — FRs are grouped by feature; FR-1..FR-9 are all present, FR-8 is the Backdrop.)

### Non-Functional Requirements (8)

NFR-Perf (~100ms optimistic / API p95 < 300ms / ~60fps backdrop step-down), NFR-A11y (zero critical WCAG 2.1 AA incl. backdrop, keyboard, contrast, reduced-motion), NFR-Resp (~320px→desktop, touch + keyboard, evergreen), NFR-Rel (durable volume-backed persistence, survives restart, no silent loss), NFR-Deploy (single `docker-compose up`, multi-stage non-root, per-service health, profiles), NFR-Quality (unit+integration+E2E, ≥70% meaningful coverage, ≥5 Playwright, contract validation, documented security + perf/a11y passes), NFR-Sec (server validation, parameterized queries, XSS-safe text render, no secrets/PII), NFR-Maint (simple; owner/auth seam left open without building it).

### Success Metrics

SM-1 (unaided task completion), SM-2 (perceived instantaneity), SM-3 (durability / zero data loss), SM-4 (zero critical WCAG AA), SM-5 (≥70% meaningful coverage), SM-6 (≥5 Playwright E2E), SM-7 (one-command deploy), SM-8 (accurate README), SM-9 (AI-integration log). Counter-metrics SM-C1 (don't grow feature surface), SM-C2 (don't enrich backdrop at cost of perf/a11y).

### PRD Completeness Assessment

The PRD is complete, internally consistent, and unusually disciplined: every FR has testable consequences; all seven Open Questions are RESOLVED or accepted-working-defaults; the assumptions index cleanly separates confirmed decisions from standing assumptions. Fixed stack and quality bars are carried explicitly. No ambiguity blocks planning.

---

## Epic Coverage Validation

### FR → Story Coverage Matrix

| FR | Requirement | Story coverage | Status |
| --- | --- | --- | --- |
| FR-1 | Create | 2.1 (`POST /api/todos` + validation + envelope) · 3.2 (AddInput optimistic create + client validation) · 6.1 (E2E create) | ✅ Covered |
| FR-2 | Toggle | 2.2 (`PATCH /api/todos/{id}`) · 3.3 (checkbox toggle-in-place both directions) · 6.1 (E2E complete/toggle-back) | ✅ Covered |
| FR-3 | Delete | 2.2 (`DELETE /api/todos/{id}`) · 3.3 (delete affordance) · 6.1 (E2E delete) | ✅ Covered |
| FR-4 | View on open | 1.2 (`GET /api/health` readiness) · 2.1 (`GET /api/todos`) · 3.1 (fetch + render on open, no auth) | ✅ Covered |
| FR-5 | Ordering | 2.1 (repo ordered query, `created_at` DESC + id tiebreak) · 3.1/3.3 (render newest-first, restyle in place) | ✅ Covered |
| FR-6 | Empty/loading | 3.1 (skeleton rows + empty state) | ✅ Covered |
| FR-7 | Error/graceful | 2.1 (server envelope + validation) · 3.1–3.4 (load/create/toggle/delete/clear rollback + inline errors) · 6.1 (E2E error path) | ✅ Covered |
| FR-8 | Backdrop + fallbacks | 4.1 (isolated three.js cube-star) · 4.2 (reduced-motion / no-WebGL / watchdog / visibility / error boundary) | ✅ Covered |
| FR-9 | Clear completed | 2.3 (`DELETE /api/todos/completed` + id snapshot) · 3.4 (footer + deferred bulk-delete + Undo toast) · 6.1 (E2E clear + undo) | ✅ Covered |

### API Contract → Story Coverage

| Endpoint | Story | Status |
| --- | --- | --- |
| `GET /api/health` | 1.2 (200 ok/db + 503 on DB-down, real round-trip) · 5.1 (backend healthcheck) | ✅ Exercised |
| `GET /api/todos` | 2.1 (ordered list) · 3.1 (client fetch) | ✅ Exercised |
| `POST /api/todos` | 2.1 (201 + 422 validation) · 3.2 (client create) | ✅ Exercised |
| `PATCH /api/todos/{id}` | 2.2 (200 + 404 + 422) · 3.3 (client toggle) | ✅ Exercised |
| `DELETE /api/todos/{id}` | 2.2 (204 + 404) · 3.3 (client delete) | ✅ Exercised |
| `DELETE /api/todos/completed` | 2.3 (200 + id-snapshot semantics; **registered before `/{id}`**, route-ordering test present) · 3.4 (client deferred commit) | ✅ Exercised |

**No phantom endpoints.** Every endpoint the stories call exists in the fixed contract; no story assumes an endpoint not in the contract. The AD-4 route-registration-ordering hazard (`/completed` vs `/{id}`) is explicitly implemented and tested in Story 2.3.

### Coverage Statistics

- Total PRD FRs: **9** — FRs covered in epics: **9** — **Coverage: 100%**
- API endpoints: **6/6** exercised
- No story introduces scope untraceable to PRD/UX/architecture (see Epic Quality Review for the one placeholder-page assumption, which is a scaffolding artifact, not product scope).

### Missing Requirements

**None.** No FR is left uncovered; no endpoint is unexercised.

---

## UX Alignment Assessment

### UX Document Status

**Found** — Orbit `DESIGN.md` (visual identity / tokens) + `EXPERIENCE.md` (behavior / states / a11y), both final. Encoded in epics as UX-DR1..UX-DR16.

### User Journey → Story Mapping

| UJ | Story coverage | Status |
| --- | --- | --- |
| UJ-1 (dump on laptop) | 3.1 (view on open) + 3.2 (create) | ✅ |
| UJ-2 (clear on phone) | 3.3 (toggle-in-place + delete) + 3.5 (touch/responsive) | ✅ |
| UJ-3 (empty/calm + reduced-motion) | 3.1 (empty/loading/error) + 4.2 (static backdrop fallback) | ✅ |
| UJ-4 (clear a day's finished tasks) | 3.4 (clear-completed + deferred bulk + Undo toast) | ✅ |

### Discrete UX Behaviors → Story Mapping

- **Empty / loading / error states** → Story 3.1 (skeleton rows, empty state, retryable load error), reinforced 3.2–3.4 (per-action inline errors + rollback). ✅
- **Clear-completed bulk-only Undo toast** → Story 3.4 + AD-7 deferred-commit; scoped strictly to bulk clear, single-item delete stays undo-less (matches EXPERIENCE Open Question #1 resolution). ✅
- **three.js backdrop + reduced-motion + no-WebGL fallbacks** → Story 4.1 (isolated layer, mounts after interactive, aria-hidden, own rAF loop) + Story 4.2 (reduced-motion static frame, no-WebGL gradient, frame-budget watchdog DPR→cube-count→static, visibility pause, error boundary). ✅
- **UX-DR1..UX-DR16** → all mapped (UX-DR1–2→3.1, 3→3.2, 4–6→3.3, 7–8→3.4, 9–11→3.1, 12→4.1/4.2, 13→3.1–3.4, 14–16→3.5/4.2). ✅

### UX ↔ Architecture Alignment

Architecture supports every UX behavior:
- Optimistic UI + rollback + reconcile → AD-6 (TanStack Query onMutate/onError/onSettled).
- Text-over-moving-stars readability → AD-8 + AD-5 (72% scrim panel; text-only render; no bright cube behind text).
- Deferred Undo commit → AD-7 (id-snapshot, one `DELETE /api/todos/completed` on dismiss, no server call on Undo, safe crash/refresh restore).
- Backdrop isolation / degradation → AD-8 (all fallbacks enumerated identically to EXPERIENCE).
- Newest-first, completed-in-place → AD-3.

The EXPERIENCE Open Question #3 (clear-completed commit model) was correctly **deferred to architecture and resolved there** as deferred-commit (AD-7); the epics implement deferred-commit consistently.

### Alignment Issues / Warnings

No blocking misalignments. One minor doc-hygiene item (stale alternative wording in EXPERIENCE State Patterns) is noted in Findings; it does not contradict the resolved AD-7 decision.

---

## Epic Quality Review

Reviewed against create-epics-and-stories best practices: user value, epic independence, no forward dependencies, story sizing, AC quality, table-creation timing, greenfield setup, traceability.

### Epic-level

- **User value:** Epics 2, 3, 4 are user-value epics. Epics 1 (Foundation & Test Harness) and 6 (QA/Docs sign-off) are enabling/hardening epics, and Epic 5 (Containerized Delivery) is a delivery epic. These are **legitimately** enabling rather than "technical milestone" anti-patterns: they are hard, explicit activity-spec deliverables (QA-from-day-one, one-command deploy, quality bars), and the human explicitly approved this six-epic structure (epics.md Open Questions #1, RESOLVED). Not flagged as a violation.
- **Epic independence / no backward-breaking dependency:** Ordering is Epic 1 → 2 → 3 → 4 → 5 → 6. Each epic consumes only prior-epic outputs. No epic requires a later epic to function. ✅
- **Greenfield setup:** Story 1.1 stands up the repo skeleton + tooling; 1.2 the app factory/health/DB/Alembic baseline; 1.3 CI. Correct greenfield front-loading. There is no external "starter template" in the architecture, so the "Epic 1 Story 1 = clone starter" rule does not apply; scaffolding-from-scratch is the right substitute. ✅

### Story-level

- **Table-creation timing:** The `todos` migration lands in **Story 2.1** (first story needing it), not up-front in Epic 1 — Epic 1 ships only the Alembic baseline. This is exactly the "create tables when first needed" best practice. ✅
- **Within-epic dependencies:** Story N.M depends only on prior stories. Story 3.5 (cross-cutting a11y/responsive) correctly sits after 3.1–3.4 build the components it hardens. ✅
- **Acceptance criteria:** Given/When/Then BDD structure throughout; ACs are specific, testable, and include error/edge paths (invalid input, 404 already-gone, bulk failure, crash-during-undo-window, no-WebGL, reduced-motion). Each story carries explicit unit/integration/E2E test scenarios. Strong. ✅
- **Traceability:** Every story cites FR/AD/UX-DR/UJ/NFR/SM ids. ✅

### One acknowledged forward reference (non-blocking)

Story 1.3 wires the coverage gate **report-only**, flipped to **enforcing** in Story 6.2. This is a forward reference to a later story but does **not** block 1.3's completion, is explicitly flagged, and reflects a resolved human decision (epics Open Question #3). Acceptable.

### Sequencing sanity

Foundation + test infra + CI first (Epic 1) → backend before dependent frontend (Epic 2 → 3) → backdrop isolated after the loop (Epic 4) → containerization (Epic 5) → QA/docs sign-off last (Epic 6). Sound. See Findings SF-3 for the one concrete sequencing wrinkle (compose-backed E2E referenced in Epic 1 before compose exists in Epic 5).

---

## Findings by Severity

### 🔴 Blockers

**None.** All FR-1..FR-9 have story coverage; all six API endpoints are exercised with no phantom endpoints; all four UJs and every discrete UX behavior (empty/loading/error, bulk-only Undo toast, backdrop + reduced-motion + no-WebGL fallbacks) map to concrete stories; all hard quality bars are present; epic sequencing is valid; no document contradicts another on any decided value.

### 🟠 Should-Fix

- **SF-1 — "Meaningful coverage" exclusions not encoded in a story AC.** The human-resolved definition (epics Open Question #4: branch coverage of real application logic — API handlers, validation, repository layer, frontend optimistic/undo logic — **excluding** generated code, config, Alembic migrations, and three.js visual tuning) is authoritative and even names the stories that "must apply these exclusions," but Story 6.2's ACs (epics.md ~L726–750) and Story 1.3's coverage step (~L223) do not restate the exclusion list. A dev must cross-reference the resolved-OQ appendix. *Fix:* add an AC to Story 6.2 (and the coverage-config note in Story 1.3) enumerating the exclusions and specifying **branch** coverage of real logic, so the ≥70% bar (SM-5) is unambiguous at the point of execution.
- **SF-2 — AI-integration log incremental capture not pinned to Epics 1–5.** Open Question #5 (RESOLVED, authoritative) requires the log be "seeded and maintained **incrementally from Epic 1 onward**," finalized in Story 6.4. Only Story 6.4 (epics.md ~L779–799) carries the log; no Epic 1–5 story has an AC to seed or append to `docs/AI-INTEGRATION-LOG.md`. *Fix:* add a seed step to Story 1.1 (create `docs/AI-INTEGRATION-LOG.md`) and a standing "append AI-integration notes as work happens" obligation to each epic (or a cross-cutting definition-of-done), leaving 6.4 to finalize/polish rather than author from scratch. Protects SM-9.
- **SF-3 — "compose-backed Playwright" referenced in Epic 1 before Compose exists (Epic 5).** Story 1.1 AC (epics.md ~L161) specifies "a single documented root command runs backend + frontend + (compose-backed) Playwright in sequence," and the architecture Testing/Wiring section describes the root command as a compose-backed Playwright run. But `docker-compose.yml` is not delivered until Epic 5. The Epic 1 E2E **smoke** spec itself only needs to "load a served page/asset" (dev server / static preview), which is fine; the compose-backed portion of the root command cannot fully run until Epic 5. *Fix:* clarify in Story 1.1 that the Epic 1 smoke E2E runs against a simple served page (Vite preview/static), and that the compose-backed root command / full-journey E2E is completed with Epic 5 (stack) and Epic 6 (journeys). Avoids a dev treating a non-runnable compose command as an Epic 1 exit criterion.

### 🟡 Minor

- **MN-1 — Story 1.3 statement vs its own AC.** The story sentence says the CI workflow "runs the unit/integration/E2E suites" (epics.md ~L211), but its ACs correctly build images only and defer full compose E2E to Epic 6 (~L217–219). Tighten the story statement to "unit + integration suites (E2E deferred to Epic 6)" to match.
- **MN-2 — Stale alternative wording in EXPERIENCE State Patterns.** EXPERIENCE.md L79 still reads "(or fires immediately with a compensating re-create on Undo — architecture's call `[ASSUMPTION]`)". Architecture resolved this to deferred-commit (AD-7) and EXPERIENCE Open Question #3 marks it deferred; the sentence is now superseded. Doc hygiene only — no contradiction, since the resolved OQ and AD-7 are authoritative. Optionally update to point at AD-7.
- **MN-3 — PRD addendum extensibility example superseded by AD-9.** The PRD addendum (L24) offers "a nullable/implicit owner today that becomes a real foreign key later" as an *example*; architecture AD-9 deliberately builds **no** `owner_id` in v1 (YAGNI) and flags the deviation, and Story 2.1 correctly adds no `owner_id`. Informational only — devs should follow AD-9, not the addendum's illustrative example.

---

## Cross-Document Consistency Check

Checked decided values across all four documents; **no contradictions found**:

- Description rule: required, trimmed, non-empty, single-line, ≤ 500 chars — identical in PRD, AD-5, DB `CHECK (1..500)`, Story 2.1. ✅
- Ordering: `created_at` DESC + `id` tiebreak, completed-in-place — PRD FR-5, AD-3, Story 2.1/3.3. ✅
- Toggle both directions — PRD FR-2, AD-3, contract PATCH, Story 2.2/3.3. ✅
- Clear-completed = deferred-commit, id snapshot, ~6s bulk-only Undo toast — EXPERIENCE OQ#1/#3, AD-7, Story 2.3/3.4. ✅
- Health contract `200 {status,db}` / `503` — PRD NFR-Deploy, AD contract, Story 1.2/5.1. ✅
- Dark-only, desktop-only autofocus, 72% scrim, 560px panel — DESIGN/EXPERIENCE resolved OQs, Story 3.1/3.2/3.5. ✅
- Completed ink ≥ 4.5:1 — DESIGN, Story 3.3. ✅
- Stack pins (Python 3.12 / FastAPI 0.136.x / React 19.2.x / Vite 8.0.x / three.js 0.185.x / PG 17 …) — architecture Stack, Story 1.1. ✅
- CI = GitHub Actions; integration-test DB = transactional-rollback on test-profile Postgres (not testcontainers) — architecture Deferred (resolved), Story 1.3/1.2/5.3. ✅

---

## Summary and Recommendations

### Overall Readiness Status

**READY — with minor fixes (ready-with-minor-fixes).**

The planning set is coherent, complete, and traceable end-to-end. All nine functional requirements, all six API endpoints, all four user journeys, every required application state, the bulk-only Undo toast, and the full backdrop + degradation behavior are each pinned to concrete stories with testable Given/When/Then acceptance criteria and unit/integration/E2E scenarios. Every hard quality bar (≥70% coverage, ≥5 Playwright E2E, three test suites, zero critical WCAG AA, `docker-compose up`, README + AI log, GitHub Actions CI, transactional-rollback integration DB) has a home story. Epic sequencing is correct and dependency-clean. No document contradicts another on any decided value.

There are **no blockers**. The three should-fix items are precision/traceability improvements — they pull already-resolved human decisions (coverage-exclusion definition, incremental AI-log capture) down into the specific story ACs that execute them, and resolve one Epic-1-before-Epic-5 wording wrinkle. They can be fixed in minutes and do not require re-opening any decision.

### Critical Issues Requiring Immediate Action

None.

### Recommended Next Steps

1. **SF-1:** Add the meaningful-coverage exclusion list + "branch coverage of real logic" wording to Story 6.2 ACs (and the Story 1.3 coverage-config note).
2. **SF-2:** Seed `docs/AI-INTEGRATION-LOG.md` in Story 1.1 and add a standing per-epic append obligation; keep Story 6.4 as finalize/polish.
3. **SF-3:** Clarify Story 1.1 that the Epic 1 E2E smoke runs against a simple served page, with the compose-backed root command / full-journey E2E landing in Epic 5/6.
4. **Minor (optional):** Tighten Story 1.3's story statement (MN-1); refresh the stale AD-7 alternative wording in EXPERIENCE.md (MN-2); note AD-9 supersedes the addendum's owner-column example (MN-3).

### Final Note

This assessment identified **6 issues** across **2 severity categories** (3 should-fix, 3 minor) and **0 blockers**. FR→story coverage is 100% (9/9) and API→story coverage is 100% (6/6). The artifacts may proceed to implementation as-is; applying the three should-fix items first will remove all ambiguity at the point of story execution.

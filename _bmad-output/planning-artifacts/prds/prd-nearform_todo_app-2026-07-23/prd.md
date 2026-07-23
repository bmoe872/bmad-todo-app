---
title: nearform_todo_app
status: final
created: 2026-07-23
updated: 2026-07-23
---

# PRD: nearform_todo_app

## 0. Document Purpose

This PRD is the source of truth for the `nearform_todo_app` product: a minimal, polished, single-user personal Todo web application. It is written for the downstream BMAD workflows that build on it — UX design, architecture, and epic/story creation — as well as for any reviewer confirming scope. It is organized Glossary-first: features are grouped with their Functional Requirements (FRs) nested and globally numbered, cross-cutting non-functional requirements live in their own section, and every inference the author made is tagged inline with `[ASSUMPTION]` and indexed in §12. A finalized [Product Brief](../../briefs/brief-nearform_todo_app-2026-07-23/brief.md) and its [addendum](../../briefs/brief-nearform_todo_app-2026-07-23/addendum.md) precede this document; the addendum preserves the user's original verbatim PRD, the full activity/quality specification, and the three.js feature notes. Fixed technical decisions and rationale that do not belong in a capability-level PRD live in this run's [addendum](./addendum.md).

## 1. Vision

`nearform_todo_app` is a clean, fast, full-stack personal Todo application. It lets one person manage their own tasks with zero ceremony: open the app, see the list, and add, complete, or delete tasks with updates that feel instant. There are no accounts to create, no projects to configure, and no onboarding to sit through — the list is the first and only screen.

The product deliberately resists feature creep. The bet is that most task tools are over-built, and that a tool which does the core loop — capture, see, complete, clear — with genuine polish is more useful day to day than one with ten features nobody touches. The differentiator is restraint and execution, not novel capability: it does less, better; it costs nothing to start; and it stays reliable.

To make the everyday act of checking a list feel a little less mundane, the interface presents the todos floating in space against a slow drift of cube-shaped "stars," rendered in three.js. This is a small piece of delight layered on top of a fast, reliable core — and never at the expense of it. The effect is always gated behind a reduced-motion / static fallback so it can never compromise accessibility or performance.

## 2. Target User

### 2.1 Jobs To Be Done

- **Functional:** capture a task the moment it occurs to me, without deciding where it goes.
- **Functional:** see everything still outstanding at a glance, and clear items as I finish them.
- **Emotional:** feel on top of my day — a shrinking list is reassuring, and an over-complicated tool is not.
- **Contextual:** do all of this equally well at my desk or on my phone, in a couple of seconds, without friction at the moment of capture.
- **Emotional (delight):** enjoy opening the app — a quietly beautiful surface makes a mundane utility pleasant to return to.

### 2.2 Non-Users (v1)

- Teams or collaborators sharing a list — v1 is single-user with no accounts.
- Power users who want labels, projects, priorities, due dates, or reminders — deliberately out of scope.
- Anyone needing their list private from others on the same deployment — v1 has no auth, so the single list is whatever the deployment exposes. `[ASSUMPTION: acceptable for a personal, self-hosted v1.]`

### 2.3 Key User Journeys

*Single-operator product, so journeys are captured lightly. Numbered UJ-1..UJ-4.*

- **UJ-1. Maya dumps what's on her mind.** Maya, mid-morning between meetings, opens the app on her laptop. The list is already there — no login. She types "call the dentist" into the input at the top, hits Enter, and the item appears instantly at the top of the list as an active todo. She adds two more the same way and closes the tab. Realizes FR-1, FR-4.
- **UJ-2. Maya clears items on her phone.** On the bus, Maya opens the app on her phone. The list is legible and thumb-friendly. She taps the checkbox next to "call the dentist"; it immediately reads as completed — visually distinct from the active items — and stays in place so she can see her progress. She taps delete on a task that's no longer relevant and it disappears. Realizes FR-2, FR-3.
- **UJ-3. Maya opens the app to an empty, calm screen.** First run of the day with nothing outstanding: instead of a blank void, Maya sees a friendly empty state ("Nothing to do — add something above") against the drifting-cube backdrop. On her machine, which has "reduce motion" enabled at the OS level, the backdrop is a still starfield rather than an animation. Realizes FR-6, FR-7.
- **UJ-4. Maya clears out a day's worth of finished tasks.** At the end of the day several items are checked off and cluttering the List. Rather than deleting each one, Maya taps "Clear completed"; all completed Todos disappear in one action while her remaining active tasks stay put. Realizes FR-9.

## 3. Glossary

*Downstream workflows and readers must use these terms exactly. FRs, UJs, and SMs use them verbatim; no synonyms elsewhere in the PRD.*

- **Todo** — A single personal task. Has a *description*, a *completion status*, and *creation-time metadata*. The only domain entity in v1.
- **Description** — The short, human-entered text of a Todo. Required, non-empty, plain single-line text, maximum ~500 characters.
- **Completion status** — A boolean state of a Todo: *active* (not done) or *completed* (done). Toggleable in both directions — a completed Todo can be returned to active.
- **Creation-time metadata** — The timestamp recorded when a Todo is created; used for ordering and durability. Set by the system, not the user.
- **List** — The full ordered collection of Todos shown to the user. A single implicit global collection in v1 (no per-user scoping). `[ASSUMPTION]`
- **Active / Completed** — The two display groupings of Todos, driven by *completion status*.
- **Clear completed** — A single bulk action that removes all Todos whose *completion status* is *completed* from the List and from persistence in one step.
- **Backdrop** — The three.js "floating in space" visual: the List rendered as if in space with cube "stars" drifting past. Purely decorative; carries no Todo data.
- **Reduced-motion fallback** — The static, non-animated rendering of the Backdrop presented when the viewer signals `prefers-reduced-motion` or when performance/capability constraints require it.

## 4. Features

### 4.1 Todo Management (Core Loop)

**Description:** The heart of the product. On open, the user sees their List immediately, with no login or onboarding. They can create a Todo from a single always-visible input, mark a Todo complete or active, and delete a Todo. Every action reflects in the UI instantly (optimistically) and is persisted durably so the List survives refreshes and sessions. Completed Todos are visually distinct from active ones so status reads at a glance. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-1: Create a Todo

The user can create a Todo by entering a non-empty Description and submitting it. Realizes UJ-1.

**Consequences (testable):**
- Submitting a non-empty Description creates a Todo with completion status = active and system-set creation-time metadata.
- The new Todo appears in the List without a full page reload and, per ordering (FR-5), at the top (newest-first).
- Submitting an empty or whitespace-only Description is rejected client-side and server-side; no Todo is created and the user sees a clear inline message.
- A Description exceeding the max length (~500 characters) is rejected with a clear message.

#### FR-2: Toggle completion status

The user can mark an active Todo as completed and mark a completed Todo back to active. Realizes UJ-2.

**Consequences (testable):**
- Toggling a Todo flips its completion status and persists the change.
- A completed Todo is rendered visually distinct from active Todos (e.g. checked control plus de-emphasized styling) meeting the contrast bar in NFR-A11y.
- The change is reflected optimistically in the UI and reconciled with the server response.

#### FR-3: Delete a Todo

The user can permanently delete a Todo. Realizes UJ-2.

**Consequences (testable):**
- Deleting a Todo removes it from the List and from persistence.
- The removal is reflected in the UI without a full page reload.
- Deleting a Todo that no longer exists server-side fails gracefully (see FR-7) and the List reconciles to the true state.

**Out of Scope:**
- Undo of a delete. `[NON-GOAL for MVP]`
- Arbitrary multi-select bulk delete beyond the "Clear completed" action (FR-9). `[NON-GOAL for MVP]`

#### FR-4: View the List on open

The user sees their full List immediately on opening the app, with no authentication, onboarding, or manual load step. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- On first paint the app requests and renders the persisted List.
- No login, signup, or onboarding screen is presented at any point.
- While the List is loading, a loading state is shown (FR-6); on failure, an error state (FR-7).

#### FR-5: List ordering

The system presents Todos in a stable, predictable order: creation-time descending — newest first.

**Consequences (testable):**
- Ordering is deterministic across refreshes for an unchanged List.
- Toggling completion status does not reorder or remove a Todo from the List; completed items remain in place and completing only restyles them (visually distinguished per FR-2).

#### FR-9: Clear completed

The user can remove all completed Todos from the List in a single "Clear completed" action, rather than deleting them one at a time. Realizes UJ-4.

**Consequences (testable):**
- Invoking "Clear completed" removes every Todo with completion status = completed from the List and from persistence in one action; active Todos are unaffected.
- The change is reflected in the UI without a full page reload and reconciles to the true persisted state on completion.
- When there are no completed Todos, the action is unavailable or inert (no error, no destructive effect).
- A failure of the bulk removal surfaces a clear error state and the List reconciles to the true state (per FR-7).
- The action guards against accidental data loss via a confirmation or undo affordance. `[NOTE FOR UX]` Exact affordance (confirm dialog vs. transient undo) is deferred to bmad-ux.

**Backend note:** Implies a bulk-removal capability on the API surface (e.g. a delete-completed endpoint) rather than looping per-item deletes; the precise contract is owned by architecture.

### 4.2 Editing Todo text

**Description / status:** Editing the Description of an existing Todo is **out of scope for v1**. The supplied source PRD enumerates only create, view, complete, and delete. To change wording, the user deletes and re-creates. `[ASSUMPTION: no in-place text editing in v1.]` `[NON-GOAL for MVP]`

### 4.3 Application States (Empty / Loading / Error)

**Description:** The app feels polished at the edges by handling non-happy-path states deliberately rather than leaving blank screens or spinners that never resolve. Realizes UJ-3.

**Functional Requirements:**

#### FR-6: Empty and loading states

The user is shown sensible empty and loading states.

**Consequences (testable):**
- When the List has zero Todos, a friendly empty state is shown (guidance to add the first Todo), not a blank area.
- While the List or an action is in flight, a loading indication is shown; it always resolves to a loaded or error state.

#### FR-7: Error states and graceful failure

The user is shown clear, non-disruptive error states when something fails, on both client and server sides. Realizes UJ-3.

**Consequences (testable):**
- A failed List load shows an error state with a way to retry, without crashing the app.
- A failed create/toggle/delete surfaces a clear message and the UI reconciles to the true persisted state (optimistic update is rolled back on failure).
- Client-side validation errors (empty/over-length Description) are shown inline and never reach the server as valid writes.

### 4.4 Backdrop (three.js "Todo in Space")

**Description:** A cosmetic delighter that renders the List as if floating in space, with cube "stars" drifting past as an animated field, via three.js. It is purely decorative and carries no Todo data. It must never compromise the core success criteria: it respects the performance budget, does not block or slow the core loop, and is fully accessible. Realizes UJ-3.

**Functional Requirements:**

#### FR-8: Animated backdrop with mandatory reduced-motion / static fallback

The user sees the animated Backdrop by default, and a static Reduced-motion fallback when their environment signals `prefers-reduced-motion` (or when capability/performance constraints require it).

**Consequences (testable):**
- When `prefers-reduced-motion: reduce` is set, no looping motion animation runs; a static rendering is shown instead.
- The core loop (FR-1..FR-9) remains fully usable regardless of Backdrop state, including if WebGL is unavailable: the Backdrop degrades gracefully to a static or plain background rather than erroring. (Working default; degradation detail deferred to architecture/UX — see §11.)
- With the Backdrop active, the page has zero critical WCAG 2.1 AA violations (see NFR-A11y) — including text contrast of Todo content over the Backdrop.
- The Backdrop does not violate the performance budget in NFR-Perf.

**Feature-specific NFRs:**
- Backdrop rendering must not degrade input responsiveness of the core loop below the NFR-Perf interaction budget on a mid-range laptop and a mid-range phone. (Representative test devices/viewports are a working default deferred to architecture/UX — see §11.)

## 5. Non-Goals (Explicit)

- **No user accounts, authentication, or authorization.** v1 is single-user with an implicit global List.
- **No multi-user, sharing, or collaboration.**
- **No task prioritization, deadlines/due dates, reminders, or notifications.**
- **No in-place editing of Todo Description** (see §4.2).
- **No categorization, labels, projects, search, or filtering** beyond the active/completed visual distinction. `[ASSUMPTION: not requested in sources.]`
- **We are not becoming a productivity suite.** The default experience stays the fast, quiet, single-screen List.

The architecture must **not preclude** adding auth / multi-user later, but must **not build** any of it now.

## 6. MVP Scope

### 6.1 In Scope

- Full CRUD-minus-update core loop: create, view, toggle-complete, delete Todos, with creation-time metadata (§4.1).
- "Clear completed" bulk action that removes all completed Todos in one step (§4.1, FR-9).
- Immediate List visibility with no login/onboarding (§4.1, FR-4).
- Instant-feeling (optimistic) updates reconciled with the server (§4.1, §4.3).
- Visual distinction of completed vs. active Todos (§4.1, FR-2).
- Empty, loading, and error states; graceful client- and server-side error handling (§4.3).
- Responsive desktop + mobile UI (NFR-Resp).
- three.js Backdrop with mandatory reduced-motion / static fallback (§4.4).
- Small, well-defined CRUD API with durable persistence across sessions (NFR-Rel, and addendum for stack).
- Containerized delivery runnable via a single `docker-compose up`, with health-check endpoints (NFR-Deploy).
- Integrated test suites (unit + integration + E2E) and QA/accessibility/security activities from day one (NFR-Quality, §7).
- README with setup instructions and an AI-integration log (§7, SM-8/SM-9).

### 6.2 Out of Scope for MVP

- Everything in §5 Non-Goals.
- Undo of destructive actions, and arbitrary multi-select bulk actions beyond the "Clear completed" action now in scope (§4.1, FR-9).
- Offline / PWA / installable experience — deferred to vision. Reason: not required for the core loop.
- Native mobile apps — responsive web only in v1.

## 7. Success Metrics

*Targets in the table below are hard bars carried from the activity specification (addendum §B) and must be treated as acceptance criteria for the product, not aspirations.*

**Primary**
- **SM-1 (Task completion, unaided):** A first-time user can complete every core action — add, view, complete, delete, clear completed — with no guidance. Target: 100% of core actions completable without instruction. Validates FR-1, FR-2, FR-3, FR-4, FR-9.
- **SM-2 (Perceived instantaneity):** Core interactions feel instantaneous under normal conditions. Target: perceived UI update within the NFR-Perf interaction budget. Validates FR-1, FR-2, FR-3.
- **SM-3 (Durability):** The List is stable across refreshes and sessions; data persists reliably. Target: zero data loss across refresh/restart in test. Validates FR-4, FR-5, NFR-Rel.
- **SM-4 (Accessibility):** Zero **critical** WCAG 2.1 AA violations, including with the Backdrop active. Target: 0 critical violations via automated axe-core / Lighthouse checks. Validates FR-8, NFR-A11y.

**Secondary (delivery-quality bars — from activity spec)**
- **SM-5 (Test coverage):** ≥ 70% meaningful code coverage across the codebase. Validates NFR-Quality.
- **SM-6 (E2E coverage):** ≥ 5 passing Playwright E2E tests covering the core journeys (create, complete, delete, clear completed, empty state, error handling). Validates FR-1..FR-9.
- **SM-7 (One-command deploy):** The whole system runs cleanly from a single `docker-compose up`. Validates NFR-Deploy.
- **SM-8 (Documentation):** A README with setup instructions exists and is accurate. Validates NFR-Deploy.
- **SM-9 (AI-integration log):** An AI-integration log is maintained (agent/MCP usage, prompts that worked, test-gen hits/misses, debugging cases, limitations). Deliverable of the activity spec.

**Counter-metrics (do not optimize)**
- **SM-C1 (Feature count):** Do **not** grow the feature surface to look richer. Counterbalances the temptation behind SM-1 — the product's value is restraint; added features that dilute the single-screen core are a regression.
- **SM-C2 (Backdrop richness vs. performance/a11y):** Do **not** enrich the Backdrop at the cost of the interaction budget or any WCAG AA violation. Counterbalances SM-4/NFR-Perf — visual flourish must never win over core responsiveness or accessibility.

## 8. Cross-Cutting Non-Functional Requirements

- **NFR-Perf (Performance / instantaneity):** Core interactions must feel instant under normal conditions. Working-default budget: optimistic UI reflects a change within ~100ms; API responses p95 < 300ms under normal local/single-user conditions. The Backdrop must not push interaction latency past this budget and should target a smooth frame rate without pinning CPU/GPU (~60fps target with a graceful step-down). Precise numeric budgets are accepted working defaults deferred to architecture/UX for confirmation — see §11.
- **NFR-A11y (Accessibility):** Zero **critical** WCAG 2.1 AA violations across the app, verified by automated tooling (axe-core / Lighthouse, automatable via Playwright). Includes keyboard operability of the full core loop, sufficient contrast of Todo content over the Backdrop, and the mandatory reduced-motion fallback (FR-8).
- **NFR-Resp (Responsiveness / cross-device):** The UI works well on desktop and mobile viewports; the core loop is fully usable via touch and keyboard. `[ASSUMPTION: supported viewport range ~320px to desktop widths; current evergreen Chrome/Firefox/Safari/Edge.]`
- **NFR-Rel (Reliability / durability):** Todo data is persisted durably and survives refreshes, sessions, and container restarts (volume-backed persistence). No silent data loss on failed writes — failures surface per FR-7.
- **NFR-Deploy (Deployability / operability):** The system builds and runs from a single `docker-compose up`. Multi-stage Docker builds, non-root container users, health-check endpoints per service, containers report status, logs viewable via `docker-compose logs`. Dev/test configuration via environment variables and compose profiles. (Stack specifics in addendum.)
- **NFR-Quality (Test & QA discipline):** QA is integrated from day one, not bolted on. Unit + integration + E2E suites exist and run via wired-in commands; ≥ 70% meaningful coverage (SM-5); ≥ 5 passing Playwright E2E tests (SM-6); API contracts validated; a documented security review (XSS, injection, etc.) with findings and remediations; a documented performance and accessibility pass.
- **NFR-Sec (Security baseline):** As a single-user, no-auth v1, the security bar is input hygiene and safe rendering: server-side validation of all writes, protection against injection at the persistence boundary (parameterized queries), and no unsafe rendering of Todo Description text (XSS-safe). `[ASSUMPTION: no secrets, PII, or auth tokens are handled in v1.]`
- **NFR-Maint (Maintainability / extensibility):** The solution stays simple and easy for a future developer to understand, deploy, and extend. The data model and API boundary must leave room to add a user/owner dimension later (auth / multi-user) without a rewrite — without implementing it now.

## 9. Constraints and Guardrails

- **Fixed technology stack (decided, not open):** Python + FastAPI backend; React + Vite + three.js frontend; PostgreSQL (volume-backed) persistence; delivery via multi-stage Dockerfiles orchestrated by Docker Compose. These are inputs, not decisions for downstream workflows to re-open. Rationale and detail live in the [addendum](./addendum.md).
- **Delivery must satisfy the activity-spec deliverables:** BMAD artifacts, working app, the three test suites, Dockerfiles + docker-compose.yml, QA reports (coverage, a11y, security), README, and the AI-integration log.
- **Accessibility and performance are guardrails on the Backdrop, not afterthoughts:** any Backdrop work that would breach NFR-A11y or NFR-Perf is out of bounds.

## 10. Non-Goals recap for architecture

The architecture must not preclude later auth/multi-user (leave an owner dimension seam in the data model and API), but must build none of it in v1. No collaboration, prioritization, deadlines, reminders, notifications, editing, search, or labels.

## 11. Open Questions

1. **RESOLVED.** List ordering rule (§4.1, FR-5): newest-first (creation-time descending), with completed items staying in place — completing a Todo only restyles it and never reorders or removes it.
2. **RESOLVED.** Description (§3, FR-1): plain single-line text, required/non-empty, maximum ~500 characters.
3. **RESOLVED.** Toggling a completed Todo back to active (§3, FR-2): yes, supported in both directions.
4. **RESOLVED.** "Clear completed" (§4.1 FR-9, §6.1): confirmed in v1 scope as a single bulk action removing all completed Todos.
5. **Deferred to architecture/UX; working default accepted:** Backdrop performance verified on a mid-range laptop and a mid-range phone; exact representative test devices/viewports chosen downstream. (§4.4)
6. **Deferred to architecture/UX; working default accepted:** when WebGL is unavailable the Backdrop degrades to a static/plain background rather than erroring; exact degradation detail chosen downstream. (FR-8)
7. **Deferred to architecture/UX; working default accepted:** interaction budget ~100ms optimistic UI, API p95 < 300ms, ~60fps Backdrop with graceful step-down; precise numeric budgets confirmed downstream. (§8, NFR-Perf)

## 12. Assumptions Index

*Items the human has now decided are recorded below as confirmed decisions or accepted working defaults and no longer carry assumption status; genuine standing assumptions are listed separately.*

**Confirmed decisions (no longer assumptions)**
- §3 / §4.1 (FR-5) — Ordering is creation-time descending (newest first); toggling completion does not reorder items (completed items stay in place, restyled). Confirmed (Open Question 1).
- §3 / §4.1 (FR-1) — Description is required, non-empty, plain single-line text, max ~500 characters. Confirmed (Open Question 2).
- §3 / §4.1 (FR-2) — Completion status is a toggle; a completed Todo can be returned to active. Confirmed (Open Question 3).
- §4.1 (FR-9) / §6.1 — "Clear completed" bulk action is in v1 scope. Confirmed (Open Question 4).

**Accepted working defaults, deferred to architecture/UX**
- §4.4 (FR-8) — When WebGL is unavailable, the Backdrop degrades to a static/plain background rather than erroring (Open Question 6).
- §4.4 — Representative mid-range test devices/viewports for the Backdrop performance budget (Open Question 5).
- §8 (NFR-Perf) — Interaction budget ~100ms optimistic UI; API p95 < 300ms; ~60fps Backdrop with graceful step-down (Open Question 7).

**Standing assumptions (unchanged)**
- §2.2 / §5 — No auth means the single List is whatever the deployment exposes; acceptable for a personal self-hosted v1.
- §3 — The List is a single implicit global collection (no per-user scoping) in v1.
- §4.2 — No in-place editing of Todo Description in v1.
- §5 — No categorization/labels/search/filter beyond active vs. completed.
- §8 (NFR-Resp) — Supported viewports ~320px to desktop; current evergreen browsers.
- §8 (NFR-Sec) — No secrets, PII, or auth tokens handled in v1.

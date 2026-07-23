---
baseline_commit: c9ca02fa1b322d5f40ba2d835191199843e7bba3
---

# Story 3.1: Panel shell, design tokens, API client, and List view with loading/empty/error states

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Maya,
I want to open the app and immediately see my List (or a calm empty state) inside the floating Orbit panel, with clear loading and retryable error states,
so that I can view my Todos on open with no login, onboarding, or manual load step.

## Acceptance Criteria

**AC1 — Design tokens + panel shell (UX-DR1, UX-DR2)**
Given a first visit, when the app loads, then the Orbit design tokens (surfaces, ink ramp, single accent, danger, borders, Inter type scale with system-ui fallback, spacing, radius, 560px panel cap) are implemented as the single source of visual truth, **dark-only**, and the translucent `surface-scrim` **~72%** panel renders `title → input placeholder → list → footer`, centered and capped at **560px** over a plain `surface-void → surface-void-far` background. **And** no login, signup, or onboarding is ever shown (FR-4).

**AC2 — Loading state (FR-6, UX-DR10)**
Given the app is fetching the List, when the request is in flight (cold load), then **3–5 skeleton shimmer rows** are shown, always resolving to loaded / empty / error — never a hanging spinner.

**AC3 — Empty state (FR-6, UX-DR11, UX-DR13)**
Given the List has zero Todos, when the fetch resolves empty, then the empty state **"Nothing to do — add something above."** is centered in the panel with the input focused (desktop).

**AC4 — Loaded state / ordering / XSS-safety (FR-4, FR-5, NFR-Sec)**
Given persisted Todos, when the fetch resolves, then rows render **newest-first (server order)** with Todo text rendered as **text only via React auto-escaping** (no HTML interpolation).

**AC5 — Load error state (FR-7, UX-DR9, UX-DR13)**
Given the List fetch fails, when the error resolves, then the panel frame + input still render and an inline **"Couldn't load your list. Retry"** appears under the list header; **Retry re-fetches**; the app never crashes.

**AC6 — Data layer (AD-1, AD-5, AD-6)**
Given the data layer, when it is built, then a thin typed `api/client.ts` + `api/todos.ts` wrap `fetch` over `/api`, TS types mirror the wire exactly (`snake_case`, no mapping layer), a **TanStack Query provider** owns the List query, and **one error shape** is parsed everywhere.

## Tasks / Subtasks

- [x] **Task 1 — Design tokens as the single source of visual truth** (AC: 1)
  - [x] Create `src/styles/tokens.css` encoding every Orbit token from DESIGN.md front-matter as CSS custom properties under `:root`: the 18 colors, the 5 type roles (family/size/weight/line-height/letter-spacing), the `rounded` scale (sm 8 / md 14 / lg 20 / full 9999), the spacing scale (1–7 = 4/8/12/16/24/32/48) and `--space-panel-max: 560px`.
  - [x] Dark-only: no light-theme block, no `prefers-color-scheme` alternate. Set the Inter + system-ui fallback font stack exactly as DESIGN.md typography (`Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`). Do NOT add a webfont `@import`/`<link>` — the system-ui fallback carries first paint (no network font dependency in this story).
  - [x] Create `src/styles/global.css`: apply `--surface-void` base fill + a `--surface-void-far` radial-gradient falloff to `body`; set base `color: var(--ink-primary)`, base font, `color-scheme: dark`, `box-sizing: border-box`, and remove default margins. Import both stylesheets from `src/main.tsx` (or `App.tsx`).
  - [x] Encode the 7 component token groups from DESIGN.md `components:` (panel, add-input, todo-row, checkbox, button-clear, toast-undo, inline-error) as either CSS classes or a small typed tokens module the components consume — resolving the `{colors.*}`/`{rounded.*}`/`{typography.*}` references to concrete values. Only panel / todo-row / inline-error / skeleton are exercised this story; define the rest so 3.2–3.4 slot in.

- [x] **Task 2 — Typed API client over `/api`** (AC: 4, 6)
  - [x] Populate `src/types.ts` with the wire-exact `Todo` type (replace the Story 1.1 placeholder `export {}`): `{ id: string; description: string; completed: boolean; created_at: string }` — `snake_case`, **no mapping layer** (AD-3, Consistency Conventions). Add `TodoListResponse = { todos: Todo[] }` and the error envelope type `ApiError = { error: { code: string; message: string; details?: { field: string; issue: string }[] } }`.
  - [x] Create `src/api/client.ts`: a thin `fetch` wrapper reading the base URL from `import.meta.env.VITE_API_BASE_URL` (fallback `'/api'` for the single-origin composed stack per AD-10). Parse the **one** AD-5 error envelope on any non-2xx and throw a typed `ApiClientError` (carrying `code`, `message`, `status`, optional `details`). Handle 204 (no body) and network failures (thrown `TypeError` from `fetch`) as thrown errors too — one error path everywhere.
  - [x] Create `src/api/todos.ts`: `getTodos(): Promise<Todo[]>` calling `GET /api/todos`, returning `response.todos` (unwraps the `{ todos: [...] }` envelope). Only the List read is in scope this story; leave create/toggle/delete/clear for 3.2–3.4 (do not stub them with dead code).

- [x] **Task 3 — TanStack Query provider + List query hook** (AC: 2, 3, 4, 5, 6)
  - [x] Add a `QueryClientProvider` at the app root (in `main.tsx`, wrapping `<App/>`) with a single shared `QueryClient`. Set sane defaults for a manual-retry UX: `retry: false` (so the load-error state surfaces immediately and Retry is user-driven, matching AC5), `refetchOnWindowFocus: false`.
  - [x] Create `src/hooks/useTodos.ts`: `useTodos()` wrapping `useQuery({ queryKey: ['todos'], queryFn: getTodos })`. This hook OWNS the List query (AD-6); components read `data`/`isPending`/`isError`/`refetch` from it. Structure the file so 3.2–3.3 add create/toggle/delete mutations here later.

- [x] **Task 4 — Panel shell + zone composition** (AC: 1)
  - [x] Create `src/components/Panel.tsx`: the single floating translucent panel — `surface-scrim` at ~72% opacity, `rounded.lg` (20px) corners, 1px `border-hairline`, one soft ambient shadow beneath, centered column capped at 560px, floating toward upper-middle with generous void margin. Renders zone slots top→bottom: **Title ("Todos")**, **add-input slot** (placeholder mount for 3.2 — render a disabled/non-interactive input placeholder or a clearly-marked slot; do NOT build the working add-input here), **List**, **footer slot** (placeholder mount for 3.4).
  - [x] Rewrite `src/App.tsx` (replace the Story 1.1 placeholder): compose `Panel` containing the zones and mount `TodoList`. Keep it a thin composition root. Semantics: the title is the page heading; the List region is labeled.
  - [x] Leave a **clean backdrop mount point** for Epic 4: a single fixed, `aria-hidden`, `pointer-events:none` placeholder layer element behind the panel (rendering only the CSS `surface-void → surface-void-far` gradient for now). Do NOT add three.js, `three` imports, or any animation in this story (AD-8; backdrop is Story 4.1). `src/backdrop/` already exists with a `.gitkeep`.

- [x] **Task 5 — TodoList + the three states** (AC: 2, 3, 4, 5)
  - [x] Create `src/components/TodoList.tsx`: consumes `useTodos()` and switches on query state — pending → `SkeletonRows`; error → `InlineError`+Retry (frame/input still render); empty data → `EmptyState`; non-empty → the list of `TodoRow`s in server order (newest-first; do NOT re-sort client-side — the server already orders `created_at` DESC). The List is a labeled `<ul>`/list region.
  - [x] Create `src/components/SkeletonRows.tsx`: 3–5 shimmer placeholder rows in `surface-raised` matching row height. Respect `prefers-reduced-motion` (no shimmer animation when reduce is set). Never a spinner.
  - [x] Create `src/components/EmptyState.tsx`: centered, exact microcopy **"Nothing to do — add something above."** in `meta` type/`ink-secondary`.
  - [x] Create `src/components/InlineError.tsx`: reusable `danger`-text (`meta` size) inline error with an optional Retry affordance (a real focusable `<button>`). For the load error, render exactly **"Couldn't load your list. Retry"** under the list header, wired to `refetch()`. Never a modal/full-screen error. This component is reused by 3.2–3.4 for their inline errors.
  - [x] Create `src/components/TodoRow.tsx` — **minimal** for this story: a checkbox affordance (visual, non-functional toggle is Story 3.3), the description rendered as **text** (React child, never `dangerouslySetInnerHTML`), and a delete affordance **placeholder** (visual only, wired in 3.3). Long descriptions **wrap** (no truncation). Structure props so 3.3 adds toggle/delete handlers cleanly.

- [x] **Task 6 — Tests (Vitest + Testing Library)** (AC: 2, 3, 4, 5, 6)
  - [x] `src/api/client.test.ts` (and/or `todos.test.ts`): success parse returns unwrapped `Todo[]`; a non-2xx AD-5 envelope is parsed into a thrown `ApiClientError` carrying `code`/`message`. Mock `fetch` (e.g. `vi.stubGlobal('fetch', …)`).
  - [x] `src/components/TodoList.test.tsx`: render with a mocked query/API layer through the four states — **skeleton (pending) → loaded**, **→ empty**, **→ error + Retry**; asserting **Retry triggers a refetch**; and **long description wraps (no truncation)**. Provide a test helper that wraps the component in a `QueryClientProvider` with a fresh `QueryClient` and mocks `getTodos` (`vi.mock('../api/todos')`) — do NOT hit a real network.
  - [x] A test asserting **dark-only tokens are applied** (e.g. a token CSS var resolves / no light-theme variant) and that **Todo text containing HTML-like characters renders escaped** (XSS-safe): given a description like `<img src=x onerror=alert(1)>`, assert it appears as literal text and no `<img>` element is created.
  - [x] Confirm `npm run test` and `npm run coverage` run green; report real numbers. Coverage stays **report-only** this story (gate flips in 6.2). Backdrop/three.js tuning stays excluded per `vitest.config.ts`.

- [x] **Task 7 — AI integration log**
  - [x] Append a brief Story 3.1 entry to `docs/AI-INTEGRATION-LOG.md` describing the AI-assisted frontend foundation work (tokens, panel, API client, List + states). Keep it factual; no "training demo" framing.

### Review Findings

Code review (2026-07-23, adversarial 3-layer: Blind Hunter + Edge Case Hunter + Acceptance Auditor; diff = working tree vs baseline `c9ca02f`). Outcome: **Approved with minor patches applied.** No high-severity findings. 2 patches applied, 1 deferred (spec-timing), 3 dismissed as noise.

- [x] [Review][Patch] Panel scrim relied solely on `color-mix()`; added an opaque `background-color: var(--panel-bg)` fallback so the load-bearing scrim (text-contrast a11y device) survives on browsers without `color-mix` instead of leaving text over the void [frontend/src/styles/global.css `.orbit-panel`] — fixed.
- [x] [Review][Patch] Redundant "Todos" accessible name: panel `<section aria-label="Todos">` duplicated the `<h1>Todos</h1>`; switched to `aria-labelledby="orbit-title"` associating the region with its heading [frontend/src/components/Panel.tsx] — fixed.
- [x] [Review][Defer] AC3 clause "empty state … with the input focused (desktop)" is not implemented: the real add-input (and its desktop autofocus) is Story 3.2; this story renders an `aria-hidden` placeholder slot, so there is no correct focusable input to focus yet. Deferred to Story 3.2 — implementing focus on the placeholder would be an a11y anti-pattern. Not a defect in 3.1.

Dismissed (no action): (1) `apiFetch` header spread would let a future caller's `headers` override the default `Content-Type` — a Story 3.2+ mutation concern, not exercised by this read-only diff; (2) `Todo` error-envelope type named `ApiErrorEnvelope`/`ApiErrorDetail` rather than the task's illustrative `ApiError` — cosmetic, clearer; (3) a contract-violating `{}` success body would not crash the List — TanStack Query v5 converts an `undefined` `queryFn` return into an error state (the retryable error UI), not a throw.

## Dev Notes

### Critical context — do NOT deviate

- **This story starts the real UI.** Build on the existing Story 1.1 scaffold (`frontend/`); do NOT recreate config, tooling, or the project. Replace the placeholder bodies of `src/App.tsx` and `src/types.ts` (they are explicitly marked as Story 1.1 placeholders to be replaced in Epic 3).
- **Scope discipline (defer, don't build):** The working add-input + optimistic create is **Story 3.2**; row toggle/delete interaction is **Story 3.3**; footer Clear-completed + Undo toast is **Story 3.4**; keyboard/SR/responsive hardening is **Story 3.5**; the three.js backdrop is **Epic 4 (Story 4.1)**. This story builds ONLY: tokens, panel shell (with placeholder slots), the read-only API client + List query, and the List view with loading/empty/error/loaded states + a minimal read-only row. Structure components so the later stories slot in cleanly, but do not implement their behavior.
- **Backdrop mount point:** leave a clean, isolated placeholder layer only (fixed, `aria-hidden`, `pointer-events:none`, plain gradient). No `three` import in this story. [Source: ARCHITECTURE-SPINE.md#AD-8; epics.md#Story-3.1]

### Design tokens — exact values (from DESIGN.md front-matter)

Colors (18): `surface-void #070A14`, `surface-void-far #0B1020`, `surface-scrim #0E1324`, `surface-raised #161C31`, `surface-raised-hover #1E2540`, `ink-primary #EEF1FA`, `ink-secondary #A7AFC8`, `ink-completed #727C99`, `ink-disabled #525A74`, `accent #7AA8FF`, `accent-strong #9CC0FF`, `accent-ink #07122B`, `border-hairline #242B45`, `border-focus #9CC0FF`, `danger #FF8A8A`, `danger-ink #2A0E0E`, `star-cube #8FB2FF`, `star-cube-dim #39456E`.
Type roles: `title 22/600 lh1.2 -0.01em`, `input 17/400 lh1.4`, `body 16/400 lh1.45`, `meta 13/400 lh1.4`, `button 14/500 lh1 +0.01em`. Family for all: `Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`.
Rounded: sm 8, md 14, lg 20, full 9999. Spacing: 1=4, 2=8, 3=12, 4=16, 5=24, 6=32, 7=48; panel-max 560px.
Panel: bg `surface-scrim` @ **0.72** opacity, radius `lg`, 1px `border-hairline`, one soft ambient shadow (the ONLY shadow in the product). [Source: DESIGN.md#Colors, #Typography, #Layout-Spacing, #Components]

### Visual rules that must hold

- **Scrim is the load-bearing a11y device:** Todo text sits on the ~72% `surface-scrim` panel, never directly on the (future) star field. Keep the panel opaque enough that contrast is independent of the backdrop. [Source: DESIGN.md#Colors; EXPERIENCE.md#Accessibility-Floor]
- **Dark-only, no light theme** (resolved human decision). No second accent hue, no category color-coding, no gradients-on-buttons, no shadows as ornament. [Source: DESIGN.md#Brand-Style, #Do's-and-Don'ts; EXPERIENCE.md#Open-Questions]
- **Newest-first, in place:** render server order as-is; never re-sort or reorder. [Source: ARCHITECTURE-SPINE.md#AD-3]
- **200% zoom / font scaling must not clip.** Use relative units where reasonable. [Source: DESIGN.md#Typography]

### Microcopy — use EXACTLY (EXPERIENCE.md Voice & Tone)

- Empty state: `Nothing to do — add something above.`
- Load error: `Couldn't load your list. Retry`
- Loading: **no text** — skeleton rows carry it.
- (For later stories, do not use here) placeholder `What needs doing?`, validation `Type something first.` / `That's a bit long — keep it under 500 characters.`, action error `Couldn't save that — try again.`
Voice is calm, plain — no exclamation marks, no emoji, no error codes. [Source: EXPERIENCE.md#Voice-and-Tone]

### Data layer — contract & architecture

- **API base:** `/api` (versionless). Read from `VITE_API_BASE_URL`; `frontend/.env.example` currently sets `http://localhost:8000/api` for dev. Default to `/api` when unset (single-origin composed stack, AD-10). [Source: ARCHITECTURE-SPINE.md#AD-4, #AD-10; frontend/.env.example]
- **GET /api/todos** → `200 { "todos": [Todo, …] }`, ordered `created_at` DESC (newest-first), `id` tiebreak. Error → AD-5 envelope. [Source: ARCHITECTURE-SPINE.md#API-Contract]
- **`Todo` wire shape (verified against backend `schemas/todo.py`):** `{ id: uuid string, description: string, completed: bool, created_at: ISO-8601 UTC with trailing "Z" }`. The backend `TodoRead._serialize_created_at` emits `…Z` (e.g. `2026-07-23T15:04:05Z`). TS type mirrors the wire exactly — `snake_case`, no mapping layer. [Source: backend/app/schemas/todo.py; ARCHITECTURE-SPINE.md#AD-3, Consistency-Conventions]
- **Error envelope (verified against backend `core/errors.py`):** `{ "error": { "code": string, "message": string, "details"?: [{ "field": string, "issue": string }] } }`. Observed codes: `validation_error` (422), `not_found` (404), `internal_error` (500), `db_unavailable` (503), `http_404`. Parse this ONE shape everywhere. [Source: backend/app/core/errors.py; ARCHITECTURE-SPINE.md#AD-5]
- **TanStack Query (v5) owns server state (AD-6):** the List query lives in `useTodos`; components never hold their own copy. This story is read-only; `onMutate/onError/onSettled` optimistic machinery arrives with the 3.2+ mutations. Every loading state must resolve to loaded/empty/error — never a hanging spinner. [Source: ARCHITECTURE-SPINE.md#AD-6; EXPERIENCE.md#State-Patterns]
- **Dependency direction:** `components → hooks → api client → HTTP`. Components must not import `fetch`/the client directly; go through `useTodos`. Backdrop shares no state with components. [Source: ARCHITECTURE-SPINE.md#Invariants-Rules]

### Source tree — where files go (from ARCHITECTURE-SPINE.md Source tree)

```
frontend/src/
  main.tsx                # add QueryClientProvider + import global/tokens css   (UPDATE)
  App.tsx                 # compose Panel + zones + TodoList (replace placeholder) (UPDATE)
  types.ts                # Todo, TodoListResponse, ApiError (replace placeholder) (UPDATE)
  api/client.ts           # typed fetch wrapper + ApiClientError                  (NEW)
  api/todos.ts            # getTodos()                                            (NEW)
  hooks/useTodos.ts       # useQuery(['todos'])                                   (NEW)
  components/Panel.tsx        (NEW)
  components/TodoList.tsx     (NEW)
  components/TodoRow.tsx      (NEW, minimal read-only)
  components/SkeletonRows.tsx (NEW)
  components/EmptyState.tsx   (NEW)
  components/InlineError.tsx  (NEW)
  styles/tokens.css / global.css (NEW)
  backdrop/               # leave placeholder mount only (NO three.js this story)
  *.test.tsx / *.test.ts  # Vitest colocated                                     (NEW)
```
Naming (TS): `PascalCase` components one-per-file matching filename; `camelCase` funcs/vars; hooks `useX`. [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions, #Source-tree]

### Testing standards

- **Vitest + @testing-library/react**, jsdom env, colocated `*.test.{ts,tsx}` (globals on; `src/test-setup.ts` registers jest-dom). Config already in `frontend/vitest.config.ts`. [Source: frontend/vitest.config.ts; ARCHITECTURE-SPINE.md#Testing-Architecture]
- **Mock the API/query layer** — no real network, no Postgres. Use `vi.mock('../api/todos')` and/or `vi.stubGlobal('fetch', …)`; wrap components in a fresh `QueryClientProvider` per test with `retry:false`.
- **Coverage:** v8 provider, branch coverage on, `all:true`; **report-only** this story (enforcing ≥70% gate lands in Story 6.2). Established exclusions in config: `main.tsx`, `types.ts`, tests, `test-setup.ts`, `backdrop/**`. Do not touch those exclusions. [Source: frontend/vitest.config.ts; ARCHITECTURE-SPINE.md#Testing-Architecture]
- Required scenarios (from epics.md Test Scenarios): client parses success + AD-5 error; List renders skeleton→loaded / →empty / →error+Retry by query state; Retry refetches; long description wraps; dark-only tokens applied; HTML-like Todo text renders escaped. [Source: epics.md#Story-3.1]
- **Run the tests for real; report actual pass/fail + coverage %. Never fake passing tests.**

### Accessibility floor (baseline this story; full hardening in 3.5)

- List is a labeled list region; title is the page heading. Interactive elements (Retry button) are real focusable `<button>`s with a visible 2px `border-focus` ring deriving contrast from the panel (not the backdrop). Backdrop placeholder is `aria-hidden` + non-focusable. Completed-styling cues (checkbox+strikethrough+ink) are a Story 3.3 concern but keep the row markup ready. [Source: EXPERIENCE.md#Accessibility-Floor]

### Project Structure Notes

- Aligns with ARCHITECTURE-SPINE.md Source tree exactly; the placeholder dirs (`api/`, `hooks/`, `components/`, `styles/`, `backdrop/`) already exist with `.gitkeep` from Story 1.1 — add files into them (the `.gitkeep`s can remain or be removed once real files land; harmless either way).
- No backend changes. Only edit `frontend/**`, this story file, `sprint-status.yaml`, and `docs/AI-INTEGRATION-LOG.md`. [Source: task constraints]
- Runtime: **Node 22** via `nvm use` (`.nvmrc` = 22). Use project-local `frontend/node_modules` (`npm install`/`npm ci` in `frontend/`); no global installs. Deps already declared: `@tanstack/react-query ^5.62`, `react ^19.2`, `three ^0.185` (do not import three this story). [Source: frontend/package.json; .nvmrc; CLAUDE.md runtime policy]

### Previous story intelligence

- **Story 1.1** created the frontend scaffold: `App.tsx`/`types.ts` are intentional placeholders to replace now; `vitest.config.ts` already excludes `backdrop/**` and type/entrypoint files; `App.test.tsx` is a placeholder test that asserts the old heading `nearform_todo_app` — **update or replace it** since the heading becomes "Todos" (don't leave a failing legacy test).
- **Epic 2 (backend)** is complete and is the contract source: `GET /api/todos` returns `{ todos: [...] }` newest-first; error envelope confirmed in `core/errors.py`; `created_at` emitted with trailing `Z`. These are verified facts, not assumptions.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.1] — authoritative ACs + test scenarios
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/DESIGN.md] — tokens, components, do/don'ts
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/EXPERIENCE.md] — IA zones, state patterns, Voice & Tone, a11y floor
- [Source: _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md] — AD-1/3/4/5/6/8/10, API contract, source tree, conventions, testing
- [Source: backend/app/schemas/todo.py, backend/app/core/errors.py, backend/app/api/routes/todos.py] — verified wire + error shapes
- [Source: frontend/package.json, frontend/vitest.config.ts, frontend/.env.example, frontend/src/*] — existing scaffold

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `claude-opus-4-8[1m]`

### Debug Log References

- Node 22.23.1 via nvm (`.nvmrc` = 22); `npm ci` in `frontend/` (297 pkgs, 0 vulnerabilities). No global installs; no new dependencies added.
- Test toolchain issue resolved: asserting the dark-only token layer via a `?raw` CSS import failed (Vitest stubs CSS imports → empty string) and `node:fs` failed `tsc` (no `@types/node`, out of scope). Fixed by enabling Vitest `css: true` and asserting tokens are *applied* — injected into jsdom and resolvable via `getComputedStyle(:root)`. Added `src/vite-env.d.ts` (`/// <reference types="vite/client" />`) so `import.meta.env` and CSS module types resolve under `tsc`.
- Final: eslint + `tsc --noEmit` clean; `vitest run` 21/21 passed; `vite build` succeeds (three.js correctly NOT bundled — not imported this story).

### Completion Notes List

- All 6 ACs satisfied. Built on the Story 1.1 scaffold (did not recreate it); replaced the placeholder bodies of `App.tsx` / `types.ts` and the legacy `App.test.tsx`.
- **Design tokens** (`styles/tokens.css`): the 18 colours, 5 type roles, radius + spacing scales, `--space-panel-max: 560px`, `--panel-bg-opacity: 0.72`, and the 7 component token groups — all as `:root` CSS custom properties, dark-only (`color-scheme: dark`, no `prefers-color-scheme`/light variant). `styles/global.css` sets the void base + radial falloff and all component classes; both imported from `main.tsx`.
- **Panel shell** (`components/Panel.tsx`): translucent `surface-scrim` at 72% (`color-mix`), rounded-lg, 1px hairline, one ambient shadow, centered ≤560px; zones Title("Todos") → add-input slot (placeholder for 3.2) → List → footer slot (placeholder for 3.4).
- **API client** (`api/client.ts` + `api/todos.ts`): thin typed `fetch` over `VITE_API_BASE_URL ?? '/api'`; parses the one AD-5 envelope into `ApiClientError`; handles 204 + network failure. `getTodos()` unwraps `{ todos: [...] }`. `Todo` type mirrors the wire exactly (snake_case, `created_at` string with `Z`).
- **State ownership** (`hooks/useTodos.ts` + `QueryClientProvider` in `main.tsx`, `retry:false`): TanStack Query owns the List query; components read through the hook (no direct client imports).
- **Three states** (`TodoList.tsx`): `isPending` → `SkeletonRows` (4 shimmer rows, no spinner, reduced-motion aware); `isError` → `InlineError` "Couldn't load your list." + "Retry" button wired to `refetch()` (frame/input stay rendered); empty `data` → `EmptyState` "Nothing to do — add something above."; else `<ul>` of `TodoRow` in **server order** (not re-sorted). Microcopy is verbatim from EXPERIENCE.md.
- **Row** (`TodoRow.tsx`): minimal/read-only — visual checkbox + description as escaped text (React child, no `dangerouslySetInnerHTML`, XSS-safe) + delete placeholder; long text wraps. Toggle/delete deferred to Story 3.3.
- **Backdrop mount point** (`backdrop/Backdrop.tsx`): clean fixed, `aria-hidden`, `pointer-events:none` placeholder rendering only the void gradient. No `three` import, no canvas, no animation — Epic 4 / Story 4.1 replaces its body.
- **Tests:** 21 passing across `api/client.test.ts`, `components/TodoList.test.tsx`, `components/InlineError.test.tsx`, `styles/tokens.test.ts`, `App.test.tsx` — API layer mocked (`vi.mock('../api/todos')` / `vi.stubGlobal('fetch')`), no real network. Coverage (report-only, v8, branch on): Statements 100%, Branches 100%, Functions 100%, Lines 100% on the covered set. Established exclusions unchanged; added `test-utils.tsx` and `*.d.ts` to exclusions.
- **Scope deferred as designed:** working add-input (3.2), row toggle/delete + completed styling (3.3), footer Clear-completed + Undo toast (3.4), keyboard/SR/responsive hardening (3.5), three.js backdrop (4.1).

### File List

**New — frontend/src/**
- `styles/tokens.css`
- `styles/global.css`
- `api/client.ts`
- `api/todos.ts`
- `hooks/useTodos.ts`
- `components/Panel.tsx`
- `components/TodoList.tsx`
- `components/TodoRow.tsx`
- `components/SkeletonRows.tsx`
- `components/EmptyState.tsx`
- `components/InlineError.tsx`
- `backdrop/Backdrop.tsx`
- `vite-env.d.ts`
- `test-utils.tsx`
- `api/client.test.ts`
- `components/TodoList.test.tsx`
- `components/InlineError.test.tsx`
- `styles/tokens.test.ts`

**Modified**
- `frontend/src/App.tsx` (replaced placeholder → composition root)
- `frontend/src/main.tsx` (QueryClientProvider + stylesheet imports)
- `frontend/src/types.ts` (replaced placeholder → wire types)
- `frontend/src/App.test.tsx` (heading is now "Todos"; shell/backdrop/no-onboarding assertions)
- `frontend/vitest.config.ts` (`css: true`; excludes `*.d.ts` + `test-utils.tsx`)
- `docs/AI-INTEGRATION-LOG.md` (Story 3.1 entries: sections 1 and 3)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status tracking)

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-23 | Story 3.1 implemented: Orbit design tokens, translucent Panel shell (with placeholder add-input/footer slots + clean Epic-4 backdrop mount), typed `/api` client with one AD-5 error shape, TanStack Query List hook, and `TodoList` with loading/empty/loaded/error(+Retry) states and minimal read-only rows. 21 Vitest tests, 100% coverage (report-only), lint + build green. Status → review. |
| 2026-07-23 | Code review (3-layer adversarial): approved. Applied 2 patches — opaque panel-scrim fallback for browsers without `color-mix` (a11y), and `aria-labelledby` on the panel region instead of a duplicate literal label. 1 finding deferred to Story 3.2 (empty-state input focus, AC3). Re-verified: 21 tests pass, 100% coverage, lint + build green. Status → done. |

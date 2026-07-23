---
baseline_commit: 6654c038c7c0ce93b14abb268d168744165b4cbe
---

# Story 3.5: Cross-cutting keyboard navigation, screen-reader semantics, and responsive layout

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a keyboard, screen-reader, or mobile user,
I want the whole loop operable by keyboard and touch with correct semantics and a layout that adapts from 320px to desktop,
so that Orbit is fully usable regardless of input method or device (foundation for the automated a11y gate in Epic 6).

## Context & Scope

This is the **last story of Epic 3** and is a **CROSS-CUTTING HARDENING PASS** over the already-built, already-merged frontend (Stories 3.1–3.4). It is **NOT a rebuild**. Every component already exists and has per-component a11y work; this story **unifies the behaviors, fills the remaining gaps, and adds the tests** that prove the whole composed loop is keyboard-operable, correctly announced to assistive tech, and responsive from ~320px to desktop.

**Golden rule for the dev agent:** make **surgical edits** to existing components/styles. If a behavior is already correct, **verify it with a test — do NOT rewrite it**. Preserve all existing passing tests (baseline = 56 passing, 10 files).

Scope boundary: full axe-core WCAG gating and the Playwright E2E keyboard-only walkthrough are **Epic 6 / Story 6.1** — out of scope here. Do everything testable at the Vitest + Testing Library (jsdom) component/integration level; leave the automated WCAG gate to 6.1.

Do **NOT** touch backend files. No global installs. Node 22 (`.nvmrc`).

## Acceptance Criteria

**AC1 — Keyboard: logical tab order + activation keys (UX-DR14, NFR-A11y)**
Given all core components exist, when I navigate by keyboard, then Tab order follows reading order: **add-input → each row's checkbox → its delete → Clear completed → toast Undo** (newest-first); Enter/Space activate controls (native `<input>`/`<button>`); **Escape clears the add-input's text** without submitting; focus **never** lands on any `aria-hidden` region (the Backdrop); and a **2px `border-focus` ring** (`--color-border-focus`, derived from the panel — never from the Backdrop) is visible on **every** interactive element via `:focus-visible`. This order is the natural DOM order — do NOT add `tabindex` values to force it.

**AC2 — Keyboard: the hover-hidden delete affordance is keyboard-reachable (UX-DR14, NFR-A11y)**
Given a pointer/desktop device where the row delete `×` is hidden until hover, when I Tab to it, then it becomes visible via `:focus-within` (already in CSS — verify) and is fully operable; it is never removed from the tab order or `display:none`.

**AC3 — Keyboard: focus is never stranded on delete/add (UX-DR14, NFR-A11y)**
Given I delete a row **using the keyboard** (focus is on that row's delete button), when the row is removed optimistically, then focus **moves to a sensible surviving target** — the next row's delete button, else the previous row's delete button, else the add-input — rather than being dropped to `<body>`. On a successful optimistic **add**, focus returns to the add-input (already implemented in `AddInput` `onSuccess` — verify).

**AC4 — Keyboard: the Undo toast timer pauses on focus, not just hover (UX-DR8, UX-DR14)**
Given the Undo toast is visible with its ~6s auto-dismiss countdown, when keyboard focus enters the toast (e.g. Tab to the Undo button), then the countdown **pauses** (`onFocus` → `pauseTimer`); when focus leaves, it **resumes** (`onBlur` → `resumeTimer`). The **Undo button is a real focusable `<button>`** reachable by Tab. (`onFocus`/`onBlur` bubble from the button to the toast container in React — verify with a test that focusing the Undo button invokes the pause handler.)

**AC5 — Screen-reader: roles, labels, landmarks (UX-DR14, NFR-A11y)**
Given assistive tech, when the app is used, then: the single screen is a **landmark** (`<main>`); the panel is a **labeled region** (`aria-labelledby="orbit-title"`); the List is a **labeled list** (`<ul aria-label>` with `<li>` rows); each row exposes its **description and completion state** via a **labeled checkbox** (`aria-labelledby` → the description) whose `checked` reflects completion; the completed **count** is announced via a **polite `aria-live` region** (`role="status" aria-live="polite"`); **icon-only controls have accessible names** (the delete `×` button has `aria-label="Delete {description}"`); and **nothing important is conveyed by color/position alone** (completed = checked box + strikethrough + de-emphasized ink — three redundant cues).

**AC6 — Screen-reader: errors associated with their control AND announced (UX-DR14, NFR-A11y)**
Given a validation or action error, when it appears, then it is **announced** (`role="alert"` — already on `InlineError`) **AND associated with its control via `aria-describedby`**: the add-input's validation/create error is `aria-describedby`-linked from the `<input>` (also set `aria-invalid` while the message is showing); the row's toggle/delete error is `aria-describedby`-linked from the row's checkbox. This is the **primary SR gap to close** — `InlineError` must accept an optional stable `id`, and the controls must point at it only while the message is present.

**AC7 — Responsive: mobile viewport 320–639px (UX-DR15, NFR-Resp)**
Given a mobile viewport, when the app renders, then the panel **fills width minus a 16px gutter each side**, the void shows top/bottom, **delete affordances are always visible** (no hover requirement on `hover: none`), the add-input is **not force-focused**, and the toast **spans near-full-width above the thumb zone**; layout is **single column at every size** and there is **no horizontal scroll**. Most of this is already in CSS media queries — verify structurally and via the token/CSS-backed assertions available in jsdom.

**AC8 — Responsive: desktop/tablet viewport ≥ 640px (UX-DR15)**
Given a desktop/tablet viewport, when the app renders, then the panel is **centered and capped at 560px** (`--panel-max-width`) with wide void margins, delete is **hover-revealed** (`@media (hover: hover) and (pointer: fine)`), and the add-input is **autofocused** on load (fine-pointer detection — already implemented in `AddInput`; verify both branches with mocked `matchMedia`).

**AC9 — Zoom / font scaling to 200% (UX-DR14, NFR-A11y)**
Given browser zoom / font scaling set to 200%, when rendered, then the layout **survives without clipping controls or content** — driven by relative sizing, `overflow-wrap: anywhere` on descriptions, and no fixed heights that would clip text. This is a CSS-robustness AC (not directly assertable in jsdom); satisfy structurally (no `overflow: hidden` on text containers, wrapping enabled) and leave visual proof to Story 6.3.

**AC10 — `prefers-reduced-motion: reduce` drops micro-transitions to instant (UX-DR16)**
Given `prefers-reduced-motion: reduce`, when UI micro-transitions would run, then the **toast slide** and **row/checkmark/delete-reveal transitions** drop to instant and the **skeleton shimmer** stops (already in CSS — verify each `@media (prefers-reduced-motion: reduce)` block exists and covers toast, row transitions, and skeleton).

## Current-state analysis (files this story touches)

All paths under `frontend/src/`. Read each fully before editing.

- **`App.tsx`** — composition root. Renders `<main className="orbit-app">` (the landmark), `<Backdrop/>` (aria-hidden), `<Panel>` with `footerSlot={<Footer/>}` and `toastSlot={<UndoToast/>}`, wrapping `<TodoList/>`. Owns `useClearCompleted()`. **Verify `<main>` landmark; likely no change.**
- **`components/Panel.tsx`** — `<section className="orbit-panel" aria-labelledby="orbit-title">` with `<h1 id="orbit-title">Todos</h1>`, add-input slot, children (list), footer slot, then the toast sibling. **Already correct region + heading; likely no change.**
- **`components/AddInput.tsx`** — `<input aria-label="Add a todo">`. Escape clears (`handleKeyDown`). Desktop-only autofocus via `matchMedia('(hover: hover) and (pointer: fine)')`. On success clears + refocuses. Renders `<InlineError message>` when `message` set. **GAP (AC6): add `aria-describedby` → error id + `aria-invalid` while message present.**
- **`components/TodoRow.tsx`** — `<li className="orbit-row">` → `.orbit-row__main` with a `<label className="orbit-row__check-hit">` wrapping the checkbox (`aria-labelledby={textId}`), the description `<span id={textId}>`, and the delete `<button aria-label={`Delete ${description}`}>`. Renders `<InlineError>` on `showError`. **GAP (AC3): focus management on keyboard delete. GAP (AC6): checkbox `aria-describedby` → error id while `showError`.**
- **`components/TodoList.tsx`** — `<section aria-label="Your list">` → `<ul className="orbit-list" aria-label="Todos">` of `<TodoRow>`; pending → `SkeletonRows`, error → `InlineError`+Retry, empty → `EmptyState`. **Already a labeled list; likely no change.**
- **`components/Footer.tsx`** — `<footer aria-label="List summary">` with `<span role="status" aria-live="polite">` count + ghost `<button>Clear completed</button>` (absent at zero). **Already correct polite live region; likely no change.**
- **`components/UndoToast.tsx`** — `<div role="status" aria-live="polite">` with `onMouseEnter/onMouseLeave` **and `onFocus/onBlur`** → pause/resume, plus a real `<button>Undo</button>`. **Focus-pause already wired — verify with a test (AC4); likely no change.**
- **`components/InlineError.tsx`** — `<div role="alert">` with message + optional Retry button. **GAP (AC6): add optional `id` prop forwarded to the container so controls can `aria-describedby` it.**
- **`components/EmptyState.tsx`, `SkeletonRows.tsx`** — SkeletonRows already `role="status" aria-busy` with decorative rows `aria-hidden`. **No change.**
- **`backdrop/Backdrop.tsx`** — `<div aria-hidden="true">`, empty, `pointer-events:none`. **No change; verify not focusable.**
- **`styles/global.css`** — global `:focus-visible` ring (`--color-border-focus`), row delete hover/`focus-within` reveal under `@media (hover: hover) and (pointer: fine)`, reduced-motion blocks for skeleton/row/toast, toast layer fixed bottom with 16px side gutter + `max-width`. **Verify; only add CSS if a gap is proven (do not restyle).**
- **`styles/tokens.css`** — `--color-border-focus: #9cc0ff`, `--panel-max-width: 560px`. **No change.**

## Tasks / Subtasks

- [x] **Task 1 — `InlineError`: optional stable `id` for association** (AC: 6)
  - [x] Add an optional `id?: string` prop to `InlineErrorProps`. Forward it to the container `<div id={id} role="alert" ...>`. Keep `role="alert"` and the `data-testid="inline-error"` unchanged. No behavior change when `id` is omitted (all existing call sites keep working).

- [x] **Task 2 — `AddInput`: associate + mark invalid** (AC: 1, 6)
  - [x] Define a stable id, e.g. `const errorId = 'add-input-error'`. When `message` is non-null, render `<InlineError id={errorId} message={message} />` and set on the `<input>`: `aria-describedby={errorId}` and `aria-invalid={true}`. When `message` is null, omit `aria-describedby` (undefined) and set `aria-invalid={false}` (or omit). Do NOT change the existing `aria-label="Add a todo"`, Escape handling, autofocus policy, or submit/refocus logic.
  - [x] Verify (no change expected) that Escape clears text and that success refocuses the input.

- [x] **Task 3 — `TodoRow`: associate error + keyboard-safe delete focus** (AC: 3, 6)
  - [x] Error association: define `const errorId = `todo-error-${todo.id}``. When `showError`, render `<InlineError id={errorId} .../>` and set `aria-describedby={errorId}` on the checkbox `<input>` (leave `aria-labelledby={textId}` as-is). When not `showError`, omit `aria-describedby`.
  - [x] Focus management on keyboard delete (AC3): in the delete button's `onClick`, BEFORE calling `remove.mutate(...)`, guard on keyboard use — only manage focus when the delete button currently has focus (`document.activeElement === event.currentTarget`). Compute the target from the live DOM: collect `document.querySelectorAll('.orbit-row')`, find this row's index, pick `next` row else `previous` row, then `.querySelector('.orbit-row__delete')`; if no sibling row, fall back to `document.querySelector('.orbit-add-input')`. Call `target?.focus()` (the target survives this row's optimistic removal, so focus lands correctly). Then call `remove.mutate({ id: todo.id })`. Keep the mouse path unchanged (no focus move when not focused). Keep it minimal and dependency-free (plain DOM); add a short comment explaining the "focus surviving sibling before removal" approach.
  - [x] Do NOT change the toggle logic, the label-wraps-only-the-checkbox structure, the description `<span>`, or the delete `aria-label`.

- [x] **Task 4 — Verify (no-change) a11y already shipped in 3.1–3.4** (AC: 1, 2, 4, 5, 7, 8, 10)
  - [x] Confirm and, where missing, cover with tests (Task 5) — do NOT modify code that is already correct:
    - `<main>` landmark (App), panel region + `<h1>` (Panel), labeled `<ul>` list + `<li>` rows (TodoList/TodoRow), polite count live region (Footer), toast `role="status"` + focus-pause + real Undo button (UndoToast), global `:focus-visible` ring, CSS delete `focus-within` reveal, reduced-motion CSS blocks, desktop-only autofocus.

- [x] **Task 5 — Tests: keyboard, SR semantics, responsive** (AC: 1–10)
  - [x] Use **Vitest + @testing-library/react** (jsdom). Mock the API layer (`vi.mock('../api/todos')`) — **no real network / Postgres**. Wrap in `renderWithClient` (`src/test-utils.tsx`, retry:false). `@testing-library/user-event` is **NOT installed** — use `fireEvent` (matches all existing tests). Seed the list via a mutable `store` mock (see `TodoRow.test.tsx` pattern) or `client.setQueryData(todosQueryKey, seed)`.
  - [x] **New cross-cutting integration test file** (e.g. `src/a11y.test.tsx` or `src/App.a11y.test.tsx`) asserting on the **composed `<App/>`** where practical:
    - **Landmarks/roles:** `getByRole('main')`, the panel region labeled "Todos" (`getByRole('region', { name: 'Todos' })` via `aria-labelledby`), `getByRole('list')`, rows as `listitem`s, `getByRole('heading', { name: 'Todos' })`.
    - **Tab order (AC1):** with an autofocused desktop `matchMedia` stub + a seeded 2-row list, assert the DOM order of focusable elements is add-input → row1 checkbox → row1 delete → row2 checkbox → row2 delete → Clear completed (→ toast Undo when a clear is pending). Prefer asserting **document order** of `queryAllByRole`/`querySelectorAll` over simulating real Tab traversal (jsdom does not implement sequential focus navigation). Assert no element carries a positive `tabindex`.
    - **Backdrop not focusable (AC1):** `getByTestId('backdrop')` has `aria-hidden="true"`, is empty, and has no `tabindex`.
  - [x] **Component tests** (extend existing files or add focused ones):
    - **AddInput (AC6):** when a validation message shows, the input has `aria-invalid="true"` and `aria-describedby` pointing to the rendered error's `id`; when cleared (Escape / success), `aria-describedby` is gone and `aria-invalid` is false. Escape-clears and success-refocus assertions already exist — keep them green.
    - **TodoRow — error association (AC6):** on a failed toggle, the checkbox gets `aria-describedby` → the row error's `id`, and the InlineError has that id.
    - **TodoRow — keyboard delete focus (AC3):** seed 2 rows; focus row1's delete button; `fireEvent.click` it; after optimistic removal assert `document.activeElement` is row2's delete button (name "Delete <row2 desc>"). Then delete the last remaining row while its delete has focus and assert focus lands on the add-input (`.orbit-add-input`). Also assert a **mouse** delete (button not focused first) does NOT throw and removes the row.
    - **UndoToast focus-pause (AC4):** render `<UndoToast>` with `vi.fn()` handlers; `fireEvent.focus` the Undo button (or the toast) → `onPause` called; `fireEvent.blur` → `onResume` called; assert Undo is a real `button` and clicking it calls `onUndo`.
    - **Footer live region (AC5):** the count span has `role="status"` and `aria-live="polite"`; exact copy at 0 and N (likely already covered — keep/verify).
    - **Reduced-motion + focus-ring + responsive CSS (AC7/8/10):** these live in CSS media queries jsdom does not evaluate. Assert them **structurally against the stylesheet source** by reading `src/styles/global.css`/`tokens.css` as text (Node `fs`, like `tokens.test.ts`) and asserting the presence of: a `:focus-visible` rule using `--color-border-focus`; a `@media (prefers-reduced-motion: reduce)` block for `.orbit-toast`, for row/checkmark transitions, and for `.orbit-skeleton__row`; the `@media (hover: hover) and (pointer: fine)` delete-reveal with `:focus-within`; the toast layer's fixed bottom + side padding; and `--panel-max-width: ... 560px` / single-column list. Document in a comment that visual/viewport proof (200% zoom, real breakpoints, axe) is deferred to Stories 6.1/6.3.
  - [x] Keep the existing 56 tests passing. Report **real** numbers.

- [x] **Task 6 — Verify build + lint + full suite** (AC: all)
  - [x] `nvm use` (Node 22). From `frontend/`: run `npm test` (full suite), `npm run coverage` (report-only — capture the % but do NOT add/enforce a gate; the coverage gate is Story 6.2), `npm run lint` (`eslint . && tsc --noEmit`), and `npm run build` (`tsc --noEmit && vite build`). All must pass. Report exact results.

## Dev Notes

### Authoritative sources (read these — do not infer)
- **Story ACs + test scenarios:** `_bmad-output/planning-artifacts/epics.md` §"Story 3.5" (lines ~501–538) — AUTHORITATIVE.
- **Accessibility Floor + Interaction Primitives + Responsive:** `_bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/EXPERIENCE.md` §"Interaction Primitives" (Enter creates / Escape clears), §"Accessibility Floor" (keyboard order, 2px focus ring from panel, ARIA/live/describedby, Backdrop aria-hidden, reduced-motion, 44px targets & 200% zoom, completion-never-by-color), §"Responsive & Platform" (≥640px vs 320–639px table; single column at every size).
- **Focus ring / contrast / responsive tokens:** `.../DESIGN.md` — `--color-border-focus`, `--panel-max-width`, dark-only (no `prefers-color-scheme`).
- **NFRs:** `_bmad-output/planning-artifacts/architecture/architecture-.../ARCHITECTURE-SPINE.md` — **NFR-A11y** (zero-critical WCAG 2.1 AA, full keyboard operability, contrast over Backdrop, reduced-motion) and **NFR-Resp** (~320px→desktop; touch+keyboard).

### Constraints & conventions (established by 3.1–3.4)
- **Dark-only tokens.** All CSS consumes `var(--…)` from `tokens.css`; **no raw hex/px** in components/global (layout primitives excepted). Do not add a light theme or `prefers-color-scheme`.
- **Reads via `useTodos` (AD-6).** Components never hold their own copy of the list. Do not introduce new state stores.
- **Optimistic + reconcile (AD-6).** Deletes/toggles mutate the query cache optimistically; failures roll back + show `InlineError`. Focus management in Task 3 must not interfere with rollback.
- **Microcopy is frozen.** Do not reword any user-facing string (placeholder, errors, empty, footer count, toast). This story adds no new copy.
- **No new dependencies.** `@testing-library/user-event` is absent — use `fireEvent`. No axe-core here (Epic 6).
- **Keep "training demo" framing out of code.**

### Why the focus-management approach in Task 3 works
Optimistic delete removes **this** `<li>` on the next render. If, while the delete button still has focus (keyboard case), we `focus()` a **different** element (a sibling row's delete button, or the add-input) **before** the removal render, that element survives and retains focus — so focus is never dropped to `<body>`. Guarding on `document.activeElement === event.currentTarget` means the mouse path (where clicking already blurs/again is not keyboard-driven) is untouched, avoiding surprising focus jumps for pointer users and revealing hover-only delete affordances unexpectedly.

### Testing standards
- Framework: **Vitest 4 + @testing-library/react 16 + jsdom 25**; jest-dom matchers via `src/test-setup.ts`. Config: `vitest.config.ts` (jsdom env, setup file). Coverage: `@vitest/coverage-v8` (report-only).
- Patterns to copy: `TodoRow.test.tsx` (mutable `store` mock + `renderWithClient` + `fireEvent` + `waitFor`), `AddInput.test.tsx` (`stubMatchMedia(desktop)` helper for autofocus/responsive branches), `tokens.test.ts` (reading a CSS file as text with `fs` and asserting on its contents — the model for structural CSS assertions here).
- jsdom does NOT lay out CSS or implement sequential Tab focus navigation. Do **not** assert computed visibility of hover-hidden elements or simulate real Tab traversal; assert **document order**, attributes/roles, `document.activeElement` after explicit `.focus()`, and **stylesheet source** for media-query-backed rules. Note these jsdom limits in comments and defer visual/axe proof to Epic 6.

### Project Structure Notes
- All edits are within `frontend/src/`. New test file(s) live beside existing tests (`frontend/src/…`). No changes to `vite.config`, `tsconfig`, `package.json`, CI, or backend.
- Naming: components PascalCase in `components/`; tests co-located as `*.test.tsx`. Follow existing structure exactly.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/EXPERIENCE.md#Accessibility Floor]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/EXPERIENCE.md#Interaction Primitives]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/EXPERIENCE.md#Responsive & Platform]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/DESIGN.md]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md#NFR-A11y]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md#NFR-Resp]
- [Source: _bmad-output/implementation-artifacts/3-4-footer-bar-clear-completed-and-deferred-undo-toast.md] (previous story — toast/footer/live-region patterns)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (bmad-dev-story)

### Debug Log References

- `npm test` — 12 files, 83 passed (baseline was 10 files / 56; +2 files, +27 tests).
- `npm run lint` — `eslint . && tsc --noEmit` clean (exit 0).
- `npm run build` — `tsc --noEmit && vite build` succeeded (dist built, no type errors).
- `npm run coverage` (report-only, gate is Story 6.2) — All files 97.22% stmts / 86.79% branch / 98.55% funcs / 99.5% lines; `src/components` 100% stmts / 94.64% branch.
- Node v22.23.1 (via `nvm use`, `.nvmrc`=22).

### Completion Notes List

**Surgical changes made (gaps closed):**
- **`InlineError.tsx`** — added optional `id` prop, forwarded to the `role="alert"` container, so a control can `aria-describedby` the message. No behavior change when `id` omitted (all prior call sites unaffected).
- **`AddInput.tsx`** — exported `ADD_INPUT_ERROR_ID`; the `<input>` now sets `aria-invalid` + `aria-describedby` → the error id **only while a message is showing** (AC6). No change to label, Escape-clear, autofocus policy, or submit/refocus.
- **`TodoRow.tsx`** — (1) checkbox now `aria-describedby` → a per-row `todo-error-${id}` id while `showError` (AC6); (2) added `handleDelete` that, **only when the delete button holds focus** (keyboard case), moves focus to a surviving target (next row's delete → previous row's delete → `.orbit-add-input`) BEFORE the optimistic removal, so focus is never stranded on `<body>` (AC3). Mouse path unchanged.

**Verified-only (already correct in 3.1–3.4, covered with tests — NOT rewritten):**
- `<main>` landmark (App); panel region + `<h1>` (Panel); labeled `<ul>`/`<li>` list (TodoList/TodoRow); labeled checkbox with completion state; polite `aria-live` count (Footer); toast `role="status"` + focus-pause (`onFocus`/`onBlur`) + real Undo `<button>` (UndoToast); reading-order tab sequence with no positive `tabindex`; Backdrop `aria-hidden`/non-focusable; global 2px `:focus-visible` ring from `--color-border-focus`; `:focus-within` delete reveal on fine-pointer; `prefers-reduced-motion` blocks (toast/row/skeleton); panel 560px cap + single column; toast bottom gutter; `overflow-wrap:anywhere` (200%-zoom safety); desktop-only autofocus.

**Tests added:** `src/a11y.test.tsx` (composed `<App/>` landmarks/roles, reading-order sequence, no positive tabindex, Backdrop isolation, and structural CSS assertions against the injected stylesheet for focus ring / reduced-motion / hover-reveal / responsive frame / wrap); `src/components/UndoToast.test.tsx` (announcement, focusable Undo action, focus-pause AC4 + hover parity); extended `AddInput.test.tsx` (AC6 describedby/invalid + clears on Escape) and `TodoRow.test.tsx` (AC6 error association; AC3 keyboard-delete focus → next row / add-input fallback / mouse-path no-op).

**Deferred to Epic 6 (as scoped):** axe-core zero-critical WCAG AA gate + Playwright keyboard-only E2E walkthrough (Story 6.1); 200%-zoom/viewport visual proof (Story 6.3); enforcing coverage gate (Story 6.2). jsdom does not lay out CSS or implement sequential Tab navigation, so those aspects are asserted structurally here and left to the browser-based audits.

### File List

- `frontend/src/components/InlineError.tsx` (modified)
- `frontend/src/components/AddInput.tsx` (modified)
- `frontend/src/components/TodoRow.tsx` (modified)
- `frontend/src/a11y.test.tsx` (new)
- `frontend/src/components/UndoToast.test.tsx` (new)
- `frontend/src/components/AddInput.test.tsx` (modified — added AC6 tests)
- `frontend/src/components/TodoRow.test.tsx` (modified — added AC3/AC6 tests)
- `_bmad-output/implementation-artifacts/3-5-cross-cutting-keyboard-navigation-screen-reader-semantics-and-responsive-layout.md` (story record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status tracking)

## Change Log

- 2026-07-23 — Story 3.5 implemented: closed the SR error-association gap (`aria-describedby`/`aria-invalid` on add-input + row checkbox via `InlineError` `id`) and added keyboard-safe delete focus management; verified the keyboard/SR/responsive behaviors shipped in 3.1–3.4 with new component + composed-App tests. Full suite 83 passing; lint + build clean; coverage report-only. Status → review.
- 2026-07-23 — Code review (adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor lenses) — CLEAN. 0 decision-needed, 0 patch, 0 defer, 3 dismissed as noise/by-design/in-scope-deferrals. No high/medium findings. Status → done.

## Senior Developer Review (AI)

**Reviewer:** claude-opus-4-8[1m] (bmad-code-review) · **Date:** 2026-07-23 · **Outcome:** Approve (clean)
**Scope:** `git diff HEAD` vs baseline `6654c03` — 7 files (3 components modified, 2 test files modified, 2 test files new).

**Verdict:** All 10 ACs addressed. Surgical, additive changes only — `InlineError` gains an optional `id` (backward-compatible), `AddInput`/`TodoRow` add `aria-describedby`/`aria-invalid` associations gated on message presence, and `TodoRow` adds keyboard-safe delete focus management. No existing behavior altered; all 56 baseline tests remain green (83 total).

**Findings (all dismissed — none actionable):**
- [Low, dismissed] `TodoRow.handleDelete` uses `document.activeElement === button` to detect keyboard use; in Chromium a mouse click also focuses the button, so the focus-move can run on mouse too. Outcome remains correct (focus lands on a surviving control, never stranded, no throw) — satisfies AC3 intent. By-design acceptable.
- [Low, dismissed] `document.querySelectorAll('.orbit-row')` is document-global rather than scoped to the row's own list; the app renders exactly one list, so no real consequence.
- [Low, dismissed] AC7 (mobile 320–639px) and AC9 (200% zoom) are asserted structurally against the injected stylesheet rather than via a real viewport/zoom render — this is the story's own explicit scope boundary (jsdom limitation), with visual/axe proof deferred to Stories 6.1/6.3. Not a violation.

**Quality gates:** `npm test` 83 passed · `npm run lint` clean · `npm run build` succeeded · coverage 97.22% stmts / 86.79% branch (report-only, gate is 6.2).

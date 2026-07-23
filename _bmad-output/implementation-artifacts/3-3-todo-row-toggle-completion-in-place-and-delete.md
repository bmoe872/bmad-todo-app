---
baseline_commit: 253a058170c21f79835dbffdeb8c44f8f37c446a
---

# Story 3.3: Todo row — toggle completion in place and delete

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Maya,
I want to check off a task (and uncheck it) and delete a task, with the change reflected instantly,
so that I can track progress and remove what's no longer relevant.

## Acceptance Criteria

**AC1 — Optimistic toggle in place, both directions (FR-2, FR-5, AD-6, UX-DR4, UX-DR5)**
Given a Todo row (checkbox + description + delete ×; clicking the description does nothing), when I click/tap the checkbox, then it toggles completion **optimistically within ~100ms** and restyles the row **in place** — checked box + strikethrough + `ink-completed` de-emphasized ink (three redundant cues), **never reordering or moving it** — issuing `PATCH /api/todos/{id}`; it toggles **back to active** the same way.

**AC2 — Completed legibility + never color-alone (UX-DR5, UX-DR14, NFR-A11y)**
Given a completed Todo, when rendered, then completed ink stays **≥ 4.5:1 on the scrim** (legible, not a ghost), and completion is **never signaled by color alone** (carries checkbox checked state + strikethrough too).

**AC3 — Optimistic delete + 404-as-already-gone (FR-3, AD-6)**
Given a Todo row, when I click/tap the delete ×, then the row is **removed optimistically** and `DELETE /api/todos/{id}` is issued; a **`404` is treated as already-gone** and reconciled (not surfaced as an error).

**AC4 — Delete affordance visibility + hit targets (UX-DR6, UX-DR15, NFR-A11y)**
Given the delete affordance, when on a **pointer device** it is **hover-revealed**; on **touch** it is **always visible**; every hit target (checkbox, ×) is **≥ 44px**.

**AC5 — Toggle/delete failure rolls back in place + inline error (FR-2, FR-3, FR-7, AD-6, UX-DR13)**
Given a toggle or delete fails server-side, when the mutation errors, then the row **reverts to its prior state/position in place** and a brief inline **"Couldn't save that — try again."** shows near the row; the List **reconciles to true server state**.

**AC6 — Checkbox announces state; description click is a no-op (FR-2, UX-DR4, UX-DR14)**
Given assistive tech, when the checkbox toggles, then it **announces its new completion state** (a real labeled checkbox whose checked state reflects `completed`); clicking the **description text does nothing** (no in-place edit in v1, no accidental toggle) — only the checkbox and × are hit targets.

## Tasks / Subtasks

- [x] **Task 1 — Add `toggleTodo` + `deleteTodo` to the API layer** (AC: 1, 3)
  - [x] Edit `frontend/src/api/todos.ts` (do NOT rewrite the existing `getTodos`). Add `toggleTodo(id: string, completed: boolean): Promise<Todo>` calling `apiFetch<Todo>('/todos/' + id, { method: 'PATCH', body: JSON.stringify({ completed }) })` — returns the updated `Todo` (the `PATCH` success body is a bare `Todo`, not an envelope). Only `completed` is in the body (only `completed` is mutable, AD-3).
  - [x] Add `deleteTodo(id: string): Promise<void>` calling `apiFetch<void>('/todos/' + id, { method: 'DELETE' })` — success is `204` (the client wrapper already maps 204 → `undefined`). Do NOT swallow errors here; `404`-as-already-gone is handled in the hook's `onError`/reconcile, not the api function.
  - [x] Keep the module's doc-comment convention (short "why", AD references). Keep `Content-Type: application/json` (the client sets it by default; the body-carrying `PATCH` needs it — verify the client's header spread does not drop it).

- [x] **Task 2 — Optimistic mutations hook `useTodoMutations.ts`** (AC: 1, 3, 5)
  - [x] Create NEW file `frontend/src/hooks/useTodoMutations.ts`. **Do NOT edit `hooks/useTodos.ts`.** Import the query key read-only: `import { todosQueryKey } from './useTodos'`.
  - [x] Export a `useTodoMutations()` hook returning `{ toggle, remove }` (two `useMutation` results), or two separate exported hooks (`useToggleTodo`, `useDeleteTodo`) — pick one shape and keep it consistent. Both follow the AD-6 lifecycle exactly:
    - `onMutate(variables)`: `await queryClient.cancelQueries({ queryKey: todosQueryKey })`; snapshot `const previous = queryClient.getQueryData<Todo[]>(todosQueryKey)`; apply the optimistic change to the cache with `setQueryData`. **Toggle:** map the list, flipping `completed` on the matching id **in place** (preserve array order — do NOT re-sort or move the element). **Delete:** filter the matching id out. Return `{ previous }` as context.
    - `onError(err, variables, context)`: roll back via `queryClient.setQueryData(todosQueryKey, context.previous)`. For **delete**, if `err` is an `ApiClientError` with `status === 404`, treat as **already-gone**: do NOT roll back (the row is correctly gone) and do NOT surface an error — let `onSettled` reconcile. Otherwise surface the inline action error to the row (see Task 3 for wiring; the hook exposes `isError`/`error` per-mutation, or the component tracks which row failed).
    - `onSettled()`: `queryClient.invalidateQueries({ queryKey: todosQueryKey })` to reconcile to server truth.
  - [x] Use `useQueryClient()` from `@tanstack/react-query`. Type the cache as `Todo[]` (matches `useTodos`'s `useQuery<Todo[]>`).
  - [x] The mutation must key its optimistic edit by `id`; the toggle variable set is `{ id, completed }` (the NEW target state) or `{ id, currentCompleted }` — choose so the optimistic cache write and the `PATCH` body agree. Document the choice.

- [x] **Task 3 — Enhance `components/TodoRow.tsx`** (AC: 1, 2, 3, 4, 5, 6)
  - [x] Replace the visual-only checkbox placeholder with a **real, accessible checkbox** whose `checked` reflects `todo.completed` and whose toggle calls the toggle mutation with the **new** state. Prefer a native `<input type="checkbox">` (visually restyled via CSS) so state announcement is free, OR a `<button role="checkbox" aria-checked={todo.completed}>`. Either way it MUST: expose an accessible name tied to the description (e.g. `aria-label={`Mark "${todo.description}" complete`}` / `...active` by state, or `aria-labelledby` the description), announce the new checked state, and sit in a **≥ 44px** hit target with a **≥ 24px** visual box.
  - [x] Render the description as **plain text** (React child — never `dangerouslySetInnerHTML`; XSS-safe, NFR-Sec). The description element has **no click handler** — clicking it does nothing (AC6). Keep the long-text wrap behavior (`overflow-wrap: anywhere`).
  - [x] Replace the delete placeholder with a **real `<button>`** ("×" glyph or icon) with an accessible label (e.g. `aria-label={`Delete "${todo.description}"`}`), calling the delete mutation on click. Low-emphasis `ink-secondary` → `ink-primary`/`danger` on hover/focus. **≥ 44px** target.
  - [x] Completed styling driven by `data-completed` (already on the `<li>`): checked box + strikethrough on the text + `--todo-row-text-completed` (`ink-completed`) ink. Three cues together — never color alone.
  - [x] Wire the mutations. Options: (a) `TodoRow` calls `useTodoMutations()` itself (simplest — each row owns its handlers); or (b) `TodoList` passes `onToggle`/`onDelete` props down. Story 3.1 shaped props as `{ todo }` and noted 3.3 "adds onToggle/onDelete handlers without restructuring" — either approach is acceptable; if the row calls the hook directly, `TodoList` does not change. **Do NOT edit `Panel.tsx`.** Editing `TodoList.tsx` is allowed ONLY if you choose the prop-drilling approach; prefer the row-owns-hook approach to keep the diff minimal and avoid touching TodoList.
  - [x] Per-row inline action error (AC5): when this row's toggle/delete mutation errors (non-404), show a brief `InlineError` (reuse `components/InlineError.tsx`, message **"Couldn't save that — try again."**, no Retry button) near/under the row. The row visual reverts because the cache rolled back; the error is transient UI state on the row.

- [x] **Task 4 — Styles: append Story 3.3 block to `global.css`** (AC: 1, 2, 4)
  - [x] Append a block **at the END** of `frontend/src/styles/global.css`, opened with the exact comment `/* Story 3.3: todo row toggle/delete */`. Do NOT modify the existing Story 3.1 rules above it.
  - [x] Style the real checkbox: idle 2px `--checkbox-idle-border` border + transparent fill, `--checkbox-radius` (sm); checked `--checkbox-checked-bg` (accent) fill + `--checkbox-checked-mark` (accent-ink) checkmark; ≥ 24px visual box inside a ≥ 44px target (padding/min-size); `--checkbox-focus-ring` focus ring. If using a native input, hide the default appearance (`appearance: none`) and draw the box.
  - [x] Completed row: strikethrough (`text-decoration: line-through`) + `color: var(--todo-row-text-completed)` on `.orbit-row[data-completed="true"] .orbit-row__text`. Keep contrast ≥ 4.5:1 (ink-completed `#727C99` on scrim `#0E1324` already satisfies this per DESIGN.md — do not lower opacity).
  - [x] Delete button: `ink-secondary` idle → `ink-primary`/`danger` on hover/focus; ≥ 44px target. **Hover-reveal on pointer, always-visible on touch:** use `@media (hover: hover) and (pointer: fine)` to hide it by default and reveal on `.orbit-row:hover`/`:focus-within`; under `@media (hover: none)` (touch) keep it always visible. Mirror the existing `@media (hover: hover)` pattern already in global.css. Ensure it is still reachable/visible on keyboard focus even on pointer devices (`:focus-visible` within the row reveals it).
  - [x] Reuse existing tokens only — no raw hex/px beyond layout primitives (match the file's stated convention).

- [x] **Task 5 — Tests (Vitest + Testing Library, mocked API/query)** (AC: 1, 2, 3, 4, 5, 6)
  - [x] Add `frontend/src/components/TodoRow.test.tsx` (component) and, if the hook is unit-tested separately, `frontend/src/hooks/useTodoMutations.test.tsx`. Mock the API layer (`vi.mock('../api/todos')`), render through `renderWithClient` (from `test-utils.tsx`) so the query cache + mutations run. Seed the List cache via the mocked `getTodos` (render `TodoList`) OR by pre-setting `queryClient.setQueryData(['todos'], [...])` and rendering the row/list — no real network.
  - [x] **Toggle both directions, optimistic + in place (no reorder):** an active todo → click checkbox → row shows completed cues immediately (checked + strikethrough class/`data-completed=true`) and `toggleTodo(id, true)` was called; a completed todo → click → back to active and `toggleTodo(id, false)`. With ≥ 2 todos, assert the DOM order of rows is unchanged after a toggle (query the rows before/after; order identical).
  - [x] **Toggle rollback on error:** mock `toggleTodo` to reject (non-404) → after settle the row reverts to its prior state and "Couldn't save that — try again." appears near the row.
  - [x] **Delete optimistic remove:** click × → row disappears immediately and `deleteTodo(id)` called.
  - [x] **Delete rollback reappears:** mock `deleteTodo` to reject with a non-404 error → the row reappears in place and inline error shows. Also assert a **`404`** (`ApiClientError` status 404) is treated as already-gone: row stays removed, **no** inline error.
  - [x] **Description click is a no-op:** clicking the description text calls neither toggle nor delete (assert mocks not called; row state unchanged).
  - [x] **Delete affordance visibility differs pointer vs touch:** mock `matchMedia` for `(hover: none)` vs `(hover: hover)` (jsdom has no layout, so assert on the presence/class/`data-*` hook that CSS keys off, or that the button is rendered always and the visibility contract is encoded in a testable attribute). At minimum assert the delete button is a real focusable `<button>` and both checkbox and × carry accessible names; assert their hit-target sizing hook (class) is present. (Exact CSS hover pixels are not asserted in jsdom — document this limitation.)
  - [x] **a11y:** checkbox exposes checked state reflecting `completed` and an accessible name; toggling flips `aria-checked`/`checked`. Completion carries three cues (checkbox checked + strikethrough + ink class).
  - [x] Run `npm run test` and `npm run coverage`; **report real numbers.** Coverage stays **report-only** (gate flips in 6.2). Do not change `vitest.config.ts` exclusions.

- [x] **Task 6 — Do NOT touch AI-integration log / sprint-status per task constraints**
  - [x] This run explicitly must NOT edit `docs/AI-INTEGRATION-LOG.md` or `sprint-status.yaml`. Skip those updates (they are normally part of the cycle but are out of scope here).

### Review Findings

Code review (2026-07-23, adversarial 3-layer: Blind Hunter + Edge Case Hunter + Acceptance Auditor; diff = working tree vs baseline `253a058`). Outcome: **Approved — clean review.** No high/medium findings; no patches required. All 6 ACs verified satisfied and all task constraints honored (`useTodos.ts` / `Panel.tsx` / `sprint-status.yaml` / AI-log untouched; shared files additive; three completion cues; ≥44px targets; 404-as-already-gone; description-click no-op). 4 low observations reviewed and dismissed:

- Dismissed: `toggle` `onError` does not special-case a PATCH `404` (a todo concurrently deleted elsewhere), so toggling it briefly shows "Couldn't save that — try again." before the reconcile refetch removes it. Spec-compliant: AC3 mandates 404-as-already-gone only for DELETE; AC5 treats a toggle failure as error + reconcile. Not a defect.
- Dismissed: the hover-hidden delete button (`opacity: 0` under `@media (hover: hover) and (pointer: fine)`) remains keyboard-focusable and is revealed by `.orbit-row:focus-within` on focus — verified: no focus trap, keyboard users reach and see it. Correct by design.
- Dismissed: `applyOptimistic`'s `if (previous)` guard and the `context?.previous` rollback guards are unreachable when the List cache is empty (rows only render with a populated cache) — the 3 uncovered branches. Defensive, not dead-in-a-harmful-way.
- Dismissed: empty-string description would yield an empty checkbox accessible name — unreachable; the backend validates `description` as non-empty (1–500 chars).

## Dev Notes

### Critical context — do NOT deviate

- **Scope is exactly:** enhance `components/TodoRow.tsx`; add `hooks/useTodoMutations.ts` (NEW); add `toggleTodo`/`deleteTodo` to `api/todos.ts`; append a Story-3.3 CSS block at the END of `styles/global.css`; add tests. **Nothing else.**
- **Files you MUST NOT edit:** `hooks/useTodos.ts` (import its `todosQueryKey` read-only), `components/Panel.tsx`, `sprint-status.yaml`, `docs/AI-INTEGRATION-LOG.md`, any backend file. [Source: task constraints]
- **`TodoList.tsx`** may be edited ONLY if you deliberately choose prop-drilling (`onToggle`/`onDelete`). Preferred: `TodoRow` calls `useTodoMutations()` directly so `TodoList.tsx` stays untouched and the diff is minimal.
- **No new dependencies.** `@tanstack/react-query ^5.62` and React 19.2 are already installed. No `three` import.
- **Runtime:** Node 22 via `nvm use` (`.nvmrc` = 22); project-local `frontend/node_modules` (already `npm ci`'d). No global installs. [Source: CLAUDE.md runtime policy; frontend/.nvmrc]

### Behavioral rules that must hold (EXPERIENCE.md + DESIGN.md)

- **Toggle restyles in place, never reorders.** Completed items stay exactly where they are, only restyled — so Maya sees progress rather than watching rows jump. This is FR-5 and a DESIGN.md Don't ("Reorder, group, or drop completed items to the bottom"). The optimistic cache edit MUST preserve array order. [Source: EXPERIENCE.md IA/State-Patterns lines 58, 154; DESIGN.md Do's-and-Don'ts line 191]
- **Completion = three redundant cues, never color alone:** checked box + strikethrough + `ink-completed` ink together. [Source: EXPERIENCE.md line 102; DESIGN.md line 190]
- **Completed ink ≥ 4.5:1 on scrim** — `ink-completed #727C99` on `surface-scrim #0E1324` is held at/above AA; pairs with strikethrough + reduced weight, **never** opacity so low it drops below AA. [Source: DESIGN.md lines 133, 197]
- **Only the checkbox and × are hit targets; clicking the description does nothing** (no in-place edit in v1; avoids accidental toggles). [Source: EXPERIENCE.md lines 58, 86]
- **Single-item delete is undo-less** (FR-3) — deliberate, keeps the row interaction one-tap and honest. Undo exists ONLY for bulk Clear-completed (Story 3.4). Do NOT add an undo affordance here. [Source: EXPERIENCE.md lines 60, 88]
- **Delete: hover-revealed on pointer, always visible on touch; ≥ 44px target.** [Source: EXPERIENCE.md lines 60, 124-125; DESIGN.md line 179]
- **Checkbox: soft-square `rounded.sm`, idle 2px `ink-secondary` border/transparent, checked `accent` fill + `accent-ink` mark; ≥ 24px box in ≥ 44px target; `border-focus` ring; announces new state.** [Source: DESIGN.md line 178; UX-DR5]
- **Error patterns (EXPERIENCE.md State Patterns):** Toggle error → checkbox reverts to prior state; brief inline "Couldn't save that — try again." near the row. Delete error → deleted row reappears in place; inline error; List reconciles to true server state. [Source: EXPERIENCE.md lines 77-78]
- **Microcopy verbatim:** action error is exactly **"Couldn't save that — try again."** Calm, plain — no exclamation marks, no emoji, no error codes. [Source: EXPERIENCE.md Voice & Tone line 47; UX-DR13]

### Optimistic mutation strategy (AD-6) — the exact lifecycle

All mutations use TanStack Query with this lifecycle (identical to what the create mutation in 3.2 uses):

- `onMutate`: `cancelQueries` on the List key → snapshot cache → apply optimistic change (`≤ ~100ms` perceived) → return snapshot as context.
- `onError`: roll back to the snapshot → surface a **non-blocking inline** error (never a modal). **Exception:** a `DELETE` returning `404` is already-gone — do not roll back, do not error; reconcile.
- `onSettled`: `invalidateQueries` on the List key to reconcile to server truth.

[Source: ARCHITECTURE-SPINE.md AD-6 line 88; epics.md Story 3.3 test scenarios lines 456-458]

### API contract — exact (verified against backend Epic 2)

- **`PATCH /api/todos/{id}`** — body `{ "completed": bool }` → `200 Todo` (bare Todo, not enveloped). `404` missing, `422` invalid. Only `completed` mutable; toggles both directions; ordering/position unchanged server-side. [Source: ARCHITECTURE-SPINE.md API Contract line 149; epics.md Story 2.2]
- **`DELETE /api/todos/{id}`** — no body → `204` (permanent, no undo). `404` missing → client treats as already-gone and reconciles. [Source: ARCHITECTURE-SPINE.md line 150; epics.md Story 2.2 lines 304-309]
- **Error envelope (AD-5):** `{ "error": { "code", "message", "details"? } }`. The existing `api/client.ts` already parses this into `ApiClientError` carrying `code`, `message`, `status`, optional `details`. Use `err instanceof ApiClientError && err.status === 404` to detect already-gone. [Source: api/client.ts; ARCHITECTURE-SPINE.md AD-5]
- **API base** `/api` (versionless), from `VITE_API_BASE_URL ?? '/api'` — already handled by `client.ts`. Path building: `/todos/${id}`.

### Existing code being modified — current state (READ before editing)

- **`api/todos.ts`** (14 lines): exports only `getTodos()` unwrapping `{ todos: [...] }`. Add `toggleTodo`/`deleteTodo` alongside; do not touch `getTodos`. `apiFetch<T>(path, init)` is the wrapper; `DELETE` returns `undefined` (204 handled). [current file read]
- **`api/client.ts`**: `apiFetch` spreads `...init` **after** setting `headers: { 'Content-Type': 'application/json' }`. NOTE: if a caller passes its own `headers` in `init`, the spread would overwrite the default (Story 3.1 review flagged this as a latent issue). For `PATCH` you only pass `method` + `body`, so the default `Content-Type` survives — do NOT pass a `headers` key from the mutation functions, or you'll drop `Content-Type` and break the JSON body. [current file read; Story 3.1 review dismissed-note #1]
- **`hooks/useTodos.ts`**: exports `todosQueryKey = ['todos'] as const` and `useTodos()` (`useQuery<Todo[]>`). Import the key; **do not edit this file.** [current file read]
- **`components/TodoRow.tsx`** (28 lines): current markup is `<li className="orbit-row" data-completed={todo.completed} data-testid="todo-row">` containing an `aria-hidden` checkbox `<span class="orbit-row__check">`, `<span class="orbit-row__text">{description}</span>`, and an `aria-hidden` `<span class="orbit-row__delete">`. Props are `{ todo }`. The `data-completed` and `data-testid="todo-row"` hooks and the `orbit-row__text` class are relied on by existing `TodoList.test.tsx` (asserts `findAllByTestId('todo-row')` order and `orbit-row__text` class) — **preserve `data-testid="todo-row"`, the `data-completed` attribute, and the `orbit-row__text` class** so the Story 3.1 tests keep passing. [current file read; TodoList.test.tsx lines 69-70, 120]
- **`components/TodoList.tsx`**: maps `data` → `<TodoRow key={todo.id} todo={todo} />` inside `<ul className="orbit-list" aria-label="Todos">`. Only edit if prop-drilling (not preferred). [current file read]
- **`components/InlineError.tsx`**: reusable `role="alert"` inline error; `<InlineError message="..." />` with optional `retryLabel`/`onRetry`. Reuse for the per-row action error (message only, no retry). [current file read]
- **`styles/global.css`**: ends at the `:focus-visible` rule (line ~242). The existing `.orbit-row__check` (24px span) and `.orbit-row__delete` rules are Story-3.1 placeholders — the new Story-3.3 block appends AFTER; you may leave the old placeholder rules or let the new block's real styles take precedence (new selectors like `.orbit-row__check` on the real element will override via source order — keep the new block authoritative). Do NOT delete/rewrite the Story-3.1 section above. [current file read]
- **`styles/tokens.css`**: checkbox tokens already defined (`--checkbox-idle-border`, `--checkbox-checked-bg`, `--checkbox-checked-mark`, `--checkbox-radius`, `--checkbox-focus-ring`) and `--todo-row-text-completed`. Consume these; do not edit tokens.css. [current file read]

### Testing standards

- **Vitest + @testing-library/react**, jsdom, colocated `*.test.{ts,tsx}`, globals on (`test-setup.ts` registers jest-dom). Config in `vitest.config.ts` — do not modify exclusions. [Source: frontend/vitest.config.ts]
- **Mock the API layer** (`vi.mock('../api/todos')`); render via `renderWithClient` (fresh `QueryClient`, `retry:false`) from `test-utils.tsx`. No real network, no Postgres. [Source: test-utils.tsx; TodoList.test.tsx pattern]
- **Deterministic mutation errors:** the test QueryClient has `queries.retry:false`; also ensure mutations don't retry (v5 mutations default to no retry — fine). Use `findBy*`/`waitFor` to await the optimistic apply + settle.
- **jsdom limitation:** CSS hover/pointer media queries have no layout effect; assert the delete button's presence, accessible name, focusability, and the class/attribute the CSS keys off — not computed pixel visibility. Document this in the Dev Agent Record.
- **Run for real; report actual pass/fail + coverage %. Never fake passing tests.** [Source: task]

### Accessibility (baseline; full hardening in 3.5)

- Checkbox is a real labeled checkbox (native `<input type=checkbox>` preferred) whose checked state reflects `completed` and announces on toggle. Delete is a real `<button>` with an accessible name. Both ≥ 44px targets; 2px `border-focus` ring (the global `:focus-visible` rule already applies to `button`/`input`). Description is not focusable/clickable. [Source: EXPERIENCE.md a11y line 97; UX-DR5, UX-DR14]
- Full keyboard-order/responsive hardening (tab order across the composed panel, 200% zoom, reduced-motion row-fade) is **Story 3.5** — do not build it here, but do not regress the row-level a11y.

### Project Structure Notes

- New file `hooks/useTodoMutations.ts` sits beside `hooks/useTodos.ts` per the source tree (`src/hooks/`). Naming: `useX` hook, `PascalCase` components one-per-file, `camelCase` funcs. [Source: ARCHITECTURE-SPINE.md Source tree, Consistency Conventions]
- Shared files touched (for merge anticipation with sibling story worktrees): `api/todos.ts` (additive — new exports only) and `styles/global.css` (additive — appended block only). `TodoRow.tsx` is this story's own component.

### Previous story intelligence (Story 3.1)

- 3.1 built `TodoRow.tsx` as a minimal read-only placeholder explicitly designed so 3.3 "adds onToggle/onDelete handlers without restructuring" and left the `data-completed` markup hook. Build on it; don't recreate. [Source: 3-1 story file; TodoRow.tsx header comment]
- 3.1 established: API layer mocked in tests via `vi.mock('../api/todos')`; `renderWithClient` helper; coverage report-only, v8, branch-on; `css:true` in vitest so token classes resolve. 3.1 landed 21 tests at 100% coverage.
- 3.1 review flagged (dismissed then) that `apiFetch`'s header spread could let a caller override `Content-Type` — **relevant now:** do not pass a `headers` key from the PATCH mutation function. [Source: 3-1 story Review Findings, dismissed-note #1]
- Backend Epic 2 is the verified contract source: `PATCH` returns a bare `Todo`; `DELETE` returns `204`; `404` envelope on missing. These are facts, not assumptions. [Source: 3-1 story; epics.md Story 2.2]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3] — authoritative ACs + test scenarios (lines 428-461)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/EXPERIENCE.md] — Todo row / checkbox / delete behavior, toggle-error & delete-error state patterns, Voice & Tone, a11y (lines 58-60, 77-78, 86-88, 97, 102, 124-125, 154)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/DESIGN.md] — completion cues (checkbox+strikethrough+ink-completed ≥4.5:1), checkbox/delete/row component specs, Do's & Don'ts (lines 133, 177-179, 190-191, 197)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md] — AD-6 optimistic lifecycle (line 88), AD-3/AD-5, API Contract PATCH/DELETE (lines 149-150)
- [Source: frontend/src/api/todos.ts, api/client.ts, hooks/useTodos.ts, components/TodoRow.tsx, components/TodoList.tsx, components/InlineError.tsx, styles/global.css, styles/tokens.css] — existing code being built on
- [Source: _bmad-output/implementation-artifacts/3-1-panel-shell-design-tokens-api-client-and-list-view-with-loading-empty-error-states.md] — previous story patterns & review learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `claude-opus-4-8[1m]`

### Debug Log References

- Node 22.23.1 via nvm (`.nvmrc` = 22); dependencies already installed (`npm ci`, 297 pkgs). No global installs, no new dependencies.
- `eslint . && tsc --noEmit` clean. `vitest run` 35/35 passed (21 pre-existing + 14 new across `api/todos.test.ts` and `components/TodoRow.test.tsx`). `vite build` succeeds; three.js correctly NOT bundled (not imported).
- Coverage (report-only, v8, branch on): Statements 100% (85/85), Functions 100% (33/33), Lines 100% (80/80), Branches 93.33% (42/45). The 3 uncovered branches are all in `useTodoMutations.ts` (lines 45/64/79) — the defensive `if (previous)` / `context?.previous` nullish guards that only fire when the List cache is unseeded, which cannot occur in the real render/reconcile flow. Well above the 70% report-only bar.
- Preserved the Story 3.1 test contract: kept `data-testid="todo-row"`, the `data-completed` attribute, and the `orbit-row__text` class, and kept the row's text content equal to the description only (the checkbox has no text; the delete "×" is drawn via CSS `::before`, and the accessible name comes from the button's `aria-label`) — so `TodoList.test.tsx`'s row-order/textContent assertions still pass.

### Completion Notes List

- All 6 ACs satisfied. Enhanced the minimal Story 3.1 row into a fully interactive one; built on the existing scaffold without restructuring `TodoList`/`Panel`.
- **API layer** (`api/todos.ts`, additive): added `toggleTodo(id, completed)` → `PATCH /api/todos/{id}` with body `{ completed }` (the NEW target state) returning the bare updated `Todo`, and `deleteTodo(id)` → `DELETE /api/todos/{id}` (204 → `undefined`). Neither passes a `headers` key, so the client's default `Content-Type: application/json` survives (Story 3.1 review noted the header-spread clobber risk). A 404 is not swallowed here — it propagates as `ApiClientError(status:404)`.
- **Optimistic mutations** (`hooks/useTodoMutations.ts`, NEW): `useTodoMutations()` returns `{ toggle, remove }`. Both follow AD-6 exactly — `onMutate` cancels in-flight refetches, snapshots the cache, and applies the optimistic edit (toggle flips `completed` **in place** via `map`, preserving array order → no reorder; delete `filter`s the id out); `onError` rolls back to the snapshot, **except** a delete 404 (`isAlreadyGone`) which is left removed and not treated as a failure; `onSettled` invalidates the List to reconcile. Imports `todosQueryKey` from `useTodos` read-only — `useTodos.ts` is untouched.
- **TodoRow** (`components/TodoRow.tsx`): a real native `<input type="checkbox">` whose `checked` reflects `completed` and announces its state (name via `aria-labelledby` → the description), in a ≥44px label hit-target wrapping a ≥24px visual box; the description is plain auto-escaped text with **no** click handler (clicking it is a no-op); a real `<button>` delete affordance with `aria-label="Delete <desc>"`. Each row owns its mutations (so `TodoList`/`Panel` stay untouched) and shows a row-scoped `InlineError` ("Couldn't save that — try again.") when its toggle fails or its delete fails with a non-404.
- **Completed cues (three, never color alone)**: checked checkbox (accent fill + accent-ink tick) + `line-through` + `--todo-row-text-completed` (`ink-completed #727C99`, ≥4.5:1 on the scrim per DESIGN.md) — all keyed off `[data-completed="true"]`.
- **Delete visibility**: CSS `@media (hover: hover) and (pointer: fine)` hides the × until row hover/`:focus-within` (keyboard-reachable); `@media (hover: none)` (touch) keeps it always visible. ≥44px target. Reduced-motion drops the reveal/checkmark transitions to instant.
- **Styles**: appended a single block at the END of `styles/global.css` opened with `/* Story 3.3: todo row toggle/delete */`; consumes existing tokens only; overrides the Story 3.1 `.orbit-row` to a column so the inline error can sit beneath the row line. No token file changes.
- **Tests** (mocked API/query, no network): toggle both directions optimistic + in place; no-reorder assertion (row order identical after toggling the top item, through reconcile); toggle rollback + inline error; delete optimistic remove; delete rollback reappears + error; delete 404 stays removed with no error; description-click no-op; labeled-checkbox reflects completion; delete is a real focusable button with an accessible name. Plus direct `api/todos.test.ts` exercising the real PATCH/DELETE request shape + 404 propagation.
- **Per task constraints:** did NOT edit `hooks/useTodos.ts`, `components/Panel.tsx`, `sprint-status.yaml`, or `docs/AI-INTEGRATION-LOG.md`. Shared files touched are additive only: `api/todos.ts` (new exports) and `styles/global.css` (appended block). No backend changes.
- **jsdom limitation (documented):** pointer-hover-vs-touch delete visibility is pure CSS media-query behavior that jsdom does not lay out; asserted structurally (real button, class hook, accessible name) rather than by computed pixels.

### File List

**New — frontend/src/**
- `hooks/useTodoMutations.ts`
- `components/TodoRow.test.tsx`
- `api/todos.test.ts`

**Modified — frontend/src/**
- `api/todos.ts` (added `toggleTodo`, `deleteTodo`; `getTodos` unchanged)
- `components/TodoRow.tsx` (minimal read-only row → interactive checkbox + delete + inline error)
- `styles/global.css` (appended `/* Story 3.3: todo row toggle/delete */` block at END)

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-23 | Story 3.3 implemented: optimistic in-place toggle (both directions, three completion cues, no reorder) + undo-less delete on the Todo row, via a new `useTodoMutations` hook (AD-6 onMutate/onError/onSettled, delete-404 = already-gone) and additive `toggleTodo`/`deleteTodo` API calls; hover-reveal/touch-always delete visibility + ≥44px targets in an appended `global.css` block. 35 Vitest tests pass; coverage 100% stmts/funcs/lines, 93.33% branches (report-only); lint + build green. `useTodos.ts`/`Panel.tsx`/`sprint-status.yaml`/AI-log untouched. Status → review. |
| 2026-07-23 | Code review (3-layer adversarial): approved — clean review, no patches required. All 6 ACs and task constraints verified; 4 low observations dismissed (spec-compliant toggle-404 flash, keyboard-reachable hover-hidden delete, unreachable defensive rollback guards, non-empty-validated description). Status → done. |

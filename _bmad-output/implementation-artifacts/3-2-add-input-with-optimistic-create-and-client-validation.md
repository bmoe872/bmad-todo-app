---
baseline_commit: 253a058170c21f79835dbffdeb8c44f8f37c446a
---

# Story 3.2: Add-input with optimistic create and client validation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Maya,
I want to type a task and press Enter to add it instantly to the top of my List,
so that I can capture what's on my mind with zero ceremony.

## Acceptance Criteria

**AC1 — Always-visible add-input + valid submit → optimistic top row (FR-1, AD-6, NFR-Perf, UX-DR3)**
Given the always-visible add-input (placeholder **"What needs doing?"**, autofocus **desktop-only**, not force-focused on touch),
when I type a non-empty description and press **Enter**,
then the new Todo appears optimistically at the **top** of the List within ~100ms, the field **clears and refocuses**, and the create is issued to `POST /api/todos`; on success the optimistic row reconciles to the server Todo (temporary local id replaced).

**AC2 — Empty / whitespace-only blocked client-side (FR-1, FR-7, UX-DR9, UX-DR13)**
Given invalid input, when I submit empty/whitespace-only text, then it is blocked **client-side** with inline **"Type something first."** and **no request is sent**.

**AC3 — Over-length blocked client-side (FR-1, FR-7)**
Given over-length input, when I submit **> 500 characters (measured on the trimmed string)**, then it is blocked **client-side** with inline **"That's a bit long — keep it under 500 characters."** and **no request is sent**.

**AC4 — Server-error rollback preserves typed text (FR-7, AD-6, UX-DR13)**
Given the create request fails server-side, when the mutation errors, then the optimistic row **rolls back**, **"Couldn't save that — try again."** shows under the input (non-blocking), and my **typed text is preserved**.

**AC5 — Escape clears without submitting (UX-DR3, Interaction Primitives)**
Given the keyboard, when I press **Escape** in the input, then the input's current text **clears without submitting** (no request).

## Tasks / Subtasks

- [x] **Task 1 — `createTodo` API call** (AC: 1)
  - [x] Add `createTodo(description: string): Promise<Todo>` to `frontend/src/api/todos.ts`. It POSTs `{ description }` to `/api/todos` via `apiFetch<Todo>('/todos', { method: 'POST', body: JSON.stringify({ description }) })` and returns the created `Todo` (201 body is the bare `Todo`, per ARCHITECTURE-SPINE API contract). Do NOT add toggle/delete/clear here — those belong to their stories.
  - [x] Keep the existing `getTodos` untouched; only append the new function + doc comment in the established style.

- [x] **Task 2 — Optimistic create mutation hook** (AC: 1, 4)
  - [x] Create NEW file `frontend/src/hooks/useCreateTodo.ts`. Do NOT edit `useTodos.ts`. Import `todosQueryKey` from `./useTodos` **read-only** (for cache reads/writes/invalidation).
  - [x] Implement `useMutation` (AD-6): `mutationFn: (description) => createTodo(description)`.
  - [x] `onMutate(description)`: `await queryClient.cancelQueries({ queryKey: todosQueryKey })`; snapshot `previous = queryClient.getQueryData<Todo[]>(todosQueryKey)`; build an optimistic `Todo` with a **temporary local id** (`crypto.randomUUID()`, prefixed e.g. `optimistic-` so it's identifiable), `completed: false`, `created_at: new Date().toISOString()`, `description` (use the trimmed string); `setQueryData` to prepend it at the **TOP** of the array (`[optimistic, ...(previous ?? [])]`). Return `{ previous }` as context.
  - [x] `onError(_err, _vars, context)`: roll back with `setQueryData(todosQueryKey, context.previous)`. Do NOT clear the caller's typed text here — text preservation is the component's responsibility (only clear on success).
  - [x] `onSettled()`: `queryClient.invalidateQueries({ queryKey: todosQueryKey })` to reconcile to server truth (temp id replaced by the server Todo). Note: in tests the List query may be idle/uninitialised — invalidate is safe/no-op then.

- [x] **Task 3 — AddInput component** (AC: 1, 2, 3, 4, 5)
  - [x] Create `frontend/src/components/AddInput.tsx`. A single-line `<input type="text">` (single-line enforced by input element; no textarea) with placeholder **exactly** `What needs doing?` and an accessible label (`aria-label="Add a todo"` or a visually-hidden label). Export the microcopy as named constants for tests: `PLACEHOLDER`, `EMPTY_MESSAGE = 'Type something first.'`, `TOO_LONG_MESSAGE = "That's a bit long — keep it under 500 characters."`, `CREATE_ERROR_MESSAGE = "Couldn't save that — try again."`, `MAX_LENGTH = 500`.
  - [x] Controlled input with local `useState` for the text and a local `useState` for the inline validation/error message.
  - [x] **Submit on Enter** (form `onSubmit` or `onKeyDown` Enter): trim the text; if empty/whitespace-only → set `EMPTY_MESSAGE`, no request. Else if `trimmed.length > MAX_LENGTH` → set `TOO_LONG_MESSAGE`, no request. Else clear any inline message and call the mutation with the **trimmed** value.
  - [x] On **successful** mutation: clear the field (`setText('')`) and **refocus** the input. On **error**: keep the typed text and show `CREATE_ERROR_MESSAGE` under the input via the existing `InlineError` component (no retry button — non-blocking). Use the mutation's `onSuccess`/`onError` callbacks passed at `mutate(value, { onSuccess, onError })` OR derive from the hook — pick one and keep it deterministic for tests.
  - [x] **Escape** clears the current text without submitting and clears any inline message; no request.
  - [x] **Desktop-only autofocus**: on mount, focus the input only when a pointer/hover media query indicates a non-touch device — use `window.matchMedia('(hover: hover) and (pointer: fine)')` guarded for absence (jsdom may lack `matchMedia`). Do NOT set the HTML `autofocus` attribute unconditionally (that would focus on touch too).
  - [x] Render the inline error message region with `role="alert"` (reuse `InlineError` with `message` only, no `retryLabel`).

- [x] **Task 4 — Wire AddInput into the Panel add-input slot** (AC: 1)
  - [x] Edit ONLY the add-input slot region of `frontend/src/components/Panel.tsx`. Pass `<AddInput />` as `addSlot` from `App.tsx`, OR render it as the default `addSlot` inside Panel. Keep the change scoped to the add-input slot — do not touch title/list/footer regions. Keep `data-testid="add-input-slot"` behavior consistent (the App.test.tsx asserts `add-input-slot` renders during load — ensure the slot wrapper or the AddInput still exposes a testid so that existing test passes, OR update that expectation only if unavoidable; prefer keeping it).
  - [x] The add-input must remain rendered in every List state (loading/empty/error/loaded) — it lives in the Panel, above `TodoList`, so this is already satisfied by composition.

- [x] **Task 5 — Component CSS** (AC: 1)
  - [x] Append a block commented `/* Story 3.2: add-input */` at the **END** of `frontend/src/styles/global.css`. Style the real input using the existing `--add-input-*` tokens (bg `--add-input-bg`, text `--add-input-text`, placeholder `--add-input-placeholder`, radius `--add-input-radius`, focus ring `--add-input-focus-ring`), `--type-input-*` typography, matching the placeholder slot's `min-height: 52px` / horizontal padding for visual continuity with Story 3.1. Reuse `.orbit-inline-error` for the message (already defined). Do NOT add raw hex; consume tokens only.

- [x] **Task 6 — Tests** (AC: 1, 2, 3, 4, 5)
  - [x] Create `frontend/src/components/AddInput.test.tsx` (Vitest + Testing Library) with the API layer mocked (`vi.mock('../api/todos')`) and rendered via `renderWithClient` so the mutation hook runs against a real (isolated, retry-off) QueryClient. Seed the List cache where needed (`client.setQueryData(todosQueryKey, [...])`).
  - [x] Cover: (a) empty and whitespace-only blocked with exact `EMPTY_MESSAGE`, no `createTodo` call; (b) `> 500` chars blocked with exact `TOO_LONG_MESSAGE`, no call; (c) Enter with valid text calls `createTodo` with trimmed value, optimistic row appears at TOP of the cache/list, field clears + refocuses on success; (d) on mocked mutation rejection the optimistic row rolls back and the typed text is preserved + `CREATE_ERROR_MESSAGE` shown; (e) Escape clears text, no call; (f) desktop autofocus when `matchMedia` reports a fine pointer (mock `window.matchMedia`); optionally assert no autofocus on coarse pointer.
  - [x] Report REAL pass/fail counts. Run coverage report-only (`npm run test:coverage` or the project's script) — do not add/adjust a coverage gate (Story 6.2 owns that).

## Dev Notes

### Current-state facts (read before writing)

- **`frontend/src/api/todos.ts`** currently exports only `getTodos()`. Pattern: `apiFetch<T>(path, init?)` from `./client`. The 3.1 comment explicitly reserves create/toggle/delete/clear for 3.2–3.4 — this story adds `createTodo` only. [Source: frontend/src/api/todos.ts]
- **`frontend/src/api/client.ts`** — `apiFetch` already sets `Content-Type: application/json`, parses the AD-5 error envelope into `ApiClientError`, and treats network failures + non-2xx as thrown errors. POST just needs `{ method: 'POST', body: JSON.stringify({ description }) }`. A 201 returns the parsed `Todo` body. [Source: frontend/src/api/client.ts]
- **`frontend/src/hooks/useTodos.ts`** — exports `todosQueryKey = ['todos'] as const` and `useTodos()`. **Do NOT edit this file.** Import `todosQueryKey` read-only. Its header comment already anticipates the create mutation being added "keyed off this same `todosQueryKey`" but in a separate file per this story's constraint. [Source: frontend/src/hooks/useTodos.ts]
- **`frontend/src/components/Panel.tsx`** — renders `addSlot ?? <placeholder>` where the placeholder is a `div.orbit-add-slot[data-testid="add-input-slot"][aria-hidden]` containing the literal `What needs doing?`. When wiring the real AddInput, the slot becomes interactive; preserve a stable testid so `App.test.tsx` (`getByTestId('add-input-slot')`) keeps passing. [Source: frontend/src/components/Panel.tsx, frontend/src/App.test.tsx:34]
- **`frontend/src/components/InlineError.tsx`** — reusable non-blocking error: `role="alert"`, renders `message` and an optional Retry button when `retryLabel`+`onRetry` are given. Use with `message` only for the create error (no retry). [Source: frontend/src/components/InlineError.tsx]
- **`frontend/src/test-utils.tsx`** — `renderWithClient(ui, client?)` wraps in a fresh `QueryClientProvider` (retry off). Returns `{ client, ...render() }` so tests can `client.setQueryData(...)`. [Source: frontend/src/test-utils.tsx]
- **`frontend/src/styles/tokens.css`** — the `--add-input-*` component tokens already exist (bg/text/placeholder/radius/focus-ring), defined in 3.1 for this story to consume. **Do NOT edit tokens.css.** [Source: frontend/src/styles/tokens.css:87-92]
- **`frontend/src/styles/global.css`** — has an `.orbit-add-slot` placeholder style (min-height 52px, padding `0 var(--space-4)`, input typography) and `.orbit-inline-error`. Append the new block at the END only. [Source: frontend/src/styles/global.css:92-104]
- **jsdom / `matchMedia`**: `test-setup.ts` registers only jest-dom. `window.matchMedia` is NOT implemented by jsdom — the AddInput must guard `typeof window.matchMedia === 'function'` before calling it (else it throws on mount in tests and app). Tests that assert autofocus should stub `window.matchMedia`. [Source: frontend/src/test-setup.ts]

### Architecture / behavior constraints

- **AD-6 Optimistic mutation with mandatory rollback + reconcile**: `onMutate` snapshots + applies optimistic change (≤~100ms); `onError` rolls back to snapshot + surfaces a **non-blocking inline** error (never a modal); `onSettled` invalidates the List to reconcile. Every loading state resolves. `cancelQueries` in `onMutate` prevents an in-flight refetch from clobbering the optimistic write. [Source: ARCHITECTURE-SPINE.md#AD-6]
- **API contract**: `POST /api/todos` body `{ "description": string }` → `201 Todo`; `422` on invalid description. Server trims + rejects empty/whitespace-only/multi-line/>500. Client mirrors the same validation **before** submit (empty + >500 in this story). The server is authoritative; client validation is a fast guard, not the only guard. [Source: ARCHITECTURE-SPINE.md#API-contract]
- **Ids**: server-generated UUID v4; client uses a **temporary local id** for the optimistic create, replaced on reconcile (the `onSettled` invalidate refetch overwrites the temp row with the real one). [Source: ARCHITECTURE-SPINE.md#Ids]
- **Ordering**: List is newest-first; the optimistic row goes to the TOP (matching where the server will place a just-created Todo). Never re-sort client-side. [Source: ARCHITECTURE-SPINE.md#AD-3]
- **Add-input behavioral rules** (EXPERIENCE.md#Interaction-inventory): always visible + focusable on load (autofocus desktop; not forced on touch to avoid keyboard pop-up); Enter submits; trims whitespace; blocks empty/whitespace-only and >~500 chars client-side with inline message; field clears + refocuses on success; new Todo appears optimistically at the top. Escape clears the input's current text (does not submit). [Source: EXPERIENCE.md:57, :85, :148, :181]
- **Create-error state** (EXPERIENCE.md#States): optimistic row rolls back; "Couldn't save that — try again." shows under the input; **text the user typed is preserved so nothing is lost**. [Source: EXPERIENCE.md:76, :148]

### Voice & Tone — EXACT microcopy (EXPERIENCE.md#Voice-and-Tone, AUTHORITATIVE)

| Purpose | Exact string |
|---|---|
| Placeholder | `What needs doing?` |
| Validation (empty) | `Type something first.` |
| Validation (too long) | `That's a bit long — keep it under 500 characters.` (em dash `—`, U+2014) |
| Create/action error | `Couldn't save that — try again.` (em dash `—`, U+2014) |

No exclamation marks, no emoji; calm/plain/warm. [Source: EXPERIENCE.md:37, :41, :45-47]

### Visual tokens (DESIGN.md#components.add-input)

- background `surface-raised`, text `ink-primary`, placeholder `ink-secondary`, radius `rounded.md` (14px), focus-ring `border-focus`, typography `input` (17px/400/1.4). All available as `--add-input-*` + `--type-input-*` CSS vars. Inline error uses `--color-danger` via `.orbit-inline-error`. [Source: DESIGN.md:78-84, :108-109]

### Project Structure Notes

- NEW: `frontend/src/hooks/useCreateTodo.ts`, `frontend/src/components/AddInput.tsx`, `frontend/src/components/AddInput.test.tsx`.
- UPDATE (shared — orchestrator will merge): `frontend/src/api/todos.ts` (append `createTodo`), `frontend/src/components/Panel.tsx` (add-input slot only) and/or `frontend/src/App.tsx` (pass `addSlot`), `frontend/src/styles/global.css` (append `/* Story 3.2: add-input */` block at END).
- DO NOT TOUCH: `frontend/src/hooks/useTodos.ts`, `frontend/src/styles/tokens.css`, any `backend/**`, `_bmad-output/implementation-artifacts/sprint-status.yaml`, `docs/AI-INTEGRATION-LOG.md`.

### Testing standards

- Vitest + Testing Library, jsdom env, API mocked via `vi.mock('../api/todos')`; render through `renderWithClient`. Retries are off so errors surface deterministically. Coverage is **report-only** at this stage (gate lands in 6.2). Assert exact microcopy via the exported constants. No real network / no Postgres. [Source: vitest.config.ts, frontend/src/components/TodoList.test.tsx]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.2] — ACs + test scenarios (authoritative)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/EXPERIENCE.md] — add-input rules, Voice & Tone, optimistic/rollback state rules
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/DESIGN.md] — add-input component tokens/visuals
- [Source: _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md] — AD-6 optimistic strategy, POST /api/todos contract, TanStack Query, ids/ordering
- [Source: _bmad-output/implementation-artifacts/3-1-...md] — established component/API/hook/test patterns

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

- `npm test` → 6 files, 31 tests passed (21 pre-existing + 10 new AddInput specs).
- `npm run lint` (eslint + `tsc --noEmit`) → clean, no warnings/errors.
- `npm run coverage` (report-only) → Statements 98.95%, Branches 95.65%, Functions 96.55%, Lines 98.94%. New files: AddInput.tsx 100% stmts / 92.85% branch; useCreateTodo.ts 100% stmts / 75% branch; api/todos.ts `createTodo` body is mocked in component tests (uncovered line 27, expected — the fetch wrapper itself is covered by client.test.ts).

### Completion Notes List

- Node 22.23.1 (via nvm; `.nvmrc`=22). `npm ci` installed 297 packages, 0 vulnerabilities.
- **Enter submission** is implemented as native `<form onSubmit>` (an Enter keypress in the single input submits the form in-browser). Tests exercise the submit path via `fireEvent.submit(form)` because `@testing-library/user-event` is not a project dependency and jsdom does not implement implicit form submission on Enter keydown. Escape is handled explicitly in `onKeyDown` and tested with `fireEvent.keyDown`.
- **Optimistic insert / rollback / reconcile** all live in `useCreateTodo` (AD-6). Tests assert directly on the QueryClient cache (`client.getQueryData(todosQueryKey)`) since AddInput does not render the List; the optimistic row is verified at index 0 with an `optimistic-` temp id, and rollback is verified as an exact restoration of the pre-submit snapshot with the typed text preserved.
- `useTodos.ts` and `tokens.css` were NOT modified. `todosQueryKey` is imported read-only. `sprint-status.yaml` and `docs/AI-INTEGRATION-LOG.md` were intentionally left untouched (orchestrator reconciles post-merge) — the story Status here is set to `review` in the story file only.
- Panel now renders `<AddInput />` as the default `addSlot`; the AddInput `<form>` carries `data-testid="add-input-slot"`, so the existing `App.test.tsx` assertion still passes. The old `.orbit-add-slot` placeholder CSS rule remains in `global.css` (now unused) because the story constrained CSS changes to an append-only block at the end of the file; it is harmless dead style and can be pruned in a later pass.
- Client-side `> 500` guard is measured on the **trimmed** string (mirrors the server, AD-5); a 500-char boundary case is covered as allowed.

### File List

- `frontend/src/api/todos.ts` — MODIFIED (appended `createTodo`)
- `frontend/src/hooks/useCreateTodo.ts` — NEW (optimistic create mutation, AD-6)
- `frontend/src/components/AddInput.tsx` — NEW (capture field + validation + keyboard + autofocus)
- `frontend/src/components/AddInput.test.tsx` — NEW (10 specs)
- `frontend/src/components/Panel.tsx` — MODIFIED (add-input slot now defaults to `<AddInput />`)
- `frontend/src/styles/global.css` — MODIFIED (appended `/* Story 3.2: add-input */` block)
- `_bmad-output/implementation-artifacts/3-2-add-input-with-optimistic-create-and-client-validation.md` — story file (this document)

### Review Findings

Code review (adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor) against baseline 253a058. Acceptance Auditor: all 5 ACs satisfied, exact microcopy verified, no spec deviations.

- [x] [Review][Patch] Dead CSS `.orbit-add-slot` orphaned by this story [frontend/src/styles/global.css] — FIXED: removed the now-unused Story 3.1 placeholder rule (Panel no longer renders that element).
- [x] [Review][Defer] No pending-guard against rapid double-submit [frontend/src/components/AddInput.tsx] — deferred: outside AC scope; a same-tick double Enter could create two optimistic rows, negligible at single-user scale. Candidate hardening in a later polish pass.
- Dismissed (1): input not linked to error via `aria-describedby` — `InlineError` already carries `role="alert"`, adequate for a non-blocking inline message.

## Change Log

| Date | Change |
|---|---|
| 2026-07-23 | Story 3.2 implemented: AddInput with client validation, Enter-submit / Escape-clear, optimistic create (top-insert + rollback + reconcile) via `useCreateTodo`, `createTodo` API call, Panel slot wiring, add-input CSS block. 10 new tests, all green. Status → review. |

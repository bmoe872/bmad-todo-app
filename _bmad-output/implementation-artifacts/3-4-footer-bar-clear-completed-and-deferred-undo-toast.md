---
baseline_commit: 253a058170c21f79835dbffdeb8c44f8f37c446a
---

# Story 3.4: Footer bar, Clear-completed, and deferred Undo toast

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Maya,
I want to clear all completed tasks in one action with a brief chance to undo,
so that I can tidy a day's finished work without deleting items one by one or risking accidental loss.

## Acceptance Criteria

**AC1 — Footer bar: completed count + Clear-completed control (FR-9, UX-DR7, UX-DR13, UX-DR14)**
Given the footer bar, when the List renders, then the **left** shows the completed count via a polite `aria-live` region using exact microcopy **"N completed"** (e.g. "2 completed") / **"No completed items"** (zero), and the **right** shows a ghost **"Clear completed"** button (`button` type, `ink-secondary` → `ink-primary` hover, no fill/border) which is **inert/absent when zero Todos are completed**.

**AC2 — Clear-completed: optimistic hide + deferred Undo toast, no server call yet (FR-9, AD-7, UX-DR8)**
Given completed Todos exist, when I click "Clear completed", then the client (1) **captures the exact set of currently-completed Todo ids** (the id snapshot), (2) **hides those rows optimistically** while active Todos stay put, and (3) shows the Undo toast with exact microcopy **"Cleared N completed. Undo"** (N = snapshot size) — with **NO server call yet**. The toast auto-dismisses after **~6s** and **pauses on hover/focus**.

**AC3 — Undo: pure client-side timer cancel, restore prior state (FR-9, AD-7)**
Given the Undo toast is visible, when I click "Undo" within the window, then the client **cancels the pending timer with NO server call** and **restores every cleared Todo to its prior position and completion state** (server order preserved), and the toast dismisses.

**AC4 — Toast dismiss commits exactly one bulk delete with the id snapshot (FR-9, AD-7)**
Given the Undo toast dismisses (timeout or manual, without Undo), when the window closes, then the client issues **exactly one** `DELETE /api/todos/completed` carrying `{ "ids": [...] }` = the captured snapshot; the server deletes only ids still completed; the List **reconciles** to server truth (query invalidation). A Todo completed *after* the click is **never** in the snapshot, so it is never cleared.

**AC5 — Bulk-delete failure reconciles with an inline error (FR-9, FR-7, AD-7)**
Given the deferred bulk delete fails server-side, when the mutation errors, then the **cleared rows return to their positions**, a **non-blocking inline error** shows (never a modal), and the List **reconciles to true persisted state**.

**AC6 — Crash/refresh safety during the undo window (AD-7, NFR-Rel)**
Given a refresh/crash during the undo window, when the app reloads, then the not-yet-committed items are **still present** (safe failure) — a natural consequence of the deferred-commit model (nothing is deleted server-side until dismiss). No extra code is required beyond deferring the server call; this AC is satisfied structurally by AD-7 and is not separately unit-tested here.

## Tasks / Subtasks

- [x] **Task 1 — API: `clearCompleted(ids)`** (AC: 4)
  - [x] Add `clearCompleted(ids: string[]): Promise<{ deleted: number }>` to `frontend/src/api/todos.ts`. Call `DELETE /api/todos/completed` with a JSON body `{ ids }` via `apiFetch` (`method: 'DELETE'`, `body: JSON.stringify({ ids })`). The response is `200 { "deleted": <int> }` (NOT 204) — return the parsed object. Keep the existing `getTodos` untouched; append the new function with a short doc comment referencing AD-7.
  - [x] Do NOT add any other endpoints (create/toggle/single-delete are Stories 3.2/3.3).

- [x] **Task 2 — Hook: `useClearCompleted` deferred-commit orchestration** (AC: 2, 3, 4, 5)
  - [x] Create NEW file `frontend/src/hooks/useClearCompleted.ts`. Do NOT edit `useTodos.ts`; import `todosQueryKey` from it **read-only**.
  - [x] Expose a hook returning: `pending` (whether an undo window is open) or a `pendingClear` object (the snapshot + count) for the toast, plus `clear()`, `undo()`, and `error` (last bulk-delete error, for the inline error). Design the surface so `Footer` calls `clear()` and `UndoToast` reads count/`undo()`/dismiss.
  - [x] **On `clear()`:** read the current List from the query cache (`queryClient.getQueryData<Todo[]>(todosQueryKey)`); capture the snapshot = the **full Todo objects** that are currently `completed === true` (need objects, not just ids, to restore exact prior position/state on Undo). Compute `ids` = their ids. **Optimistically** `setQueryData(todosQueryKey, list.filter(t => !t.completed))` — active Todos stay in their positions, completed rows vanish. Store the snapshot + the pre-clear full list (or enough to restore order) in hook state/ref. Start a **~6s timer** (`CLEAR_UNDO_MS = 6000`). Do NOT call the server here.
  - [x] **On `undo()`:** clear the timer, restore the cache to the pre-clear list (`setQueryData(todosQueryKey, snapshotFullList)` — restores exact prior positions and completion states), drop pending state. **No server call.**
  - [x] **On commit (timer fires OR manual dismiss without undo):** clear the timer, then fire the bulk delete **exactly once** with the captured `ids` snapshot. Use a TanStack Query `useMutation` whose `mutationFn` is `clearCompleted(ids)`. `onError`: restore the cleared rows to their positions (re-insert the snapshot into the cache in original order) and set `error` for the inline message. `onSettled`: `queryClient.invalidateQueries({ queryKey: todosQueryKey })` to reconcile to server truth (AD-6/AD-7). Ensure the commit cannot double-fire (guard with a ref/flag; both the timeout and a manual dismiss must funnel through one commit path).
  - [x] **Timer pause/resume:** expose `pauseTimer()` / `resumeTimer()` (or accept hover/focus handlers) so `UndoToast` pauses the countdown on `mouseenter`/`focus` (within the toast) and resumes on `mouseleave`/`blur`. Pausing must not lose already-elapsed time semantics for the purposes of these tests, but a simple "clear timeout on pause, restart full window on resume" is acceptable and simplest — restart-on-resume is fine and matches "pauses on hover/focus". Document the chosen semantic in a comment.
  - [x] Use `window.setTimeout`/`clearTimeout`; store the handle in a `useRef`. Clean up the timer on unmount (`useEffect` cleanup) to avoid firing after teardown.

- [x] **Task 3 — `Footer` component** (AC: 1)
  - [x] Create `frontend/src/components/Footer.tsx`. Reads the List through `useTodos()` (AD-6 — never holds its own copy) to compute `completedCount = data.filter(t => t.completed).length`. Left: a polite `aria-live="polite"` region rendering exact copy — export `completedCountLabel(n)` returning `n === 0 ? 'No completed items' : \`${n} completed\``. Right: a ghost `<button type="button">Clear completed</button>` wired to the clear-completed flow.
  - [x] **Inert at zero:** when `completedCount === 0`, the Clear-completed button is **absent** (do not render it) — simplest satisfaction of "inert/absent when zero completed" (UX-DR7). (Rendering it `disabled` is an acceptable alternative but absent is cleaner given the spec wording "inert/absent"; pick absent.)
  - [x] While the pending clear/loading states apply, the footer count reflects the **optimistic** cache (completed rows already gone → count returns to the remaining completed, typically 0). This is automatic because the count derives from the same query cache the hook mutates. Do not special-case it.
  - [x] Footer must render in **every non-cold state** where the List frame is present. Keep it resilient: if `data` is undefined (pending/error), render the footer with a zero/empty count rather than crashing (the count region can show "No completed items" or render nothing harmful). Keep this minimal — full a11y/keyboard hardening is Story 3.5.

- [x] **Task 4 — `UndoToast` component** (AC: 2, 3)
  - [x] Create `frontend/src/components/UndoToast.tsx`. Overlay pinned to the **bottom**; `surface-raised` fill, `rounded.md`, `ink-primary` text, an `accent-strong` **"Undo"** action that is a **real focusable `<button>`**. Announced: wrap in a `role="status"` (or `aria-live="polite"`) region so screen readers hear it (UX-DR8/UX-DR14).
  - [x] Renders only while an undo window is open (driven by the hook's pending state). Text: exact **"Cleared N completed. Undo"** — render the leading sentence as text and the "Undo" as the button label, so the combined accessible text reads "Cleared N completed. Undo".
  - [x] Clicking "Undo" calls the hook's `undo()`. Hovering/focusing the toast pauses the timer (`onMouseEnter`/`onFocus` → pause; `onMouseLeave`/`onBlur` → resume). A manual dismiss affordance is optional; the primary dismiss path is the ~6s timeout. If you add a close/× control, it must route through the same **commit** path (fires the bulk delete), NOT undo.
  - [x] Respect `prefers-reduced-motion`: any slide/fade transition drops to instant (CSS handles this — see styles task).

- [x] **Task 5 — Wire into Panel** (AC: 1, 2)
  - [x] Edit `frontend/src/components/Panel.tsx` **only** in the footer-slot / toast-overlay region. Story 3.2 edits the add-input slot on a sibling branch — keep changes localized to that one region to ease the merge. Do NOT touch the add-input slot, title, or list rendering.
  - [x] Simplest wiring that keeps the merge clean: instantiate the `useClearCompleted` hook at the composition point that renders both `Footer` (into `footerSlot`) and `UndoToast` (as a bottom overlay). Options: (a) create the hook inside a small wrapper and pass its handles to both, rendering `Footer` via `footerSlot` and `UndoToast` as an overlay sibling; or (b) have `App.tsx` own the hook and pass `footerSlot={<Footer .../>}` plus render `<UndoToast .../>`. **Prefer wiring in `App.tsx`** (compose `Footer` into the existing `footerSlot` prop and render `UndoToast` as an overlay) so `Panel.tsx`'s only change is adding an overlay mount region for the toast — minimizing the Panel diff. If Panel must host the overlay, add ONLY a toast-overlay slot/region; leave the footer-slot mechanism as-is.
  - [x] The `.orbit-footer-slot` already exists in Panel and hides when empty. Populate it with `<Footer/>`. The toast overlay should be `position: fixed`, bottom-anchored, above the panel (z-index above `.orbit-app`).

- [x] **Task 6 — Styles** (AC: 1, 2)
  - [x] Append component CSS to the **END** of `frontend/src/styles/global.css` inside a block clearly commented `/* Story 3.4: footer + clear-completed + undo toast */`. Consume tokens only (no raw hex): footer layout (flex row, space-between, `meta` type, `ink-secondary` count), the ghost Clear button (`--button-clear-text` → `--button-clear-text-hover`, no fill/border, `--button-clear-radius`), and the toast (`--toast-undo-bg`, `--toast-undo-text`, `--toast-undo-action`, `--toast-undo-radius`, fixed bottom, near-full-width above the thumb zone on mobile per DESIGN.md/EXPERIENCE.md). Include a `@media (prefers-reduced-motion: reduce)` rule dropping toast transitions to instant.
  - [x] Do NOT edit `tokens.css` — the `--button-clear-*` and `--toast-undo-*` tokens already exist there (added in Story 3.1 for this story).

- [x] **Task 7 — Tests (Vitest + Testing Library, FAKE TIMERS)** (AC: 1, 2, 3, 4, 5)
  - [x] Use `vi.useFakeTimers()` for all toast-timing tests; advance with `vi.advanceTimersByTime(...)`. Mock the API layer (`vi.mock('../api/todos')`) so no real network/Postgres. Wrap components in a fresh `QueryClientProvider` (reuse `src/test-utils.tsx` `renderWithClient`) with `retry:false`. Seed the List cache via the mocked `getTodos` (or `queryClient.setQueryData(['todos'], seed)`) so `useTodos` resolves synchronously.
  - [x] **Note on fake timers + async + RTL:** React Query resolves promises as microtasks; with fake timers you must flush microtasks (e.g. `await` inside `act`, or `await vi.runOnlyPendingTimersAsync()` / `await flushPromises()`), and use RTL `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` or fall back to `fireEvent` (which is synchronous and simpler under fake timers). Prefer `fireEvent` here to avoid userEvent/fake-timer friction. Wrap timer advances in `act(() => vi.advanceTimersByTime(6000))`.
  - [x] Required scenarios (report real numbers):
    - Footer count copy: **zero → "No completed items"** and **N completed → "N completed"** (assert the exact strings; assert the `aria-live` region).
    - Clear button **inert/absent at zero completed**; present when ≥1 completed.
    - Clear **removes only completed rows optimistically** (active rows stay, in order) and the toast shows **"Cleared N completed. Undo"** with the correct N; **no `clearCompleted` call yet** (`expect(clearCompletedMock).not.toHaveBeenCalled()`).
    - **Undo** restores exact prior rows/order/state and makes **NO** network call (`clearCompletedMock` never called); toast gone.
    - **~6s timeout fires exactly one** `DELETE /api/todos/completed` with the **correct id snapshot** (`expect(clearCompletedMock).toHaveBeenCalledTimes(1)` and `toHaveBeenCalledWith(expectedIds)`). Advance timers by 6000.
    - **Hover/focus pauses the timer:** advance <6s, hover the toast, advance past 6s while hovered → no commit yet; unhover → advance → commit fires once. (Assert the pause prevents the fire during hover.)
    - **A Todo completed after the click is NOT in the snapshot:** seed 2 completed, click clear (snapshot = those 2), then mutate cache to complete a 3rd, let it commit → `clearCompleted` called with exactly the original 2 ids.
    - **Bulk-delete failure:** make `clearCompletedMock` reject → after commit, cleared rows return to positions and an **inline error** shows; assert reconciliation (invalidate/refetch) is triggered.
  - [x] Run `npm run test` and `npm run coverage`; report actual pass/fail + coverage %. Coverage stays **report-only** (gate flips in 6.2). Never fake passing tests.

- [x] **Task 8 — Verify lint/build/tests green**
  - [x] `npm run lint` (eslint + `tsc --noEmit`) clean; `npm run build` succeeds; `npm run test` all green. Node 22 via `nvm use`.

<!-- Note: Story 3.1's Task 7 appended to docs/AI-INTEGRATION-LOG.md. For THIS story that file is OUT OF SCOPE — do NOT edit docs/AI-INTEGRATION-LOG.md or sprint-status.yaml (task constraint). -->

### Review Findings

Code review (2026-07-23, adversarial 3-layer: Blind Hunter + Edge Case Hunter + Acceptance Auditor; diff = working tree vs baseline `253a058`). Outcome: **Approved with one minor patch applied.** No high/medium findings. 1 patch applied, 2 dismissed as noise. All 6 ACs verified satisfied; microcopy exact; single `DELETE /api/todos/completed` with the id snapshot verified by a fake-timer test.

- [x] [Review][Patch] `useClearCompleted` exposed an unused `commit` in its public return (no manual-dismiss/× control consumes it; timeout is the only dismiss path) — removed from the returned object + `UseClearCompleted` interface; the internal `commit` stays (funnels the timer). Dead API surface removed [frontend/src/hooks/useClearCompleted.ts] — fixed. Re-verified: 32 tests pass, lint + build green.

Dismissed (no action): (1) `clear()` re-entrancy — overwriting the snapshot if invoked while a window is open — is unreachable because the Clear button is absent once the completed count drops to 0 after the optimistic hide; defensive-only. (2) Pause is not reference-counted (an overlapping hover+focus could restart the timer on `mouseleave` while still focused) — behavior still pauses on each of hover/focus and the restart-on-resume semantic is documented; full keyboard/focus hardening is Story 3.5. Noted in-favor: `undo()` deliberately does NOT invalidate the query, since a refetch would be a server call, correctly honoring AC3's "no server call".

## Dev Notes

### Critical context — do NOT deviate

- **This story implements FR-9 client-side (footer + Clear-completed + deferred Undo toast) per AD-7.** Epic 2 already shipped the backend: `DELETE /api/todos/completed` accepting `{ ids }` (Story 2.3, verified done). Do NOT touch the backend, Postgres, or run a server — tests mock the API.
- **AD-7 deferred-commit — implement precisely** (the single most important rule):
  1. Clear captures the **exact set of currently-completed ids** (id snapshot) and hides them **optimistically**. **No server call.**
  2. **Undo is a pure client-side timer cancel — NO server call** — and restores every cleared Todo to its **prior position and completion state**.
  3. On toast dismiss (timeout ~6s, or manual without undo) fire **exactly one** `DELETE /api/todos/completed` with `{ ids: <snapshot> }`. Server deletes only ids still completed.
  4. Because nothing is deleted server-side until dismiss: a crash/refresh mid-window safely restores on reload (AC6), and a Todo completed *after* the click is never in the snapshot so is never cleared.
  [Source: ARCHITECTURE-SPINE.md#AD-7; EXPERIENCE.md State-Patterns "Clear-completed pending"]
- **Rejected alternative (do NOT build):** immediate server delete + compensating re-create on Undo. AD-7 supersedes it (re-create mints new ids, loses `created_at`, risks partial loss). [Source: ARCHITECTURE-SPINE.md#AD-7; EXPERIENCE.md Open-Questions #3]
- **Scope discipline (defer, don't build):** working add-input + optimistic create is **Story 3.2** (sibling branch also edits `Panel.tsx`'s add-input slot — keep your Panel edit to the footer/overlay region only). Row toggle/delete is **Story 3.3**. Keyboard/SR/responsive hardening is **Story 3.5**. three.js backdrop is **Epic 4**. Build ONLY the footer, clear-completed flow, and undo toast.
- **Do NOT edit `hooks/useTodos.ts`** — import its exported `todosQueryKey` read-only. **Do NOT edit `tokens.css`** (tokens already present). **Do NOT edit `sprint-status.yaml` or `docs/AI-INTEGRATION-LOG.md`.**

### Files being modified — current state (read before editing)

- **`frontend/src/api/todos.ts`** (UPDATE, shared with siblings): currently exports only `getTodos(): Promise<Todo[]>` (unwraps `{ todos }`). Header comment explicitly notes clear-completed "arrives with Story 3.4". **Append** `clearCompleted(ids)` — do not modify `getTodos`. Uses `apiFetch<T>(path, init)` from `./client` which already sets `Content-Type: application/json`, spreads `init`, throws typed `ApiClientError` on non-2xx / network failure, and returns `undefined` for 204. The bulk endpoint returns **200 `{ deleted }`**, not 204, so parse the body.
- **`frontend/src/components/Panel.tsx`** (UPDATE, shared with Story 3.2): renders `Title → addSlot → children(list) → <div className="orbit-footer-slot">{footerSlot}</div>`. Already has a `footerSlot?: React.ReactNode` prop and `.orbit-footer-slot:empty { display:none }` in CSS. **Story 3.2 edits the add-input slot on its own branch** — restrict your edit to the footer-slot / toast-overlay region so the two branches merge cleanly. Preferred: keep Panel nearly unchanged (populate `footerSlot` from `App.tsx`) and mount the toast overlay from `App.tsx`; only touch Panel if you must add a toast-overlay mount region.
- **`frontend/src/hooks/useTodos.ts`** (READ-ONLY): exports `todosQueryKey = ['todos'] as const` and `useTodos()` (`useQuery<Todo[]>`). Import `todosQueryKey` for cache reads/writes/invalidation. Do not modify.
- **`frontend/src/styles/global.css`** (UPDATE, shared): consumes tokens only. **Append** the Story 3.4 block at the very END. Existing patterns to mirror: `.orbit-inline-error` (danger text, `meta` size) is reusable for the bulk-delete-failure inline error; `.orbit-footer-slot:empty` already hides an empty footer.

### Reusable building blocks (don't reinvent)

- **`InlineError`** (`components/InlineError.tsx`) — non-blocking `danger` inline error, `role="alert"`, optional retry button. Reuse it for the AC5 bulk-delete-failure message rather than building a new error UI. (A retry affordance is optional here — reconciliation happens via query invalidation.)
- **`apiFetch`** (`api/client.ts`) — the ONLY module that touches `fetch`. Route the new endpoint through it; do not call `fetch` directly.
- **`renderWithClient` + `createTestQueryClient`** (`test-utils.tsx`) — fresh `QueryClient` (`retry:false`, `refetchOnWindowFocus:false`) per test. Use for all component tests.
- **TanStack Query cache as the single source of List state (AD-6):** the optimistic hide, undo restore, and reconcile all operate on `queryClient` data at `todosQueryKey` — components never hold their own List copy. Mirror the standard optimistic pattern (`onMutate` snapshot → `onError` rollback → `onSettled` invalidate, AD-6) but note the **twist**: the "optimistic hide" happens at **click time**, and the mutation itself only fires at **commit time** (dismiss). So the snapshot/hide is done manually in `clear()`, and the `useMutation` handles just the deferred server call + error rollback + invalidate.

### Microcopy — use EXACTLY (EXPERIENCE.md Voice & Tone)

- Footer count: **`No completed items`** (zero) / **`N completed`** (e.g. `2 completed`). [Source: EXPERIENCE.md Voice&Tone table line "Footer count: '2 completed' / 'No completed items'"]
- Toast: **`Cleared N completed. Undo`** (e.g. `Cleared 3 completed. Undo`). "Undo" is the action button label. [Source: EXPERIENCE.md Voice&Tone; epics.md Story 3.4 AC]
- Clear button label: **`Clear completed`**. [Source: DESIGN.md Components; epics.md]
- Bulk-delete-failure inline error: EXPERIENCE.md's action-error copy is **`Couldn't save that — try again.`** — reuse it (or a close calm variant) for AC5. No exclamation marks, no emoji, no error codes. [Source: EXPERIENCE.md Voice&Tone]

### Design tokens / visuals (already in tokens.css — consume, don't redefine)

- Clear-completed button: `--button-clear-text` (`ink-secondary`) → `--button-clear-text-hover` (`ink-primary`), `--button-clear-radius` (`radius-sm` 8px), **no fill, no border** (ghost). `button` type: 14px/500, tracking +0.01em (`--type-button-*`). [Source: DESIGN.md Components button-clear, Typography]
- Undo toast: `--toast-undo-bg` (`surface-raised` #161C31), `--toast-undo-text` (`ink-primary`), `--toast-undo-action` (`accent-strong` #9CC0FF), `--toast-undo-radius` (`radius-md` 14px). Transient bar; auto-dismiss ~6s; pauses on hover/focus. Mobile: near-full-width above the thumb zone. [Source: DESIGN.md Components toast-undo, Layout; EXPERIENCE.md Responsive]
- `accent`/`accent-strong` is used ONLY on checked box, focus ring, toast action, and Clear hover — never decoration. [Source: DESIGN.md Colors]
- Completion is never signaled by color alone (three cues) — not directly relevant here but keep the footer/toast calm and text-first. [Source: EXPERIENCE.md]

### API / architecture contract (verified)

- **`DELETE /api/todos/completed`** — body `{ "ids": [uuid, …] }` (client always sends the snapshot); response **`200 { "deleted": <int> }`**; error `500` → AD-5 envelope. Registered before `/{id}` (backend concern, already done). Server deletes only ids still completed. [Source: ARCHITECTURE-SPINE.md API-Contract line 151, AD-7]
- **`Todo` wire shape:** `{ id: string(uuid), description: string, completed: boolean, created_at: string(ISO-8601 UTC "…Z") }`. `snake_case`, no mapping layer (AD-3). Types already in `src/types.ts`. [Source: types.ts; ARCHITECTURE-SPINE.md AD-3]
- **Error envelope (one shape everywhere):** `{ error: { code, message, details? } }` → parsed by `apiFetch` into `ApiClientError { code, message, status, details? }`. AC5 catches this in the mutation `onError`. [Source: api/client.ts; ARCHITECTURE-SPINE.md AD-5]
- **AD-6:** all mutations use TanStack Query; `onMutate` snapshot → `onError` rollback → `onSettled` invalidate. Here the optimistic hide is manual (at click), the deferred mutation fires at dismiss. [Source: ARCHITECTURE-SPINE.md AD-6]
- **Dependency direction:** `components → hooks → api client → HTTP`. Footer/UndoToast read/act through `useTodos`/`useClearCompleted`; never import `fetch` or the client directly. [Source: ARCHITECTURE-SPINE.md Invariants]

### Source tree — where files go

```
frontend/src/
  api/todos.ts                 # + clearCompleted(ids)                        (UPDATE, shared)
  hooks/useClearCompleted.ts   # deferred-commit orchestration                (NEW)
  hooks/useTodos.ts            # import todosQueryKey read-only               (DO NOT EDIT)
  components/Footer.tsx        # completed count + Clear-completed button      (NEW)
  components/UndoToast.tsx     # bottom overlay toast + Undo action           (NEW)
  components/Panel.tsx         # footer-slot / toast-overlay region ONLY      (UPDATE, shared)
  App.tsx                      # compose Footer into footerSlot + mount toast (UPDATE, likely)
  styles/global.css            # append Story 3.4 block at END                (UPDATE, shared)
  styles/tokens.css            # button-clear / toast-undo tokens exist       (DO NOT EDIT)
  hooks/useClearCompleted.test.tsx OR components/Footer.test.tsx / UndoToast.test.tsx  (NEW tests)
```
Naming: `PascalCase` components one-per-file; hooks `useX`; `camelCase` funcs/vars. [Source: ARCHITECTURE-SPINE.md Consistency-Conventions, Source-tree]

### Testing standards

- **Vitest + @testing-library/react**, jsdom, globals on, colocated `*.test.{ts,tsx}`; `src/test-setup.ts` registers jest-dom; `vitest.config.ts` has `css:true`. Coverage: v8, branch on, `all:true`, **report-only** (gate flips in 6.2). Established exclusions (`main.tsx`, `types.ts`, `*.d.ts`, tests, `test-setup.ts`, `test-utils.tsx`, `backdrop/**`) — do not change them. [Source: vitest.config.ts]
- **FAKE TIMERS are required** for the toast auto-dismiss / hover-pause tests (`vi.useFakeTimers()`; `vi.advanceTimersByTime(6000)` inside `act`). Reset timers in `afterEach` (`vi.useRealTimers()`). Mock `../api/todos` so `clearCompleted` is a spy you assert call count / args on, and no real network is hit.
- **Deterministic cache seeding:** either `getTodosMock.mockResolvedValue(seed)` and `await screen.findBy…` to let the query settle before switching to fake timers, or set `queryClient.setQueryData(['todos'], seed)` directly. Beware ordering: install fake timers *after* the initial query settles, or flush microtasks carefully.
- Run tests for real; report actual pass/fail + coverage %. Never fake passing tests. [Source: epics.md Story 3.4 Test Scenarios]

### Accessibility (baseline this story; full hardening in 3.5)

- Completed count in a polite `aria-live="polite"` region so SR users hear count changes. Clear-completed is a real focusable `<button type="button">`. Undo toast is announced (`role="status"`/`aria-live="polite"`) and its "Undo" is a real focusable button. Full tab-order/focus-ring loop is Story 3.5, but do not regress the existing 2px focus-ring rule in global.css. [Source: EXPERIENCE.md Accessibility-Floor; UX-DR14]

### Previous story intelligence (Story 3.1)

- 3.1 built the panel shell with placeholder footer slot, tokens (incl. `--button-clear-*`/`--toast-undo-*` reserved for THIS story), the typed `/api` client (`apiFetch` + `ApiClientError`), `useTodos` (`todosQueryKey = ['todos']`), and `TodoList`. 3.1 review lessons: prefer `aria-labelledby` over duplicate literal labels; provide non-`color-mix` fallbacks where load-bearing; don't focus `aria-hidden` placeholders. Tests: 21 passing, 100% coverage (report-only), lint+build green — match that bar.
- 3.1 added `test-utils.tsx` (`renderWithClient`) and set `css:true` in vitest so token classes apply in jsdom. Reuse both.

### Project Structure Notes

- Only edit `frontend/**` and this story file. No backend changes. Runtime: Node 22 via `nvm use` (`.nvmrc`=22); project-local `frontend/node_modules` via `npm ci`; no global installs. Deps already present: `@tanstack/react-query ^5.62`, `react ^19.2`. No new dependencies. [Source: package.json; .nvmrc; CLAUDE.md]
- Panel.tsx and global.css and api/todos.ts are **shared with sibling story branches (3.2/3.3)** — keep edits localized and additive to minimize merge conflicts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.4] — authoritative ACs + test scenarios; #FR-9; #AD-7; #UX-DR7, #UX-DR8, #UX-DR13, #UX-DR14
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/EXPERIENCE.md] — IA Footer bar, State Patterns "Clear-completed pending"/"Clear-completed error", Voice&Tone microcopy, Accessibility Floor, Responsive (toast mobile), Open-Questions #3 (deferred-commit chosen)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/DESIGN.md] — Components button-clear + toast-undo, Colors/accent usage, Typography button/meta, Layout/radius
- [Source: _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md] — AD-7 (deferred bulk-delete + id snapshot), AD-6 (query mutations), AD-5 (error envelope), AD-3 (wire shape), API Contract (`DELETE /api/todos/completed` `{ ids }` → `200 { deleted }`), Source tree, Conventions, Testing
- [Source: frontend/src/api/todos.ts, client.ts, hooks/useTodos.ts, components/Panel.tsx, components/InlineError.tsx, styles/tokens.css, styles/global.css, test-utils.tsx, vitest.config.ts] — existing patterns to build on
- [Source: _bmad-output/implementation-artifacts/3-1-*.md] — previous story patterns + review lessons

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `claude-opus-4-8[1m]`

### Debug Log References

- Node 22.23.1 via nvm (`.nvmrc` = 22); `npm ci` in `frontend/` (297 pkgs, 0 vulnerabilities). No global installs; no new dependencies.
- `npx vitest run` → 32/32 passing across 7 files. `npm run lint` (eslint + `tsc --noEmit`) clean. `npm run build` succeeds (232 kB JS / 8 kB CSS; three.js not bundled — not imported).
- Coverage (report-only, v8, branch on): Statements 96% (120/125), Branches 87.03% (47/54), Functions 100% (37/37), Lines 100% (116/116). Remaining uncovered branches are unreachable defensive guards in `useClearCompleted` (e.g. `clear()` early-returns on empty/zero-completed — the Clear button is absent at zero, so the UI never reaches them).
- Fake-timer note: component tests seed the query cache directly with `staleTime: Infinity` so `useTodos` resolves synchronously and `vi.useFakeTimers()` is safe from the start; timer advances are wrapped in `act()` and react-query promise chains flushed with a microtask helper. `fireEvent` used (not userEvent) to avoid userEvent/fake-timer friction.

### Completion Notes List

- All 6 ACs satisfied. Built on the Story 3.1 scaffold; `tokens.css` untouched (button-clear/toast-undo tokens already present), `useTodos.ts` untouched (imported `todosQueryKey` read-only).
- **AD-7 deferred commit** (`hooks/useClearCompleted.ts`): `clear()` reads the List from the query cache, captures the id snapshot of currently-completed Todos, optimistically hides them (`setQueryData` filter), and starts a `CLEAR_UNDO_MS = 6000` timer — **no server call**. `undo()` clears the timer and restores the pre-clear list (exact positions/states) — **no server call**. Timeout (or manual dismiss) funnels through a single guarded `commit()` that fires **exactly one** `clearCompleted(ids)` (`DELETE /api/todos/completed` `{ ids }`); a `committedRef` guard prevents double-fire and blocks commit after undo. Mutation `onError` restores the cleared rows + sets the inline error; `onSettled` invalidates the List to reconcile. Snapshot is captured at click time so a Todo completed later is never included. Timer pauses on hover/focus (`pauseTimer` clears it; `resumeTimer` restarts the full window — documented semantic). Unmount cleanup clears any pending timer.
- **API** (`api/todos.ts`): appended `clearCompleted(ids)` calling `apiFetch('/todos/completed', { method:'DELETE', body: JSON.stringify({ ids }) })`, parsing the `200 { deleted }` body. `getTodos` untouched.
- **Footer** (`components/Footer.tsx`): reads `useTodos()` for the completed count; left is a polite `aria-live` region with exact copy `No completed items` / `N completed`; right is a ghost `Clear completed` button that is **absent** when zero completed. Reuses `InlineError` for the bulk-delete-failure message.
- **UndoToast** (`components/UndoToast.tsx`): bottom overlay, `role="status"`, text `Cleared N completed.` + a real focusable `Undo` button (combined reads "Cleared N completed. Undo"); hover/focus → pause, leave/blur → resume.
- **Wiring**: `App.tsx` owns the `useClearCompleted` hook and passes `footerSlot={<Footer/>}` + `toastSlot={<UndoToast/>}` to `Panel`. `Panel.tsx` change is localized: added an optional `toastSlot` overlay rendered after the panel `<section>` (fragment wrap) — the add-input slot is untouched, keeping the Story 3.2 merge clean.
- **Styles**: appended the `/* Story 3.4: footer + clear-completed + undo toast */` block at the END of `global.css` (tokens only; ghost button, fixed bottom toast layer near-full-width on mobile, reduced-motion drops the toast animation).
- **Tests**: `hooks/useClearCompleted.test.tsx` (fake timers, mocked API) covers optimistic hide + toast + no-call-yet, undo restores + no call, ~6s → exactly one DELETE with the snapshot (+ no double-fire), late-completed excluded from snapshot, hover pauses the timer, bulk-failure returns rows + inline error + reconcile. `components/Footer.test.tsx` covers the count copy (0 vs N), aria-live, button inert-at-zero, inline error. `api/client.test.ts` extended for `clearCompleted` body/response.
- **Out of scope (untouched):** `sprint-status.yaml`, `docs/AI-INTEGRATION-LOG.md`, `useTodos.ts`, `tokens.css`, backend. Add-input (3.2), row toggle/delete (3.3), keyboard/SR/responsive hardening (3.5), three.js (Epic 4) deferred.

### File List

**New — frontend/src/**
- `hooks/useClearCompleted.ts`
- `components/Footer.tsx`
- `components/UndoToast.tsx`
- `hooks/useClearCompleted.test.tsx`
- `components/Footer.test.tsx`

**Modified — frontend/src/**
- `api/todos.ts` (appended `clearCompleted(ids)`)
- `components/Panel.tsx` (added `toastSlot` overlay region; add-input slot untouched)
- `App.tsx` (owns `useClearCompleted`; wires Footer + UndoToast)
- `styles/global.css` (appended Story 3.4 block at END)
- `api/client.test.ts` (added `clearCompleted` test)

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-23 | Story 3.4 created (ready-for-dev): footer bar + completed count, ghost Clear-completed, and AD-7 deferred-commit Undo toast (id snapshot, ~6s, hover/focus pause, one bulk DELETE on dismiss, pure client-side undo). |
| 2026-07-23 | Story 3.4 implemented: `clearCompleted` API, `useClearCompleted` deferred-commit hook, `Footer` + `UndoToast`, Panel `toastSlot`, App wiring, global.css block. 32 Vitest tests pass (fake-timer toast/undo suite included); lint + build green; coverage 96% stmts / 100% funcs+lines (report-only). Status → review. |
| 2026-07-23 | Code review (3-layer adversarial): approved. Applied 1 patch — removed the unused `commit` from the hook's public surface (dead API). No high/medium findings; 2 dismissed. Re-verified 32 tests pass, lint + build green. Status → done. |

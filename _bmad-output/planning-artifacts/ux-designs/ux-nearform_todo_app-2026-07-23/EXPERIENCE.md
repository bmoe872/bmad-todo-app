---
name: Orbit
status: final
sources:
  - {planning_artifacts}/prds/prd-nearform_todo_app-2026-07-23/prd.md
  - {planning_artifacts}/prds/prd-nearform_todo_app-2026-07-23/addendum.md
  - {planning_artifacts}/briefs/brief-nearform_todo_app-2026-07-23/brief.md
updated: 2026-07-23
---

# Orbit — Experience Spine

> Single-surface responsive web (~320px → desktop). One screen: input, list, clear-completed. No login, no onboarding. A three.js "floating in space" Backdrop is a delighter layered on a fast, reliable core and never allowed to compromise it. `DESIGN.md` (Orbit) is the visual identity reference; this spine owns how it works. Both spines win on conflict with any mock or import. Glossary terms (Todo, Description, Completion status, List, Clear completed, Backdrop, Reduced-motion fallback) are used verbatim from the PRD §3.

## Foundation

One surface, responsive web. React + Vite; no UI component library inherited — behavior is specified from scratch here, visuals in `DESIGN.md`. The List is the first and only screen: on open the app fetches and renders the persisted List with no auth, onboarding, or manual load step (FR-4). Single implicit global List in v1 — no per-user scoping. All writes are **optimistic**: the UI reflects the change within the interaction budget (~100ms) and reconciles with the server, rolling back and surfacing a non-blocking error on failure (FR-7, NFR-Perf). The Backdrop renders behind everything as a fixed, `aria-hidden`, non-interactive decorative layer that can be switched off entirely without affecting the loop (FR-8).

## Information Architecture

There is one surface. Everything is composed into a single floating **Panel**; the Backdrop sits behind it.

| Zone (top → bottom, within the one screen) | Purpose | Realizes |
|---|---|---|
| Title | "Todos" — quiet anchor, no nav | — |
| Add-input | Always-visible capture field; Enter creates a Todo at the top | FR-1 |
| List | The Todos, newest-first; each row = checkbox + description + delete | FR-2, FR-3, FR-4, FR-5 |
| Footer bar | Left: count of remaining/completed. Right: **Clear completed** action | FR-9 |
| Backdrop | Decorative cube-star field / fallback, behind the Panel | FR-8 |

No routes, no tabs, no drawer, no modals for the core loop. The only overlay is the transient **Undo toast** after Clear completed. Surface closure: every stated need (capture, see, complete, toggle-back, delete, clear-completed, empty/loading/error) is delivered by a zone of this one screen; there is nowhere else to navigate.

→ Composition reference: mocks under `.working/` are illustrative only; this spine and `DESIGN.md` win on conflict.

## Voice and Tone

Microcopy. Brand voice and aesthetic posture live in `DESIGN.md.Brand & Style`. Voice is calm, plain, and quietly warm — never chirpy, never alarmist, no exclamation marks, no emoji.

| Do | Don't |
|---|---|
| Placeholder: "What needs doing?" | "Add a task…", "Type here to get started!" |
| Empty state: "Nothing to do — add something above." | "You're all caught up! 🎉", "No items." |
| Loading: nothing textual — skeleton rows carry it | "Loading your tasks, please wait…" |
| Load error: "Couldn't load your list. Retry" | "Error 500: request failed" |
| Validation (empty): "Type something first." | "Invalid input.", "This field is required." |
| Validation (too long): "That's a bit long — keep it under 500 characters." | "Max length exceeded (500)." |
| Action error: "Couldn't save that — try again." | "Mutation failed." |
| Clear-completed toast: "Cleared 3 completed. Undo" | "Are you absolutely sure?" |
| Footer count: "2 completed" / "No completed items" | "2/5 done (40%)" |

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| Add-input | Top of panel | Always visible and focusable on load (autofocus on desktop; not forced on touch to avoid keyboard pop-up `[ASSUMPTION]`). Enter submits; trims whitespace; blocks empty/whitespace-only and > ~500 chars **client-side** with inline message; field clears and refocuses on success; new Todo appears optimistically at the top. |
| Todo row | List | Whole checkbox and the delete button are the only hit targets; clicking the description text does **not** toggle (no in-place edit in v1, avoids accidental toggles). Checkbox toggles completion optimistically and restyles **in place** — never reorders (FR-5). Delete removes optimistically. |
| Checkbox | Todo row | Toggles active ↔ completed both directions (FR-2). Announces new state to assistive tech. Optimistic; reconciles/rolls back. |
| Delete affordance | Todo row | Permanent delete, no undo (FR-3 out-of-scopes delete-undo). Hover-revealed on pointer; **always visible on touch**. Optimistic remove; on failure the row reappears with an inline error. |
| Clear-completed | Footer | Removes all completed Todos in one action (FR-9). Inert/absent when zero completed. Fires optimistically and shows the **Undo toast**. |
| Undo toast | Overlay, bottom | Appears after Clear completed. "Undo" restores every cleared Todo to its prior position/state. Auto-dismiss ~6s; pauses on hover/focus; dismiss commits the deletion server-side. See State Patterns for the commit model. |
| Skeleton rows | List, cold load | 3–5 placeholders during initial List fetch; resolve to rows / empty / error. |
| Inline error | Under input or list header | Non-blocking text + (for load/bulk failure) a Retry affordance. Never a modal or full-screen state. |

## State Patterns

The three required states — **empty, loading, error** — plus the reconciliation states that make optimistic UI safe.

| State | Where | Treatment |
|---|---|---|
| Loading (cold) | List | Skeleton rows over the calm Backdrop. Always resolves to loaded / empty / error — never a spinner that hangs (FR-6). |
| Empty | List | "Nothing to do — add something above." Centered in the panel; input stays focused and inviting. Not a blank void (FR-6, UJ-3). |
| Loaded | List | Newest-first rows; completed items styled in place (FR-5). |
| Load error | List | Inline: "Couldn't load your list. Retry" — the app frame + input still render; retry re-fetches. App never crashes (FR-7). |
| Create error | Under input | Optimistic row rolls back; "Couldn't save that — try again." Text the user typed is preserved so nothing is lost. |
| Toggle error | Row | Checkbox reverts to prior state; brief inline "Couldn't save that — try again." near the row. |
| Delete error | Row | Deleted row reappears in place; inline error. List reconciles to true server state (FR-3). |
| Clear-completed pending | Footer + toast | Completed rows disappear optimistically; Undo toast visible. Per the decided deferred-commit model (architecture AD-7), the server commit is **deferred until the toast dismisses**: on dismiss the client fires a single `DELETE /api/todos/completed` carrying an id snapshot, and Undo is a pure client-side timer cancel with **no server call**. (The earlier immediate-delete-with-compensating-recreate-on-Undo alternative was considered and superseded by AD-7.) |
| Clear-completed error | Footer | If the bulk delete fails, cleared rows return to their positions and an inline error shows; List reconciles to true state (FR-9, FR-7). |
| Offline / network drop | Global | Failed writes roll back per the rules above with the standard "try again" message. No offline queue in v1 (PWA/offline is out of scope). |

## Interaction Primitives

- **Enter** in the add-input creates a Todo. **Escape** clears the input's current text (does not submit).
- **Click / tap** the checkbox toggles completion. **Click / tap** the × deletes. Clicking the description does nothing (no edit in v1).
- Every action is **optimistic**: instant UI, then reconcile. Perceived update within ~100ms (NFR-Perf, SM-2).
- **Undo** is available only for **Clear completed** (via toast). Single-item delete has no undo (FR-3) — deliberate, keeps the row interaction one-tap and honest.
- **Banned:** modal confirmation dialogs anywhere in the core loop; drag-to-reorder (order is fixed newest-first); hover-only affordances on touch; infinite spinners; any blocking overlay over the list; reordering on completion.

## Accessibility Floor

Behavioral. Visual contrast values live in `DESIGN.md`. Target: **zero critical WCAG 2.1 AA violations with the Backdrop active** (SM-4, NFR-A11y), verified by axe-core / Lighthouse via Playwright.

- **Keyboard:** the entire core loop is operable by keyboard alone — Tab reaches input → each row's checkbox → its delete → Clear completed → toast Undo, in reading order (newest-first). Enter/Space activate controls. Focus never lands on the `aria-hidden` Backdrop.
- **Focus visibility:** a 2px `border-focus` ring at AA contrast against the panel on every interactive element. Focus rings derive contrast from the panel, **never** from the moving Backdrop.
- **ARIA / semantics:** the List is a labeled list; each row exposes the Todo's description and its completion state (e.g. a labeled checkbox whose checked state reflects completion). Toggling announces the new state. The completed count is announced via a polite `aria-live` region so screen-reader users perceive changes. Validation and action errors are associated with their control and announced (`aria-live` / `aria-describedby`). The Undo toast is announced and reachable; its action is a real focusable button.
- **The Backdrop is `aria-hidden`, `role`-less, non-focusable, non-interactive** — invisible to assistive tech and the tab order.
- **Contrast over motion:** because Todo text sits on the ~72% `surface-scrim` panel (`DESIGN.md`), text/UI contrast is independent of whatever drifts behind. Never place text directly on the star field.
- **Reduced motion:** `prefers-reduced-motion: reduce` → the Backdrop shows a **static** starfield with no looping animation; UI micro-transitions (toast slide, row fade) also drop to instant. See Backdrop section.
- **Targets & zoom:** interactive targets ≥ 44×44px. Layout survives 200% zoom and user font scaling without clipping controls or content.
- **Completion never by color alone:** completed = checked box + strikethrough + de-emphasized ink together (three redundant cues) — safe for color-blind users (FR-2, `DESIGN.md` Do's/Don'ts).

## Backdrop (three.js "Todo in Space") — treatment & fallbacks

The signature delighter, held strictly subordinate to the loop (FR-8, SM-C2). Product-specific section.

**Default (WebGL available, motion allowed):** a fixed full-viewport three.js scene behind the panel — cube "stars" drifting slowly past over the `surface-void` gradient. Targets ~60fps with graceful step-down; must not push interaction latency past the NFR-Perf budget on a mid-range laptop and mid-range phone. Renders **after** the core loop is interactive (never blocks first paint or input); the app is fully usable before/without it.

**Reduced-motion fallback (mandatory):** when `prefers-reduced-motion: reduce` is signaled, no looping animation runs — a **static** rendering of the same starfield is shown instead (a single rendered frame or a static gradient-plus-cubes image). Identical layout and contrast; only motion is removed (FR-8, UJ-3).

**No-WebGL / capability fallback:** if WebGL is unavailable or context creation fails, the Backdrop degrades to a **plain static background** — the `surface-void → surface-void-far` radial gradient — rather than erroring. The loop is unaffected (FR-8).

**Performance guardrails:** pause or throttle the animation when the tab is hidden (`visibilitychange`); cap device-pixel-ratio and cube count on low-power devices; step down frame rate before ever dropping input responsiveness. If the frame budget can't be met, fall back to static rather than stutter (SM-C2, NFR-Perf).

**Readability contract:** the panel scrim guarantees text contrast regardless of the field behind it; cube brightness/density is tuned so nothing bright ever sits directly behind text — and it can't, because the panel is opaque enough. The Backdrop carries no Todo data and no interaction.

## Responsive & Platform

Responsive web, ~320px → desktop; core loop fully usable by touch and keyboard (NFR-Resp). Current evergreen Chrome/Firefox/Safari/Edge `[ASSUMPTION]`.

| Viewport | Behavior |
|---|---|
| Desktop / tablet (≥ 640px) | Centered panel, capped at 560px, floating over a wide void margin. Delete affordance hover-revealed. Add-input autofocused on load. |
| Mobile (320–639px) | Panel fills width minus a 16px gutter each side; void shows top/bottom. Delete affordance **always visible** (no hover). Add-input not force-focused (avoids immediate keyboard). Toast spans near-full width above the thumb zone. |

Single column at every size. Nothing is hidden behind a breakpoint; the whole product is always on screen.

## Inspiration & Anti-patterns

- **Lifted from TodoMVC / Apple Reminders:** the one-line input at top, Enter-to-add, check-in-place, and a footer clear-completed — the proven minimal task loop. Orbit adds the void, nothing else structural.
- **Lifted from optimistic-first UIs (Linear, Things):** every action feels instant; the network is invisible until it fails, and failure is a quiet inline nudge, not a modal.
- **Rejected — confirmation dialog on Clear completed:** a modal "Are you sure?" interrupts the fast single-screen loop and trains users to dismiss reflexively. Orbit uses a reversible **Undo toast** instead (see Open Questions).
- **Rejected — reordering completed items to the bottom:** the PRD fixes newest-first with completed-in-place (FR-5); moving them would destroy the "see my progress in place" feel (UJ-2).
- **Rejected — celebratory animation / streaks / gamification:** the delight budget is spent entirely on the Backdrop; the loop stays quiet.
- **Rejected — decorating the UI to match the "space" theme (neon, glows, HUD chrome):** the stars are the spectacle; the UI is a calm panel that gets out of their way.

## Key Flows

Protagonist: **Maya**, managing her own day, on laptop and phone. Flows map to the PRD's UJ-1…UJ-4.

### Flow 1 — UJ-1: Maya dumps what's on her mind (mid-morning, laptop)

1. Maya opens the app in a browser tab. The List is already there — no login. The panel floats over drifting cube-stars; the input is focused.
2. She types "call the dentist" and presses Enter.
3. **Climax:** the item appears instantly at the top of the List as an active Todo; the field clears and stays focused. No spinner, no reload. She fires off two more the same way and closes the tab, everything captured. (Realizes FR-1, FR-4.)

*Failure:* a create fails to persist → the optimistic row rolls back, "Couldn't save that — try again." shows under the input with her text preserved.

### Flow 2 — UJ-2: Maya clears items on her phone (on the bus)

1. Maya opens the app on her phone. The panel fills the width; rows are legible and thumb-sized; delete × is visible on every row.
2. She taps the checkbox next to "call the dentist."
3. **Climax:** it immediately reads as completed — checked box, strikethrough, dimmed ink — and **stays exactly where it is**, so she can see her progress rather than watch it jump. She taps the × on a now-irrelevant task and it disappears. (Realizes FR-2, FR-3.)
4. Later she realizes one wasn't actually done: she taps its checkbox again and it returns to active, in place (FR-2, toggle-back).

*Failure:* a toggle or delete fails → the row reverts to its prior state in place with a brief inline "Couldn't save that — try again."

### Flow 3 — UJ-3: Maya opens to an empty, calm screen (start of day, reduce-motion on)

1. First run of the day, nothing outstanding. Maya's OS has "reduce motion" enabled.
2. The Backdrop renders as a **static** starfield — no drift. The panel floats as usual.
3. **Climax:** instead of a blank void, the empty state reads "Nothing to do — add something above," with the input focused and waiting. Calm, not empty-feeling. (Realizes FR-6, FR-7, FR-8.)

*Failure:* the initial List fetch fails → "Couldn't load your list. Retry" renders inline in the panel; the frame and input are intact; Retry re-fetches.

### Flow 4 — UJ-4: Maya clears a day's worth of finished tasks (end of day)

1. Several items are checked off, cluttering the List among the active ones. The footer reads "4 completed."
2. Maya taps **Clear completed**.
3. **Climax:** all completed Todos vanish in one action while her remaining active tasks stay put; a toast slides in — "Cleared 4 completed. Undo." She glances at it, doesn't need it, and it fades after a few seconds, committing the removal. Her List is now just what's left to do. (Realizes FR-9.)
4. *Undo path:* had she cleared by mistake, tapping **Undo** within the window restores all 4 to their prior positions and states.

*Failure:* the bulk removal fails server-side → the cleared rows return to their positions, an inline error shows, and the List reconciles to the true persisted state (FR-9, FR-7).

## Open Questions (resolved 2026-07-23)

1. **Clear-completed guard — RESOLVED (human): transient Undo toast, bulk-only.** A transient Undo toast (~6s, pauses on hover/focus) guards the bulk Clear-completed action — not a confirmation dialog. The undo affordance is scoped strictly to the bulk Clear-completed action within the toast window; single-item delete remains undo-less per PRD FR-3. Signed off as a deliberate, consistent scoped exception. (PRD FR-9.)
2. **Dark-only visual identity — RESOLVED (human): dark-only for v1.** Orbit ships a single dark, cosmic theme; no light theme in v1.
3. **Clear-completed commit model — DEFERRED to architecture (accepted).** Server delete may fire immediately (with a compensating re-create on Undo) or defer until the toast dismisses; both satisfy the UX. Architecture chooses.
4. **Add-input autofocus on touch — RESOLVED (human, accepted): desktop-only autofocus.** Autofocus the add-input on desktop only, to avoid popping the mobile keyboard on open.

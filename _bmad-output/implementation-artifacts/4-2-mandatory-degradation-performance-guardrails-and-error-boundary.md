---
baseline_commit: 83e035563534eda42f03b697990fb1025b93c360
---

# Story 4.2: Mandatory degradation, performance guardrails, and error boundary

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As any user (reduced-motion, no-WebGL, low-power, or hit by a Backdrop failure),
I want the Backdrop to degrade gracefully to a static fallback and never break or slow the app,
so that accessibility and the interaction budget always win over visual flourish.

## Acceptance Criteria

1. **(AC1 — full reduced-motion static fallback)** Given `prefers-reduced-motion: reduce`, when the app loads, then NO looping animation runs — a single static frame (static starfield) is shown with identical layout and contrast; only motion is removed. Where feasible, respond to a runtime toggle of the OS setting via a media-query `change` listener (start the loop if motion becomes allowed; stop to a static frame if it becomes reduced) (FR-8, AD-8, UX-DR12, UX-DR16).
2. **(AC2 — no-WebGL / context-creation-failure fallback)** Given WebGL is unavailable or context creation throws, when the app loads, then the Backdrop degrades to the plain `surface-void → surface-void-far` radial gradient rather than erroring; no error is surfaced to the user and the core loop is unaffected (FR-8, AD-8, UX-DR12).
3. **(AC3 — runtime WebGL context-loss recovery)** Given the animation is running, when the GPU fires `webglcontextlost`, then the loop stops cleanly (preventing the default so a restore can occur) without crashing; on `webglcontextrestored` the field re-initializes/resumes, or otherwise falls back to the static gradient. No uncaught error reaches the app (AD-8, FR-7).
4. **(AC4 — visibility pause)** Given the animation is running, when the tab becomes hidden (`document.visibilitychange` → `hidden`), then the rAF loop pauses; when the tab becomes visible again the loop resumes. No CPU/GPU is burned rendering a background tab (AD-8, NFR-Perf).
5. **(AC5 — performance watchdog / ordered degradation ladder)** Given a low-power device or a sustained missed frame budget, when rendering, then a watchdog steps down in this exact order — (1) reduce device-pixel-ratio, (2) reduce cube count, (3) stop the loop and fall back to a static frame — rather than stutter. Frame rate is reduced before input responsiveness is ever dropped; the watchdog decision logic is a pure, unit-testable function driven by observed frame times (AD-8, NFR-Perf, SM-C2).
6. **(AC6 — React error boundary)** Given the Backdrop throws at any point (render or a caught async failure surfaced through React), when the error occurs, then an error boundary wrapping the Backdrop catches it and renders the static gradient fallback; the core todo loop is never taken down and stays fully rendered and usable (FR-8, AD-8, FR-7).
7. **(AC7 — accessibility posture holds with the backdrop active)** The zero-critical-WCAG-AA contract holds with the backdrop active: the layer stays `aria-hidden`, never enters tab order, contrast is carried by the ~72% `surface-scrim` panel (unchanged), and reduced-motion users get no motion. (The automated axe gate itself is Story 6.1; here the semantics/contract must be correct.) (NFR-A11y, UX-DR12, UX-DR14)
8. **(AC8 — no regression / isolation preserved)** All existing frontend tests continue to pass; `three` stays code-split in its own lazy chunk and absent from the entry bundle (AC4 of 4.1 must NOT regress); the backdrop still owns its canvas imperatively with the rAF loop outside React's render cycle, reads no Todo data, and disposes cleanly on unmount (no leaked loop / listener / context) (AD-8).

## Tasks / Subtasks

- [x] **Task 1 — Extract the degradation-ladder decision logic into a pure, testable module** (AC: 5)
  - [x] Create `src/backdrop/degradation.ts` (NEW) — a framework-free, `three`-free module exporting the watchdog's pure decision function and the ladder types. Example shape: `type QualityTier = { dprCap: number; count: number }`, an ordered `TIERS` array (highest quality first), and `nextDegradationStep(state, recentFrameMs[]): 'reduce-dpr' | 'reduce-count' | 'fallback-static' | 'hold'`. The function decides PURELY from observed frame times + current tier index (no `three`, no DOM) so it is fully unit-testable in jsdom.
  - [x] Ladder order is FIXED by AD-8: step 1 reduce DPR → step 2 reduce cube count → step 3 stop loop + static frame. Only step down after a *sustained* budget miss (e.g. N consecutive over-budget frames or a rolling average over the ~16.7ms 60fps budget), never on a single spike, so a GC hitch or a resize does not nuke the field. Include hysteresis / a minimum sample count in the decision.
  - [x] Keep this module importable WITHOUT pulling in `three` (so it does not re-enter the entry bundle and is not excluded from coverage). `scene.ts` imports the tiers/decider from here; the pure logic is what tests cover.
- [x] **Task 2 — Wire the watchdog + context-loss + DPR/count step-down into `scene.ts`** (AC: 3, 5)
  - [x] In the rAF `step`, sample per-frame delta (ms). Feed a small rolling window into `nextDegradationStep`. On `reduce-dpr`: lower the pixel-ratio cap and call the existing resize path. On `reduce-count`: hide/skip a fraction of instances (e.g. reduce the effective draw count on the `InstancedMesh` via `mesh.count`) — do NOT reallocate buffers per frame. On `fallback-static`: stop the loop and render one static frame (or signal the host to drop to gradient). Expose current tier for tests/telemetry if cheap.
  - [x] Add `webglcontextlost` / `webglcontextrestored` listeners on the canvas. On lost: `event.preventDefault()`, stop the loop, mark context unavailable. On restored: re-initialize GPU resources (or, if re-init is impractical, signal the host to fall back to gradient) — never leave a dangling loop rendering to a dead context. Ensure `dispose()` removes these listeners (no leak).
  - [x] Extend the `CubeStarField` handle only as needed (e.g. an optional `onFallback` callback the host passes so the scene can tell React "I gave up, show gradient"). Keep the handle minimal and backward-compatible with 4.1's `{ start, stop, resize, renderStaticFrame, dispose }`.
  - [x] Keep DPR cap + count as adjustable state (they were static in 4.1). The watchdog mutates them within sane floors (never below a minimum DPR of ~1 or a minimum visible count) before it escalates to static.
- [x] **Task 3 — Add visibility pause + reduced-motion runtime toggle to `Backdrop.tsx`** (AC: 1, 4)
  - [x] Add a `document` `visibilitychange` listener: on `hidden` call `field.stop()`; on `visible` call `field.start()` (only if not in static/reduced-motion mode and the field is alive). Remove the listener in cleanup.
  - [x] Add a `matchMedia('(prefers-reduced-motion: reduce)')` `change` listener: if it flips to reduced → `field.stop()` + `field.renderStaticFrame()`; if it flips to allowed → `field.start()`. Guard for older Safari (`addEventListener` may be absent → fall back to `addListener`, and no-op if neither exists). Remove in cleanup. This is "where feasible" — degrade the listener wiring gracefully, never throw.
  - [x] Preserve ALL 4.1 behavior: the `cancelled` async-race guard, the try/catch around `createCubeStarField` (no-WebGL → gradient), resize handling, and `dispose()` on unmount. Do not regress the code-split dynamic `import('./scene')` boundary.
- [x] **Task 4 — Add the React error boundary around the Backdrop** (AC: 6)
  - [x] Create `src/backdrop/BackdropBoundary.tsx` (NEW) — a small class component implementing `getDerivedStateFromError` + `componentDidCatch` that, on any error thrown by its children, renders `null` (the CSS `body`/`.orbit-backdrop` void gradient is already the base layer, so rendering nothing IS the static-gradient fallback). It must NOT re-throw and must NOT render any visible/interactive/AT-exposed node. Optionally log to `console.error` in dev only.
  - [x] Wrap `<Backdrop />` with `<BackdropBoundary>` at the mount point in `App.tsx` (e.g. `<BackdropBoundary><Backdrop /></BackdropBoundary>`), OR export a composed default from the backdrop module and mount that. Keep `App.tsx` thin; do NOT wire Todo data into either. The boundary catches only backdrop-subtree errors — the todo loop lives in a sibling `<main>` and is unaffected.
  - [x] Note the React limitation in a comment: error boundaries catch errors during render/lifecycle/commit of the child tree, NOT errors thrown asynchronously inside the rAF loop or event handlers. Async scene failures are already handled by the try/catch + `onFallback` path (Task 2/3); the boundary is the backstop for synchronous/React-surfaced throws (AC6).
- [x] **Task 5 — Tests (Vitest / jsdom, WebGL mocked/absent)** (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] `src/backdrop/degradation.test.ts` (NEW) — unit-test the pure ladder decider: sustained over-budget frames step DPR → then count → then static, in that exact order; a single spike does NOT step down (hysteresis); good frame times → `hold`; floors are respected (never below min DPR/count before static). This is the AC5 decision-logic coverage.
  - [x] Extend `src/backdrop/Backdrop.test.tsx`: (a) `visibilitychange`→hidden calls `handle.stop`, →visible calls `handle.start` (drive by setting `document.visibilityState` + dispatching the event; use the existing `vi.mock('./scene')` handle); (b) reduced-motion runtime `change` → allowed starts the loop, → reduced stops + renders a static frame (mock `matchMedia` returning a mock MediaQueryList whose `addEventListener` captures the handler); (c) listeners are removed on unmount (no leak) — assert removeEventListener or that post-unmount events are no-ops; (d) reconfirm the existing 4.1 assertions still hold (reduced-motion at mount = static, no-WebGL = graceful degrade, async-race guard, dispose on unmount).
  - [x] `src/backdrop/BackdropBoundary.test.tsx` (NEW) — a child that throws on render is caught: the boundary renders no throwing subtree, does NOT crash the test render, and a sibling (representing the core loop) still renders. Silence the expected React error log for a clean run. Assert the fallback exposes no interactive / tab-focusable / AT-visible node (AC7 posture).
  - [x] Update `src/App.test.tsx` if the mount structure changes (boundary wrapper): the backdrop must remain present, `aria-hidden`, non-interactive; the panel/list still render. Keep the FR-4 no-onboarding + shell tests intact.
  - [x] Add comments noting what defers to Epic 6: real-device FPS / ~60fps step-down proof (Story 6.3), axe-with-backdrop-active zero-critical WCAG AA (Story 6.1), and that jsdom has no real WebGL/rAF timing so context-loss + watchdog are asserted via mocks/pure logic, not a live GPU.
- [x] **Task 6 — Coverage config: include the pure decision logic** (AC: 5)
  - [x] `vitest.config.ts` currently excludes ALL of `src/backdrop/**` from coverage (device-dependent visual tuning). Narrow that exclusion so the DEVICE-DEPENDENT rendering (`src/backdrop/scene.ts`) stays excluded but the pure DECISION logic (`src/backdrop/degradation.ts`) and, if practical, the React host/boundary are INCLUDED and covered. Minimal, surgical change — do not broaden coverage of `scene.ts` (no real WebGL in jsdom). Coverage stays REPORT-ONLY (the enforcing ≥70% gate is Story 6.2 — do not flip it).
- [x] **Task 7 — Build + bundle-chunk verification** (AC: 8)
  - [x] `npm run build` succeeds (tsc `--noEmit` + `vite build`).
  - [x] Re-inspect `dist/assets/`: confirm `three` STILL lands in a separate lazy chunk (`scene-*.js`), NOT the entry/index chunk. The new `degradation.ts` / `BackdropBoundary.tsx` must NOT drag `three` into the entry bundle (the boundary and decider are `three`-free). Report chunk names + sizes. This is the AC8/AC4-of-4.1 no-regression gate — verify quantitatively.
- [x] **Task 8 — Lint, full suite, coverage, and log** (AC: all)
  - [x] `npm run lint` (eslint + `tsc --noEmit`) clean.
  - [x] `npm run test` — full frontend suite green (report count vs the 90 baseline).
  - [x] `npm run coverage` — report real numbers; confirm `degradation.ts` decision logic is covered.
  - [x] Append a Story 4.2 entry to `docs/AI-INTEGRATION-LOG.md`.
  - [x] Update `sprint-status.yaml`: story 4.2 through its lifecycle; when done, epic-4 → done (4.2 is the last story of Epic 4).

## Dev Notes

### What this story is (and is NOT)

This is the **guardrail + degradation** story — the deliberate hand-off from 4.1. Story 4.1 shipped the working, isolated, code-split cube-star field with only a *static* DPR cap and *basic* reduced-motion / no-WebGL guards. 4.2 bolts on the FULL ordered degradation ladder, runtime resilience, and the error boundary so a backdrop problem can never harm the core loop. It is the SECOND and LAST story of Epic 4 — when it's done, Epic 4 is done.

Do NOT rewrite the working 4.1 scene visuals. Do NOT add `@react-three/fiber` or any React-three wrapper (AD-8 mandates imperative, framework-free scene outside React render). Do NOT change the `.orbit-backdrop` isolation CSS or the ~72% scrim panel opacity (the load-bearing accessibility device). Keep "training demo" framing out of code/comments.

[Source: epics.md#Story-4.2; 4-1-*.md#Completion-Notes; ARCHITECTURE-SPINE.md#AD-8]

### Isolation contract (AD-8) — the non-negotiable spine

> The backdrop is a fixed, full-viewport, `aria-hidden`, `pointer-events:none` layer below the panel. Its three.js code is code-split and mounted **after** the core loop is interactive. It owns its canvas imperatively inside an effect with its own `requestAnimationFrame` loop **outside** React's render cycle; it reads no Todo data. Degradation is mandatory and ordered: `prefers-reduced-motion` → a single static frame (no loop); no WebGL context → the CSS `surface-void → surface-void-far` radial gradient; a frame-budget watchdog steps down device-pixel-ratio then cube count, then falls back to static rather than stutter; the loop pauses on tab `visibilitychange`. An error boundary wraps the backdrop and falls back to the static gradient, so a backdrop failure can never take down the loop. [Source: ARCHITECTURE-SPINE.md#AD-8]

**Never-degrade-core is the overriding invariant.** Every guardrail here exists so the todo loop's paint, input, and interaction budget always win. Frame rate is sacrificed before responsiveness; the backdrop stops entirely before it starves the main thread.

### The degradation ladder — exact ordered steps (AD-8, AC5)

1. `prefers-reduced-motion: reduce` → single static frame, NO loop (also runtime-toggle aware).
2. No WebGL / context creation throws → CSS void gradient (base layer already shows through the transparent canvas).
3. Frame-budget watchdog, in order, on *sustained* miss: **(a) reduce DPR → (b) reduce cube count → (c) stop loop + static frame.**
4. `visibilitychange` hidden → pause loop; visible → resume.
5. `webglcontextlost` → stop cleanly (preventDefault); `webglcontextrestored` → recover or fall back.
6. React error boundary → any synchronous/React-surfaced backdrop throw → static gradient; core loop intact.

### Current state of files being modified (READ before editing)

- **`src/backdrop/scene.ts`** (UPDATE) — 4.1's `createCubeStarField(canvas, options)` returning `{ start, stop, resize, renderStaticFrame, dispose }`. Already has: transparent `WebGLRenderer` (alpha, no-AA, low-power), `InstancedMesh` of `count` cubes (default 220), a `resize()` that caps DPR at `Math.min(devicePixelRatio, maxPixelRatio=2)`, an rAF `step` loop with a fixed `dt` clamp, and a `dispose()` that cancels rAF + disposes geometry/material/renderer + `forceContextLoss()`. `start`/`stop` toggle a `running` flag. **Add** the watchdog sampling, DPR/count step-down, and context-loss listeners here. DPR cap + `count` become mutable. `mesh.count` can be lowered to reduce drawn instances cheaply (buffers already allocated for the max). Preserve the r185 API usage (`setMatrixAt`, `instanceColor`).
- **`src/backdrop/Backdrop.tsx`** (UPDATE) — 4.1's lazy imperative host: `useEffect` reads `prefersReducedMotion()`, dynamic `import('./scene')`, on resolve `try { createCubeStarField(canvas); staticOnly ? renderStaticFrame() : start(); addEventListener('resize', onResize) } catch { field=null }`, cleanup removes resize + `dispose()`. Has a `cancelled` flag for the async-unmount race. **Add** the `visibilitychange` listener, the reduced-motion `change` listener, and (if used) pass an `onFallback` to the scene. Keep the returned JSX (`div.orbit-backdrop[aria-hidden] > canvas`) unchanged.
- **`src/App.tsx`** (UPDATE — small) — renders `<Backdrop />` first, then `<main className="orbit-app">…</main>`. Wrap the backdrop in the new `<BackdropBoundary>`. Do NOT pass Todo data. Keep it thin.
- **`src/App.test.tsx`** (VERIFY/UPDATE) — has `it('mounts the backdrop as an aria-hidden, non-interactive isolated layer (Story 4.1)')` selecting `getByTestId('backdrop')`. The boundary wrapper must not break this selector — keep `data-testid="backdrop"` on the inner div. Update only if structure shifts.
- **`src/backdrop/Backdrop.test.tsx`** (UPDATE) — 4.1 suite already mocks `./scene` via `vi.hoisted` with a `handle` of spies (`start/stop/resize/renderStaticFrame/dispose`) and toggles `window.matchMedia`. EXTEND it (do not rewrite) for visibility + runtime reduced-motion + listener cleanup.
- **`src/test-setup.ts`** (VERIFY) — already stubs `HTMLCanvasElement.getContext → null` (deterministic no-WebGL). Keep. If a test needs `document.visibilityState` mutable, set it per-test with `Object.defineProperty`.
- **`vitest.config.ts`** (UPDATE — Task 6) — narrow the `src/backdrop/**` coverage exclusion to keep `scene.ts` excluded but include `degradation.ts` (+ host/boundary if practical). Report-only; do not flip the gate.

[Source: current repo files read during story creation — commit 83e0355]

### Readability / accessibility contract (AC7) — already structural

Contrast is carried by the unchanged ~72% opaque `surface-scrim` panel over the `z-index:0` backdrop (app is `z-index:1`); no bright cube can sit behind text regardless of what drifts. Focus rings derive from the panel, never the moving backdrop. The backdrop stays `aria-hidden` and out of tab order. Reduced-motion users get zero motion. The automated axe zero-critical-WCAG-AA assertion with the backdrop active is Story 6.1; this story only has to keep the semantics correct (nothing here should add an AT-visible or focusable node). [Source: EXPERIENCE.md#Backdrop; UX-DR12; UX-DR14; NFR-A11y]

### Testing standards (jsdom reality)

- jsdom has **no WebGL and no real rAF timing / GPU**. So: (1) the watchdog LADDER LOGIC is tested as a pure function with simulated frame-time arrays (`degradation.test.ts`); (2) the host wiring (visibility pause, reduced-motion toggle, listener cleanup) is tested via the `vi.mock('./scene')` handle + dispatched DOM events; (3) the error boundary is tested with a throwing child; (4) real ~60fps step-down on hardware and axe-with-backdrop defer to Epic 6 (Stories 6.3 perf, 6.1 axe). State this in test comments.
- Frontend tests are colocated Vitest `*.test.{ts,tsx}`; coverage is v8 branch, `all:true`, report-only. After Task 6, `degradation.ts` is INCLUDED; `scene.ts` stays excluded (device-dependent). Do not flip the enforcing gate (Story 6.2).
- Keep the WHOLE existing suite green (90 tests at baseline: App, a11y, components, hooks, api client, Backdrop). [Source: 4-1-*.md#Results; frontend/vitest.config.ts]

### Library / framework

- `three` **0.185.1** already installed; import it ONLY inside `scene.ts` (the code-split boundary). `degradation.ts` and `BackdropBoundary.tsx` MUST be `three`-free so they can live in the entry graph without dragging `three` in. React error boundaries REQUIRE a class component (`getDerivedStateFromError` / `componentDidCatch`) — there is no hook equivalent; do not reach for a library. `webglcontextlost`/`webglcontextrestored` are standard canvas events; `event.preventDefault()` on lost is REQUIRED for the browser to later fire restored. [Source: frontend/package.json; React docs; WebGL spec]
- Vite auto code-splits dynamic `import()`; the `await import('./scene')` boundary from 4.1 is what isolates `three`. Adding `three`-free siblings does not change that — verify in Task 7 regardless.

### File structure

```
frontend/src/backdrop/
  Backdrop.tsx           # UPDATE — + visibilitychange, + reduced-motion change listener
  BackdropBoundary.tsx   # NEW — React class error boundary → static gradient fallback
  scene.ts               # UPDATE — + watchdog step-down, + context-loss/restore listeners
  degradation.ts         # NEW — pure, three-free ladder decision fn (covered by tests)
  Backdrop.test.tsx      # UPDATE — + visibility/reduced-motion/cleanup cases
  BackdropBoundary.test.tsx # NEW — throwing child caught, sibling survives
  degradation.test.ts    # NEW — pure ladder decision unit tests
```
[Source: ARCHITECTURE-SPINE.md#Source-Tree; frontend/src/backdrop layout]

### Previous story intelligence (Story 4.1)

- `scene.ts` is the ONLY `three` importer; `Backdrop.tsx` reaches it via `await import('./scene')` — do not add a static `three` import anywhere reachable from `main.tsx`. 4.1 verified entry `index-*.js` ≈ 237 kB (74 kB gz) with ZERO three markers and a separate lazy `scene-*.js` ≈ 520 kB (130 kB gz). Keep it that way.
- 4.1 corrected `InstancedMesh.setMatrix` → `setMatrixAt` (real r185 API) and fixed `camera.aspect` when `h===0` (`h>0 ? w/h : 1`). Don't reintroduce.
- 4.1 review explicitly listed as intentional deferrals now IN SCOPE here: runtime WebGL-context-loss recovery, `visibilitychange` pause, frame-budget watchdog, React error boundary. StrictMode double-mount + async unmount races are handled by the `cancelled` flag + always-remove cleanup — preserve that pattern for the new listeners too (always remove in cleanup).
- `global.css` merges badly across parallel edits (3.4 retro) — but 4.2 runs solo and needs NO CSS change (the gradient fallback already exists on `body`). Do not touch `global.css` unless strictly necessary.
- test-setup stubs `getContext → null`, so under jsdom the real scene never initializes — the mocked-scene tests are how host behavior is asserted. [Source: 4-1-*.md#Debug-Log, #Completion-Notes, #Change-Log]

### Git intelligence

- Recent commits: `83e0355 Story 4.1: isolated three.js cube-star backdrop` (baseline, HEAD), preceded by Epic 3 frontend stories. Story 4.1 committed `scene.ts`, `Backdrop.tsx`, `Backdrop.test.tsx`, App/a11y test updates, `test-setup.ts`, sprint-status, AI-log. This story builds directly on those files — read them (done above) before editing.
- No error boundary exists anywhere in `frontend/src` yet (grep confirmed) — `BackdropBoundary.tsx` is genuinely new; do not reinvent an existing one.

### Runtime

- **Node 22** via `nvm use` (`.nvmrc` = 22). The default shell Node may be 26 — activate nvm in EVERY build/test command (`source ~/.nvm/nvm.sh && nvm use`) and verify `node --version` is 22.x. Project-local `frontend/node_modules` (already installed incl. `three`). No global installs. No backend/Postgres for this story. [Source: .nvmrc; CLAUDE.md runtime policy]

### Project Structure Notes

- Aligns with AD-8 source tree (`backdrop/{Backdrop.tsx,scene.ts}` + new siblings). The only structural change outside `backdrop/` is wrapping `<Backdrop />` in `<BackdropBoundary>` in `App.tsx` — a mount-point change, no Todo-data coupling. No conflict with the unified structure; the new `degradation.ts` keeps `three`-dependent code isolated to `scene.ts` while making the decision logic testable.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.2] — ACs + test scenarios (AUTHORITATIVE)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md#AD-8] — isolation + ordered degradation ladder + never-degrade-core
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/EXPERIENCE.md#Backdrop] — reduced-motion + no-WebGL fallbacks, perf guardrails, readability contract
- [Source: _bmad-output/implementation-artifacts/4-1-isolated-three-js-cube-star-backdrop.md] — prior story: files, deferrals now in-scope, bundle numbers, jsdom posture
- [Source: frontend/src/backdrop/scene.ts, Backdrop.tsx, Backdrop.test.tsx; src/App.tsx, App.test.tsx; src/test-setup.ts; vitest.config.ts; package.json] — current state (commit 83e0355)

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

- Initial implementation agent died mid-run (API error) after wiring the boundary but
  BEFORE writing the `BackdropBoundary` test and running code-review. A finishing agent
  (same model) completed the missing test, ran the adversarial code-review lenses in-session,
  and verified green. No implementation rework was needed — the prior tree was sound as-found.
- Runtime: Node v22.23.1 via `nvm use` (`.nvmrc` = 22). System default Node is newer; nvm
  activated in every test/lint/build command.

### Completion Notes List

- **AC1 (reduced-motion static + runtime toggle):** `Backdrop.tsx` reads `prefers-reduced-motion`
  at mount (static frame, no loop) and subscribes to the media-query `change` event
  (addEventListener with addListener fallback for old Safari; no-op if neither) to flip between
  loop and static frame at runtime. Covered by `Backdrop.test.tsx`.
- **AC2 (no-WebGL):** 4.1 try/catch around `createCubeStarField` preserved — context failure
  leaves the CSS void gradient; no user-facing error.
- **AC3 (context-loss/restore):** `scene.ts` adds `webglcontextlost` (preventDefault + clean stop)
  and `webglcontextrestored` (resize + resume-or-static) listeners, removed in `dispose()`.
  jsdom has no WebGL so this is asserted by construction; live-GPU proof defers to Epic 6 (6.3).
- **AC4 (visibility pause):** `visibilitychange` → hidden stops the loop, visible resumes; skipped
  in static mode. Listener removed on unmount. Covered by `Backdrop.test.tsx`.
- **AC5 (watchdog ladder):** pure `degradation.ts` decider (`nextDegradationStep`) — sustained
  over-budget window steps DPR → count → static in fixed order with hysteresis and floors.
  Fully unit-tested (`degradation.test.ts`, 100% stmt/branch coverage). Applied in `scene.ts`.
- **AC6 (error boundary):** `BackdropBoundary.tsx` class boundary renders `null` on child throw;
  wired around `<Backdrop/>` in `App.tsx` as a sibling of `<main>`. New `BackdropBoundary.test.tsx`
  proves the throw is caught, the fallback is empty/non-interactive, and a sibling core-loop stand-in survives.
- **AC7 (a11y posture):** boundary fallback adds no visible/interactive/AT-exposed node; backdrop
  stays `aria-hidden`, non-interactive. Automated axe-with-backdrop defers to Epic 6 (6.1).
- **AC8 (isolation/no-regression):** full suite green (114 tests); build confirms `three` stays in
  its own lazy chunk `scene-*.js` (520.88 kB / 130.81 kB gz) and the entry `index-*.js`
  (238.10 kB / 74.25 kB gz) contains ZERO three markers (grep-verified). Coverage narrowed to
  exclude only `scene.ts`; `degradation.ts` / `Backdrop.tsx` / `BackdropBoundary.tsx` now covered.

Verification (Node 22.23.1): `npm run test` → 15 files / 114 tests passed; `npm run lint`
(eslint + tsc --noEmit) clean; `npm run build` OK; `npm run coverage` → All files 94.46% stmts /
82.8% branch (report-only), `degradation.ts` 100%/100%, `scene.ts` excluded.

### Review Findings

_Adversarial code-review run in-session (Blind Hunter, Edge Case Hunter, Acceptance Auditor lenses)
against the diff vs baseline `83e0355`. No `decision-needed` and no `patch` findings — the
implementation is sound. Two low-severity items defer to Epic 6; two dismissed as by-design._

- [x] [Review][Defer] Watchdog frame budget is hardcoded to a ~60fps target (16.67ms × 1.5 = ~25ms miss threshold) [degradation.ts:43-51, scene.ts:230-244] — on a genuinely low-refresh (30Hz) or power-saver display the inter-frame interval (~33ms) exceeds the threshold and the field degrades toward static even when the backdrop itself is not the bottleneck. Direction is safe (never-degrade-core holds; errs toward less flourish), but real-device / non-60Hz calibration is explicitly deferred to Epic 6 Story 6.3 (performance pass).
- [x] [Review][Defer] AC3 context-loss/restore recovery and AC5 real ~60fps step-down cannot be exercised under jsdom (no WebGL / no real rAF timing) — asserted via the pure decider + mocked scene handle; live-GPU proof defers to Epic 6 (6.3 perf, 6.1 axe-with-backdrop). Expected per the story's jsdom testing posture.
- Dismissed (by-design, non-blocking): (1) After the watchdog freezes to static, a tab hide→show calls `field.start()` and resumes the loop at the lowest tier (the ladder holds — it cannot re-fall-back), rather than staying frozen — acceptable because it runs at the lowest quality and never-degrade-core still holds; the optional `onFallback` hook exists for a host that wants sticky-static. (2) `onFallback` is defined in `scene.ts` but not wired by the host — intentional optional telemetry/future hook; the CSS void gradient is always the base layer so there is no functional gap.

### File List

- `frontend/src/backdrop/degradation.ts` (NEW) — pure, three-free degradation-ladder decider + floors.
- `frontend/src/backdrop/degradation.test.ts` (NEW) — unit tests for the ladder decision logic (AC5).
- `frontend/src/backdrop/BackdropBoundary.tsx` (NEW) — React class error boundary → gradient fallback (AC6).
- `frontend/src/backdrop/BackdropBoundary.test.tsx` (NEW) — throwing-child caught, sibling survives, no AT node (AC6/AC7).
- `frontend/src/backdrop/scene.ts` (MODIFIED) — watchdog step-down (DPR/count/static) + context-loss/restore listeners.
- `frontend/src/backdrop/Backdrop.tsx` (MODIFIED) — visibility pause + runtime reduced-motion toggle + listener cleanup.
- `frontend/src/backdrop/Backdrop.test.tsx` (MODIFIED) — visibility + runtime-reduced-motion + cleanup cases.
- `frontend/src/App.tsx` (MODIFIED) — wrap `<Backdrop/>` in `<BackdropBoundary>`.
- `frontend/vitest.config.ts` (MODIFIED) — narrow backdrop coverage exclusion to `scene.ts` only.

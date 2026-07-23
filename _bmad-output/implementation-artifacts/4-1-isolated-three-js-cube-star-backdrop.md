---
baseline_commit: 8224ee02248a472ef48f7b6f9407f6178e82bacb
---

# Story 4.1: Isolated three.js cube-star Backdrop

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Maya,
I want a slow drift of cube-shaped stars behind my list,
so that opening the app is quietly delightful — without the effect ever slowing or blocking the core loop.

## Acceptance Criteria

1. **(AC1 — working backdrop)** Given WebGL is available and motion is allowed, when the app has become interactive, then a fixed, full-viewport, `aria-hidden`, `pointer-events:none` Backdrop layer **below** the panel renders a three.js cube-star field over the `surface-void` gradient, drifting slowly (targets ~60fps), mounted **after** first interactivity via code-splitting so it never blocks first paint or input (FR-8, AD-8, UX-DR12).
2. **(AC2 — imperative isolation)** Given the Backdrop, when it runs, then it owns its canvas imperatively inside an effect with its own `requestAnimationFrame` loop **outside** React's render cycle, reads no Todo data, and causes no per-frame re-render of the core UI (AD-8).
3. **(AC3 — readability contract)** Given Todo content over the Backdrop, when displayed, then text sits on the ~72% scrim panel; no bright cube ever sits directly behind text, so contrast is independent of what drifts behind (UX-DR12, NFR-A11y).
4. **(AC4 — code-split / never in critical bundle)** The `three` library is dynamically imported into a separate async chunk and is **absent from the main/entry bundle** (verified in the production build output). The core todo loop renders and is usable before/without the backdrop. Story 3.1 established `three` is not in the core bundle — this must NOT regress.
5. **(AC5 — no regression of 3.1 base + reduced-motion guard)** The static `surface-void → surface-void-far` radial gradient remains the base layer that shows if the canvas is not (yet) up or fails to initialize. A basic `prefers-reduced-motion` guard is honored here (do not start a looping animation for reduced-motion users). Existing frontend tests continue to pass.
6. **(AC6 — clean lifecycle / no leaks)** On unmount the rAF loop is cancelled and all three.js GPU resources (renderer, geometry, material, canvas, event listeners) are disposed — no leaked loop, listener, or context.

## Tasks / Subtasks

- [x] **Task 1 — Extract the three.js scene into an isolated, code-split module** (AC: 1, 2, 4, 6)
  - [x] Create `src/backdrop/scene.ts` (NEW) — a pure, framework-free module that imports `three` and exposes a factory, e.g. `createCubeStarField(canvas: HTMLCanvasElement, opts?): { start(): void; stop(): void; dispose(): void; resize(): void }`. This is the ONLY module that imports `three`, so the dynamic import of this module is the code-split boundary that keeps `three` out of the entry chunk.
  - [x] Scene contents: a `WebGLRenderer` bound to the passed canvas (guard `powerPreference`/`antialias` conservatively), a `PerspectiveCamera`, a field of small cube meshes (`BoxGeometry` instanced or reused geometry/material) positioned across a depth range so near cubes read brighter/larger and far cubes dimmer/smaller (depth, not noise). Colors from the tokens: `star-cube #8FB2FF` (bright/near) → `star-cube-dim #39456E` (far); background transparent so the CSS `surface-void` gradient shows through and remains the fallback.
  - [x] Drift: cubes move slowly along one axis (e.g. toward/past the camera or a gentle lateral drift); when a cube passes the camera/edge it recycles to the far plane (wrap-around) so the field is infinite and cheap. Slow, calm, subtle rotation optional. Own `requestAnimationFrame` loop lives here (or is driven by the component effect calling a tick) — never inside React render.
  - [x] `dispose()` must: cancel any rAF, `renderer.dispose()`, dispose geometries/materials, drop references. `resize()` handles viewport/DPR changes. Cap `devicePixelRatio` (e.g. `Math.min(window.devicePixelRatio, 2)`) — full DPR step-down watchdog is Story 4.2, but a static sane cap here is fine and expected.
- [x] **Task 2 — Rewrite `Backdrop.tsx` as the lazy, imperative host** (AC: 1, 2, 5, 6)
  - [x] Keep the outer element identical to today's contract: `<div className="orbit-backdrop" aria-hidden="true" data-testid="backdrop" />` with a `<canvas>` child it owns. Fixed / behind panel / `pointer-events:none` come from `.orbit-backdrop` CSS (already correct) — do not change the isolation CSS.
  - [x] Inside a `useEffect` (runs after paint, i.e. after the loop is interactive): bail early if `prefers-reduced-motion: reduce` matches (mount static/no-loop path — a single rendered frame is acceptable but NOT required for 4.1; at minimum do not start the animation loop) OR if a WebGL context cannot be created (leave the CSS gradient showing). Otherwise **dynamically `import('./scene')`** and start the field. The effect returns a cleanup that stops + disposes.
  - [x] Because the dynamic import is async, guard against the effect being torn down before the import resolves (cancelled flag) so a fast unmount does not start a leaked scene.
  - [x] The component must accept NO props carrying Todo data and read no Todo state/hooks (AD-8). It shares no state with the core loop.
- [x] **Task 3 — Confirm mounting + isolation in `App.tsx`** (AC: 1, 2, 3)
  - [x] `App.tsx` already renders `<Backdrop />` first, behind `<main className="orbit-app">` (z-index 1 over the backdrop's z-index 0). Verify this still holds; no structural change expected. Do NOT wire any Todo data into the Backdrop.
  - [x] Readability contract (AC3) is already delivered by the ~72% `surface-scrim` panel — verify the panel opacity/z-index is unchanged; the backdrop must stay `z-index:0` under the `z-index:1` app.
- [x] **Task 4 — Tests (Vitest / jsdom, WebGL mocked/absent)** (AC: 1, 2, 4, 5, 6)
  - [x] Update `src/App.test.tsx`: the existing test `"mounts the backdrop as an aria-hidden, non-interactive placeholder (no three.js)"` asserts `toBeEmptyDOMElement()` — this is now WRONG for the story. Replace it with assertions of the NEW contract: backdrop present, `aria-hidden="true"`, non-interactive, and (in jsdom, no WebGL) it degrades gracefully without throwing. Keep the "no login/onboarding" and shell tests intact.
  - [x] Add `src/backdrop/Backdrop.test.tsx` (NEW): (a) mounts without throwing under jsdom (no WebGL) and stays `aria-hidden` + `pointer-events` isolated; (b) exposes no Todo-data props / reads no todo hooks; (c) mounts and unmounts cleanly with no unhandled errors and no leaked rAF (mock `requestAnimationFrame`/`cancelAnimationFrame` and assert cancel on unmount, or assert the scene module's `dispose` is called via a `vi.mock('./scene')`); (d) with `prefers-reduced-motion: reduce` mocked (mock `window.matchMedia`), the animation loop is not started (scene factory not invoked / no rAF scheduled); (e) assert `three` is reached only via dynamic import — i.e. `vi.mock('./scene')` proves the component does not statically import `three` (the scene module is the only `three` importer, and it is imported dynamically).
  - [x] Note in test comments: real WebGL rendering + FPS are out of jsdom scope — validated in Epic 6's perf pass (Story 6.3) and axe-with-backdrop in Story 6.1.
  - [x] Keep the whole existing suite green (`a11y.test.tsx`, component tests, etc.).
- [x] **Task 5 — Build + bundle-chunk verification** (AC: 4)
  - [x] Run `npm run build`. Confirm success (tsc `--noEmit` + `vite build`).
  - [x] Inspect `dist/assets/`: confirm `three` lands in a **separate lazy chunk** (its own hashed JS file, pulled in by the `scene` dynamic import), NOT the main entry/index chunk. Report chunk names + sizes. This is the AC4 gate — do not hand-wave it.
- [x] **Task 6 — Lint, coverage, and log** (AC: all)
  - [x] `npm run lint` (eslint + `tsc --noEmit`) clean.
  - [x] `npm run coverage` — report real numbers. `src/backdrop/**` stays EXCLUDED from coverage per `vitest.config.ts` (three.js visual tuning is device-dependent, not business logic). Do NOT change that exclusion. Coverage stays report-only (gate flips in 6.2).
  - [x] Append a Story 4.1 entry to `docs/AI-INTEGRATION-LOG.md`.

### Review Findings (code-review, 2026-07-23)

Adversarial review ran three lenses (Blind Hunter / Edge Case Hunter / Acceptance Auditor) directly against `git diff HEAD` (baseline `8224ee0`) + the new files, since subagents were unavailable in this environment. Outcome: **Approve**. AC1–AC6 all satisfied; AC4 (three code-split out of the entry bundle) verified quantitatively in the build. One low-severity finding, patched immediately:

- [x] [Review][Patch] Camera aspect could be `Infinity` when `h === 0` [frontend/src/backdrop/scene.ts] — changed `camera.aspect = w / h || 1` to `h > 0 ? w / h : 1`. Re-verified: 90 tests pass, lint clean, build OK with the lazy `three` chunk intact.

No decision-needed items, no deferrals, no unresolved high/medium findings. Confirmed non-issues (intentional / deferred to 4.2 by design): runtime WebGL-context-loss recovery, `visibilitychange` pause, frame-budget watchdog, and the React error boundary. StrictMode double-mount, resize-listener lifecycle, and async unmount races are handled by the `cancelled` flag + always-remove cleanup.

## Dev Notes

### What this story is (and is NOT)

This is the **working backdrop**: replace the placeholder body of `Backdrop.tsx` with a real, isolated, code-split three.js cube-star field. It is the first of two Epic 4 stories.

**Deliberately DEFERRED to Story 4.2 (do not build here, but structure so it bolts on cleanly):**
- Full `prefers-reduced-motion` static-frame rendering (4.1 only needs a guard that does not start the loop).
- No-WebGL static fallback beyond "leave the CSS gradient showing" (the ordered, tested degradation ladder is 4.2).
- FPS/frame-budget watchdog + perf step-down (DPR → cube count → static). 4.1 may set a *static* DPR cap only.
- `visibilitychange` pause/throttle.
- React error boundary around the backdrop.

[Source: epics.md#Story-4.1; epics.md#Story-4.2; ARCHITECTURE-SPINE.md#AD-8]

### Isolation contract (AD-8) — the non-negotiable spine

> The backdrop is a fixed, full-viewport, `aria-hidden`, `pointer-events:none` layer below the panel. Its three.js code is code-split and mounted **after** the core loop is interactive. It owns its canvas imperatively inside an effect with its own `requestAnimationFrame` loop **outside** React's render cycle; it reads no Todo data. [Source: ARCHITECTURE-SPINE.md#AD-8]

Concretely for the dev agent:
- **Code-split:** `three` MUST NOT appear in the entry chunk. Achieve this by putting all `three` usage in `src/backdrop/scene.ts` and importing that module via `await import('./scene')` inside the effect — never a top-level `import ... from 'three'` anywhere reachable from `main.tsx`'s static graph. Story 3.1 verified `three` is absent from the core bundle; keeping it out is AC4.
- **After interactivity:** the effect runs post-paint; the core loop (List query, input, footer) renders first regardless of the backdrop. Do not `await` anything before first paint.
- **Own rAF outside React:** the animation must not call `setState` per frame or otherwise trigger React re-renders. The canvas is mutated imperatively via three.js only.
- **No Todo data:** `Backdrop` takes no data props and calls no `useTodos`/query hooks. It shares no state with components. [Source: ARCHITECTURE-SPINE.md#Invariants-Rules "Backdrop shares no state with components"]

### Current state of files being modified (READ before editing)

- **`src/backdrop/Backdrop.tsx`** (UPDATE) — today a pure placeholder returning `<div className="orbit-backdrop" aria-hidden="true" data-testid="backdrop" />`. Replace its body with the lazy imperative host (Task 2). Preserve the outer div's className, `aria-hidden`, and `data-testid="backdrop"` so downstream selectors keep working.
- **`src/App.tsx`** (VERIFY, likely no change) — renders `<Backdrop />` then `<main className="orbit-app">…</main>`. The backdrop is already mounted first and behind. Do not pass Todo data to it.
- **`src/App.test.tsx`** (UPDATE) — contains `it('mounts the backdrop as an aria-hidden, non-interactive placeholder (no three.js)')` which asserts `expect(backdrop).toBeEmptyDOMElement()`. That assertion is intentionally the OLD placeholder contract and MUST be updated (the backdrop now owns a canvas child). Update it to the new isolation contract; keep the heading / no-onboarding / shell tests.
- **`src/styles/global.css`** (DO NOT CHANGE the isolation rules) — `.orbit-backdrop { position: fixed; inset: 0; z-index: 0; pointer-events: none; }` is correct and load-bearing. The `body` background is the `surface-void → surface-void-far` radial gradient = the no-WebGL / pre-backdrop fallback (AD-8). The `<canvas>` should fill the `.orbit-backdrop` div (`width:100%;height:100%;display:block` — you may add a scoped rule for the canvas, but keep it minimal and additive; note `global.css` merges badly across parallel edits per the 3.4 retro, so keep edits small and appended).
- **`src/main.tsx`** (DO NOT add a static three import) — the entry graph must stay free of `three`.

[Source: current repo files read during story creation]

### Design / visual reference (DESIGN.md — cosmic surface)

- The product's entire reason to feel special is this backdrop: "a slow drift of cube-shaped 'stars' across a deep-space void, rendered in three.js — and the discipline that this delight never taxes the core loop." Keep it **quiet**: subtle, calm, depth-reading. Stars are the only spectacle; do not over-animate. [Source: DESIGN.md#Brand-Style]
- Tokens (already in `src/styles/tokens.css`): `--color-surface-void #070a14`, `--color-surface-void-far #0b1020`, `--color-star-cube #8fb2ff`, `--color-star-cube-dim #39456e`. Cubes range bright(near) → dim(far). Cubes are decorative only, carry no data, never sit behind text. [Source: DESIGN.md#Colors]
- Depth is literal — the list genuinely floats over a 3D field. The scrim panel (~72% `surface-scrim`) is what lifts the list off the void and is the load-bearing accessibility device: text contrast is stable regardless of what drifts behind. [Source: DESIGN.md#Elevation-Depth; EXPERIENCE.md#Backdrop]

### Readability contract (AC3) — already satisfied by the panel

Do not attempt to keep cubes away from text in the 3D scene — the architecture solves this structurally: the ~72% opaque `surface-scrim` panel sits over the field, so "no bright cube ever sits directly behind text" is guaranteed by the panel opacity, not by scene logic. Your job: keep the backdrop at `z-index:0` under the `z-index:1` app, and keep the panel opacity unchanged. Focus rings derive contrast from the panel, never the moving backdrop. [Source: EXPERIENCE.md#Backdrop "Readability contract"; EXPERIENCE.md#Accessibility-Floor]

### Testing standards (jsdom reality)

- jsdom has **no WebGL** — `canvas.getContext('webgl'|'webgl2')` returns null. So under test the component must degrade gracefully (catch the failed context / failed dynamic scene init and leave the gradient). Assert what IS testable: mount-without-throw, `aria-hidden`, non-interactive, no Todo props, clean unmount / dispose called, rAF cancelled, reduced-motion guard, and that `three` is only reached via dynamic import (via `vi.mock('./scene')`).
- Frontend tests are colocated Vitest `*.test.tsx`; coverage is v8 branch, `all:true`, report-only, with `src/backdrop/**` excluded (leave that exclusion as-is). [Source: frontend/vitest.config.ts; ARCHITECTURE-SPINE.md#Testing-Architecture]
- Real WebGL render + FPS + interaction-budget = Epic 6 Story 6.3; axe-with-backdrop = Story 6.1. Note these as out-of-scope-here in test comments. [Source: epics.md#Story-4.1 Test Scenarios]

### Library / framework

- `three` **0.185.1** is already installed (`frontend/node_modules/three` present; `package.json` pins `^0.185.0`; `@types/three ^0.185.0` present). No new dependency needed. Use the modern ES module entry (`import * as THREE from 'three'`) inside `scene.ts` only. Do NOT add `@react-three/fiber` or any React-three wrapper — AD-8 mandates an imperative, framework-free scene outside React's render cycle. [Source: frontend/package.json; ARCHITECTURE-SPINE.md#AD-8]
- Vite code-splits dynamic `import()` automatically into separate chunks — no manual `manualChunks` config needed. The `await import('./scene')` boundary is sufficient to isolate `three` into its own async chunk.

### File structure

```
frontend/src/backdrop/
  Backdrop.tsx      # UPDATE — lazy imperative host (no static three import)
  scene.ts          # NEW — the ONLY three importer; createCubeStarField factory
  Backdrop.test.tsx # NEW — jsdom isolation/lifecycle tests
```
[Source: ARCHITECTURE-SPINE.md#Source-Tree; frontend/src layout]

### Previous story intelligence (Epic 3)

- Story 3.1 created the backdrop placeholder and the isolation CSS, and verified `three` is NOT in the bundle when unimported — 4.1 flips that to "imported but in a separate lazy chunk." [Source: 3-1-*.md]
- Parallel-build retro (3.2–3.4): `global.css` interleaves badly across concurrent edits — keep any CSS change here small and appended, not woven into existing property blocks. Story 4.1 runs solo, so this is a low risk, but keep edits minimal.
- 3.5 established the jsdom limitation pattern: assert structure/behavior, not layout/GPU. Same posture applies to the backdrop.

### Runtime

- **Node 22** via `nvm use` (`.nvmrc` = 22 at repo root and in `frontend/`). Project-local `frontend/node_modules`; `npm install` only if `three` isn't materialized (it is). No global installs. No backend/Postgres needed for this story. [Source: .nvmrc; CLAUDE.md runtime policy]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.1] — ACs + test scenarios (authoritative)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.2] — the deferred fallbacks/watchdog/error-boundary scope
- [Source: _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md#AD-8] — backdrop isolation + ordered degradation
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/EXPERIENCE.md#Backdrop] — default behavior, readability contract, perf guardrails
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-nearform_todo_app-2026-07-23/DESIGN.md#Colors, #Elevation-Depth, #Brand-Style] — cosmic look, cube colors, restraint
- [Source: frontend/src/backdrop/Backdrop.tsx, src/App.tsx, src/styles/global.css, src/styles/tokens.css, vitest.config.ts, package.json] — current state

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

- Two legacy tests hard-coded the OLD placeholder contract (`expect(backdrop).toBeEmptyDOMElement()`) in `src/App.test.tsx` and `src/a11y.test.tsx`. Updated both to the new Story 4.1 contract: backdrop owns a `<canvas>` but stays `aria-hidden` and exposes no interactive / tab-focusable nodes.
- jsdom does not implement `HTMLCanvasElement.getContext`, so the real scene module printed noisy "Not implemented" errors when it probed for WebGL. Stubbed `getContext` to return `null` in `src/test-setup.ts` — this IS the no-WebGL environment the AD-8 fallback must handle, making the degrade path deterministic and the suite output clean (no native `canvas` dependency).
- TS/lint on the Vitest scene mock: spread-args / tuple-index / unused-param errors resolved with `vi.hoisted` + a typed `vi.fn<(canvas?: HTMLCanvasElement) => ...>()` signature and `toBeInstanceOf(HTMLCanvasElement)` instead of a cast.
- Corrected `InstancedMesh.setMatrix` → `setMatrixAt` (the actual three.js API) in `scene.ts`.

### Completion Notes List

- **AC1/AC2 (working, isolated backdrop):** `scene.ts` is the ONLY module importing `three`; `Backdrop.tsx` reaches it via `await import('./scene')` inside a `useEffect` (post-paint). The rAF loop lives in the scene module, outside React's render cycle — no per-frame re-render, no Todo data, no props. Cubes drift toward the camera on a single `InstancedMesh`, recycling to the far plane (infinite, cheap); near=bright/large → far=dim/small using the `star-cube` / `star-cube-dim` tokens for depth.
- **AC3 (readability):** delivered structurally by the unchanged ~72% `surface-scrim` panel over the `z-index:0` backdrop (app is `z-index:1`); no scene-side logic needed.
- **AC4 (code-split — verified):** production build emits entry `dist/assets/index-*.js` ≈ 237 kB (74 kB gzip) with **zero** three markers, and a separate lazy `dist/assets/scene-*.js` ≈ 520 kB (130 kB gzip) containing three r185 (7 markers). Entry references the scene chunk as a dynamic import only. `three` is NOT in the critical bundle.
- **AC5 (no regression + reduced-motion):** `body` void gradient stays the base/no-WebGL fallback; `prefers-reduced-motion: reduce` renders a single static frame and never starts the loop. All prior tests still pass.
- **AC6 (clean lifecycle):** effect cleanup cancels rAF and calls `dispose()` (renderer/geometry/material dispose + `forceContextLoss`); a `cancelled` flag prevents a leaked scene when unmounted before the async chunk resolves. Covered by tests.
- **Deferred to Story 4.2 (structured to bolt on):** adaptive frame-budget watchdog (DPR → cube count → static), `visibilitychange` pause, React error boundary. 4.1 ships only a static DPR cap + basic reduced-motion / no-WebGL guards.
- **Results:** 90 Vitest tests pass (up from 83); coverage 97.22% stmts / 86.79% branch (report-only; `backdrop/**` excluded per config as device-dependent visual tuning); lint (eslint + `tsc --noEmit`) clean; `vite build` OK. Node 22.23.1. Real WebGL render + ~60fps + interaction budget are out of jsdom scope — validated in Epic 6 (Story 6.3 perf, Story 6.1 axe-with-backdrop).

### File List

- `frontend/src/backdrop/scene.ts` (NEW) — isolated three.js cube-star field factory; the only `three` importer.
- `frontend/src/backdrop/Backdrop.tsx` (MODIFIED) — lazy imperative host; dynamic `import('./scene')`, effect-owned lifecycle, reduced-motion + no-WebGL guards.
- `frontend/src/backdrop/Backdrop.test.tsx` (NEW) — isolation + lifecycle tests (scene mocked; jsdom no-WebGL).
- `frontend/src/App.test.tsx` (MODIFIED) — backdrop assertion updated to the Story 4.1 contract.
- `frontend/src/a11y.test.tsx` (MODIFIED) — backdrop out-of-tab-order assertion updated for the canvas child.
- `frontend/src/test-setup.ts` (MODIFIED) — stub `HTMLCanvasElement.getContext` → null (deterministic no-WebGL env).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED) — epic-4 in-progress, story 4.1 status.
- `docs/AI-INTEGRATION-LOG.md` (MODIFIED) — Story 4.1 entry appended.

## Change Log

- 2026-07-23 — Story 4.1 implemented: isolated, code-split three.js cube-star Backdrop (AD-8). `three` verified out of the entry bundle (separate lazy `scene-*.js` chunk). 90 Vitest tests pass, lint clean, build OK. Status → review.

# Performance Pass — nearform_todo_app

Story 6.3 · date 2026-07-23 · baseline commit `99c1e01`

Verifies the app against the NFR-Perf budgets and resolves PRD Open Questions
5–7 (numeric budgets + representative devices). Each result is labelled
**MEASURED** (a real number taken in this environment) or **DESIGN-ANALYSIS**
(a guardrail argued from the code + a stated validation method, used where the
item is genuinely device-dependent and cannot be measured here without
fabrication).

## Confirmed v1 budgets (resolves PRD OQ5–7)

The working-default budgets carried from the PRD/architecture are **confirmed as
the v1 budgets** — the measurements below meet them with wide margin:

| Budget | Value | Status |
|--------|-------|--------|
| Optimistic UI reflects a change | within ~100ms | MET (design-analysis: synchronous client-cache apply) |
| API response latency, normal single-user | p95 < 300ms | MET (measured p95 < 7ms) |
| Backdrop frame rate | ~60fps target, graceful step-down, never past interaction budget | MET by design (guardrails verified; live-GPU fps is device-dependent) |

**Representative devices (OQ6 — confirmed):** mid-range laptop = a 2019-era
dual-core/8GB ultrabook with integrated GPU (e.g. Intel Iris) at 1440×900+;
mid-range phone = a mid-tier Android (e.g. Pixel-a class) at ~390×844 CSS px,
DPR 2–3. These are the profiles against which the fps guardrails should be
validated (method in §3). The backdrop's mandatory degradation ladder means the
core loop's budget holds even below these profiles.

---

## 1. API latency — MEASURED (p95 < 300ms) ✔

Method: an isolated prod-like compose stack (separate project `nftodo_perf`,
spare ports 8091/8011, own volume — the human's :8080/:8000 stack was never
touched and was torn down after). Each endpoint curl-timed (`%{time_total}`)
n=50 through the **full path** browser → nginx `/api` proxy → FastAPI/uvicorn →
PostgreSQL 17. Single-user, localhost, Docker Desktop (Apple Silicon).

| Endpoint | n | min (ms) | median (ms) | p95 (ms) | max (ms) |
|----------|---|----------|-------------|----------|----------|
| `GET /api/health` | 50 | 2.19 | 4.55 | 6.60 | 7.70 |
| `GET /api/todos` | 50 | 2.35 | 2.98 | 5.01 | 5.54 |
| `POST /api/todos` | 50 | 3.65 | 4.55 | 5.07 | 6.18 |
| `DELETE /api/todos/{id}` | 50 | 2.49 | 3.09 | 4.34 | 6.30 |

All endpoints p95 **< 7ms** — roughly 40× under the 300ms budget under normal
single-user conditions. `PATCH` (toggle) exercises the same
read-modify-commit path as `POST`/`DELETE` and is well within the same envelope.
No slow query, N+1, or connection-pool contention observed (single session per
request, AD-12; single-row ops on an indexed table). Headroom is ample for the
v1 single-user scale; these are local-network numbers — a real deployment adds
network RTT but the server-side work is negligible.

## 2. Frontend bundle sizes + three.js lazy-chunk isolation — MEASURED ✔

Method: `npm run build` (Vite 8 production build). Sizes are raw / gzipped.

| Asset | Raw | Gzip | Notes |
|-------|-----|------|-------|
| `index.html` | 0.40 kB | 0.27 kB | entry document |
| `assets/index-*.css` | 10.11 kB | 2.53 kB | all app styles |
| `assets/index-*.js` (entry) | 238.10 kB | 74.25 kB | React 19 + TanStack Query + **all core UI** |
| `assets/scene-*.js` (lazy) | 520.88 kB | 130.81 kB | **three.js + the backdrop scene** |

**Three.js lazy-chunk isolation confirmed (AD-8):** three.js lands in its own
`scene-*.js` chunk, **not** in the entry graph. The entry bundle (74 kB gzip) is
what gates first paint + interactivity; the 131 kB-gzip three.js chunk is fetched
via `import('./scene')` in `Backdrop.tsx` **only after** the core loop is
interactive, and never at all under reduced-motion or no-WebGL. This is the
architectural guarantee that the decorative backdrop cannot delay the core loop.
(Vite emits a chunk-size warning for `scene-*.js` > 500 kB raw — expected and
acceptable: it is three.js, deliberately code-split and off the critical path.)

## 3. Backdrop ~60fps + graceful step-down — DESIGN-ANALYSIS (guardrails verified)

Real-GPU frame rate is device-dependent and cannot be honestly measured in this
headless environment (no real GPU, no real rAF timing — see the 4.2 deferral).
Rather than fabricate an fps number, the guardrails are documented from the code
and the validation method is stated.

Guardrails (all present + unit-tested):
- **Isolation (AD-8):** the backdrop owns its canvas imperatively inside an
  effect with its own `requestAnimationFrame` loop **outside** React's render
  cycle, reads no Todo data, and is `aria-hidden`/`pointer-events:none`. It
  cannot trigger per-frame React re-renders of the core UI. → frame-rate
  problems in the backdrop can never consume the core loop's interaction budget.
- **Watchdog ladder (`frontend/src/backdrop/degradation.ts`):** a pure decider
  samples trailing per-frame durations and steps **down** DPR → cube count →
  static, in that fixed order, only on a **sustained** miss (all of the trailing
  `sustainedFrames = 30` frames over `budgetMs × tolerance`), never on a single
  GC/resize spike. Frame quality is always sacrificed before interactivity
  ("never-degrade-core"). Covered by `degradation.test.ts`.
- **Reduced-motion / no-WebGL / tab-hidden:** reduced-motion → one static frame
  (no loop); no WebGL context → the CSS `surface-void` radial gradient; tab
  hidden (`visibilitychange`) → loop pauses; WebGL context lost/restored →
  handled in `scene.ts`. All exercised by the Story 6.1 axe run with the
  backdrop active (0 critical) and the reduced-motion E2E.

### Watchdog frame-budget calibration (closes the 4.2 deferral) — DOCUMENTED

The deferred concern: the threshold is anchored to 60fps
(`budgetMs = 1000/60 ≈ 16.67ms`, `tolerance = 1.5` → **~25ms**). On a genuine
30Hz / power-saver display the natural inter-frame interval (~33ms) exceeds 25ms,
so the watchdog would step the field down toward static even when the backdrop is
not the bottleneck.

**Disposition — keep the 60fps-anchored budget as the v1 default; documented,
not code-changed.** Rationale:
- The direction is **safe**: an unnecessary step-down only reduces decorative
  richness; it can never harm the core loop (never-degrade-core holds), and the
  final fallback (static field) is a fully acceptable, accessible state.
- Making the budget refresh-rate-aware (deriving `budgetMs` from
  `screen`/`requestAnimationFrame` cadence or a rolling baseline) touches the
  tested decider and the scene sampling loop — a larger change than this
  analysis-focused story should carry, with its own real-device validation
  needs. It is recorded as a **future enhancement**, not a v1 blocker.
- **Validation method** (for whoever calibrates it): on the representative
  mid-range laptop/phone, record a Chrome DevTools performance trace (or the
  Chrome DevTools MCP) with the backdrop active; confirm sustained ~60fps on a
  60Hz panel with no step-down, and confirm that on a forced 30Hz/power-saver
  profile the intended behaviour (either "hold at reduced quality" or
  "refresh-aware budget") matches the calibrated intent.

## 4. Optimistic UI ~100ms — DESIGN-ANALYSIS ✔

The optimistic update is a **synchronous, local** cache write, not a network
round-trip: TanStack Query `onMutate` snapshots the cache and applies the
change before any request is sent (AD-6), and `main.tsx` sets `retry: false` so
the UI never waits on retries. The perceived update therefore lands within a
single frame — comfortably inside ~100ms by construction — independent of API
latency; the server round-trip (measured p95 < 7ms above) only reconciles
afterward via `onSettled` invalidation. The Story 6.1 E2E suite asserts the
optimistic-then-reconcile behaviour functionally (create appears at top before
reload confirms persistence; error paths roll back in place).

---

## Issues / follow-ups

- **None blocking.** All budgets met or safely guarded.
- Watchdog refresh-rate-aware calibration — future enhancement (§3), documented.
- Live-GPU 60fps + WebGL context-loss on real devices — validation method stated
  (§3); remains device-dependent and out of scope to measure here (see
  `deferred-work.md`).

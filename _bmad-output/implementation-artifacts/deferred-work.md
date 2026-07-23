# Deferred Work

Items surfaced during reviews that are real but intentionally not actioned in the
originating story. Each entry names its source and a one-line reason.

## Deferred from: code review of story-3.1 (2026-07-23)

- **Empty-state input focus (AC3 clause "with the input focused (desktop)").** The empty state renders, but the desktop autofocus it references cannot be implemented in Story 3.1 because the real add-input does not exist yet — this story ships an `aria-hidden` placeholder slot. Belongs to Story 3.2 (Add-input), which introduces the focusable field and owns its desktop-only autofocus. Focusing the placeholder would be an accessibility anti-pattern.

## Deferred from: code review of story-4.2 (2026-07-23)

- **Watchdog frame budget hardcoded to ~60fps.** The degradation threshold is `budgetMs(16.67) × tolerance(1.5) ≈ 25ms`. On a genuinely low-refresh (30Hz) or power-saver display the inter-frame interval (~33ms) exceeds the threshold and the backdrop degrades toward static even when it is not the bottleneck. Direction is safe (never-degrade-core holds), but real-device / non-60Hz calibration of the budget belongs to Epic 6 Story 6.3 (performance pass).
- **Live-GPU behaviour unverified under jsdom.** AC3 (WebGL context-loss/restore recovery) and AC5 (real ~60fps step-down on hardware) cannot be exercised in jsdom (no WebGL, no real rAF timing). They are asserted here via the pure decider + mocked scene handle; live proof (and axe-with-backdrop-active) defers to Epic 6 (Stories 6.3 perf, 6.1 accessibility gate).

## Deferred from: code review of story-5.1 (2026-07-23)

- **Backend base image pinned by tag, not digest.** `backend/Dockerfile` uses `python:3.12-slim` (matches the 3.12 pin the story required) but not a `@sha256:` digest. Digest pinning for reproducible/supply-chain-hardened builds belongs to the Epic 6 Story 6.3 security pass; not actioned in 5.1.

## Deferred from: code review of story-5.2 (2026-07-23)

- **nginx resolves the `backend` upstream once at config-load (static DNS).** `frontend/nginx.conf` uses `proxy_pass http://backend:8000;` (literal hostname), so nginx caches the resolved IP for the worker lifetime. Correct on a normal `docker compose up` (frontend waits for backend healthy via `depends_on`; `restart: unless-stopped` preserves the IP). A stale IP → 502 only if the backend is recreated with a new IP while the frontend is not restarted. Hardened fix (`resolver 127.0.0.11 valid=10s;` + variable upstream for per-request re-resolution) belongs to the Epic 6 / 5.3 ops pass; not warranted for 5.2's verified single-`docker compose up` scope.
- **Frontend base images pinned by tag, not digest.** `frontend/Dockerfile` uses `node:22-slim` and `nginx:stable-alpine` (tag pins satisfy the story requirement) but not `@sha256:` digests. Digest pinning for supply-chain-hardened builds belongs to the Epic 6 Story 6.3 security pass — same disposition as the 5.1 backend finding.

## Deferred from: code review of story-5.3 (2026-07-23)

- **Playwright run under the compose `test` profile.** AC2's core — a compose-managed ephemeral Postgres (`db-test`, tmpfs) plus the transactional-rollback backend integration suite — is implemented and verified (44 integration tests now RUN and pass; prior state was 44 skipped for lack of a test DB). The AC's additional clause "Playwright runs against the composed app" is forward-looking and belongs to Story 6.1 (Playwright E2E suite + accessibility gate), which owns bringing up the composed stack and running the ≥5 E2E specs against it. No compose change needed now; the `test` profile already provides the DB environment CI will invoke.

## Resolved in: Story 6.3 — security review + performance/accessibility pass (2026-07-23)

The Epic 6 / Story 6.3 pass triaged the items routed here. Disposition per item
(historical entries above are left intact for the record):

- **RESOLVED — Backend base image pinned by tag, not digest (from 5.1).** `backend/Dockerfile` now pins `python:3.12-slim` (builder + runtime) by `@sha256:` digest (`57cd7c3a…710de`), tag kept as a comment. Both images rebuilt and came up healthy. See `docs/qa/security-review-6.3.md` §7.
- **RESOLVED — Frontend base images pinned by tag, not digest (from 5.2).** `frontend/Dockerfile` now pins `node:22-slim` (builder + dev, `6c74791e…f6b3`) and `nginx:stable-alpine` (runtime, `97d490c1…5b46`) by digest, tags kept as comments. Verified via rebuild. See `docs/qa/security-review-6.3.md` §7.
- **RESOLVED — nginx resolves the `backend` upstream once at config-load (static DNS) (from 5.2).** `frontend/nginx.conf` now uses `resolver 127.0.0.11 valid=10s ipv6=off;` + a variable upstream (`set $backend_upstream backend; proxy_pass http://$backend_upstream:8000;`) so nginx re-resolves per request instead of caching the IP for the worker lifetime. Path-preserving (scheme+host+port only, no URI in `proxy_pass`) — verified end-to-end on an isolated stack: `/api/health` 200 `db:ok` plus a full CRUD + clear-completed `DELETE`-with-body round-trip through the proxy.
- **DOCUMENTED (kept as design default) — Watchdog frame budget hardcoded to ~60fps (from 4.2).** The ~25ms threshold (`16.67ms × 1.5`) is kept as the v1 default: the step-down direction is safe (never-degrade-core holds; the static fallback is an acceptable, accessible state), and making the budget refresh-rate-aware touches the tested decider + scene sampling loop — a larger change than this analysis story warrants. Recorded as a future enhancement with a real-device validation method in `docs/qa/performance-pass-6.3.md` §3.
- **DOCUMENTED (device-dependent, out of scope to measure here) — Live-GPU behaviour / WebGL context-loss real-device validation (from 4.2).** Cannot be exercised in a headless environment without fabricating numbers. The guardrails (pure decider, `scene.ts` `webglcontextlost`/`webglcontextrestored` + `visibilitychange` handlers, reduced-motion/no-WebGL fallbacks) are unit-tested and the 6.1 axe run exercises the backdrop live (0 critical). Real-GPU 60fps + context-loss validation method documented in `docs/qa/performance-pass-6.3.md` §3. Remains a real-device task, not a v1 blocker.

Also newly documented as **recommendations** (not code-changed here) in
`docs/qa/security-review-6.3.md`: bump dev-only `pytest` to ≥ 9.0.3
(PYSEC-2026-1845; not in the runtime image); add a dependency-audit CI step
(`npm audit` + `pip-audit`) — intentionally deferred from Story 6.3 to avoid
colliding with Story 6.2's parallel `.github/workflows/ci.yml` edits.

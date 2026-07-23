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

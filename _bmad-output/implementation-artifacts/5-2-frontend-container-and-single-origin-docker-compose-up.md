---
baseline_commit: b95305fb42190d1f0176782ba4f6569c741d7cb7
---

# Story 5.2: Frontend container and single-origin `docker-compose up`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want the built SPA served by nginx which reverse-proxies `/api`, and the whole three-service stack to come up with one command,
so that the browser sees a single origin (no CORS) and the system runs from `docker-compose up`.

## Acceptance Criteria

1. **Frontend Dockerfile is multi-stage (Node build → nginx runtime) producing the static SPA served by nginx.** `frontend/Dockerfile` builds in two stages: a builder stage on a pinned `node:22` base runs `npm ci` + `npm run build` to produce the static `dist/`, and a runtime stage on pinned `nginx:stable-alpine` serves those assets. Base images are pinned. (epics.md §654 AC-1; ARCHITECTURE-SPINE.md#Container topology "frontend: node build → nginx runtime"; NFR-Deploy)
2. **`nginx.conf` serves the SPA and reverse-proxies `/api/*` to the backend so the browser sees one origin — no CORS needed — with SPA fallback and a `GET /` healthcheck.** nginx serves the built SPA (with client-side-routing fallback: unknown non-`/api` paths return `index.html`) AND reverse-proxies `/api/*` to the `backend` service on the internal network, so the browser talks to ONE origin and no CORS headers are required in the composed stack. The proxy preserves method, body, and headers for the JSON API — including the `DELETE /api/todos/completed` call that carries a JSON request body. A Docker `healthcheck` hits nginx `GET /` returning `200`. (epics.md §658 AC-2; AD-10; NFR-Deploy)
3. **The full three-service stack comes up with one `docker-compose up`, healthy in the correct order, usable end-to-end at the frontend origin.** `docker compose up` starts three containers (`frontend`, `backend`, `db`); they become healthy in the correct order (`db` healthy → `backend` migrates + healthy → `frontend` healthy), with `frontend depends_on backend: condition: service_healthy`; the app is fully usable end-to-end at the frontend origin (host port, e.g. `8080:80`). (epics.md §662 AC-3; SM-7; NFR-Deploy)

## Test Scenarios (authoritative — from epics.md §666-668)

- **Integration/ops:** `docker compose up` → the SPA loads at the frontend port, `/api/*` calls succeed through the proxy with **no CORS headers required**; all three healthchecks report healthy.
- **E2E:** the Playwright suite (Story 6.1) runs green against this composed single-origin stack (out of scope here — this story only makes the stack exist and be exercised manually).

**Traceability:** NFR-Deploy; AD-10; SM-7.

## Tasks / Subtasks

- [x] **Task 1 — `frontend/.dockerignore`** (AC: #1)
  - [x] Exclude everything the builder does not need so the build context stays small and the host `node_modules`/`dist` never leak into the image (the builder installs deps fresh and builds fresh): `node_modules/`, `dist/`, `coverage/`, `.env`, `.env.*` (but the image build needs `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/`, and `public/` if present). Also exclude `Dockerfile`, `.dockerignore`, `.DS_Store`, `*.swp`, and test/vitest artifacts not needed for `vite build`.
- [x] **Task 2 — `frontend/Dockerfile` (multi-stage: node build → nginx runtime, non-root, healthcheck)** (AC: #1, #2)
  - [x] Builder stage `FROM node:22-slim` (or `node:22-alpine`) `AS builder` — matches `frontend/.nvmrc` = `22` and `package.json` `engines.node` `>=22 <23`. Pin the tag.
  - [x] Builder: `WORKDIR /build`; `COPY package.json package-lock.json ./`; `RUN npm ci` (reproducible install from the committed lockfile — NOT `npm install`); then `COPY . .` and `RUN npm run build`. Note `npm run build` is `tsc --noEmit && vite build`, so the builder must have the full devDependencies (typescript, vite, plugins) — `npm ci` installs them by default. Output is `/build/dist`.
  - [x] Do NOT set `VITE_API_BASE_URL` at build time — the API client (`frontend/src/api/client.ts`) already defaults `API_BASE_URL` to `'/api'` when the env var is unset, which is exactly the single-origin same-origin base (AD-10). Leaving it unset is the correct production build. (Setting it to an absolute `http://localhost:8000/api` would BREAK single-origin — do not do that.)
  - [x] Runtime stage `FROM nginx:stable-alpine` (pin the tag). Copy the built assets: `COPY --from=builder /build/dist /usr/share/nginx/html`. Copy the site config: `COPY nginx.conf /etc/nginx/conf.d/default.conf` (this REPLACES the stock `default.conf` `server{}` block; do NOT overwrite `/etc/nginx/nginx.conf` — the `conf.d/*.conf` include is what the stock main config already wires up).
  - [x] **Non-root nginx.** The stock `nginx:stable-alpine` runs the master as root and workers as `nginx`. Run the whole thing as the unprivileged `nginx` user. The clean approach: keep nginx listening on an **unprivileged port** (e.g. `listen 8080;` in `nginx.conf`, ports <1024 need root) and make the paths nginx writes to (cache/run/tmp + the pid) writable by uid `nginx`, then `USER nginx`. `chown -R nginx:nginx /var/cache/nginx /var/run` and point `pid` to a writable path (e.g. `/tmp/nginx.pid` set in `nginx.conf`, or `/var/run/nginx.pid` after chown). `EXPOSE 8080`. Document the port choice so it lines up with the compose port mapping and the HEALTHCHECK. (If you keep `listen 80`, you cannot drop to non-root because binding 80 needs root — so choose an unprivileged listen port to satisfy the non-root activity-spec requirement.)
  - [x] `HEALTHCHECK` hitting nginx `GET /` → `200`. `nginx:stable-alpine` has **no curl** but **does have `wget`** (busybox) — use `wget -q -O /dev/null http://localhost:<port>/ || exit 1`. Use sensible `--interval`, `--timeout`, `--retries`, `--start-period`.
  - [x] No custom `ENTRYPOINT`/`CMD` needed — the base image's default (`nginx -g 'daemon off;'`) is correct for a foreground container.
- [x] **Task 3 — `frontend/nginx.conf` (single-origin: SPA + `/api` reverse proxy, AD-10)** (AC: #2)
  - [x] A single `server { listen <unprivileged-port>; ... }` block (goes into `conf.d/default.conf`). If you moved the pid, put `pid /tmp/nginx.pid;` at the top-level of a full config — but since you're only replacing `conf.d/default.conf`, prefer the chown approach for the pid and keep this file to the `server{}` block. (Whichever you pick, keep it consistent with Task 2 and verify nginx starts as non-root.)
  - [x] **SPA static + fallback:** `root /usr/share/nginx/html; index index.html;` with `location / { try_files $uri $uri/ /index.html; }` so client-side routes and deep links resolve to the SPA entry. (This app is single-view, but the fallback is the standard correct SPA rule and is cheap insurance.)
  - [x] **`/api` reverse proxy:** `location /api/ { proxy_pass http://backend:8000; ... }` — `backend` is the compose service name on the internal network; port `8000` is the uvicorn port from 5.1. **Preserve the path** so `/api/health` maps to the backend's `/api/health` (the backend mounts its router at the `/api` prefix — do NOT strip `/api`). Be deliberate about the trailing-slash semantics of `proxy_pass`: `proxy_pass http://backend:8000;` (no trailing path) preserves the full original URI including `/api/`, which is what we want. Do not use `proxy_pass http://backend:8000/;` (trailing slash) — that would strip the `location` prefix and break the paths.
  - [x] **Preserve method/body/headers incl. DELETE-with-body:** set `proxy_set_header Host $host;`, `proxy_set_header X-Real-IP $remote_addr;`, `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`, `proxy_set_header X-Forwarded-Proto $scheme;`. nginx forwards the request body and method by default, so `DELETE /api/todos/completed` with its `{ "ids": [...] }` JSON body (the clear-completed call, AD-7) passes through intact — do NOT add anything that discards the body (e.g. avoid `proxy_method`/`proxy_pass_request_body off`). Use HTTP/1.1 upstream (`proxy_http_version 1.1;`) and clear a stale `Connection` header if you set keep-alive; not strictly required but conventional.
  - [x] **No CORS anywhere** — single origin means the browser never makes a cross-origin request, so nginx must NOT add `Access-Control-*` headers and the backend `CORS_ORIGINS` stays empty (AD-10). CORS is a dev-profile concern deferred to 5.3.
  - [x] Keep it minimal and readable. Optional niceties (fine but not required): gzip on, `server_tokens off;`, cache headers for hashed `/assets/*`. Do not over-engineer.
- [x] **Task 4 — Extend root `docker-compose.yml` (add `frontend` service)** (AC: #2, #3)
  - [x] ADD a `frontend` service (do NOT rewrite the file — it is the 5.1 compose with `db` + `backend`): `build: { context: ./frontend }`; `depends_on: { backend: { condition: service_healthy } }`; attach to the existing `appnet` network so it can reach `backend` by service name; `restart: unless-stopped` to mirror the other services.
  - [x] Publish the app on a host port: `ports: ["${FRONTEND_PORT:-8080}:<container-port>"]` where `<container-port>` is the nginx listen port from Task 2/3 (e.g. `8080:8080` if nginx listens on 8080). Use the same `${VAR:-default}` env-indirection convention as 5.1.
  - [x] The frontend healthcheck comes from the Dockerfile `HEALTHCHECK` (no need to duplicate in compose), same pattern as backend in 5.1.
  - [x] **Backend public port:** per the story AC the frontend is now the public entrypoint. The AC says the backend "can stay internal or keep its port for debugging". Keep the backend `ports: ["${BACKEND_PORT:-8000}:8000"]` mapping as-is (5.1 convention, useful for debugging and unchanged behavior) — the single-origin requirement is about the BROWSER talking to one origin, which the frontend port satisfies; the backend host port is a developer/debug convenience, not something the browser uses. Note this choice in Dev Notes. (Do NOT remove it — that would be an unrequested behavior change to 5.1.)
  - [x] Update the top-of-file comment block: the "Story 5.2 adds a frontend service" note in the extension seam should move from "do NOT add here yet" to reflecting that 5.2 is now implemented; keep the 5.3 profiles note as the remaining seam. Keep the base config **profile-free** so a plain `docker compose up` remains the production-like stack (5.3 adds `dev`/`test` profiles cleanly).
- [x] **Task 5 — Verify for real (Docker is available)** (AC: #1, #2, #3)
  - [x] `docker compose build` — all three build (db is an image pull; backend + frontend build). Frontend builder runs `npm ci` + `npm run build` cleanly; runtime stage is nginx.
  - [x] `docker compose up -d`; wait for all three `healthy` (`docker compose ps` shows `db`, `backend`, `frontend` healthy; confirm ordering: `db` healthy → `backend` healthy → `frontend` healthy via `depends_on`).
  - [x] Confirm **non-root nginx**: `docker compose exec frontend id` → non-zero uid (the `nginx` user, not `uid=0(root)`), and `docker compose exec frontend ps -o user,pid,args` (or `cat /proc/1/status`) shows master + workers not running as root.
  - [x] **SPA served through the frontend origin:** `curl -s http://localhost:8080/` → returns the SPA `index.html` (has `<div id="root">` and the hashed `/assets/index-*.js` script tag). `curl -sI http://localhost:8080/assets/<hashed>.js` → `200`.
  - [x] **Health PROXIED through nginx:** `curl -s http://localhost:8080/api/health` → `200 {"status":"ok","db":"ok"}` (this proves nginx → backend proxy + path preservation + the real DB round-trip). Confirm **no `Access-Control-*` headers** on `curl -sI http://localhost:8080/api/health` (single origin, AD-10).
  - [x] **Full CRUD round-trip through the proxy** (all against `http://localhost:8080/api/...`, NOT the backend port): `POST /api/todos {"description":"..."}` → `201` bare Todo; `GET /api/todos` → shows it; `PATCH /api/todos/{id} {"completed":true}` → `200` toggled; `DELETE /api/todos/{id}` → `204`; `GET /api/todos` → gone.
  - [x] **Clear-completed DELETE-with-body through the proxy:** create ≥1 todo, PATCH it completed, then `DELETE /api/todos/completed` with a JSON body `{"ids":["<id>"]}` (use `curl -X DELETE -d '{"ids":[...]}' -H 'Content-Type: application/json'`) → `200 {"deleted":N}`. This is the load-bearing verification that nginx forwards a DELETE **request body** — paste the observed output.
  - [x] **SPA fallback:** `curl -s http://localhost:8080/some/deep/route` → returns `index.html` (200), NOT a 404 (proves `try_files … /index.html`). And confirm an unknown `/api/*` path is proxied to the backend (returns the backend's 404/handling, NOT the SPA index).
  - [x] Capture `docker compose logs frontend` (nginx access/error) and `docker compose ps` output for the record.
  - [x] **Tear down:** `docker compose down -v` at the end → confirm **no leftover `nearform_todo_app` containers** (`docker ps -a | grep nearform` empty) and the `pgdata` volume dropped from the machine. The compose file + volume/network definitions stay in the repo.
- [x] **Task 6 — Regression guard** (AC: all)
  - [x] Confirm the frontend Vitest suite still passes (`cd frontend && npm run test` under Node 22) — this story adds infra files + at most a doc-only client tweak and must not break app behavior. If you make ANY change under `frontend/src` (e.g. a comment or the default base path), re-run the suite and note it.
  - [x] Confirm the backend pytest suite still passes (`backend/.venv/bin/python -m pytest -q` from `backend/`) — expected `43 passed, 44 skipped` (the skips are the pre-existing integration tests that need a test-profile Postgres, a 5.3/CI concern; NOT a regression). This story changes no backend app code.
  - [x] Note (do not run GitHub): if `.github/workflows/ci.yml` has a conditional `docker build … frontend` step keyed on `frontend/Dockerfile` existing (mirroring the backend one from 5.1), creating `frontend/Dockerfile` activates it. Verify the frontend image builds standalone with `docker build -t nearform-todo-frontend:ci frontend` (context = `frontend/`), the exact CI invocation.

### Review Findings

Adversarial code review (2026-07-23) — Blind Hunter, Edge Case Hunter, and Acceptance Auditor lenses run in-session against the diff vs baseline `b95305f` (`docker-compose.yml`, `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore`). All 3 ACs audited as met against the live composed 3-service stack. **No `decision-needed` or `patch` findings.** 2 items deferred; 5 dismissed as noise / by-design.

- [x] [Review][Defer] nginx resolves the `backend` upstream once at config-load (static DNS) [frontend/nginx.conf:23] — deferred, low severity: `proxy_pass http://backend:8000;` uses a literal hostname, so nginx caches the resolved IP for the worker lifetime. On a normal `docker compose up` the frontend starts only after the backend is healthy (`depends_on`) so the name resolves correctly (verified live), and `restart: unless-stopped` restarts the same container (IP preserved). A stale IP → 502 only occurs if the backend is *recreated* with a new IP while the frontend is not restarted (an operational edge). The hardened fix (`resolver 127.0.0.11 valid=10s;` + a variable upstream to force per-request re-resolution) is robustness hardening that fits the Epic 6 / 5.3 ops pass; not warranted for this story's verified single-`docker compose up` scope.
- [x] [Review][Defer] Frontend base images pinned by tag, not digest [frontend/Dockerfile:12,29] — deferred: `node:22-slim` and `nginx:stable-alpine` are pinned by tag (satisfying the story's pin requirement) but not by `@sha256:` digest. Digest pinning for supply-chain-hardened builds belongs to the Epic 6 Story 6.3 security pass — same disposition as the equivalent 5.1 backend finding.

Dismissed as noise / by-design (5): host port `8080:8080` instead of the AC's illustrative "e.g. `8080:80`" (in-scope by-design — nginx listens on the unprivileged 8080 so the process runs non-root, satisfying the AC2 non-root requirement; the browser still sees one origin at the host port); backend host port `8000:8000` kept (AC explicitly permits "keep its port for debugging"; browser uses only the frontend origin); high `worker_processes` count on a many-core host (stock `nginx:stable-alpine` `30-tune-worker-processes.sh` behavior, harmless); bare `/api` with no trailing slash falls to the SPA `location /` (never called — the client only ever hits `/api/<resource>`, and there is no bare-`/api` backend route); `/var/run/nginx.pid` created at build time (persists in the image layer and is rewritten by the non-root master at start — verified healthy live).

## Dev Notes

### Architecture / invariants this story implements

- **AD-10 (Single-origin delivery)** — the load-bearing constraint. In the composed stack, **nginx serves the built SPA and reverse-proxies `/api/*` to the backend**, so the browser sees one origin and **no CORS is needed**. CORS is enabled ONLY in the dev profile (5.3) via `CORS_ORIGINS`, where the Vite dev server (:5173) calls the backend (:8000). For THIS story, add NO CORS headers in nginx and leave the backend `CORS_ORIGINS` empty. [Source: ARCHITECTURE-SPINE.md#AD-10, lines 107-110]
- **Container topology** — 3 containers total (`frontend`, `backend`, `db`). This story adds the **`frontend`** container: multi-stage `node build → nginx stable-alpine runtime`. Browser hits the frontend on its host port; `frontend --/api--> backend --5432--> db`. Each service declares a Docker healthcheck: `db` via `pg_isready` (done 5.1), `backend` via `GET /api/health` (done 5.1), **`frontend` via nginx `GET /` returning 200 (this story)**. `db` healthy before `backend`; `backend` migrates before serving; **`frontend depends_on backend: service_healthy`**. [Source: ARCHITECTURE-SPINE.md#Container topology, lines 180-190]
- **Health contract** — `GET /api/health` → `200 {"status":"ok","db":"ok"}` after a real DB round-trip; `503` if DB unreachable. The route is mounted at the `/api` router prefix + `/health` = `/api/health`. nginx must proxy `/api/*` **preserving the path** so this contract holds through the proxy. [Source: ARCHITECTURE-SPINE.md#API Contract, line 146; backend/app/api/routes/health.py]
- **12-factor config** — env vars only. Frontend config is **build-time `VITE_*`** (Vite only exposes `VITE_`-prefixed vars). The single build-time knob is `VITE_API_BASE_URL`, and it must stay **unset** for the production image so the client uses its `'/api'` same-origin default (AD-10). No secrets in v1. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions, line 134; frontend/.env.example; frontend/src/api/client.ts]
- **nginx pin** — the Stack table pins nginx to `stable-alpine`. [Source: ARCHITECTURE-SPINE.md#Stack, line 176]

### Files to CREATE / MODIFY

- `frontend/Dockerfile` (NEW) — multi-stage node build → nginx runtime, non-root, `GET /` healthcheck.
- `frontend/.dockerignore` (NEW).
- `frontend/nginx.conf` (NEW) — SPA + `/api` reverse proxy, SPA fallback.
- `docker-compose.yml` (MODIFY — EXTEND, do not rewrite) — add the `frontend` service + host port; update the header comment seam.
- Possibly `frontend/.env.example` / `frontend/src/api/client.ts` (MODIFY only if needed) — the client ALREADY defaults to `'/api'`, so NO code change is expected. If you touch anything under `frontend/src`, re-run Vitest and document it.

### Existing frontend facts the dev MUST respect (read before writing)

- **The API client already single-origin-ready.** `frontend/src/api/client.ts` line 16-17: `export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api';`. With `VITE_API_BASE_URL` unset at build time, all calls go to same-origin `/api/...` — exactly what nginx proxies. `apiFetch` does `fetch(\`${API_BASE_URL}${path}\`, ...)` where `path` is e.g. `/todos`, `/health`, `/todos/completed`. So `/api/todos`, `/api/todos/completed`, etc. **This means NO frontend code change is required for single-origin.** [Source: frontend/src/api/client.ts, frontend/src/api/todos.ts]
- **The clear-completed call is a DELETE with a JSON body.** `frontend/src/api/todos.ts` `clearCompleted(ids)` → `apiFetch('/todos/completed', { method: 'DELETE', body: JSON.stringify({ ids }) })`. nginx must forward the DELETE body (it does by default; do not disable it). This is the explicit proxy-fidelity check in Task 5. [Source: frontend/src/api/todos.ts, lines 68-75]
- **Node pin:** `frontend/.nvmrc` = `22`; `package.json` `engines.node` = `>=22 <23`. Use a `node:22*` builder base. [Source: frontend/.nvmrc, frontend/package.json]
- **Build command:** `npm run build` = `tsc --noEmit && vite build` — needs devDependencies (typescript, vite, @vitejs/plugin-react), which `npm ci` installs by default. Output dir is `dist/` (default Vite `outDir`; `vite.config.ts` does not override it). [Source: frontend/package.json, frontend/vite.config.ts]
- **Lockfile present:** `frontend/package-lock.json` is committed → use `npm ci` (deterministic) not `npm install`. [Source: frontend/package-lock.json]
- **`dist/` and `node_modules/` are gitignored** and must be `.dockerignore`d so the host copies never override the fresh in-image build. [Source: .gitignore lines "dist/", "node_modules/", "frontend/dist/"]
- **Backend API surface (through the proxy):** `GET /api/health`, `GET /api/todos` (→ `{todos:[...]}`), `POST /api/todos` (→ `201` bare Todo), `PATCH /api/todos/{id}` (→ `200` bare Todo), `DELETE /api/todos/{id}` (→ `204`), `DELETE /api/todos/completed` with `{ids:[...]}` (→ `200 {deleted}`). Uvicorn listens on `:8000` inside the container (5.1). [Source: epics.md API contract line 71; backend/app/api/routes/; docker-compose.yml backend service]

### nginx / non-root gotchas (prevent wasted review cycles)

- **Binding port 80 needs root.** To run nginx non-root (activity-spec requirement), listen on an **unprivileged port** (e.g. 8080) inside the container and map the host port to it in compose. Alternatively use the `nginxinc/nginx-unprivileged` image, but the architecture pins plain `nginx:stable-alpine`, so the chown + unprivileged-listen approach is the intended path.
- **Writable paths for the `nginx` user:** the master writes a pid file and workers write to `/var/cache/nginx`. When dropping to `USER nginx`, `chown -R nginx:nginx /var/cache/nginx` and ensure the pid path is writable (chown `/var/run` or set `pid /tmp/nginx.pid;`). Missing this = nginx exits at start with a permission error.
- **`nginx:stable-alpine` has no curl** — the HEALTHCHECK must use busybox `wget` (present) not curl. `wget -q -O /dev/null http://localhost:<port>/ || exit 1`.
- **`proxy_pass` trailing-slash trap:** `proxy_pass http://backend:8000;` (no path) preserves the full request URI incl. `/api/` — correct here. Adding a trailing `/` (`http://backend:8000/`) strips the matched `location` prefix and would turn `/api/health` into `/health` upstream → 404. Preserve the path.
- **Replace `conf.d/default.conf`, not the whole `nginx.conf`.** The stock main `nginx.conf` already `include /etc/nginx/conf.d/*.conf;` inside `http{}`. Dropping your `server{}` block at `conf.d/default.conf` is the least-surprise approach and keeps sensible defaults (mime types, log format).
- **Do not bake `VITE_API_BASE_URL` as an absolute URL** — that hard-codes the backend origin into the bundle and breaks single-origin. Leave it unset (client default `'/api'`).

### Single-origin end-to-end flow (what "working" means)

```
Browser → http://localhost:8080/            → nginx serves dist/index.html (SPA)
Browser → http://localhost:8080/assets/*    → nginx serves hashed static assets
Browser → http://localhost:8080/api/todos   → nginx proxy_pass → backend:8000/api/todos → db
         (same origin :8080 → no preflight, no CORS headers needed — AD-10)
```

### Compose extension seam (what stays for 5.3 — do not build now)

- **5.3** adds `dev` and `test` **profiles**: source mounts + Vite HMR (frontend :5173) + exposed ports + `CORS_ORIGINS` on for dev; ephemeral test DB + suite runners for test. Keep the base config **profile-free** so the default `docker compose up` is the production-like single-origin stack. Structure the new `frontend` service so a `dev` profile variant (or override) can add the Vite HMR path cleanly. Do NOT add profiles in this story. [Source: ARCHITECTURE-SPINE.md#Container topology line 190; epics.md Story 5.3]

### Project Structure Notes

- Matches the architecture source tree exactly: `frontend/Dockerfile`, `frontend/nginx.conf`, root `docker-compose.yml`. [Source: ARCHITECTURE-SPINE.md#Source tree, lines 237/241]. `frontend/.dockerignore` is an unlisted-but-implied standard support file (mirrors `backend/.dockerignore` from 5.1), non-conflicting.
- `.gitignore` already ignores `dist/`, `node_modules/`, `.env`/`.env.*`; no build artifacts or secrets will be committed. [Source: .gitignore]

### Testing standards summary

- This is an **infrastructure** story; its verification is the ops procedure in Task 5 (real `docker compose build` + `up` + all-healthy + SPA served + `/api` proxied incl. DELETE-with-body + SPA fallback + non-root nginx + teardown). Capture the actual command output in the Dev Agent Record.
- The existing frontend Vitest suite and backend pytest suite must still pass unchanged — do not modify app behavior. [Source: ARCHITECTURE-SPINE.md#Testing lines 269/279]
- No new automated unit test is mandated by the ACs. A lightweight `nginx -t` config-syntax check (run inside the built image or during `up`) is a reasonable guard — do not over-engineer.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2 (lines 646-670)] — authoritative ACs + test scenarios
- [Source: _bmad-output/planning-artifacts/architecture/architecture-nearform_todo_app-2026-07-23/ARCHITECTURE-SPINE.md#AD-10 (107-110), #Container topology (180-190), #API Contract (146), #Consistency Conventions (134), #Stack (159-176), #Source tree (228-241)]
- [Source: _bmad-output/planning-artifacts/prds/prd-nearform_todo_app-2026-07-23/addendum.md] — multi-stage Dockerfiles, non-root users, health checks
- [Source: _bmad-output/implementation-artifacts/5-1-backend-database-containers-with-health-checks-named-volume-and-migrate-before-serve.md] — 5.1 conventions to mirror (multi-stage, non-root, healthcheck via stdlib tool, `${VAR:-default}` env indirection, `appnet` network, extension seam)
- [Source: frontend/src/api/client.ts, frontend/src/api/todos.ts, frontend/package.json, frontend/vite.config.ts, frontend/.nvmrc, frontend/.env.example, .gitignore, docker-compose.yml, backend/Dockerfile]

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

Real verification against Docker (Docker 29.6.2, Compose v5.3.1). Key observed output:

- `docker compose config` — valid. `docker compose build` — both `backend` (rebuilt) and `frontend` build clean. Frontend builder ran `npm ci` then `npm run build` (`tsc --noEmit && vite build`): `vite v8.1.5 built in 114ms` producing `dist/index.html` + hashed `dist/assets/index-*.js|css` + `scene-*.js` (three.js still code-split). Runtime stage is `nginx:stable-alpine` (`nginx/1.30.4`).
- `docker compose up -d` — startup ordering enforced by `depends_on: condition: service_healthy`: `db Healthy` → `backend Started` → `backend Healthy` → `frontend Started`. All three reach `healthy`.
- **First bring-up caught a real bug:** frontend went `unhealthy` — host `curl http://localhost:8080/` returned `200` but the in-container `wget http://localhost:8080/` got `Connection refused`. Root cause: in `nginx:stable-alpine`, `localhost` resolves to IPv6 `::1` first, but `nginx listen 8080;` binds IPv4 `0.0.0.0:8080` only (`netstat` confirmed `0.0.0.0:8080 LISTEN`; `wget 127.0.0.1` OK, `wget localhost` refused). Fixed the HEALTHCHECK to probe `http://127.0.0.1:8080/`. Rebuilt → frontend reaches `healthy`.
- **Non-root nginx:** `docker compose exec frontend id` → `uid=101(nginx) gid=101(nginx)` (not root). nginx logs the expected benign warning that the `user` directive is ignored when not running as super-user.
- **SPA served through the frontend origin:** `curl http://localhost:8080/` returns the built `index.html` (`<div id="root">`, hashed `/assets/index-CPHIQcV4.js` module + css). `GET /assets/index-CPHIQcV4.js` → `200 content-type=application/javascript`.
- **/api/health PROXIED through nginx:** `curl http://localhost:8080/api/health` → `200 {"status":"ok","db":"ok"}` (nginx → backend:8000, path preserved, real DB round-trip). `curl -I` shows **no `Access-Control-*` headers** (single origin, AD-10).
- **Full CRUD round-trip through the proxy** (all against `:8080/api/...`): `POST /api/todos` → `201` bare Todo (id `846880ce…`); `GET /api/todos` → shows it; `PATCH /api/todos/{id} {"completed":true}` → `200` toggled; `DELETE /api/todos/{id}` → `204`, then gone.
- **Clear-completed DELETE-with-body through the proxy:** `DELETE /api/todos/completed` with JSON body `{"ids":["846880ce…"]}` → `200 {"deleted":1}`, and `GET /api/todos` → `{"todos":[]}`. Confirms nginx forwards the DELETE **request body** intact (AD-7).
- **SPA fallback:** `GET /some/deep/route` → `200` returning `index.html` (try_files fallback). Unknown `/api/does-not-exist` → proxied to backend, returns the backend's `404 {"error":{"code":"http_404",...}}` envelope (NOT the SPA index) — proves the `/api/` prefix is proxied, not swallowed by the SPA fallback.
- **Teardown:** `docker compose down -v` removed all three containers + the `pgdata` volume + network. `docker ps -a | grep nearform` empty; `docker volume ls | grep nearform_todo_app` empty. The `pgdata` volume *definition* + `frontend` service remain in `docker-compose.yml`.
- **CI-exact standalone build:** `docker build -t nearform-todo-frontend:ci frontend` (context `frontend/`) succeeded — activates the existing conditional `build-images` frontend step in `.github/workflows/ci.yml` (keyed on `frontend/Dockerfile` existing). `:ci` tag removed after.
- **Regression:** frontend `npm run test` → **114 passed** (15 files). backend `pytest -q` → **43 passed, 44 skipped** (skips are the pre-existing integration tests needing a test-profile Postgres on `localhost:5433`, a 5.3/CI concern — not a regression). No app code changed.

### Completion Notes List

- All 3 ACs verified against a live composed 3-service stack; all 6 tasks complete.
- Key choices: builder `node:22-slim` (matches `.nvmrc`/`engines` pin), `npm ci` from the committed lockfile, `npm run build` → `dist/`; runtime `nginx:stable-alpine` (architecture Stack pin). nginx listens on the **unprivileged port 8080** so the process runs as the non-root `nginx` user (uid 101) — chowned `/var/cache/nginx`, `/var/log/nginx`, and the pid file. HEALTHCHECK via busybox `wget` on `GET http://127.0.0.1:8080/` (127.0.0.1, not `localhost`, to force IPv4 — the fix for the IPv6 false-unhealthy). `nginx.conf` installed at `conf.d/default.conf` (replaces stock block, keeps stock mime/log defaults): serves the SPA with `try_files … /index.html` fallback, long-caches hashed `/assets/`, and reverse-proxies `location /api/ { proxy_pass http://backend:8000; }` — **no trailing slash** so the `/api` prefix is preserved; forwards method/body/headers by default so the clear-completed DELETE-with-body passes through. No CORS headers anywhere (AD-10). Compose EXTENDED (not rewritten): added a `frontend` service `depends_on backend: service_healthy`, host port `${FRONTEND_PORT:-8080}:8080`, on the existing `appnet`.
- **No frontend app code changed.** The API client already defaults `API_BASE_URL` to `'/api'` when `VITE_API_BASE_URL` is unset, so building without that env var yields the correct same-origin bundle — single-origin worked with zero code tweak.
- Backend host port `8000:8000` intentionally KEPT (debug convenience per the AC "can stay internal or keep its port"); the browser uses only the `:8080` frontend origin, so this does not affect single-origin. Not removed, to avoid an unrequested change to 5.1 behavior.
- Left for **5.3** (untouched): `dev`/`test` compose profiles (source mounts, Vite HMR, exposed ports, CORS-on-in-dev, ephemeral test DB). Base config stays profile-free so a plain `docker compose up` is the production-like single-origin stack; the `frontend` service is structured so a dev override can add the HMR path cleanly.

### File List

- `frontend/Dockerfile` (NEW) — multi-stage `node:22-slim` build → `nginx:stable-alpine` runtime, non-root nginx (uid 101) on unprivileged port 8080, HEALTHCHECK on `GET /` via wget/127.0.0.1.
- `frontend/.dockerignore` (NEW)
- `frontend/nginx.conf` (NEW) — single-origin server block: SPA + `try_files` fallback, long-cache `/assets/`, `/api/` reverse proxy to `backend:8000` (path-preserving, DELETE-body-forwarding), no CORS.
- `docker-compose.yml` (MODIFIED — extended 5.1 with the `frontend` service + host port; updated header comment; annotated the backend debug port)
- `_bmad-output/implementation-artifacts/5-2-frontend-container-and-single-origin-docker-compose-up.md` (story file — status/records)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status tracking)

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-23 | Created Story 5.2 (create-story): frontend nginx container + single-origin `docker compose up`. Status → ready-for-dev. |
| 2026-07-23 | Implemented Story 5.2 (dev-story): multi-stage `frontend/Dockerfile` (node:22 build → nginx:stable-alpine runtime, non-root, `GET /` HEALTHCHECK); `frontend/.dockerignore`; `frontend/nginx.conf` (SPA + single-origin `/api` reverse proxy, AD-10); extended `docker-compose.yml` with the `frontend` service (depends_on backend healthy, host port 8080). Verified live: 3-service stack builds + comes up healthy in order; SPA served at `:8080`; `/api/health` proxied `200 db:ok` with no CORS headers; full CRUD + clear-completed DELETE-with-body round-trip through the proxy; SPA fallback; non-root nginx (uid 101). Fixed an IPv6-vs-IPv4 healthcheck bug (probe 127.0.0.1). No app code changed; frontend 114 tests + backend 43 pass (44 pre-existing skips). Teardown clean (no leftovers). Status → review. |

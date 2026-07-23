# Security Review — nearform_todo_app

Story 6.3 · date 2026-07-23 · baseline commit `99c1e01`

Scope: the single-user, no-auth v1 security bar per NFR-Sec — input hygiene and
safe rendering. No secrets, PII, or auth tokens are handled in v1. This review
covers XSS, injection, input-validation parity, error-envelope information
disclosure, CORS posture (AD-10), transport/response security headers,
dependency risk, and container hardening. Findings are rated and each carries a
status: PASS (verified, no action), REMEDIATED (fixed in this story), or
RECOMMENDATION (documented for a future story).

## Summary

| # | Area | Finding | Severity | Status |
|---|------|---------|----------|--------|
| 1 | XSS | Todo text rendered as an auto-escaped React child; no `dangerouslySetInnerHTML`/`innerHTML`/`eval` anywhere | — | PASS |
| 2 | Injection | All Todo persistence goes through the AD-2 repository chokepoint with parameterized SQLAlchemy constructs; no raw/interpolated SQL on user input | — | PASS |
| 3 | Validation parity | Server enforces trim / non-empty / no-control-char / ≤500; client mirrors non-empty + ≤500 (control-char check is server-only) | Low | PASS (documented gap) |
| 4 | Error envelope | Uniform AD-5 envelope; catch-all returns a generic message and logs internals server-side only; `server_tokens off` | — | PASS |
| 5 | CORS (AD-10) | Enabled only when `CORS_ORIGINS` is set (dev profile); prod single-origin sends no CORS | — | PASS |
| 6 | Security headers | No response security headers on the SPA/proxy | Medium | REMEDIATED |
| 7 | Container base images | Bases pinned by tag, not digest | Low | REMEDIATED |
| 8 | Dependencies (JS) | `npm audit` (prod + dev): 0 vulnerabilities | — | PASS |
| 9 | Dependencies (Python) | `pytest` 8.4.2 flagged (PYSEC-2026-1845); dev/test-only, not in the runtime image | Low | RECOMMENDATION |
| 10 | Container hardening | Both images already run non-root; `.dockerignore` excludes secrets/tests | — | PASS |

No High/Critical findings. Two Medium/Low items remediated in this story; two
low items left as documented recommendations.

---

## 1. XSS — PASS

- `frontend/src/components/TodoRow.tsx` renders the description as a React child
  (`<span>{todo.description}</span>`) — React auto-escapes text children, so
  HTML-like content is inert. The delete affordance's accessible name is an
  `aria-label` string (also escaped). AD-5.
- Repo-wide grep of `frontend/src` for `dangerouslySetInnerHTML`, `innerHTML`,
  `eval(`, `new Function`, `document.write`: **no matches** (only a comment in
  `TodoRow.tsx` documenting the intentional avoidance).
- **Live test (isolated stack):** created a Todo with description
  `<img src=x onerror=alert(1)> normal todo`. It is stored verbatim and rendered
  as literal text — the `<img>` never becomes a DOM element, no handler fires.
- Content-type of the API is `application/json` and now carries
  `X-Content-Type-Options: nosniff` (see §6), so a stored payload can never be
  reinterpreted as HTML by MIME-sniffing.

## 2. Injection — PASS

- `backend/app/repositories/todo_repo.py` is the sole AD-2 chokepoint for Todo
  data access. Every statement is a parameterized SQLAlchemy Core/ORM construct
  (`select(Todo)`, `delete(Todo)`, `.where(Todo.id == todo_id)`,
  `.where(Todo.id.in_(ids))`). No user input is string-formatted into SQL.
- The only `text()` occurrences in `backend/app` are static, non-user DDL/health
  constants: `text("SELECT 1")` (health probe), `gen_random_uuid()` / `false`
  server defaults, and an index expression in `models.py`. None interpolate
  request data.
- `clear_completed` builds a parameterized `IN (:ids)` bind and short-circuits an
  explicit empty snapshot (avoids a degenerate `IN ()`).
- **Live test (isolated stack):** created a Todo with description
  `Robert'); DROP TABLE todos;--`. It persisted verbatim as a string value and
  subsequent list/create/delete operations continued to work — the table was
  never affected, confirming the value was bound as data, not executed as SQL.

## 3. Input-validation parity — PASS (documented low gap)

- Server (authoritative): `backend/app/schemas/todo.py::validate_description` —
  trim → reject empty/whitespace-only → reject any C0 control char (`ord < 32`)
  or DEL (`127`) → reject `> 500` chars on the trimmed string. `TodoUpdate`
  types `completed` as `StrictBool` (rejects `"true"`/`1`); the `{todo_id}` path
  is UUID-typed; extra body keys are ignored.
- Client (fast-fail UX): `frontend/src/components/AddInput.tsx` mirrors non-empty
  and ≤500-char on the trimmed value.
- **Gap (Low):** the client does not replicate the control-character rejection.
  This is acceptable and low-risk: the capture field is a single-line
  `<input type="text">` (newlines are not enterable via normal typing), and the
  server is authoritative — a control-char payload sent directly to the API is
  rejected with a 422 (verified live: a `description` containing `\n` returned
  `422`). Documented rather than remediated to avoid client/server drift on a
  non-user-facing edge.

## 4. Error-envelope information disclosure — PASS

- `backend/app/core/errors.py` funnels every non-2xx through the uniform AD-5
  envelope `{"error":{"code","message","details"?}}`.
- The catch-all `_handle_unexpected` returns a generic
  `{"code":"internal_error","message":"An internal server error occurred"}` and
  logs the full exception (`exc_info`) to server stdout only — no stack traces,
  SQL, or DSNs reach the client.
- Validation errors emit `details:[{field, issue}]` only. **Live sample:**
  `POST {"description":"   "}` →
  `{"error":{"code":"validation_error","message":"Request validation failed","details":[{"field":"description","issue":"Value error, Description must not be empty."}]}}`.
- `server_tokens off` in `frontend/nginx.conf` suppresses the nginx version.

## 5. CORS posture (AD-10) — PASS

- `backend/app/main.py` adds `CORSMiddleware` **only** when
  `settings.cors_origins` is non-empty. The prod compose leaves `CORS_ORIGINS`
  unset, so the single-origin stack sends no CORS headers.
- The permissive `allow_credentials=True` + `allow_methods/headers=["*"]` combo
  is scoped to the dev profile (Vite :5173 → backend :8000) and is acceptable
  there. It is unreachable in prod because the middleware is never installed.
  **Live check:** `/api/health` through the prod-like proxy returned no
  `Access-Control-Allow-*` headers.

## 6. Security response headers — REMEDIATED (was Medium)

Before this story the SPA/proxy sent no security headers. Added to
`frontend/nginx.conf` at server scope with `always` (so they ride every
response, including errors):

- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`

CSP rationale (tuned to what the built SPA actually loads):
- `script-src 'self'` — the built `index.html` loads a single same-origin ES
  module (`/assets/index-*.js`); there is **no inline script**, so strict
  `'self'` holds. The lazy-loaded three.js chunk (`/assets/scene-*.js`) is also
  same-origin.
- `style-src 'self' 'unsafe-inline'` — the stylesheet is same-origin, but React
  renders one inline `style=` attribute (the Backdrop canvas), which requires
  `'unsafe-inline'`. This is low-risk: style injection is far less dangerous
  than script injection, and `script-src` stays strict.
- `connect-src 'self'` — the API is reached via same-origin `fetch('/api')`.
- WebGL/canvas rendering is not governed by CSP, so the backdrop needs no
  allowance. `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`
  close plugin, base-tag, and clickjacking vectors.

nginx `add_header` inheritance footgun handled: `location /assets/` declares its
own `Cache-Control`, which cancels inheritance of the server-level headers, so
the asset-relevant `X-Content-Type-Options: nosniff` is re-declared there.
`location /` (serves index.html, where CSP takes effect) and `location /api/`
have no own `add_header` and inherit the full set.

**Verified live (isolated prod-like stack):** headers present on `/`
(index.html: CSP + nosniff + X-Frame-Options + Referrer-Policy), on
`/assets/index-*.js` (nosniff + Cache-Control preserved), and on the proxied
`/api/health` (CSP + nosniff inherited). The app loaded and ran a full
create→toggle→clear→delete round-trip with no CSP violations.

## 7. Container base-image digest pinning — REMEDIATED (was Low; deferred from 5.1/5.2)

Pinned all three bases to `@sha256:` digests (tags kept as comments) for
reproducible, supply-chain-hardened builds:

| Image | Tag | Digest (resolved 2026-07-23) |
|-------|-----|------------------------------|
| `python:3.12-slim` (backend builder+runtime) | 3.12-slim | `sha256:57cd7c3a7a273101a6485ba99423ee568157882804b1124b4dd04266317710de` |
| `node:22-slim` (frontend builder+dev) | 22-slim | `sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3` |
| `nginx:stable-alpine` (frontend runtime) | stable-alpine | `sha256:97d490c12ba55b4946b01546d1c3ed324e8d41ab1c9fcb2a616aa470620e5b46` |

**Verified:** both images rebuilt successfully from the pinned digests and the
stack came up healthy. Refresh the digests deliberately when bumping a base.

## 8. JavaScript dependency risk — PASS

`npm audit` in `frontend/`: **0 vulnerabilities** for both the production set
(`--omit=dev`) and the full dev set.

## 9. Python dependency risk — RECOMMENDATION (Low)

`pip-audit` against the installed backend environment found one advisory:

| Package | Version | Advisory | Fix | Disposition |
|---------|---------|----------|-----|-------------|
| pytest | 8.4.2 | PYSEC-2026-1845 | 9.0.3 | **Not applied** — see below |

pytest is a **dev/test-only** dependency (`[project.optional-dependencies].dev`
in `backend/pyproject.toml`); it is **not** in the runtime dependency closure and
is **not** installed in the production backend image (the prod Dockerfile stage
installs only runtime deps; pytest is added only in the separate `test` stage).
The fix (9.0.3) is a **major** version bump that falls outside the current
`pytest>=8,<9` pin and risks breaking the suite. Because the exposure is a local
test tool with no untrusted-input surface in production, this is left as a
recommendation: bump `pytest` to `>=9` (and re-green the suite) in a maintenance
pass, ideally alongside the dependency-audit CI step recommended below.

All runtime backend dependencies are on current pinned ranges
(`fastapi 0.136`, `pydantic 2.x`, `sqlalchemy 2.0.x`, `psycopg 3.x`,
`uvicorn 0.34.x`, `alembic 1.x`) with no advisories reported.

## 10. Container hardening — PASS

- Backend runs as non-root `appuser` (uid/gid 10001); frontend nginx runs as the
  non-root `nginx` user on the unprivileged port 8080.
- `.dockerignore` in both services excludes `.env*`, tests, caches, and local
  `node_modules`/`.venv` — no secrets or dev cruft baked into images.
- No secrets are baked at build time (frontend build leaves `VITE_API_BASE_URL`
  unset for same-origin; backend config is 12-factor env at runtime).

---

## Recommendations (documented, not applied)

1. **Bump `pytest` to ≥ 9.0.3** in a maintenance pass to clear PYSEC-2026-1845
   (dev/test-only; requires re-greening the suite against pytest 9).
2. **Add a dependency-audit CI step** (`npm audit --audit-level=high` +
   `pip-audit`) so new advisories fail the pipeline. Deliberately **not** added
   here to avoid colliding with Story 6.2's parallel edits to
   `.github/workflows/ci.yml`; this belongs with the coverage-gate CI work.
3. **HSTS** (`Strict-Transport-Security`) is intentionally omitted because TLS
   termination is out of scope for the v1 compose stack (nginx serves plain
   HTTP behind whatever the deployer fronts it with). Add it at the TLS edge
   when one is introduced.

# PRD Addendum — nearform_todo_app

Technical depth held out of the capability-level PRD, preserved here for the downstream Architecture and QA workflows. These are **decided inputs**, not open choices.

## Fixed technology stack

- **Backend:** Python + **FastAPI** — a small, well-defined CRUD API for Todos with request validation and error handling.
- **Frontend:** **React + Vite**, with **three.js** for the Backdrop.
- **Persistence:** **PostgreSQL**, volume-backed, for durability across sessions and to exercise a realistic multi-container Compose setup.
- **Delivery:** multi-stage Dockerfiles (frontend + backend), non-root container users, health-check endpoints; orchestrated via **Docker Compose** (app + DB), runnable with a single `docker-compose up`. Dev/test config via environment variables and compose profiles; logs via `docker-compose logs`.

## Test & QA tooling (from activity spec, addendum §B)

- Unit: **Jest/Vitest** (frontend), backend unit tests in the Python stack's runner.
- Integration: per-endpoint API integration tests written as endpoints are built; API contracts validated (Postman MCP or similar).
- E2E: **Playwright** — ≥ 5 passing tests covering create, complete, delete, empty state, error handling.
- Coverage tooling targeting ≥ 70% meaningful coverage.
- Accessibility: Lighthouse / axe-core, automatable via Playwright; WCAG 2.1 AA.
- Performance: Chrome DevTools MCP; document issues.
- Security: review for XSS, injection, etc.; document findings + remediations.

## Extensibility seam (do not build in v1)

To keep later auth/multi-user from requiring a rewrite: model Todos so an owner/user dimension can be introduced later (e.g. a nullable/implicit owner today that becomes a real foreign key later), and keep the API boundary shaped so authentication middleware and per-owner scoping can be layered on without changing the core Todo contract. None of this is implemented in v1.

> **Superseded by architecture AD-9:** the illustrative "nullable/implicit owner today" example above is *not* the chosen approach. AD-9 deliberately adds **no** `owner_id` column and no auth in v1 (YAGNI); the auth/multi-user seam is instead a documented set of additive changes when needed (users table + FK migration, a repository-chokepoint owner filter, optional `/api` auth middleware), leaving the wire contract unchanged. The original text is retained for provenance — follow AD-9.

## Deliverables checklist (activity spec)

BMAD artifacts (brief, PRD, architecture, stories w/ ACs) · working Todo app · unit + integration + E2E suites · Dockerfiles + docker-compose.yml · QA reports (coverage, a11y, security) · README with setup instructions · AI-integration log (agent/MCP usage, effective prompts, test-gen hits/misses, AI debugging cases, limitations where human expertise was critical).

## Source provenance

Substantive product behavior in the PRD derives from the user's original supplied PRD (brief addendum §A, verbatim). The brief is the distilled framing; the activity spec (brief addendum §B) supplies the hard quality bars now encoded as SM-5..SM-9 and NFR-Quality; the three.js feature (brief addendum §C) is encoded as §4.4 / FR-8.

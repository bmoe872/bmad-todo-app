# nearform_todo_app

Full-stack single-user Todo web app: a React + Vite + three.js SPA over a layered
FastAPI REST service backed by PostgreSQL, delivered via Docker Compose.

> This README is a scaffold stub created in Story 1.1. The complete project
> README (setup, run, architecture overview, screenshots) is finalized in
> Story 6.4.

## Monorepo layout

```
backend/    FastAPI service (Python 3.12) — layered routes -> services -> repositories -> db
frontend/   React + Vite SPA (Node 22 LTS) — components / hooks / api / backdrop
e2e/        Playwright end-to-end + accessibility specs
docs/        Project docs, incl. AI-INTEGRATION-LOG.md
```

## Runtimes

- **Node.js 22 LTS** — pinned via `.nvmrc`. Run `nvm use` in `frontend/` and `e2e/`.
- **Python 3.12** — pinned via `backend/.python-version` (pyenv). Backend uses a
  project-local virtualenv at `backend/.venv` (no global installs).

## Common commands (root Makefile)

```
make install    # backend venv + deps, frontend deps, e2e deps + browsers
make test       # backend pytest + frontend vitest
make coverage   # both suites with branch coverage (report-only until Story 6.2)
make lint       # ruff (backend) + eslint & tsc (frontend)
make smoke      # Playwright smoke against a locally-served page (NOT docker-compose)
make ci         # lint + test + coverage + smoke, the local mirror of CI
```

The full docker-compose delivery and CI pipeline arrive in Epics 5 and 6.

# nearform_todo_app — root task runner.
#
# Single, CI-agnostic entrypoint that reproduces the CI pipeline locally
# (GitHub Actions calls these same targets — see Story 1.3). The Epic 1
# Playwright smoke targets a locally-served page (Vite preview), NOT
# docker-compose; the compose-backed run lands in Epic 5.
#
# Runtimes (see CLAUDE.md / README):
#   * Node 22 LTS via nvm — run `nvm use` (reads .nvmrc) before node targets.
#   * Python 3.12 via pyenv — backend uses a project-local venv at backend/.venv;
#     targets invoke that venv's python directly, so no activation is needed.

BACKEND      := backend
FRONTEND     := frontend
E2E          := e2e
VENV         := $(BACKEND)/.venv
PY           := $(VENV)/bin/python
PIP          := $(VENV)/bin/python -m pip

# Isolated E2E stack (Story 6.1): a SEPARATE compose project name + distinct host
# ports + its own pgdata volume, so the compose-backed Playwright run never
# touches a default-project stack (e.g. a live inspection stack on :8080/:8000).
E2E_PROJECT       := nftodo_e2e
E2E_FRONTEND_PORT := 8090
E2E_BACKEND_PORT  := 8010
E2E_BASE_URL      := http://localhost:$(E2E_FRONTEND_PORT)
E2E_COMPOSE       := FRONTEND_PORT=$(E2E_FRONTEND_PORT) BACKEND_PORT=$(E2E_BACKEND_PORT) \
                     docker compose -p $(E2E_PROJECT)

.DEFAULT_GOAL := help
.PHONY: help install install-backend install-frontend install-e2e \
        test test-backend test-frontend coverage coverage-backend coverage-frontend \
        lint lint-backend lint-frontend smoke e2e e2e-up e2e-down install-e2e-browsers ci clean

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ---- install ----

install: install-backend install-frontend install-e2e ## Install all package dependencies

install-backend: ## Create the backend venv (Python 3.12) and install deps
	# Create the venv from INSIDE backend/ so pyenv honors backend/.python-version
	# (3.12). Running python3 at the repo root would pick up the global interpreter.
	cd $(BACKEND) && python3 -m venv .venv
	$(PIP) install --upgrade pip
	$(PIP) install -e "$(BACKEND)[dev]"

install-frontend: ## Install frontend deps (requires Node 22 active)
	cd $(FRONTEND) && npm install

install-e2e: ## Install e2e deps + Chromium (requires Node 22 active)
	cd $(E2E) && npm install && npm run install-browsers

# ---- test ----

test: test-backend test-frontend ## Run backend + frontend unit suites

test-backend: ## Run backend pytest
	cd $(BACKEND) && ../$(VENV)/bin/python -m pytest

test-frontend: ## Run frontend Vitest
	cd $(FRONTEND) && npm run test

# ---- coverage (branch; report-only until Story 6.2) ----

coverage: coverage-backend coverage-frontend ## Run both suites with branch coverage

coverage-backend: ## Backend pytest with branch coverage (report-only)
	cd $(BACKEND) && ../$(VENV)/bin/python -m pytest --cov=app --cov-report=term-missing --cov-report=xml

coverage-frontend: ## Frontend Vitest with v8 branch coverage (report-only)
	cd $(FRONTEND) && npm run coverage

# ---- lint ----

lint: lint-backend lint-frontend ## Lint backend + frontend

lint-backend: ## Ruff check on the backend
	cd $(BACKEND) && ../$(VENV)/bin/python -m ruff check .

lint-frontend: ## ESLint + tsc typecheck on the frontend
	cd $(FRONTEND) && npm run lint

# ---- e2e (compose-backed, Story 6.1) ----

install-e2e-browsers: ## Ensure the Playwright Chromium browser is installed
	cd $(E2E) && npm run install-browsers

e2e-up: ## Bring up an ISOLATED prod-like stack for E2E (own project/ports/volume)
	$(E2E_COMPOSE) up -d --build --wait

e2e-down: ## Tear down the isolated E2E stack (removes its containers + volume ONLY)
	$(E2E_COMPOSE) down -v

# Full-journey Playwright suite + @axe-core/playwright accessibility gate against
# the isolated composed stack (frontend+backend+db). Always tears the stack down,
# even on failure, and propagates the test exit code. This is the compose-backed
# Playwright run the architecture's "one command reproduces CI locally" refers to.
e2e: ## Run the Playwright E2E + a11y suite against an isolated composed stack
	$(MAKE) e2e-up
	cd $(E2E) && E2E_BASE_URL=$(E2E_BASE_URL) npm run test; status=$$?; \
		cd .. && $(MAKE) e2e-down; exit $$status

# Back-compat alias: `smoke` now runs the real compose-backed E2E suite (the
# Epic-1 vite-preview placeholder smoke was retired in Story 6.1).
smoke: e2e ## Alias for `e2e` (compose-backed Playwright + a11y run)

# ---- aggregate ----

ci: lint test coverage e2e ## Local mirror of the CI pipeline (incl. compose-backed E2E)

clean: ## Remove build/venv/coverage artifacts
	rm -rf $(VENV) $(FRONTEND)/node_modules $(E2E)/node_modules \
		$(FRONTEND)/dist $(FRONTEND)/coverage \
		$(E2E)/test-results $(E2E)/playwright-report
	find . -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true

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

.DEFAULT_GOAL := help
.PHONY: help install install-backend install-frontend install-e2e \
        test test-backend test-frontend coverage coverage-backend coverage-frontend \
        lint lint-backend lint-frontend smoke ci clean

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

# ---- e2e smoke ----

smoke: ## Playwright smoke against a locally-served page (NOT docker-compose)
	cd $(E2E) && npm run test

# ---- aggregate ----

ci: lint test coverage smoke ## Local mirror of the CI pipeline

clean: ## Remove build/venv/coverage artifacts
	rm -rf $(VENV) $(FRONTEND)/node_modules $(E2E)/node_modules \
		$(FRONTEND)/dist $(FRONTEND)/coverage \
		$(E2E)/test-results $(E2E)/playwright-report
	find . -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true

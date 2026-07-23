# syntax=docker/dockerfile:1
#
# Multi-stage backend image (AD-11, NFR-Deploy):
#   builder → installs pinned runtime deps into an isolated venv
#   runtime → slim, non-root, migrate-before-serve entrypoint, healthcheck
#
# Base pinned to Python 3.12 to match backend/.python-version (3.12.13) and
# pyproject requires-python ">=3.12,<3.13". psycopg[binary] ships wheels, so no
# compiler toolchain is needed — the image stays slim.

# ---- Stage 1: builder ----------------------------------------------------
# Base pinned by DIGEST (supply-chain hardening, Story 6.3 security pass) so the
# build is reproducible and immune to a mutated `python:3.12-slim` tag. The tag
# is kept in the comment for human readability; refresh the digest deliberately
# when bumping the base. Digest resolved for python:3.12-slim (linux, 2026-07-23).
FROM python:3.12-slim@sha256:57cd7c3a7a273101a6485ba99423ee568157882804b1124b4dd04266317710de AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Create the venv the runtime stage will copy verbatim.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy the sources setuptools needs to build+install the project. `pip install .`
# resolves the pinned dependency ranges from pyproject.toml (runtime deps only —
# the "dev" extra with pytest/ruff/httpx is intentionally NOT installed).
COPY pyproject.toml ./
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
RUN pip install .

# ---- Stage 2: runtime ----------------------------------------------------
# Same digest-pinned base as the builder (see the builder-stage note).
FROM python:3.12-slim@sha256:57cd7c3a7a273101a6485ba99423ee568157882804b1124b4dd04266317710de AS runtime

# PYTHONUNBUFFERED so structured JSON logs flush to stdout for `docker compose logs`.
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Non-root user (NFR-Deploy). Fixed high UID/GID for predictable ownership.
RUN groupadd --gid 10001 appuser \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin appuser

WORKDIR /app

# The prebuilt venv holds every runtime dependency.
COPY --from=builder /opt/venv /opt/venv

# Application source + migration assets. alembic.ini/migrations are NOT part of
# the installed wheel (packages.find includes only app*), so they are copied
# explicitly and run from this WORKDIR.
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER appuser

EXPOSE 8000

# Health contract GET /api/health -> 200 {"status":"ok","db":"ok"} after a real
# DB round-trip. The slim image has no curl/wget, so probe via Python stdlib.
# start-period covers migration + boot time before failures count.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD python -c "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health', timeout=4).status == 200 else 1)"

ENTRYPOINT ["docker-entrypoint.sh"]

# ---- Stage 3: dev (Story 5.3, dev profile only) --------------------------
# Extends the prod runtime with the fast file-watcher so `uvicorn --reload`
# reloads on efficient inotify events instead of the polling fallback. The prod
# `runtime` stage above is the DEFAULT final stage, so a bare `docker build`
# (and the profile-free compose) still produces the slim prod image WITHOUT
# watchfiles. The dev service (compose `backend-dev`) bind-mounts the source and
# overrides the entrypoint to migrate-then-`uvicorn --reload`.
FROM runtime AS dev

USER root
RUN pip install --no-cache-dir "watchfiles>=0.24,<2"
USER appuser

# ---- Stage 4: test (Story 5.3, test profile only) ------------------------
# Extends the prod runtime with the test toolchain (mirrors the pyproject `dev`
# extra: pytest/pytest-cov/httpx; alembic + sqlalchemy are already runtime deps
# the integration fixtures use). The `backend-test` compose service bind-mounts
# `tests/` (omitted from the prod image) and runs pytest against the ephemeral
# `db-test` Postgres. Runs as root: the throwaway CI runner needs to import the
# bind-mounted tests without host/container uid friction.
FROM runtime AS test

USER root
RUN pip install --no-cache-dir \
    "pytest>=8,<9" \
    "pytest-cov>=5,<7" \
    "httpx>=0.27,<0.29"

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
FROM python:3.12-slim AS builder

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
FROM python:3.12-slim AS runtime

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

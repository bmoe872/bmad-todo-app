#!/bin/sh
# Migrate-before-serve entrypoint (AD-11): the API never serves against an
# unmigrated schema. `set -e` aborts startup if the migration fails, so a bad
# schema surfaces as a failed container rather than a half-working service.
set -e

# Runs with WORKDIR /app so alembic finds alembic.ini (script_location=migrations,
# prepend_sys_path=.). The DB URL is read from DATABASE_URL by migrations/env.py
# via the application Settings — a single source of truth, never hard-coded here.
echo "entrypoint: applying database migrations (alembic upgrade head)"
alembic upgrade head

# exec so uvicorn replaces the shell as PID 1's process and receives SIGTERM/SIGINT
# from `docker compose down` for a graceful shutdown.
echo "entrypoint: starting uvicorn on 0.0.0.0:8000"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

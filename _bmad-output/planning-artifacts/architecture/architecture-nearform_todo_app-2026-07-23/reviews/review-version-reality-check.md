# Reviewer lens: version / reality-check

**Verdict: PASS.** Every pinned technology was web-verified current as of 2026-07 and each named library still exists and fits the stack. Two version pins are `[ASSUMPTION]` runtime choices (defensible), one library major was verified after drafting.

## Findings

1. **[resolved] TanStack Query major unverified at draft time.** Verified: v5 is current (5.101.4, July 2026); no v6 for react-query. Pin `v5` stands.
2. **[low, accepted] Python 3.12 and Node 22 LTS are `[ASSUMPTION]` pins** — neither is fixed by the inputs. Both are current, supported, and satisfy Vite 8's Node floor (20.19+/22.12+). Reasonable; flagged in the spine.
3. **[low, no action] `gen_random_uuid()`** is core in PostgreSQL 13+ (no pgcrypto extension needed on PG17). Correct.
4. **[low, no action] Alembic pinned "current (~1.14+)"** — acceptable soft pin for a tooling dep; the code owns the exact version.
5. **Verified currents:** FastAPI 0.136.x, Pydantic 2.x, SQLAlchemy 2.0.x, psycopg 3.x, Uvicorn 0.34.x, React 19.2.x, Vite 8.0.x, three.js 0.185.x, Vitest 4.x, Playwright 1.5x, PostgreSQL 17 — all confirmed against web sources.

No changes required beyond the version confirmation already folded in.

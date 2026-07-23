# Reviewer lens: adversarial seam (two-units-diverge)

**Verdict: PASS with two minor fixes.** I tried to build two compliant units that still clash. The state-mutation path (AD-1/AD-6), the clear-completed model (AD-7), and the entity contract (AD-3) are tight. Two small holes let independent builders diverge; both are cheap to close.

## Findings

1. **[medium → autofix] Frontend container health check unspecified.** AD-11 and the Structural Seed say "each service declares a healthcheck" but only define the backend's `GET /api/health`. Two builders could pick different frontend nginx health signals. → Close by fixing the frontend healthcheck to `GET /` returning 200 from nginx.

2. **[medium → autofix] Pydantic validation error remapping not explicit.** AD-5 mandates the `{error:{…}}` envelope "via centralized handlers", but FastAPI's native `RequestValidationError` returns `422 {detail:[…]}`. A builder could leave the native shape on validation errors while custom errors use the envelope — a real divergence for the frontend error parser. → Tighten AD-5 to state the `RequestValidationError` handler is remapped into the same envelope.

3. **[low, no action] created_at DESC + UUID tiebreak determinism.** UUIDv4 tiebreak is random per-row but *stable* (same id always sorts identically), so ordering is deterministic across refreshes (FR-5). Acceptable.

4. **[low, no action] Optimistic temp-id vs server-id.** AD-6 `onSettled` invalidate → refetch replaces the temp row with the server row. No lingering divergence.

5. **[low, no action] Clear-completed window races.** AD-7's explicit-id snapshot + server "only-still-completed" filter closes the "item completed during the undo window gets deleted" hole, and the deferred commit makes crash-mid-window a safe no-op. Solid.

6. **[low, no action] Delete idempotency.** `404`-as-already-gone + reconcile (AD-6) means a double-delete or stale delete converges. Fine.

Fixes 1 and 2 applied to the spine.

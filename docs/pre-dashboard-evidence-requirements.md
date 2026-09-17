# Pre-dashboard evidence artifact contract

The pre-dashboard gate is evidence-based. A dashboard is not a validation mechanism.

## Required artifact

The research runner must emit one deterministic JSON document containing:

- release commit SHA and branch
- dependency-lock identity (lockfile SHA)
- dataset provenance: provider, symbol, pool/symbol identifier, interval, requested start/end, actual start/end, volume semantics
- data-quality counts and errors
- freshness policy and ingestion freshness result
- baseline and optimized walk-forward OOS metrics
- all WFO windows and selected parameters
- parameter-stability summary across windows
- stress results for every configured scenario
- seeded bootstrap confidence intervals
- seeded Monte Carlo summary
- paper-trading observation count, regime coverage and acceptance results
- execution/risk invariant test status
- persistence idempotency/conflict/reconciliation status
- security status: dependency audit, secret scan, fail-closed configuration
- typecheck/test/build status
- explicit gate result and reasons

## Pass rule

The artifact must set `readyForDashboard=true` only when every required evidence field is present and every required check passes on the same release commit. Missing, unavailable, stale, provider-rejected, or documentation-only evidence is a failure.

The gate must never infer profitability from incomplete evidence and must never convert a provider outage into a pass.

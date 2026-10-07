# Pre-dashboard evidence contract

This contract defines the minimum machine-verifiable evidence required before the read-only dashboard is released.

A release is READY only when one exact commit has a successful CI evidence run and the evidence artifact is internally consistent. Documentation alone never counts as evidence.

## Required evidence

- pinned dependency lockfile and dependency/security audit
- tracked-secret scan and fail-closed PAPER/LIVE configuration tests
- typecheck, full tests and build
- historical source provenance: provider, symbol/pool, interval, requested range and volume semantics
- data-quality report: duplicates, ordering, OHLC, volume, gaps and range coverage
- freshness/out-of-order ingestion rejection tests
- deterministic execution and portfolio invariants
- stateful paper-trading risk enforcement and halt behavior
- idempotent persistence with conflict detection and deterministic replay/reconciliation
- sequential walk-forward windows with non-overlapping train/test ranges and compounded OOS metrics
- train-only optimization with inner validation and deterministic tie-breaking
- parameter-stability evidence across accepted nearby configurations/windows
- all configured execution stress scenarios and threshold evaluation
- seeded bootstrap confidence intervals and seeded Monte Carlo analysis
- paper-trading acceptance evidence covering the declared observation/regime period
- machine-readable end-to-end research report containing all above evidence and a final readiness boolean

## Release rule

`preDashboardReady` MUST be false if any required evidence is absent, failed, unavailable, non-deterministic, or derived from an unverified provider range. In particular, a GeckoTerminal public-API historical-range limitation cannot be treated as a pass.

The dashboard may consume this report but must not override the readiness boolean.

Live trading is a separate gate and remains disabled.

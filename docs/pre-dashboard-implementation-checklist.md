# Complete pre-dashboard implementation checklist

This checklist is the implementation companion to `docs/pre-dashboard-readiness.md`.

## Evidence and data
- [x] Historical provider abstraction.
- [x] OHLCV schema and bounds validation.
- [x] Duplicate/order/gap/range-coverage audit.
- [x] Provider provenance documented.
- [x] DEX and CEX benchmark roles separated.
- [x] Provider limitations fail closed.
- [x] Fixed research period and deterministic configuration.

## Strategy and research
- [x] Deterministic baseline strategy.
- [x] Explicit execution costs and delay.
- [x] Walk-forward train/test separation.
- [x] Sequential OOS compounding.
- [x] Inner train/validation optimization.
- [x] Deterministic candidate tie-breaking.
- [x] Stress scenarios.
- [x] Seeded bootstrap confidence intervals.
- [x] Seeded Monte Carlo trade-sequence robustness.
- [x] Parameter-stability evidence contract.

## Portfolio and risk
- [x] Long/short accounting rules.
- [x] Insufficient-cash rejection.
- [x] Invalid-close rejection.
- [x] Stateful paper trading.
- [x] Monotonic candle ordering.
- [x] Exposure gate before new exposure.
- [x] Post-breach no-new-entry behavior.
- [x] Reduction/closure remains permitted after halt.
- [x] Risk telemetry is distinct from live execution authorization.

## State and persistence
- [x] Deterministic replay model.
- [x] Paper trade sequence records.
- [x] Equity snapshots.
- [x] Idempotent duplicate persistence.
- [x] Conflicting sequence detection.
- [x] Stable ordering on reads.

## Security
- [x] PAPER is the default trading mode.
- [x] PAPER mode rejects signing keys.
- [x] LIVE mode requires explicit enablement and key material.
- [x] Research CI never receives signing keys.
- [x] Secret-pattern CI check.
- [x] Dependency audit job.
- [x] Read-only GitHub Actions permissions.
- [x] Threat model and incident response.
- [ ] Wallet signing/execution module: not part of pre-dashboard scope and must remain disabled.
- [ ] Transaction simulation/blockhash/confirmation controls: required only for later live-execution phase.

## Observability
- [x] Structured application logging dependency exists.
- [x] Research outputs are machine-readable.
- [x] Security policy forbids raw key logging.
- [ ] Research artifact includes explicit provenance/hash/run metadata.
- [ ] Paper telemetry includes safe latency categories for future dashboard consumption.

## CI and reproducibility
- [x] Node engine requirement.
- [x] Package lockfile committed.
- [x] CI uses deterministic lockfile installation.
- [x] Typecheck gate.
- [x] Test gate.
- [x] Build gate.
- [x] Security gate.
- [x] Research evidence gate.
- [x] Provider limitation artifacts are explicit failures/diagnostics, not substituted evidence.

## Release rule

The dashboard may start only after the implementation items required for the dashboard data contract are complete and the exact release commit has a green CI/evidence run. Documentation alone never converts missing or failed evidence into a pass.

Live trading is a separate later release and is not authorized by the dashboard gate.

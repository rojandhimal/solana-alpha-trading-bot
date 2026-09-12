# Pre-dashboard readiness gate

This gate must be satisfied before the read-only dashboard is started. It is a release gate, not a claim of profitability.

## Required controls

- [x] Historical OHLCV provider abstraction and schema validation
- [x] Duplicate, ordering, OHLC, volume, interval-gap and range-coverage audit
- [x] Provider separation: DEX research diagnostics vs SOL benchmark data
- [x] Deterministic baseline backtest
- [x] Walk-forward optimization with train/test separation
- [x] Out-of-sample compounding across sequential windows
- [x] Stress execution scenarios: slippage, fees, liquidity, delay and volatility
- [x] Robustness thresholds with explicit failure reasons
- [x] Bootstrap confidence intervals and deterministic Monte Carlo trade-sequence analysis
- [x] Stateful paper-trading engine with monotonic market-data ordering
- [x] Paper exposure and drawdown controls
- [x] Paper-trading persistence contract and in-memory implementation
- [x] Fail-closed trading configuration; paper mode cannot load a signing key
- [x] Security threat model covering LLM prompt injection, data poisoning, key leakage and CI compromise
- [x] Dependency audit and tracked-secret pattern checks in CI
- [x] CI typecheck, tests and build gates
- [x] Research artifacts are machine-readable and reproducible

## Mandatory evidence before dashboard release

The dashboard may display research results only when the evidence run has completed successfully. The following are evidence requirements rather than code-only tasks:

1. A complete, provenance-recorded dataset for the selected research universe and period.
2. Zero unresolved data-quality failures.
3. Multiple walk-forward out-of-sample windows with no train/test overlap.
4. Optimization performed only inside training windows.
5. Parameter stability documented; no reliance on one isolated parameter combination.
6. All configured stress scenarios evaluated.
7. Bootstrap/Monte Carlo results recorded with deterministic seeds.
8. Paper trading run long enough to cover multiple market regimes and accepted against the same risk limits.
9. CI and security workflows green on the exact release commit.
10. No live-trading credentials are required by the dashboard or research pipeline.

If any evidence requirement fails, the system status must be **NOT VALIDATED**. It must never silently convert missing data, failed tests or unavailable providers into a passing result.

## Live-trading gate

Live trading remains disabled. Enabling live execution requires a separate, explicit authorization step after this gate, independent security review, key-management review, and successful paper-trading evidence. The dashboard is read-only and cannot bypass deterministic execution/risk controls.

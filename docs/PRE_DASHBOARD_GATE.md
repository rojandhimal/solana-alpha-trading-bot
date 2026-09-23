# Final pre-dashboard gate

Status: **NOT VALIDATED until CI evidence and research evidence are green on the exact release commit.**

This checklist is the authoritative release gate for starting the read-only dashboard.

## Engineering gates

- [x] Historical provider abstraction and schema validation
- [x] Historical data quality audit: duplicates, ordering, OHLC, volume, interval gaps, range coverage
- [x] Provider provenance/separation between DEX diagnostics and benchmark data
- [x] Deterministic baseline backtest
- [x] Walk-forward train/test separation and sequential OOS compounding
- [x] Stress scenarios for slippage, fees, liquidity, execution delay and volatility
- [x] Bootstrap confidence intervals and deterministic Monte Carlo trade-sequence analysis
- [x] Stateful paper-trading engine with ordered candles
- [x] Paper risk telemetry and exposure controls
- [x] Idempotent in-memory paper-trading persistence contract
- [x] Fail-closed paper/live configuration and signing-key separation
- [x] Security threat model
- [x] Dependency audit and secret-pattern CI checks

## Required evidence gates

These cannot be marked complete merely because code exists:

1. **Data evidence:** selected research dataset is complete, provenance-recorded, fresh for the experiment, and has zero unresolved quality failures.
2. **OOS evidence:** multiple non-overlapping walk-forward test windows exist; optimization uses training data only.
3. **Anti-overfit evidence:** parameter choices are stable across training windows and are not dependent on a single isolated combination.
4. **Stress evidence:** every configured stress scenario has a recorded result and the configured robustness thresholds pass.
5. **Statistical evidence:** bootstrap/Monte Carlo outputs are recorded with deterministic seeds and confidence intervals; results do not rely on a single favorable sequence.
6. **Paper evidence:** paper trading covers multiple market regimes, reconciles persisted events with the deterministic replay, and stays within configured risk limits.
7. **Security evidence:** dependency audit and secret checks are green on the exact release commit; no signing key is required by research/dashboard paths.
8. **CI evidence:** typecheck, tests and build are green on the exact release commit.
9. **Reproducibility:** the research runner produces machine-readable artifacts from pinned configuration and records provider/dataset provenance.
10. **Final status:** if any item above is missing, failed, stale, or unverifiable, release status is `NOT VALIDATED` and dashboard release is blocked.

## Explicit exclusions

- No live trading is enabled by this gate.
- No dashboard may turn a missing provider response into a passing result.
- No LLM may override deterministic risk or execution controls.
- No profitability claim is implied by passing engineering checks.

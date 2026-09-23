# Pre-dashboard readiness gate

This is the hard release gate before the read-only dashboard is started. It is an engineering and evidence gate, not a claim of profitability.

## Code controls

- [x] Historical OHLCV provider abstraction and strict schema/bounds validation.
- [x] Duplicate, ordering, OHLC, volume, interval-gap and requested-range coverage audit.
- [x] Explicit provider separation: DEX diagnostics vs CEX SOL benchmark.
- [x] Deterministic baseline backtest with fees/slippage/execution-delay modeling.
- [x] Walk-forward train/test windows with optimizer restricted to training data.
- [x] Sequential out-of-sample compounding and consistency metrics.
- [x] Stress scenarios for slippage, fees, liquidity, execution delay and volatility.
- [x] Explicit robustness thresholds and failure reasons.
- [x] Deterministic bootstrap confidence intervals and Monte Carlo trade-sequence analysis.
- [x] Stateful paper-trading engine with monotonic candle ordering and no-new-entry behavior after halt.
- [x] Paper exposure and drawdown controls.
- [x] Idempotent paper-trading persistence contract with conflict detection.
- [x] Fail-closed configuration: PAPER mode rejects signing keys; LIVE requires explicit enablement and a key.
- [x] Threat model covering prompt injection, data poisoning, key leakage, client bypass and CI compromise.
- [x] CI dependency/security checks and tracked-secret pattern checks.
- [x] CI typecheck, tests and build gates.
- [x] Machine-readable research artifacts.

## Evidence that must be green before dashboard release

The dashboard must not be treated as research-validated until one exact release commit has a successful evidence run proving all of the following:

1. **Data provenance:** dataset source, symbol/pool, interval, requested period and volume semantics are recorded.
2. **Data quality:** zero unresolved duplicate, ordering, malformed-OHLC, invalid-volume, unexpected-gap or coverage failures.
3. **Freshness:** live/paper ingestion rejects stale or out-of-order market data; historical research uses a fixed reproducible period.
4. **Execution invariants:** fills obey valid indices/prices/quantities; BUY/SELL accounting cannot create impossible exposure or bypass cash/short rules.
5. **Risk invariants:** position limits are enforced before opening exposure; drawdown halt prevents new exposure while permitting necessary reduction/closure.
6. **State/idempotency/reconciliation:** repeated persistence of the same sequence is a no-op; conflicting sequence data fails; replayed deterministic state reconciles to the same fills/equity.
7. **Walk-forward OOS:** multiple sequential windows exist, train/test ranges do not overlap, and OOS metrics are compounded rather than independently summed.
8. **Anti-overfitting:** optimization is train-only, with an inner validation/selection discipline and deterministic tie-breaking; the report documents parameter stability rather than relying on one optimum.
9. **Stress:** every configured scenario is executed and evaluated against explicit thresholds.
10. **Statistical robustness:** bootstrap intervals and seeded Monte Carlo results are generated and stored with the evidence artifact.
11. **Paper acceptance:** paper trading covers enough observations/regimes for the declared research period and passes the same risk invariants; no live credentials are needed.
12. **Security:** dependency audit, secret scan, fail-closed configuration tests and read-only CI permissions pass.
13. **Reproducibility:** the research runner produces a machine-readable report from a pinned dependency lockfile and deterministic configuration/seed values.
14. **CI:** typecheck, full tests, build, security and the required research evidence jobs are green on the exact release commit.

If any item is missing, failed, unavailable or only asserted by documentation, readiness is **NOT VALIDATED**. A provider outage or insufficient historical access must never be converted into a pass.

## Current provider limitation

The fixed 2025 DEX experiment requires historical coverage beyond the public GeckoTerminal window available at runtime. If the provider refuses that period, the DEX experiment remains a diagnostic failure and cannot be counted as evidence. A legitimate licensed historical source or another provider with the required coverage must supply the evidence dataset; no bypass or fabricated data is acceptable.

## Live-trading gate

Live execution remains disabled. Passing this pre-dashboard gate does not authorize live trading. Any later live-execution work requires separate security/key-management review, statistically meaningful paper-trading evidence, explicit human authorization, and a separate release gate. The dashboard remains read-only and cannot bypass deterministic risk/execution controls.

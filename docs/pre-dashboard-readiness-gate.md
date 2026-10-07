# Pre-dashboard Readiness Gate

This is a release-readiness contract, not a profitability claim. Dashboard implementation must not be declared ready until every mandatory item has objective evidence on the exact candidate commit.

## Mandatory gates

- [ ] Security controls: PAPER is the default; LIVE requires explicit enablement and a signing key; PAPER rejects signing keys.
- [ ] Secrets: no credentials/private keys in tracked source; environment examples contain placeholders only.
- [ ] Dependency/security checks: committed lockfile; production dependency audit clean at high/critical severity; CI security workflow green.
- [ ] Typecheck/tests/build: CI green on the exact candidate commit.
- [ ] Execution invariants: fills are valid; delay cannot create future or duplicate fills; deterministic replay is stable.
- [ ] Risk invariants: exposure and drawdown controls fail closed; halted state cannot open new exposure and can only reduce/close existing exposure.
- [ ] Paper state/idempotency/reconciliation: incremental state is deterministic; persistence is idempotent; conflicting sequence data is rejected; replay reconciliation is proven.
- [ ] Data quality/provenance/freshness: provider, market, range and interval are explicit; duplicates, ordering, malformed OHLCV, gaps and coverage are audited; stale/unavailable data is rejected rather than silently accepted.
- [ ] Walk-forward OOS: optimizer sees training data only; test windows remain frozen OOS; sequential OOS results are compounded.
- [ ] Anti-overfitting/parameter stability: optimizer has an inner train/validation split, minimum-trade guard and deterministic tie-break; parameter neighborhoods are evaluated without OOS leakage and stability is reported.
- [ ] Stress testing: BASE plus slippage, fees, liquidity, execution-delay and volatility shocks run through the canonical pipeline.
- [ ] Statistical/Monte Carlo robustness: bootstrap confidence intervals and deterministic Monte Carlo trade-sequence simulations are tested and included in the research report.
- [ ] Paper acceptance: deterministic replay, risk limits, state recovery/reconciliation and a minimum observation/acceptance policy are verified before live consideration.
- [ ] End-to-end research runner/report: one command emits immutable provenance, data quality, baseline/OOS, optimization, stress, statistical robustness, paper acceptance and gate status.
- [ ] Final readiness gate: every mandatory item is evidenced by tests, CI and artifacts; any missing evidence keeps the gate RED.

## Explicit non-goals

- Passing this gate does not prove profitability.
- Passing this gate does not authorize live trading.
- The public GeckoTerminal API cannot be used to fabricate unavailable long-history DEX data. A legitimate historical provider is required for future Raydium-specific long-history research.

## Required evidence

The exact candidate commit SHA, green CI run, green security audit and generated research artifact must be recorded. The gate must remain RED when any of those are missing.

# Pre-dashboard Readiness Gate

This gate must be satisfied before the dashboard is treated as ready. It is a release-readiness contract, not a claim of profitability.

## Mandatory gates

- [ ] Security controls: paper mode is default; live mode requires explicit enablement and signing key; paper mode rejects signing keys.
- [ ] Secrets: no credentials/private keys in tracked source; environment examples contain placeholders only.
- [ ] Dependency/security checks: lockfile is committed and production dependency audit is clean at high/critical severity.
- [ ] Typecheck/tests/build: CI green on the exact candidate commit.
- [ ] Execution invariants: no invalid fills; execution delay cannot create future/duplicate fills; deterministic replay is stable.
- [ ] Risk invariants: position exposure and drawdown controls fail closed; halted state cannot open new exposure and can only reduce/close existing exposure.
- [ ] Paper state/idempotency/reconciliation: incremental state is deterministic; persistence is idempotent; conflicting sequence data is rejected; replay can be reconciled.
- [ ] Data quality/provenance/freshness: source/range/interval are explicit; duplicates, ordering, malformed OHLCV, gaps and coverage are audited; stale/unavailable data is not silently accepted.
- [ ] Walk-forward OOS: optimizer sees training data only; test windows remain frozen OOS; OOS results are compounded sequentially.
- [ ] Anti-overfitting/parameter stability: optimization uses a train-only objective, has a minimum-trade guard, and reports parameter choices across windows; stability must be evaluated before claiming readiness.
- [ ] Stress testing: baseline plus slippage, fees, liquidity, delay and volatility shocks are evaluated through the canonical pipeline.
- [ ] Statistical/Monte Carlo robustness: bootstrap confidence intervals and deterministic Monte Carlo trade-sequence simulations are available and exercised by the research runner.
- [ ] Paper acceptance: deterministic replay, risk limits, state recovery and a defined minimum observation/acceptance policy are verified before live consideration.
- [ ] End-to-end research runner/report: one command produces machine-readable provenance, data-quality, baseline, OOS, optimization, stress and statistical results plus gate status.
- [ ] Final readiness gate: every mandatory item is evidenced by tests/CI/artifacts; any missing evidence keeps the gate RED.

## Explicit non-goals

- Passing this gate does not prove profitability.
- This gate does not authorize live trading.
- The public GeckoTerminal API cannot be used to fabricate unavailable long-history DEX data; a legitimate historical provider is required for any future Raydium-specific long-history experiment.

## Required evidence

The candidate commit, CI run, security audit and research artifact must be recorded with immutable identifiers. Dashboard work starts only after all mandatory checks are green.

# Pre-dashboard evidence record

This template is intentionally conservative. It is not a validation result until populated from a successful exact-commit evidence run.

## Release identity

- Commit SHA: `TBD`
- Evidence run timestamp (UTC): `TBD`
- Status: `NOT VALIDATED`

## Dataset provenance

- Provider: `TBD`
- Market/universe: `TBD`
- Period: `TBD`
- Interval: `TBD`
- Source/API version or endpoint: `TBD`
- Retrieval timestamp: `TBD`
- Dataset hash: `TBD`
- Bar count: `TBD`
- Quality audit: `TBD`

## Walk-forward evidence

- Training window: `TBD`
- Test window: `TBD`
- Step: `TBD`
- OOS window count: `TBD`
- Train/test overlap: `TBD`
- Optimization leakage check: `TBD`
- OOS metrics: `TBD`

## Parameter stability

- Parameter neighborhood definition: `TBD`
- Variants tested: `TBD`
- Acceptable variants: `TBD`
- Stability rate: `TBD`
- Result: `NOT VALIDATED`

## Stress and statistical robustness

- Stress scenarios evaluated: `TBD`
- Bootstrap confidence interval: `TBD`
- Monte Carlo simulations: `TBD`
- Deterministic seed(s): `TBD`
- Result: `NOT VALIDATED`

## Paper trading

- Session identifier: `TBD`
- Regimes covered: `TBD`
- Persisted fills/equity: `TBD`
- Replay deterministic: `TBD`
- Persistence idempotency/reconciliation: `TBD`
- Risk-limit enforcement: `TBD`
- Result: `NOT VALIDATED`

## Security and CI

- Production dependency audit: `TBD`
- Secret-pattern scan: `TBD`
- Typecheck: `TBD`
- Tests: `TBD`
- Build: `TBD`
- Exact release commit verified: `TBD`

## Gate decision

The gate is **COMPLETE** only when every evidence field above is backed by an actual successful run on the same commit. Missing data, provider limitations, failed checks, or unverifiable evidence must keep the status **NOT VALIDATED**.

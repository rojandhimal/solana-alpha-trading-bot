# Paper-trading acceptance criteria

Paper trading is accepted only when all criteria are evidenced by persisted, reproducible records.

1. Run the selected frozen strategy through the same execution and accounting model used by research.
2. Cover multiple market regimes rather than a single favorable period.
3. Persist every accepted fill and equity snapshot with a session id and monotonic sequence.
4. Replaying the same ordered market-data/event stream produces the same fills, equity and risk state.
5. Re-submitting an identical persistence event is a no-op; conflicting reuse of a sequence is rejected.
6. Drawdown and exposure limits are enforced before opening additional exposure; after a halt, only risk-reducing closes are permitted.
7. Stale, malformed, duplicated or out-of-order market data is rejected rather than treated as safe.
8. No private signing key is loaded or required in paper mode.
9. The paper run produces a machine-readable report containing configuration, data provenance, execution assumptions, risk outcomes and acceptance status.
10. Any failed, missing or unverifiable criterion leaves the status `NOT VALIDATED`.

These criteria are research/paper-trading gates only and do not authorize live trading.

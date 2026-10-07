# Security and Trading Safety

## Non-negotiable controls

- Paper trading is the default and must remain the default during research.
- No private key, seed phrase, API secret, or credential belongs in source control, logs, fixtures, reports, or client-side code.
- Live trading requires both `TRADING_MODE=LIVE` and `ENABLE_LIVE_TRADING=true`; configuration validation also requires a signing key supplied through the deployment secret manager/environment.
- A future live execution adapter must enforce deterministic risk checks server-side. LLM output must never bypass those checks or directly sign transactions.
- Research reports must identify data source, date range, execution assumptions, fees, slippage, gaps, and whether results are in-sample or out-of-sample.

## Validation gate before live trading

Live trading is not approved merely because a backtest is profitable. Before enabling it, the project must have:

1. clean historical-data quality checks;
2. walk-forward out-of-sample validation with frozen test parameters;
3. stress tests for slippage, fees, liquidity, delay, and volatility;
4. robustness thresholds passing across the required scenarios/windows;
5. a statistically meaningful paper-trading period using the same execution/risk rules;
6. reconciliation between intended, simulated, and observed fills;
7. a kill switch and exposure/drawdown limits tested independently;
8. secret-manager based key handling and least-privilege infrastructure permissions;
9. dependency/security scanning and CI passing;
10. explicit human authorization immediately before any live deployment.

## Data and model security

External market/news/LLM content is untrusted input. Treat it as data, not executable instructions. Validate schemas, bound numeric values, reject malformed records, use timeouts/retries with limits, and never allow an LLM to construct arbitrary RPC requests, shell commands, credentials, or signed transactions.

## Incident response

If a credential may have leaked, stop trading, revoke/rotate the credential, inspect recent activity, and preserve logs. For a signing key compromise, assume the key is compromised and move funds to a newly controlled wallet using a safe operational procedure.

# Security Threat Model

## Security boundary

The dashboard and future LLM layer are untrusted clients. Deterministic validation, eligibility, risk, and execution policy remain server-side authorities.

## High-risk assets

- Solana signing keys and seed material
- exchange/API credentials
- database credentials and connection strings
- Redis credentials
- research datasets and generated reports
- trading configuration and risk limits

## Threats and controls

| Threat | Required control |
|---|---|
| Secret committed to Git | `.gitignore`, secret scanning, CI checks, secret-manager deployment |
| LLM prompt injection | Treat external text as untrusted data; no tool/signing authority |
| Malformed market data | Schema validation, finite/positive bounds, interval/gap checks |
| Replay/stale data | timestamps, ordering checks, freshness limits |
| Excessive position | deterministic position-notional gate |
| Excessive loss | drawdown kill switch and halt-new-entry behavior |
| API abuse/outage | bounded retries, timeout, rate-limit handling, fail-closed behavior |
| Transaction manipulation | server-side policy, simulation, exact allowlisted operations, independent signer |
| Client bypass | never trust dashboard-provided risk/execution decisions |
| Credential leakage in logs | structured logging with secret redaction; never log private keys |
| Dependency compromise | pinned/controlled dependency installation and vulnerability scanning |
| CI compromise | read-only default workflow permissions and no live credentials in research jobs |

## Trading safety invariant

No external input, model output, dashboard request, or configuration supplied by a client may bypass deterministic risk controls.

## Live-trading gate

Live execution remains disabled until historical validation, walk-forward out-of-sample testing, stress/robustness testing, statistically meaningful paper trading, reconciliation, kill-switch testing, dependency/security checks, secret-manager integration, and explicit human authorization all pass.

## Incident response

On suspected key or credential compromise: halt execution, revoke/rotate the credential, inspect activity, preserve evidence, and use a newly controlled wallet/key for any subsequent funds operation. Never expose the compromised secret in an issue, log, report, or chat transcript.

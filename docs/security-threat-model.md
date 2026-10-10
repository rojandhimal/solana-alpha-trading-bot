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


## Security acceptance evidence for this phase

PAPER default/key-rejection tests, malformed input rejection, deterministic entry veto/halt/closure tests, storage-failure latch/recovery tests, and tracked-file secret scan must pass. Full dependency audit includes development tools at high/critical severity. Research workflows use read-only contents permission and no signing credentials. Reports preserve failures without raw provider response bodies. See the dated audit for actual results rather than inferring PASS from these controls.

The file journal requires a single process owner. On storage failure, keep the session halted, restore storage, inspect the atomic journal, verify deterministic replay and explicitly recover. Never reset a halt to resume new exposure automatically. Reports/datasets may contain untrusted provider data; they do not grant strategy, wallet or execution authority.


## Queue, hourly ingestion and recovery controls — 11 October 2026

Queued journal records are copied before storage waits. Realtime bars require completed UTC hours with opening timestamps no more than two hours old; freshness is rechecked after queue delay. Exact durable retries are idempotent even after age expiry.

Valid operator halt requests gate unstarted candle processing immediately and report halted risk while persistence is pending. Await the HALT promise for durability. A write already in progress can finish its earlier accepted event. After known storage failure, verified replay may recover a prefix without an unpersisted halt; explicitly persist a recovery HALT before feeding new observations. The [paper recovery contract](paper-session-recovery.md) records these semantics and the single-owner limit. These controls do not establish elapsed paper acceptance or broker-side cancellation.

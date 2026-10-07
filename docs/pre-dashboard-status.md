# Pre-dashboard Verification Status

**Status: RED — not ready for dashboard.**

The mandatory readiness gate is intentionally not marked complete until the exact candidate commit has green typecheck, tests, build, dependency/security checks, and a reproducible end-to-end research artifact with immutable evidence.

Current verified blockers:

1. CI run `34699211647` for commit `6a38b344854ea341c96770b3acce19ae1c671ba8` failed during TypeScript typecheck. The failure was caused by `exactOptionalPropertyTypes` in paper-trading accounting calls. This was fixed in a later commit, but that later candidate must receive a fresh green CI run before the gate can be considered verified.
2. The repository has a committed `package-lock.json`, but the security workflow's production dependency audit must be green on the candidate commit. The prior CI install reported 5 vulnerabilities (3 moderate, 1 high, 1 critical); this is not sufficient evidence of a clean high/critical audit.
3. The committed readiness contract requires execution/risk invariants, paper-state idempotency/reconciliation, data provenance/freshness, anti-overfitting/parameter stability, stress testing, statistical/Monte Carlo reporting, paper acceptance criteria, and a single end-to-end research report. Presence of individual modules/tests is not by itself evidence that every mandatory gate is integrated and verified.
4. The Binance benchmark currently emits baseline/optimized OOS summaries but does not yet emit the full mandatory statistical, provenance, acceptance, and final-gate evidence contract described in `docs/pre-dashboard-readiness-gate.md`.
5. The public GeckoTerminal API is not a valid source for the full 2025 DEX experiment under current public-history limits; the gate therefore cannot claim Raydium-specific long-history validation from that endpoint.

Dashboard work must not begin while this document remains RED.

# Current pre-dashboard verification status

**NOT VALIDATED — dashboard development may not begin.**

The previous GREEN engineering declaration and permission to begin a read-only dashboard were not supported by complete current evidence. They are superseded by the [audit updated 11 October 2026](pre-dashboard-audit-2026-10-10.md) and [machine-readable gate](pre-dashboard-readiness.json).

Verified software checks pass on d1d4a90 (61 files / 296 tests), but strategy OOS, parameter stability, stress and statistical acceptance fail. The 2025 Solana DEX dataset and elapsed realtime paper acceptance remain blocked. Binance SOLUSDT is a CEX benchmark, not DEX execution evidence. No live trading is enabled.

See the audit for exact commits, actual checks, CI run links, measurements, scope limits and concrete resolution steps. Do not infer readiness from existing modules or old green workflow runs.

Historical conversion now preserves volume. Earlier optimized return -3.8143% is superseded by the corrected frozen OHLCV result **-4.3722%** with unchanged data, configuration and thresholds. Both journals retain the correction and original artifacts.

Free recent DEX research now supplies 3,672 valid hourly May–September 2026 Raydium pool bars. Optimized OOS return is -0.333875%; two complete windows and failed stability/stress/statistical acceptance prevent validation. This supplemental period cannot satisfy the required 2025 gate. SQD raw 2025 pool records are a verified reconstruction candidate; complete candles remain unvalidated. See [free data sources](free-data-sources.md).

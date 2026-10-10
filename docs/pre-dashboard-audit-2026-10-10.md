# Pre-dashboard audit — 10 October 2026

**Overall readiness: NOT VALIDATED. Dashboard development may not begin.**

Software verification and strategy acceptance are separate. Verified engineering checks pass; real strategy evidence fails, required DEX history and elapsed paper acceptance are blocked. This is not a profitability claim or authorization for live trading.

Branch: `feature/walk-forward-integration`. Initial HEAD: `8d2d661`. Verified implementation/evidence commit: `514888c2edff2531f49768a82e3f4db4cb75fe6b`. Later documentation or test commits require their own exact-commit CI; this report does not manufacture that evidence.

## Initial failures and fixes

- The empty workspace was populated by cloning the requested branch without overwriting existing work.
- Initial typecheck/test/build could not run: a skeletal lockfile installed no compiler/test runner. Rebuilt lockfile; clean `npm ci --include=dev --ignore-scripts` verified.
- Initial full audit found critical Vitest advisories. Upgraded to patched 4.1.11, verified compatibility, removed vulnerable test-runner reinstalls from CI, and audited development dependencies too.
- Initial Evidence run 37999809445 failed on GeckoTerminal HTTP 401 and Binance report ENOENT. Reports now create directories, preserve failure artifacts and return nonzero rather than disguising failed evidence.
- Corrected short entry fees, fee/price/fill validation, long/short reversals, cumulative entries in FIFO attribution, and aggregate breakeven trade metrics.
- Removed same-bar/open look-ahead; delayed positions change when fills arrive. OOS sizing follows actual sequential capital; terminal liquidation charges modeled costs.
- Stress scenarios re-execute canonical strategy fills on delayed bars with changed costs; they no longer merely adjust completed-trade prices in strategy research.
- Batch paper sessions now use enforcing incremental state. Entry risk checks use opening prices, halt remains latched, reductions/closures remain possible, and rejected/malformed input cannot mutate accepted state.
- Added a minimal atomic file event journal, deterministic restart/replay, configuration identity, sequence/event idempotency, conflict/tamper checks and fail-closed storage handling.
- Hardened provider retries/timeouts/rate-limit waiting, query/numeric validation and conflicting duplicates. Corrected DEX Screener's documented bare-array response contract (https://docs.dexscreener.com/api/reference).
- Added release/lock/dataset identities, cached dataset replay, per-window parameters, training-neighborhood stability, concentration, bootstrap/permutation uncertainty, explicit incomplete states and comparable passive OOS benchmark to reports.

## Checks actually run

Local: clean npm installation, TypeScript typecheck, 51 source test files / 203 tests, build, tracked-file secret-pattern scan and `git diff --check` passed. Compiled duplicate test copies are excluded.

On implementation commit 514888c, [CI](https://github.com/rojandhimal/solana-alpha-trading-bot/actions/runs/38020601352), [Validation](https://github.com/rojandhimal/solana-alpha-trading-bot/actions/runs/38020601339), and [Security](https://github.com/rojandhimal/solana-alpha-trading-bot/actions/runs/38020601403) passed. CI included 201 tests; two further exposure/halt regressions subsequently passed locally. The full dependency audit and secret check passed in CI. Local final audit attempts hit registry/socket/DNS errors and are not claimed as successful.

[Pre-dashboard Evidence](https://github.com/rojandhimal/solana-alpha-trading-bot/actions/runs/38020601359) and [Historical Research](https://github.com/rojandhimal/solana-alpha-trading-bot/actions/runs/38020601361) correctly failed research acceptance. Provider failures and strategy losses were not converted to passes.

## Readiness checklist

PASS requires actual verification; FAIL means required acceptance failed; BLOCKED names an external/evidence dependency; NOT RUN means no verification occurred. The machine-readable equivalent is `docs/pre-dashboard-readiness.json`.

| # | Required gate | State | Evidence |
| --- | --- | --- | --- |
| 1 | Security configuration and secret handling | **PASS** | PAPER defaults/key rejection tests; tracked-file scan; read-only research workflows. No signer or live broker connected. |
| 2 | Dependency vulnerability audit | **PASS** | Full dependency high/critical audit passed in Security and Evidence CI on 514888c; local final registry attempts failed on network access. |
| 3 | Typecheck, tests and build | **PASS** | Local: typecheck, 51 files / 203 tests, build. CI/Validation on 514888c passed with 201 tests; two additional risk regressions passed locally. |
| 4 | Historical data quality and provenance | **BLOCKED** | Binance CEX dataset PASS: 8760 hourly bars for 2025, no quality errors, SHA-256 recorded. Required Solana DEX dataset unavailable: GeckoTerminal HTTP 401. |
| 5 | Backtesting accounting correctness | **PASS** | Fee, short/long, reversal, invalid-fill, equity reconciliation regressions; empirical optimized closed-trade PnL reconciles with OOS equity to floating-point tolerance. |
| 6 | No look-ahead leakage | **PASS** | Completed-candle signals execute at next open; pending positions update only on execution; every delayed prefix matches replay. Opening risk checks use opening prices. |
| 7 | Walk-forward validation | **FAIL** | Train-only selection and nine sequential OOS windows verified; observed optimized CEX OOS -3.8143%, zero profitable windows and negative expectancy fail acceptance. |
| 8 | Optimizer anti-overfitting | **PASS** | Inner split, minimum fit/validation trades, drawdown objective, bounded grid, deterministic selection and duplicate-neighborhood guard verified. No profitability implication. |
| 9 | Parameter stability | **FAIL** | All nine training-neighborhood checks failed stability on the real CEX dataset. |
| 10 | Stress testing | **FAIL** | All six configured scenarios executed through canonical fills/accounting; one or more OOS stress windows fail configured acceptance. |
| 11 | Statistical robustness | **FAIL** | Seeded bootstrap and fixed-PnL permutation calculations verified; mean-window 95% CI [-0.5578%, -0.2970%] fails positive-lower-bound acceptance. |
| 12 | Stateful paper-trading correctness | **PASS** | Incremental/full replay, delayed fills, OHLC/timestamp validation, immutable configuration/state and batch enforcement regressions passed. |
| 13 | Risk enforcement and halt behavior | **PASS** | Actual entry veto, drawdown timing, persistent kill switch, closure after halt, no reversal/new exposure and storage-failure latch verified. |
| 14 | Persistence, replay and idempotency | **PASS** | Atomic file journal, file/directory sync, contiguous sequences, duplicate/conflict handling, configuration identity, restart reconciliation, corrupt snapshots and storage failure tests passed. Single writer only. |
| 15 | Reproducible end-to-end research report | **PASS** | Real CEX report and frozen dataset produced; cached replay matches calculations; failed acceptance returns exit 1; DEX failure artifact preserved. Required paper evidence remains explicitly missing. |
| 16 | CI reliability | **PASS** | CI, Validation, Security passed on 514888c. Research/Evidence workflows remain correctly red for provider/strategy failures and preserve artifacts. Later commits require their own CI results. |
| 17 | Required paper-trading acceptance evidence | **BLOCKED** | No elapsed realtime session, frozen duration/regime policy, or accepted strategy exists. Historical replay and synthetic regression tests cannot satisfy this gate. |

## Measured CEX experiment

The downloaded CI dataset has 8,760 hourly SOLUSDT bars from 2025-01-01 00:00 UTC through 2025-12-31 23:00 UTC, with zero gaps, duplicates, ordering, OHLC or volume errors. Dataset SHA-256: `646e59f40645ff57ff382d903682d1732b35f9dbdb5c7463f0e4f1feafe48009`.

Nine 30-day OOS windows cover 6,480 bars after 2,160 training bars. The last 120 bars form an incomplete test window and are excluded. Windows liquidate at their final close with modeled fees/slippage. Benchmark sizing begins at one SOL for $10,000 equity and scales with realized prior-window capital.

| Result | Baseline strategy | Optimized strategy | Comparable passive SOL |
| --- | ---: | ---: | ---: |
| OOS return | -3.5567% | -3.8143% | -0.0866% |
| Max drawdown | 3.6414% | 3.9301% | 1.3557% |
| Completed trades | 574 | 637 | 9 |

Optimized profit factor is approximately 0.60 and expectancy is negative. All nine windows lose money; all training-neighborhood stability checks fail. Mean-window bootstrap 95% interval is approximately [-0.5578%, -0.2970%]. Fixed-PnL permutations preserve terminal profit by definition and only test ordering sensitivity: the 95th-percentile drawdown is approximately 4.3373%. They are not a forecast confidence interval.

These results are Binance CEX research only. Modeled liquidity/volatility shocks alter costs, not measured Solana pool capacity or future price regimes. OOS results have now been inspected: changes intended to improve strategy performance require fresh holdout evaluation and multiple-testing disclosure, not repeated tuning of the same 2025 OOS data.

## Concrete blockers and resolution

1. **2025 DEX history — BLOCKED:** GeckoTerminal public API returns HTTP 401 for data outside its public window. Supply a legitimate complete pool dataset or separately authorize provider access. Validate provenance/range/quality before rerunning; never fabricate or patch prices silently. Birdeye access has not been attempted without credentials.
2. **Strategy acceptance — FAIL:** Training stability, OOS performance, stress and statistical gates fail. Revisit strategy hypotheses using training data, retain the failed reports, and evaluate changes on a fresh untouched period. Do not lower thresholds to turn losses into success.
3. **Elapsed paper acceptance — BLOCKED / NOT RUN:** Freeze a duration/regime/observation policy and selected strategy before a real-time paper session. Use `appendRealtime` for freshness enforcement and persist every event. Historical replay does not count as elapsed operation. Any production-scale paper deployment needs separately supplied runtime/provider access; no live credentials are needed.
4. **Exact later-commit evidence:** Check Actions on the final branch HEAD; older green workflows do not prove a later commit green. Required research workflows must stay red until the blockers above are genuinely resolved.

## Reproduction and operational limits

After `npm ci --include=dev --ignore-scripts` and `npm run build`, `npm run research:solana:binance` fetches public benchmark data and writes the report plus `.dataset.json`. For an exact replay, set `SOL_DATASET_FILE` to the frozen dataset path and `SOL_BINANCE_EXPERIMENT_OUTPUT` to a new report path. Hash, provider, identity, query and volume semantics are checked. A failed strategy returns exit code 1 while preserving the report. Data/report files are local artifacts (ignored by Git) and uploaded by CI.

Use one process/owner per file journal. Files contain paper data, no wallet signing material. Atomic replacement, file/directory sync, replay verification and a storage-failure latch prevent false success. If storage fails, the session halts and requires explicit recovery from the verified journal; durability cannot be claimed while the storage device is unavailable. Multi-process file locking and a production service are outside this minimal research implementation.

The discovery/scanner and in-memory repository remain available. The event-journal session is the persistence authority for restartable paper sessions. No dashboard code, broker connection, signer, live trading, paid provider subscription or deployment was added.

## Implementation commits

- `ed82dfb` — reproducible lockfile, patched test runner, CI installation/audit.
- `fdb9e43` — accounting, causal execution, sequential OOS, enforcing paper state and journal.
- `54cf242` — provider validation, bounded requests, discovery contract, logging/secret checks.
- `0c727cd` — reproducible datasets and failure reports.
- `721453a` — storage-failure latch, distinct stability candidates and evidence states.
- `c59ce6b` — release/lock metadata correction and regression.
- `514888c` — comparable OOS benchmark and cached end-to-end replay verification.
- `4c02a90` — actual entry-veto and closing-after-halt regression coverage.

Dashboard decision: **DO NOT BEGIN**. Live execution remains disabled and requires a separate authorization gate regardless of future dashboard readiness.

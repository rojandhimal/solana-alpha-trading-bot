# Solana Alpha Trading Bot — Research and Engineering Journal

**Project:** Solana Alpha Trading Bot  
**Repository:** https://github.com/rojandhimal/solana-alpha-trading-bot  
**Purpose:** Publication-oriented record of research questions, engineering changes, algorithm design, experiments, validation evidence, limitations, and decisions.  
**Status at last entry:** Software checks pass on c1f8863; research acceptance is FAIL and required evidence is BLOCKED. The overall pre-dashboard gate is OPEN / NOT PASSED. Implementation progress is not evidence of profitability. Live trading remains disabled.

> **Record-keeping rule:** Distinguish implemented, tested locally, passed in CI, observed from a real data run, and planned. Never report performance metrics unless the exact dataset, code revision, configuration, and output artifact are retained. Failed or inconclusive experiments remain in the journal.

## 1. Research objective and questions

The project is developing a research-grade Solana market-analysis and paper-trading system. The near-term objective is to determine whether a transparent, rule-based alpha strategy has defensible out-of-sample performance after transaction costs and adverse execution assumptions. A successful build or backtest alone does not establish future profitability.

Primary questions:
1. Does the baseline strategy produce positive and sufficiently stable out-of-sample expectancy after modeled fees and slippage?
2. Does walk-forward optimization improve performance over a fixed baseline without leaking test data into parameter selection?
3. Are results robust to worse fees, slippage, liquidity, execution delay, and volatility?
4. How sensitive are outcomes to parameter choices, market regimes, trade ordering, and sample uncertainty?
5. Can paper trading enforce risk limits, preserve an auditable event history, and replay deterministically?
6. Is the data sufficiently complete, correctly timestamped, and traceable to a named provider?
7. Does the repository pass type checks, tests, builds, secret checks, and dependency-security checks?

## 2. Scope and safety boundaries

- Current mode: paper/research only.
- Live execution is intentionally disabled; no live-trading readiness claim is made.
- Paper mode must reject private-key configuration. Secrets must not be committed or written to logs.
- Future Claude/LLM features may summarize evidence or assist research. They must not receive signing keys, directly sign transactions, or bypass deterministic risk and execution controls.
- Provider responses, token metadata, and model outputs are untrusted until schema-validated and checked for freshness and plausibility.
- Failed runs, unavailable providers, weak performance, and incomplete evidence must be reported rather than hidden or replaced with fabricated data.

## 3. System architecture and rationale

The design separates research data from production-oriented discovery and execution concerns.

- Historical market-data adapters provide a common OHLCV contract with validation, pagination, retry limits, timeout handling, range filtering, and timestamp normalization.
- Provider adapters have distinct purposes: Birdeye, GeckoTerminal, and Binance are not interchangeable.
- Data-quality audit checks duplicates, ordering, malformed OHLC, volume, expected interval gaps, and requested-range coverage.
- The shared backtesting core composes strategy signals, execution-cost simulation, portfolio accounting, trade attribution, performance metrics, stress scenarios, and robustness reporting.
- The walk-forward runner separates training and out-of-sample test windows. The optimizer receives only training data and the selected configuration is evaluated on the following test window.
- The paper-trading core provides stateful candle ingestion, simulated fills, accounting snapshots, risk telemetry, and persistence contracts. It is not connected to a broker or wallet.
- Configuration defaults to paper mode and fails closed when live-related settings are inconsistent.
- CI is intended to cover typecheck, tests, build, historical research jobs, dependency audit, and secret-pattern checks.
- The dashboard is deferred until the pre-dashboard acceptance gate has evidence for the foundations above.

## 4. Algorithm methodology

### 4.1 Baseline signal

The implemented alpha strategy is a transparent technical-signal score combining fast and slow exponential moving averages (trend), relative strength index (oscillator), price momentum over a configured lookback, average true range (volatility context), and current volume relative to a rolling volume baseline. A configurable score threshold maps the combined evidence to LONG, SHORT, or FLAT.

Exact formula-level coefficients and boundary behavior must be taken from the source at the recorded commit, not inferred from this summary.

### 4.2 Execution and costs

The execution model uses a reference candle open, supports configurable execution delay in bars, applies adverse slippage according to volatility and liquidity multipliers, and charges a fee as a percentage of notional. A requested fill is skipped when the delayed execution candle is unavailable. These are simplifying simulation assumptions; they do not guarantee real DEX orders could fill at the modeled price or size.

### 4.3 Portfolio accounting and metrics

The shared accounting engine tracks cash, position quantity, average entry/cost basis, realized P&L, fees, equity by candle, completed trades, and drawdown. Short positions are optional. Performance analysis includes total return, drawdown, trade count, profit factor, expectancy, and out-of-sample window aggregation. Metrics must be interpreted in light of candle-level assumptions and the absence of actual order-book/on-chain execution evidence.

### 4.4 Walk-forward optimization

The current research configuration uses hourly SOL candles with nominal 90-day training windows, 30-day testing windows, and 30-day steps. Candidate parameters are searched on training data only; the selected configuration is frozen for the following test window. The fixed-parameter baseline is compared with the optimized approach.

The optimizer searches fast EMA, slow EMA, RSI, momentum, ATR, and volume lookbacks, plus entry threshold. Its scoring function combines return, bounded profit factor, expectancy, drawdown penalty, and a trade-count term. This introduces model-selection risk. The canonical report now uses nested train/validation selection, deterministic tie-breaking and training-only parameter stability. Minimum trade counts and a bounded grid are enforced. These implementation checks do not remove multiple-testing or regime-shift risk.

### 4.5 Stress and statistical robustness

Configured stress scenarios include base execution, higher slippage, higher fees, liquidity shock, execution delay, and volatility shock. Robustness thresholds are intended to reject excessive drawdown, weak profit factor/expectancy, and insufficient scenario pass rate. Statistical/Monte Carlo robustness code has been added to the repository, but results must be tied to a completed experiment artifact and validated tests before any acceptance claim is made.

### 4.6 Risk controls

The stateful paper-trading component validates candle fields and timestamp ordering, tracks drawdown and exposure, and is designed to stop opening additional exposure after a risk halt while permitting risk-reducing exits. The batch paper session now replays through the same enforcing state as incremental ingestion. Entry vetoes, delayed fills, persistent halt and safe closing have verified regressions; this remains a candle simulation, not a broker-enforced kill switch or elapsed paper acceptance record.

## 5. Data sources, provenance, and limitations

| Source | Intended role | Important limitation |
|---|---|---|
| Birdeye | DEX/on-chain market-data adapter | API plan, quota, coverage, and schema changes can constrain data |
| GeckoTerminal | DEX pool OHLCV diagnostics | Public historical endpoint was observed to restrict data older than 180 days; longer history may require an eligible paid plan |
| Binance SOLUSDT | CEX benchmark and long-history research path | CEX prices/volume are not equivalent to a Solana DEX pool or executable DEX fills |
| DexScreener | Token/pair discovery and market metadata | Discovery metadata is not a substitute for validated historical bars |
| Solana RPC | On-chain reads for future operational use | RPC availability/rate limits and transaction-state interpretation require dedicated handling |

Bars should retain provider identity, symbol/pool identity, interval, requested and actual range, retrieval time, and data-quality report. A benchmark must not be silently relabeled as DEX data.

## 6. Dated engineering and research log

### Entry 2026-09-04 — Research direction

**Goal:** Investigate a Kalshi/AI trading-bot idea and Claude-assisted research.  
**Decision:** This journal focuses on the subsequent Solana alpha-trading-bot repository and its paper-trading/research path. Any exchange-specific prediction-market work is outside the current validation claims.

### Entry 2026-09-12 — Historical data, backtest, and walk-forward foundations

**Implemented in repository, according to source and commit history:**
- Historical OHLCV source abstraction and provider adapters with schema checks, range filtering, pagination, retry/timeout behavior, and sorting/deduplication.
- Historical-data quality audit and strict range-coverage assertions.
- Shared backtest pipeline for strategy fills, accounting, attribution, metrics, stress testing, and robustness evaluation.
- Walk-forward window creation and out-of-sample aggregation; optimizer is supplied only the training slice.
- SOL 2025 experiment configuration with hourly bars, 90-day training / 30-day test / 30-day step, fixed baseline parameters, stress scenarios, and acceptance thresholds.
- Binance SOLUSDT benchmark runner and GeckoTerminal DEX diagnostic runner.
- Paper-trading batch session and stateful paper-trading state, with candle validation and risk telemetry.
- Configuration hardening: paper mode is default; live mode requires explicit enablement and a key; paper mode rejects private-key configuration.
- Security threat model and secret/dependency workflow.
- Statistical robustness module export and pre-dashboard readiness documentation.

**Data/provider finding:** The GeckoTerminal public API was observed to reject historical OHLCV requests older than 180 days unless using an eligible paid plan. This is a provider-access limitation; do not bypass access controls or manufacture data. Binance provides an alternative CEX benchmark but does not validate DEX execution.

**Validation evidence and failures:**
- A previous CI run failed during Node setup because actions/setup-node was configured to use npm caching but the repository had no committed lockfile. The workflow was changed to remove that cache dependency.
- A subsequent CI run reached typechecking and failed because exactOptionalPropertyTypes disallowed passing allowShort: undefined to portfolio accounting. The implementation was corrected to omit the property when undefined.
- An earlier test failure was traced to an incorrect Binance pagination cursor expectation; the expected next startTime was corrected to the next hourly bar.
- Dependency installation reported 5 vulnerabilities (3 moderate, 1 high, 1 critical) at that time. This requires a real audit/remediation; do not lower the audit threshold to obtain a green result.
- A historical benchmark run was previously blocked by HTTP 451 for Binance access from the CI environment. This is an environment/provider restriction, not a strategy result.

**Status:** These notes do not establish that the current branch passes CI or that a full-year experiment produced valid performance results. Those claims remain unverified until the current head's jobs and retained artifacts are inspected.

### Entry 2026-10-10 — Publication journal and current pre-dashboard gate

**User direction:** Continue work autonomously, prioritize security, complete every pre-dashboard requirement, and maintain a journal suitable for publication at project completion.

**Action:** Established this research journal as the canonical record, with methodology, architecture, data provenance, known failures, limitations, and an evidence-first reporting policy.

**Outstanding work (do not mark complete without evidence):**
1. Inspect current branch head and latest CI/security workflow results; fix typecheck, test, build, dependency, secret-scanning, and workflow failures.
2. Confirm paper-state invariants: no duplicate fills across incremental updates, correct delayed execution, no new exposure after halt, risk-reducing exits remain possible, and exposure caps are enforced before entry.
3. Verify event identity, idempotent persistence/replay, reconciliation, and deterministic repeated-run outputs.
4. Review optimizer leakage, tie-breaking, inner validation, parameter stability, and sensitivity to candidate-grid size.
5. Validate Monte Carlo/bootstrap implementation and report assumptions, seeds, sample sizes, confidence intervals, and limitations.
6. Complete a reproducible end-to-end experiment using a legally accessible dataset; retain source metadata, exact configuration, code revision, quality report, and machine-readable result.
7. Review execution realism: fee/slippage assumptions, position sizing, delayed fills, unavailable fills, candle timing, and distinction between CEX benchmark and DEX execution.
8. Run stress and walk-forward acceptance checks; if evidence fails or is insufficient, keep acceptance status FAIL/INCONCLUSIVE.
9. Resolve production dependency vulnerabilities with a reviewed, reproducible dependency graph and lockfile; retain security audit output.
10. Update README and research documentation to match verified state; only then decide whether the pre-dashboard gate is passed.

**Outcome:** Journal established. Pre-dashboard gate remains OPEN / NOT PASSED. No profitability conclusion is made. No dashboard or live execution is authorized by this entry.

## 7. Experiment record template

Use one copy for every material research run. Never overwrite a failed run; append a new record and link the prior artifact.

### Experiment [ID] — [short title]
- Run date/time (UTC):
- Code commit SHA:
- Run command / workflow URL:
- Research hypothesis:
- Provider, venue, symbol/pool, interval:
- Dataset range and bar count:
- Dataset artifact/checksum:
- Quality report: duplicates, ordering, invalid bars, gaps, coverage
- Train/test boundaries and walk-forward window count:
- Strategy and parameter configuration:
- Execution assumptions: fee, slippage, delay, liquidity, sizing
- Baseline result: return, max drawdown, trade count, profit factor, expectancy
- Optimized out-of-sample result:
- Per-window results and consistency:
- Stress scenario results:
- Monte Carlo/bootstrap method, seed, repetitions, interval estimates:
- Acceptance checks and thresholds:
- Outcome: PASS / FAIL / INCONCLUSIVE
- Interpretation, including negative evidence:
- Threats to validity / confounders:
- Artifact links and reproducibility instructions:
- Next action:

## 8. Publication checklist

Before converting this journal into a paper, technical report, or public project article:

- State the research question and contribution precisely; distinguish an engineering platform from a novel trading strategy.
- Cite strategy definitions, statistical methods, provider documentation, and market microstructure assumptions.
- Record exact code commit, package versions, configuration, dataset provenance, retrieval date, and license/terms.
- Describe selection bias, look-ahead bias controls, survivorship/token-selection bias, regime dependence, multiple testing, and data snooping.
- Report all predeclared metrics and failed/inconclusive runs, not only the best-performing configuration.
- Include per-window out-of-sample results, cost sensitivity, stress results, uncertainty intervals, and reproducibility instructions.
- Clearly separate CEX benchmark results from DEX-specific claims.
- State that historical simulation and paper trading do not guarantee future returns; do not present results as investment advice.
- Do not claim the system is production-safe or profitable unless corresponding evidence exists.
- Remove secrets, private account details, and sensitive infrastructure identifiers from publication artifacts.

## 9. Decision log

| Decision | Rationale | Revisit condition |
|---|---|---|
| Keep live trading disabled | Prevents unvalidated code from risking funds | Only after formal validation, security review, and explicit human authorization |
| Use one shared backtest pipeline | Avoids inconsistent accounting/metrics between experiments | Revisit only if tests show a necessary separation |
| Treat Binance as a benchmark, not DEX truth | Venue microstructure and prices differ | When a validated, authorized DEX historical source is available |
| Fail closed on incomplete/poor-quality data | Prevents false confidence from partial history | Never bypass; improve provider/coverage instead |
| Delay dashboard until gate is evidenced | UI must display verified status rather than imply readiness | After all gate checks are backed by reproducible evidence |

## 10. Ongoing update protocol

At each meaningful implementation session:
1. Inspect repository head and existing journal before editing.
2. Append a dated entry describing changes and exact files/commit.
3. Record tests actually run, CI run IDs and conclusions, and any failures.
4. Attach or link machine-readable experiment artifacts; do not copy unsupported performance claims into prose.
5. Update the outstanding-work list, marking an item complete only with verifiable evidence.
6. Keep the pre-dashboard gate open until all mandatory checks pass; report blockers explicitly.


### Entry 2026-10-10 — CI verification follow-up

**Evidence checked:** GitHub Actions run 34699211647 (workflow job “quality”, associated with commit 6a38b344854ea341c96770b3acce19ae1c671ba8) completed successfully. The recorded steps for setup, dependency installation, typecheck, tests, and build all show success. This confirms the quality job for that specific commit, not for every later commit and not the separate dependency-audit/security workflow.

**Interpretation:** The exact-optional-property type errors recorded above were corrected sufficiently for that quality job to pass. The journal-only commit that created this document has no combined commit status yet. A green quality job does not resolve previously reported npm audit vulnerabilities, prove a successful full-year historical experiment, or pass the overall pre-dashboard gate.

**Still required:** Verify the current branch head's latest workflow outcomes; obtain the actual security/dependency-audit result; run or retrieve an end-to-end experiment artifact; complete the paper-state and idempotency tests; and document actual statistical robustness outputs. Keep the gate OPEN until all required evidence is present.


### Entry 2026-10-10 — Statistical robustness input validation

**Code changes:** Commit e7137f32aef41bd70a00a1ed8f440f710fe73c41 hardened packages/backtesting/src/statistical-robustness.ts. Both bootstrap confidence-interval and Monte Carlo trade-sequence functions now reject non-finite/non-integer seeds. Shared return validation now rejects simple returns at or below -100%, which are invalid for the multiplicative equity compounding model used here. Commit 0c966c771651087c2fd834a3c762c4e46549cc7a added regression tests for impossible returns and invalid seeds.

**Methodological reason:** Monte Carlo equity is compounded as equity × (1 + return/100). Accepting a trade return of -100% or lower can zero out or invert equity and makes subsequent drawdown interpretation invalid. Fixed-seed validation supports reproducibility. This is an input-integrity fix, not evidence that the strategy is statistically significant.

**Validation status:** Regression tests were added, but no CI result for commit 0c966c771651087c2fd834a3c762c4e46549cc7a was available at journal update time. Do not claim the new tests passed until a current run confirms it.

**Remaining concerns:** The bootstrap interval is an ordinary IID resampling interval for a mean; it does not preserve serial dependence or regime clustering. The trade-sequence Monte Carlo resamples individual trades IID and therefore estimates order/sampling sensitivity under that assumption, not realistic market paths. Publication claims must name these assumptions and should compare with block/bootstrap or regime-aware methods before claiming robust uncertainty estimates.


### Entry 2026-10-10 — Paper risk-halt position-flip invariant

**Issue identified:** The stateful paper-trading engine previously filtered post-halt fills by side alone. If strategy execution emitted a close and a new opposite-side entry in the same candle, both fills could share the reducing side, allowing a close-and-reverse sequence despite the halt. The same flaw could affect the exposure-cap rejection path.

**Change:** Commit 57f937c4d7d0a80acdf809c2355ea4dd970f002b added selectRiskReducingFills, which simulates the position quantity through the candidate fill sequence and accepts a fill only when it strictly reduces absolute exposure. Commit eca7efa43dada32996cd84f53dc53c7940054164 added regression coverage for long close-versus-short flip, short close-versus-long flip, and flat-position behavior.

**Safety effect:** A halted or over-limit state can accept a reducing close, but must not accept the subsequent fill that would open exposure in the opposite direction. This is a deterministic simulation guard, not a broker-side kill switch.

**Validation status:** The code and regression test are committed. The combined-status lookup did not yet expose a CI status for commit eca7efa43dada32996cd84f53dc53c7940054164. Mark as pending CI verification, not passed.

**Pre-dashboard status:** Still OPEN / NOT PASSED. Other stateful execution, persistence/replay, data provenance, optimizer validation, statistical assumptions, dependency audit, and end-to-end experiment evidence remain outstanding.


### Entry 2026-10-10, 03:59 UTC — Verified engineering, retained negative experiment and continued fixes

**Evidence scope:** The earlier pending-CI notes are historical snapshots. Current implementation is `c1f8863f6195aec997903fe48faae1257afbe2ac` on `feature/walk-forward-integration`. This entry supersedes earlier unverified software/benchmark status while preserving the failed observations. Overall readiness remains **NOT VALIDATED**.

**Completed foundation work:** Commits `ed82dfb`, `fdb9e43`, `54cf242`, `0c727cd`, `721453a`, `c59ce6b`, `514888c`, `4c02a90` and `7737815` repaired the incomplete lockfile and vulnerable test runner, hardened provider and discovery contracts, corrected accounting/causal execution/sequential OOS capital, added nested training validation and distinct stability candidates, enforced paper risk, implemented a restartable event journal with a storage-failure latch, and retained reproducible dataset/report identities. Principal files are `package-lock.json`, `.github/workflows/`, `packages/market-data/src/`, `packages/backtesting/src/`, `apps/research/src/research-report.ts`, and the readiness/security documentation. The [audit](pre-dashboard-audit-2026-10-10.md) records the concrete defects and 17 gate states. These are implemented and tested software improvements, not positive strategy evidence.

**New fixes and diagnostic tests:** `fd37a137dec87b8f9dee6658278d6e8fa4bea64e` shares fill validation across execution, accounting, attribution and persistence; rejects invalid/unsafe indices, sides, prices, fees, chronological disorder and unrepresentable notionals; preserves small partial long/short positions; rejects small oversells; bounds cash rounding relative to capital; and rejects non-finite portfolio/trade calculations. FIFO fee allocation now retains a remaining lot fee instead of dividing a fee by a potentially tiny quantity. `c1f8863f6195aec997903fe48faae1257afbe2ac` fixes continuous OOS boundary resets by scheduling selected configurations on one causal stream; pending orders keep their original target and preceding OOS candle history remains available. Gaps and invalid test indices are rejected. Regression sources: `fill-integrity-regression.test.ts` (18 cases) and `continuous-oos-boundary-regression.test.ts` (8 cases). Before fixing, 15 of the initial 16 fill cases and all 7 initial boundary cases failed. The previous boundary test expected artificial trades caused by history resets and was corrected to assert uninterrupted exposure.

**Actual local verification:** Typecheck, **53 test files / 229 tests**, build, tracked-file secret-pattern scan (165 files), and `git diff --check` passed on the new implementation. Pattern scanning does not establish that every possible credential is absent. No fresh successful local registry audit is claimed.

**Exact-commit CI:** On c1f8863, [CI 38022322667](https://github.com/rojandhimal/solana-alpha-trading-bot/actions/runs/38022322667), [Validation 38022322704](https://github.com/rojandhimal/solana-alpha-trading-bot/actions/runs/38022322704), and [Security 38022322671](https://github.com/rojandhimal/solana-alpha-trading-bot/actions/runs/38022322671) passed, including reproducible installation and the full dependency high/critical audit. [Evidence 38022322836](https://github.com/rojandhimal/solana-alpha-trading-bot/actions/runs/38022322836) and [Historical Research 38022322692](https://github.com/rojandhimal/solana-alpha-trading-bot/actions/runs/38022322692) failed. Downloaded Evidence artifacts confirm provider HTTP 401 and genuine CEX acceptance failures. The previous pushed 7737815 and fill-fix fd37a13 also passed CI/Validation/Security; those outcomes were checked rather than inferred. A later documentation commit needs its own checks.

**Retained real experiment:** Binance SOLUSDT has 8,760 valid hourly 2025 bars; dataset SHA-256 `646e59f40645ff57ff382d903682d1732b35f9dbdb5c7463f0e4f1feafe48009`. Nine complete OOS windows cover 6,480 bars after 2,160 initial training bars; the last 120 bars are excluded. The canonical report uses costed window-end liquidation and quantity scaled to realized prior-window capital. It differs from the alternative continuous simulator, which carries positions and uses only preceding OOS history for indicator warmup.

| Measured OOS result | Baseline | Optimized | Comparable passive SOL |
| --- | ---: | ---: | ---: |
| Return | -3.5567% | -3.8143% | -0.0866% |
| Maximum drawdown | 3.6414% | 3.9301% | 1.3557% |
| Closed trades | 574 | 637 | 9 |

Optimized profit factor is approximately 0.60, expectancy is negative, all nine windows lose money and all training-neighborhood stability checks fail. The IID mean-window bootstrap 95% interval is [-0.5578%, -0.2970%]. The 5,000 fixed-PnL permutations (seed 42) estimate trade-order drawdown sensitivity, with a 95th-percentile drawdown of 4.3373%; terminal profit is fixed by construction and is not a predictive confidence interval. Earlier compounded per-trade-return Monte Carlo interpretation has been superseded for this report. Liquidity/volatility stress changes modeled execution costs, not measured DEX capacity or generated market regimes.

**Reproduction and retained artifacts:** Built c1f8863, then ran `SOL_DATASET_FILE=artifacts/ci-721453a/solana-binance-historical-experiment.json.dataset.json SOL_BINANCE_EXPERIMENT_OUTPUT=artifacts/continuous-oos/benchmark.json npm run research:solana:binance`. The clean-tree report has the actual commit, branch and lock hash and returned exit 1 for failed strategy acceptance. Its summary and comparable benchmark exactly match the retained 514888c report. New report SHA-256: `486947fe97d86d8d91014b96b0424c0f90d8b68bdcf1e8663da5dcd11ac14435`; verification is `artifacts/continuous-oos/replay-verification.json`. Current downloaded CI reports and dataset are in `artifacts/ci-c1f8863/pre-dashboard-evidence/`; the workflow artifact is the remotely retained copy. Generated data stays outside source control.

**Open work and decision:** 2025 Solana DEX history remains blocked by legitimate public-provider access; CEX data is not interchangeable. Strategy performance, stability, stress and statistical acceptance remain failed. An elapsed realtime paper acceptance session, frozen duration/regime policy and accepted strategy are absent; historical replay is not elapsed operation. Further work should audit remaining public research APIs and recovery/freshness edge cases, then test any new strategy hypothesis on a fresh holdout because 2025 OOS has been inspected. File journals currently support one writer, not multi-process ownership. Dashboard work remains blocked and live trading disabled. No thresholds were lowered or strategy parameters tuned to make this failed OOS period pass.

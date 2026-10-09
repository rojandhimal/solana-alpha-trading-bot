# M1 Research Journal — Solana Alpha Trading Bot

**Working title:** Robust Evaluation of an Explainable, Risk-Constrained Solana Trading Strategy  
**Researcher:** Rojan Dhimal  
**Project repository:** https://github.com/rojandhimal/solana-alpha-trading-bot  
**Document status:** Living research journal — work in progress  
**Last updated:** 10 October 2026  
**Research phase:** Pre-dashboard validation and reproducibility  
**Trading mode:** PAPER only; live trading is not authorised

> **Format note:** “M1 research journal format” is not a uniquely identifiable journal title from the information available. This document uses an M1-style research-proposal/report structure: title and abstract; background and literature; significance; research questions, aims and objectives; methodology; ethics and risk; timeline; data management; references; and a dated development/experiment log. If “M1” refers to a specific institution or journal template, its official guide should supersede this working structure.

## Abstract

This project investigates whether a transparent, rule-based trading strategy for Solana-market data can demonstrate robust out-of-sample performance after realistic execution costs and risk constraints. The engineering work builds a reproducible research pipeline covering historical OHLCV ingestion, data-quality validation, a fixed baseline strategy, walk-forward evaluation, training-only parameter optimisation, execution stress tests, statistical robustness checks, and paper-trading safeguards. The principal research concern is not whether a strategy can be made profitable on historical data, but whether any observed edge persists outside the data used to select parameters and remains credible under uncertainty, fees, slippage, liquidity deterioration, execution delay, and changing market conditions.

The current implementation includes historical-data adapters, candle-quality audits, baseline and optimised walk-forward pipelines, execution and accounting models, stress scenarios, and paper-trading state abstractions. A Binance SOLUSDT hourly benchmark for 1 January–31 December 2025 is configured as an independent centralised-exchange research benchmark; GeckoTerminal is kept as a separate decentralised-exchange diagnostic. Provider coverage and access restrictions may prevent a requested experiment from running. Such cases must be reported as blocked or incomplete, not replaced with fabricated observations. At the time of this entry, a complete, successfully validated end-to-end experiment and a sustained live-market paper-trading acceptance period have **not** been established by evidence in this journal. Therefore, no claim of profitability or readiness for live execution is made.

## 1. Background and problem statement

Automated trading strategies can appear successful when evaluated on the same historical observations used to select their parameters. Repeated strategy trials, selective reporting, data leakage, unrealistic fill assumptions, and transaction costs can all overstate performance. A credible evaluation must separate model selection from out-of-sample testing, document data provenance, account for execution frictions, and disclose uncertainty and limitations.

This project focuses on Solana-related trading research. It distinguishes centralised-exchange benchmark data from decentralised-exchange data because the two markets have different liquidity, execution, fee, and market-structure characteristics. A result measured on Binance SOLUSDT must not be presented as evidence that the same strategy can trade a particular Solana DEX pool profitably.

The software is treated as a research instrument rather than a profit guarantee. Deterministic risk controls must remain authoritative; external data and any future LLM-generated analysis must not be able to override them. The project remains in paper mode while the evaluation framework and evidence are incomplete.

## 2. Literature and conceptual basis

The methodology follows established principles from quantitative research:

- **Out-of-sample evaluation and walk-forward testing:** parameter selection is performed on a training window, and the selected configuration is evaluated on a later, untouched test window. Test-window outcomes must not influence the configuration selected for that same window.
- **Backtest-overfitting awareness:** searching a large parameter grid increases the chance of selecting noise. Results should therefore include the search process, parameter stability, and validation outside the optimisation data.
- **Execution realism:** trading costs, slippage, liquidity changes, and delayed execution can materially change strategy results. Results without credible cost assumptions are not sufficient evidence of deployability.
- **Reproducibility and provenance:** data source, retrieval interval, timestamps, validation rules, code version, parameters, and run artifacts should be recorded so that a result can be reproduced and audited.
- **Responsible reporting:** negative, inconclusive, blocked, and incomplete experiments are research outcomes and must be recorded rather than omitted.

This section is a starting synthesis, not a completed systematic literature review. A later revision should expand the bibliography, critically compare methods, and map each methodological choice to peer-reviewed or primary sources.

## 3. Research question, aim and objectives

### Primary research question

**To what extent does a rule-based Solana-market strategy retain out-of-sample performance after realistic transaction costs, execution stress, and parameter-selection controls, compared with a fixed baseline strategy?**

### Sub-questions

1. Does the strategy exhibit consistent out-of-sample performance across multiple chronological walk-forward windows?
2. How sensitive are results to fees, slippage, liquidity shocks, execution delays, and volatility shocks?
3. Are the selected parameters stable, or do small changes cause material deterioration?
4. How uncertain are the estimated returns and risk metrics under resampling or Monte Carlo analysis?
5. Can the research and paper-trading pipeline enforce data-quality, reproducibility, and risk-control invariants?

### Aim

Develop and evaluate an auditable, risk-constrained research pipeline for a Solana-related trading strategy without assuming that historical returns imply future profitability.

### Objectives

1. Ingest historical OHLCV data from explicitly identified providers and retain provenance.
2. Reject malformed, duplicated, out-of-order, incomplete, or insufficiently covered datasets according to documented rules.
3. Establish a fixed baseline and compare it with an optimiser whose search is restricted to training data.
4. Evaluate the strategies with chronological walk-forward out-of-sample windows.
5. Measure performance, drawdown, trade outcomes, and execution-cost sensitivity.
6. Add parameter-stability and statistical robustness analyses, including uncertainty intervals where defensible.
7. Test stateful paper execution, idempotency, persistence contracts, data freshness, and risk halting behaviour.
8. Maintain security controls and automated quality gates; keep live execution disabled.
9. Produce machine-readable experiment artifacts and this human-readable research journal.
10. Begin dashboard development only after the documented pre-dashboard readiness gate is satisfied.

## 4. Significance and expected contribution

The intended contribution is an engineering and evaluation framework that makes trading-strategy claims more difficult to overstate. It combines explicit data-quality gates, training-only optimisation, chronological out-of-sample evaluation, execution stress tests, risk-control tests, and reproducible artifacts. The framework is potentially useful to developers who need to distinguish a promising backtest from evidence strong enough to justify extended paper trading.

The contribution is not a novel trading theorem, a guaranteed profitable strategy, or evidence of a production-ready trading system. Any empirical contribution depends on completing the planned experiments and publishing their actual results, including failures and limitations.

## 5. Methodology

### 5.1 Research design

Quantitative, computational, comparative experimental research. A fixed baseline strategy is compared with an optimised variant. Data is split chronologically using walk-forward windows; random shuffling of time-series observations is not used for the principal evaluation.

### 5.2 Data and scope

**Configured benchmark experiment**

| Item | Configuration |
|---|---|
| Instrument | SOLUSDT |
| Venue/provider | Binance Spot klines (centralised-exchange benchmark) |
| Interval | 1 hour |
| Requested period | 2025-01-01 00:00 UTC to 2025-12-31 23:00 UTC |
| Expected observations | 8,760 hourly bars, subject to provider response and data-quality validation |
| Initial capital in simulation | 10,000 units of the backtest quote currency |
| Walk-forward training window | 90 days |
| Walk-forward test window | 30 days |
| Walk-forward step | 30 days |
| Data-quality gate | hourly interval, range coverage, duplicate/order/OHLCV checks, and no unexplained gaps under the configured strict policy |

The expected observation count is a configuration-derived expectation, not a statement that the dataset has been successfully retrieved or passed validation. Any provider error, restricted-location response, rate limit, missing interval, or coverage limitation must be recorded in the run log.

**Separate DEX diagnostic:** GeckoTerminal OHLCV is intended for DEX-pool diagnostics. It is not interchangeable with the Binance benchmark. If public-provider history limits prevent access to the requested period, the diagnostic remains blocked until an authorised, suitable data source is available. Do not bypass provider access controls or fabricate missing bars.

### 5.3 Strategy and execution

The configured baseline uses moving-average trend, RSI, momentum, ATR, and volume features with explicit strategy parameters. Execution simulation accounts for signal timing, reference prices, slippage, and fees. The implementation must be reviewed for look-ahead bias, delayed-fill handling, accounting invariants, and consistent application of costs before results are accepted.

The optimiser evaluates candidate configurations on training data only. Before accepting an optimised strategy, the research pipeline should use an inner validation split or another explicit anti-overfitting procedure, deterministic tie-breaking, minimum trade requirements, and parameter-stability reporting. A selected parameter set must be frozen before the corresponding outer test window is evaluated.

### 5.4 Walk-forward evaluation

The configured outer evaluation uses a 90-day training window, a 30-day test window, and 30-day steps. The optimiser is permitted to see only the training portion of each window. Test returns are aggregated chronologically and compounded, not naively summed. The number of windows actually produced, their date boundaries, and any skipped windows must be included in each report.

### 5.5 Metrics

At minimum, record:
- net total return after simulated costs;
- maximum drawdown;
- trade count and trade-level outcomes;
- profit factor and expectancy, with the definitions used by the implementation;
- per-window out-of-sample results and the fraction of windows meeting predeclared criteria;
- sensitivity to each execution stress scenario;
- parameter stability;
- resampling/Monte Carlo distributions and confidence intervals where assumptions are defensible;
- data-quality report, run status, code revision, configuration, and provider provenance.

Metrics must be interpreted together. Profit factor can be undefined or unstable with few trades; percentage returns can obscure risk; and resampling trade outcomes does not model every source of market uncertainty. No single metric is sufficient to establish an edge.

### 5.6 Stress and robustness analysis

The current scenario set includes BASE, HIGH_SLIPPAGE, HIGH_FEES, LIQUIDITY_SHOCK, EXECUTION_DELAY, and VOLATILITY_SHOCK. The actual parameter values used by each run must be saved with the result. Robustness thresholds are research gates, not proof of future performance. Thresholds should be justified before inspecting final results and should not be relaxed merely to obtain a passing report.

### 5.7 Reproducibility

Each experiment should record:
- unique run identifier and UTC start/end time;
- repository commit SHA and runtime/dependency versions;
- provider name, market/instrument, interval, requested and actual time coverage;
- dataset count and quality report;
- strategy and execution configuration;
- walk-forward boundaries and optimiser settings;
- random seed for any stochastic analysis;
- metrics by window and scenario;
- acceptance-gate outcomes, warnings, and failure reasons;
- machine-readable artifact path and report version.

A rerun using the same data, code, configuration, and random seed should produce equivalent outputs within documented numerical tolerances.

## 6. Research acceptance and pre-dashboard gate

Dashboard work must not begin until the foundational research and safety work is complete. The gate must fail closed when evidence is missing.

| Gate | Required evidence | Current status |
|---|---|---|
| Data provenance and quality | Source, coverage, interval, duplicates, order, OHLCV, gaps audited | Implemented components; end-to-end dataset pass not yet evidenced here |
| Baseline backtest | Reproducible baseline artifact | Pending verified successful run |
| Walk-forward OOS | Frozen training-only selection and per-window test metrics | Pipeline exists; successful complete run not yet evidenced here |
| Anti-overfitting controls | Inner validation, deterministic tie-break, parameter stability | Requires verification/completion |
| Stress testing | All configured scenarios and per-scenario artifacts | Components exist; successful complete artifact not yet evidenced here |
| Statistical robustness | Resampling/Monte Carlo and uncertainty reporting | Components exist or are being integrated; complete verified run pending |
| Paper-trading invariants | Incremental candles, delayed fills, no duplicate fills, close/reduce after halt, exposure gate, persistence/idempotency | Test coverage and implementation verification required |
| Security | Fail-closed PAPER/LIVE config, secret scan, dependency audit, least-privilege CI | Controls exist; current green security run must be verified |
| CI | Typecheck, tests, build, security checks all green on current HEAD | Not yet confirmed; recent CI run exposed TypeScript errors that were patched, requiring a fresh run |
| Research artifact | Machine-readable report with provenance, metrics, gate status, and limitations | Pending verified successful end-to-end run |
| Paper acceptance period | Sufficiently long, regime-diverse paper observations with monitoring and incident records | Not complete |
| Live trading | Separate approval and risk review after all evidence gates | **Disabled; not authorised** |

**Current decision: NOT READY FOR DASHBOARD / NOT READY FOR LIVE TRADING.** This is an evidence status, not a judgement that the strategy must fail. The gate can change only when the required artifacts and checks exist and pass.

## 7. Ethics, safety and security

No human participants are planned for this computational study. The principal risks concern financial loss, misleading claims, secret leakage, unsafe automation, and overconfidence in backtest results.

Controls:
- Keep TRADING_MODE set to PAPER and ENABLE_LIVE_TRADING set to false by default.
- Do not store private keys, seed phrases, exchange credentials, or other secrets in source control, test fixtures, research artifacts, or logs.
- Do not connect a research or dashboard layer directly to signing authority.
- Keep any future LLM outside the deterministic execution and risk-control boundary. LLM outputs are advisory and must not override hard risk rules.
- Do not execute real transactions as part of the current research phase.
- Report negative, inconclusive, blocked, or incomplete results.
- Treat a kill-switch test, data-staleness check, and exposure-limit check as safety-critical tests rather than optional enhancements.
- Do not describe the system as profitable or production-ready without sufficient independent evidence.

## 8. Data management plan

- Store code, methodology, test definitions, and non-sensitive research documentation in version control.
- Store generated experiment artifacts under a predictable artifacts/ location and upload them as CI artifacts where appropriate.
- Include commit SHA, configuration, timestamps, provider, and dataset-quality metadata in every artifact.
- Never commit credentials or raw secrets. Review whether provider terms permit redistribution before committing downloaded market data.
- Use deterministic seeds for stochastic tests and record the seed.
- Preserve failed run logs and explain failures instead of silently overwriting them.
- Separate centralised-exchange benchmark results from DEX-specific diagnostics.
- Do not claim reproducibility when the source dataset is unavailable or its provenance cannot be verified.

## 9. Development and experiment journal

Entries below are chronological. New entries should include date/time in UTC, commit SHA, work performed, test evidence, outcome, limitations, and the next action. The list describes repository state and known validation evidence; it must not be interpreted as a claim that every component has passed end-to-end.

### Entry — 2026-09-12 to 2026-10-10: Research framework and validation hardening

**Work recorded**
- Added historical OHLCV source abstractions and provider adapters, including data-quality checks, pagination, response validation, retries, timeouts, and range filtering.
- Added a configured SOLUSDT hourly benchmark and a separate GeckoTerminal DEX diagnostic path.
- Added baseline and optimised walk-forward evaluation, with training-only optimisation intended to protect outer test windows.
- Added execution modelling for fees, slippage, liquidity multipliers, volatility multipliers, and delayed fills.
- Added portfolio accounting, trade attribution, performance metrics, stress scenarios, robustness thresholds, and statistical-robustness modules.
- Added batch and stateful paper-trading foundations and tests.
- Hardened configuration so paper mode rejects a supplied Solana private key and live mode requires explicit enablement and a key; live mode remains disabled.
- Added a security threat model and a CI security workflow.
- Added a pre-dashboard readiness checklist.

**Observed validation evidence and failures**
- A previous CI run failed before dependency installation because the workflow requested npm caching but the repository had no npm lockfile. The workflow was adjusted to allow installation without cache configuration.
- A subsequent CI run reached TypeScript typechecking and reported exactOptionalPropertyTypes errors where allowShort: undefined was passed explicitly. The accounting calls were patched to omit the option when undefined. A fresh successful typecheck/test/build result still needs to be confirmed.
- Dependency installation reported vulnerabilities, including high and critical findings. These must be investigated and remediated rather than suppressed. The current production dependency audit result remains unverified.
- A provider may block historical access because of plan or regional restrictions. Such provider responses are blockers, not successful data retrieval.
- No complete successful 2025 benchmark artifact or sustained paper-trading acceptance record is established by this entry.

**Interpretation**
The repository has meaningful research and safety components, but the acceptance evidence is incomplete. A green compile alone would not validate the strategy; similarly, a successful backtest would not validate real-world execution or establish future profitability.

**Next actions**
1. Re-run and inspect current CI after the latest fixes; fix each failure at its source.
2. Resolve production dependency audit findings without using force upgrades blindly.
3. Complete stateful paper-trading tests, particularly execution delays, fill idempotency, halt behaviour, and exposure limits.
4. Verify the optimiser's inner validation, deterministic tie-breaking, and parameter-stability reporting.
5. Verify statistical robustness assumptions and report confidence intervals without overstating them.
6. Run the end-to-end benchmark where data access permits; save artifacts and clearly label blocked provider runs.
7. Keep the readiness gate closed until all required evidence exists.
8. Start the read-only dashboard only after the gate has been reviewed against current evidence.

## 10. Project timeline

| Phase | Activities | Exit evidence |
|---|---|---|
| A. Research foundation | Provider contracts, data validation, baseline strategy | Validated dataset and baseline artifact |
| B. Evaluation integrity | Walk-forward split, training-only optimisation, anti-overfit controls | Reproducible per-window OOS report |
| C. Robustness | Stress tests, parameter stability, resampling and uncertainty | Complete robustness report |
| D. Paper-trading safety | Stateful processing, risk limits, halt semantics, persistence/idempotency | Passing invariant tests and monitored paper run |
| E. Security and CI | Secret scanning, dependency remediation, typecheck/tests/build | Green checks on the current commit |
| F. Pre-dashboard review | Evidence audit and readiness decision | All pre-dashboard gates satisfied or documented blocker |
| G. Dashboard | Read-only presentation of metrics, provenance, alerts, and gate status | Dashboard reflects real artifacts and never hides failed gates |

The schedule is evidence-driven rather than date-driven. No phase should be marked complete merely because implementation has been committed.

## 11. Limitations

- Results depend on the availability, quality, and representativeness of historical data.
- Binance SOLUSDT is a centralised-exchange benchmark and does not reproduce the execution conditions of a Solana DEX pool.
- OHLCV-based fills are approximations; they do not fully model order-book depth, routing, MEV, failed transactions, priority fees, pool-specific price impact, or all latency effects.
- Strategy parameters and robustness thresholds can be misspecified.
- Walk-forward tests and Monte Carlo resampling reduce some evaluation risks but do not eliminate regime shift, data snooping, or uncertainty about future returns.
- Public API access restrictions may limit the requested historical period.
- A short paper-trading period cannot establish long-term reliability or profitability.

## 12. Conclusion and next research direction

The current project should be treated as a developing research and paper-trading framework. Its most important deliverable is a reliable evidence trail—not an attractive dashboard or a profitable-looking backtest. The next phase is to close implementation and CI defects, verify anti-overfitting and statistical procedures, run the full experiment where legitimate data access permits, and retain an explicit blocked/not-ready status when evidence is insufficient. Dashboard implementation is downstream of that readiness decision. Live execution remains out of scope until the research, security, operational, and human-approval gates are independently satisfied.

## References

1. Bailey, D. H., Borwein, J. M., López de Prado, M., & Zhu, Q. J. (2017). The Probability of Backtest Overfitting. Journal of Computational Finance, 20(4), 39–69. https://doi.org/10.21314/JCF.2016.322
2. López de Prado, M. (2018). Advances in Financial Machine Learning. Wiley. https://www.wiley.com/en-us/Advances+in+Financial+Machine+Learning-p-9781119482086
3. Harvey, C. R., Liu, Y., & Zhu, H. (2016). …and the Cross-Section of Expected Returns. The Review of Financial Studies, 29(1), 5–68. https://doi.org/10.1093/rfs/hhv059
4. University of Melbourne, Academic Skills. Planning your paper. https://students.unimelb.edu.au/academic-skills/graduate-research-services/writing-a-paper-for-publication/planning-your-paper
5. Curtin University Library. Writing your M1 research proposal. https://researchtoolkit.library.curtin.edu.au/grasp/ideas-hub/writing-your-research-proposal/
6. Binance. Spot API — Kline/Candlestick Data. https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
7. GeckoTerminal. API documentation. https://api.geckoterminal.com/docs/index.html

**Citation note:** The references above are a starting bibliography. Before submission to a named journal or university, verify every bibliographic detail against the original source, expand the critical literature review, and apply the required citation style.

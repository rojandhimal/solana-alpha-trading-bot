# Reproducible research protocol

## Dataset

Every research run must record symbol, interval, requested start/end, provider, endpoint/source identifier, generation time, bar count, first/last timestamp, and the complete data-quality report. Missing coverage, gaps above the configured threshold, duplicates, malformed candles or out-of-order data are release-blocking.

## Validation

Use a deterministic baseline first. Walk-forward optimization must receive only training candles. The selected strategy is frozen for the corresponding test window. Sequential OOS windows are compounded rather than treated as independent deposits.

## Anti-overfitting

Record the selected parameters for every training window. Review dispersion across windows and reject results that depend on one isolated parameter combination or one isolated OOS window. Parameter search must never consume test candles.

## Robustness

Evaluate every configured execution stress scenario. Record drawdown, profit factor, expectancy, trade count and return. Run bootstrap confidence intervals and deterministic Monte Carlo trade-sequence simulations with explicit seeds.

## Paper trading

Run the frozen strategy using the same execution/accounting model as research. Persist ordered events and equity snapshots. Reconcile persisted events against deterministic replay. Enforce exposure/drawdown limits before new exposure and halt new entries after a loss-limit breach.

## Reproducibility

Pin configuration in source, use deterministic seeds for statistical simulations, emit JSON reports, and retain enough metadata to identify the exact commit and dataset. Never treat unavailable data as zero performance or a successful validation.

## Release rule

The final state is `VALIDATED_FOR_DASHBOARD` only if all engineering and evidence gates pass on the exact release commit. Otherwise the state is `NOT_VALIDATED` and dashboard release is blocked.

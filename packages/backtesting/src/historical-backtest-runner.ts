import type { HistoricalDataQuery, HistoricalDataSource } from "../../market-data/src/historical-source.js";
import type { BacktestPipelineInput, BacktestPipelineResult } from "./backtest-pipeline.js";
import { runBacktestPipeline } from "./backtest-pipeline.js";
import type { StrategyExecutionConfig } from "./strategy-execution-adapter.js";
import type { StressScenario } from "./stress-testing.js";
import type { RobustnessThresholds } from "./robustness.js";
import { toBacktestCandles } from "./market-data.js";

export interface HistoricalBacktestConfig {
  initialCapital: number;
  strategy: StrategyExecutionConfig;
  stressScenarios: readonly StressScenario[];
  robustnessThresholds: RobustnessThresholds;
}

export async function runHistoricalBacktest(
  source: HistoricalDataSource,
  query: HistoricalDataQuery,
  config: HistoricalBacktestConfig
): Promise<BacktestPipelineResult> {
  const bars = await source.load(query);
  const candles = toBacktestCandles(bars);
  if (candles.length === 0) throw new Error("historical source returned no candles");

  const input: BacktestPipelineInput = {
    candles,
    strategy: config.strategy,
    initialCapital: config.initialCapital,
    stressScenarios: config.stressScenarios,
    robustnessThresholds: config.robustnessThresholds
  };

  return runBacktestPipeline(input);
}

import type { HistoricalDataQuery, HistoricalDataSource } from "../../market-data/src/historical-source.js";
import { auditHistoricalData, assertHistoricalDataQuality, type HistoricalDataQualityReport } from "../../market-data/src/historical-data-quality.js";
import { optimizeAlphaStrategy, type AlphaStrategyOptimizationOptions } from "./alpha-strategy-optimizer.js";
import type { Candle } from "./execution-model.js";
import type { RobustnessThresholds } from "./robustness.js";
import type { StressScenario } from "./stress-testing.js";
import type { StrategyExecutionConfig } from "./strategy-execution-adapter.js";
import { runWalkForwardPipeline, type WalkForwardPipelineResult } from "./walk-forward-pipeline.js";
import type { WalkForwardOptions } from "./walk-forward.js";
import { toBacktestCandles } from "./market-data.js";

export interface HistoricalExperimentConfig {
  symbol: string;
  query: HistoricalDataQuery;
  initialCapital: number;
  baselineStrategy: StrategyExecutionConfig;
  walkForward: WalkForwardOptions;
  stressScenarios: readonly StressScenario[];
  robustnessThresholds: RobustnessThresholds;
  optimization?: AlphaStrategyOptimizationOptions;
}

export interface HistoricalExperimentResult {
  symbol: string;
  query: HistoricalDataQuery;
  dataset: HistoricalDataQualityReport;
  baseline: WalkForwardPipelineResult;
  optimized: WalkForwardPipelineResult;
}

function runWfo(
  candles: readonly Candle[],
  config: HistoricalExperimentConfig,
  strategyOptimizer?: (trainCandles: readonly Candle[], base: StrategyExecutionConfig) => StrategyExecutionConfig
): WalkForwardPipelineResult {
  return runWalkForwardPipeline({
    candles,
    initialCapital: config.initialCapital,
    strategy: config.baselineStrategy,
    walkForward: config.walkForward,
    stressScenarios: config.stressScenarios,
    robustnessThresholds: config.robustnessThresholds,
    ...(strategyOptimizer ? { strategyOptimizer } : {})
  });
}

export async function runHistoricalExperiment(
  source: HistoricalDataSource,
  config: HistoricalExperimentConfig
): Promise<HistoricalExperimentResult> {
  if (!config.symbol.trim()) throw new Error("symbol is required");
  if (!Number.isFinite(config.initialCapital) || config.initialCapital <= 0) {
    throw new Error("initialCapital must be a positive finite number");
  }

  const bars = await source.load(config.query);
  if (bars.length === 0) throw new Error("historical source returned no candles");

  const dataset = auditHistoricalData(bars, config.query, { requireRangeCoverage: true });
  assertHistoricalDataQuality(bars, config.query, { requireRangeCoverage: true });
  const candles = toBacktestCandles(bars);

  const baseline = runWfo(candles, config);
  const optimized = runWfo(candles, config, (trainCandles, base) =>
    optimizeAlphaStrategy(trainCandles, base, config.optimization).strategy
  );

  return { symbol: config.symbol, query: config.query, dataset, baseline, optimized };
}

export interface HistoricalExperimentSummary {
  symbol: string;
  barCount: number;
  rangeStart?: number;
  rangeEnd?: number;
  baselineReturnPct: number;
  optimizedReturnPct: number;
  baselineMaxDrawdownPct: number;
  optimizedMaxDrawdownPct: number;
  baselineTradeCount: number;
  optimizedTradeCount: number;
}

export function summarizeHistoricalExperiment(result: HistoricalExperimentResult): HistoricalExperimentSummary {
  const summary: HistoricalExperimentSummary = {
    symbol: result.symbol,
    barCount: result.dataset.barCount,
    baselineReturnPct: result.baseline.outOfSample.totalReturnPct,
    optimizedReturnPct: result.optimized.outOfSample.totalReturnPct,
    baselineMaxDrawdownPct: result.baseline.outOfSample.maxDrawdownPct,
    optimizedMaxDrawdownPct: result.optimized.outOfSample.maxDrawdownPct,
    baselineTradeCount: result.baseline.outOfSample.tradeCount,
    optimizedTradeCount: result.optimized.outOfSample.tradeCount
  };

  if (result.dataset.firstTimestamp !== undefined) summary.rangeStart = result.dataset.firstTimestamp;
  if (result.dataset.lastTimestamp !== undefined) summary.rangeEnd = result.dataset.lastTimestamp;
  return summary;
}

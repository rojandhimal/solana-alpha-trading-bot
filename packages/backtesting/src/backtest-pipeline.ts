import type { Candle, ExecutionFill } from "./execution-model.js";
import { attributeTrades, type CompletedTrade } from "./trade-attribution.js";
import { calculatePerformanceMetrics, type PerformanceMetrics } from "./performance-metrics.js";
import { accountFills, type PortfolioAccountingResult } from "./portfolio-accounting.js";
import { evaluateRobustness, type RobustnessReport, type RobustnessThresholds } from "./robustness.js";
import { runStressScenarios, type StressScenario, type StressScenarioResult, type StressParameters } from "./stress-testing.js";
import { simulateExecutionStress, type SimulatedTrade } from "./execution-stress.js";
import { generateStrategyFills, type StrategyExecutionConfig } from "./strategy-execution-adapter.js";
import type { StrategyCandle } from "./alpha-strategy.js";

export interface BacktestPipelineInput {
  candles: readonly Candle[];
  fills?: readonly ExecutionFill[];
  strategy?: StrategyExecutionConfig;
  initialCapital: number;
  stressScenarios: readonly StressScenario[];
  robustnessThresholds: RobustnessThresholds;
  runScenario?: (fills: readonly ExecutionFill[], parameters: StressParameters, scenario: StressScenario) => ExecutionFill[];
}

export interface BacktestPipelineResult {
  baseline: PortfolioAccountingResult;
  fills: ExecutionFill[];
  trades: CompletedTrade[];
  metrics: PerformanceMetrics;
  stressResults: StressScenarioResult[];
  robustness: RobustnessReport;
}

function tradesForExecutionStress(trades: readonly CompletedTrade[]): SimulatedTrade[] {
  return trades.map((trade) => ({
    entryReferencePrice: trade.entryReferencePrice,
    exitReferencePrice: trade.exitReferencePrice,
    quantity: trade.quantity,
    side: trade.side
  }));
}

function strategyCandles(candles: readonly Candle[]): StrategyCandle[] {
  return candles.map((candle) => ({
    ...candle,
    volume: "volume" in candle && typeof candle.volume === "number" ? candle.volume : 0
  }));
}

export function runBacktestPipeline(input: BacktestPipelineInput): BacktestPipelineResult {
  if (!input.fills && !input.strategy) throw new Error("either fills or strategy must be provided");

  const fills = input.strategy
    ? generateStrategyFills(strategyCandles(input.candles), input.strategy)
    : [...(input.fills ?? [])];
  const allowShort = Boolean(input.strategy);
  const baseline = accountFills(input.candles, fills, input.initialCapital, { allowShort });
  const trades = attributeTrades(fills);
  const metrics = calculatePerformanceMetrics(baseline, trades);

  const stressResults = runStressScenarios(input.stressScenarios, (parameters, scenario) => {
    if (!input.runScenario) {
      return simulateExecutionStress(tradesForExecutionStress(trades), parameters, undefined, undefined, input.initialCapital).metrics;
    }

    const stressedFills = input.runScenario(fills, parameters, scenario);
    const accounting = accountFills(input.candles, stressedFills, input.initialCapital, { allowShort });
    const stressedTrades = attributeTrades(stressedFills);
    const stressedMetrics = calculatePerformanceMetrics(accounting, stressedTrades);
    return {
      totalReturnPct: stressedMetrics.totalReturnPct,
      maxDrawdownPct: stressedMetrics.maxDrawdownPct,
      tradeCount: stressedMetrics.tradeCount,
      profitFactor: stressedMetrics.profitFactor,
      expectancy: stressedMetrics.expectancy
    };
  });

  return { baseline, fills, trades, metrics, stressResults, robustness: evaluateRobustness(stressResults, input.robustnessThresholds) };
}

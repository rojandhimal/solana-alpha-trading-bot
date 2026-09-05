import type { Candle, ExecutionFill } from "./execution-model.js";
import { attributeLongTrades, type CompletedTrade } from "./trade-attribution.js";
import { calculatePerformanceMetrics, type PerformanceMetrics } from "./performance-metrics.js";
import { accountFills, type PortfolioAccountingResult } from "./portfolio-accounting.js";
import { evaluateRobustness, type RobustnessReport, type RobustnessThresholds } from "./robustness.js";
import { runStressScenarios, type StressScenario, type StressScenarioResult, type StressParameters } from "./stress-testing.js";

export interface BacktestPipelineInput {
  candles: readonly Candle[];
  fills: readonly ExecutionFill[];
  initialCapital: number;
  stressScenarios: readonly StressScenario[];
  robustnessThresholds: RobustnessThresholds;
  runScenario?: (fills: readonly ExecutionFill[], parameters: StressParameters, scenario: StressScenario) => ExecutionFill[];
}

export interface BacktestPipelineResult {
  baseline: PortfolioAccountingResult;
  trades: CompletedTrade[];
  metrics: PerformanceMetrics;
  stressResults: StressScenarioResult[];
  robustness: RobustnessReport;
}

export function runBacktestPipeline(input: BacktestPipelineInput): BacktestPipelineResult {
  const baseline = accountFills(input.candles, input.fills, input.initialCapital);
  const trades = attributeLongTrades(input.fills);
  const metrics = calculatePerformanceMetrics(baseline, trades);

  const stressResults = runStressScenarios(input.stressScenarios, (parameters, scenario) => {
    const stressedFills = input.runScenario ? input.runScenario(input.fills, parameters, scenario) : input.fills;
    const accounting = accountFills(input.candles, stressedFills, input.initialCapital);
    const stressedTrades = attributeLongTrades(stressedFills);
    const stressedMetrics = calculatePerformanceMetrics(accounting, stressedTrades);
    return {
      totalReturnPct: stressedMetrics.totalReturnPct,
      maxDrawdownPct: stressedMetrics.maxDrawdownPct,
      tradeCount: stressedMetrics.tradeCount,
      profitFactor: stressedMetrics.profitFactor,
      expectancy: stressedMetrics.expectancy
    };
  });

  return { baseline, trades, metrics, stressResults, robustness: evaluateRobustness(stressResults, input.robustnessThresholds) };
}

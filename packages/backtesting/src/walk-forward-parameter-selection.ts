import type { Candle } from "./execution-model.js";
import type { BacktestPipelineResult } from "./backtest-pipeline.js";
import { runBacktestPipeline } from "./backtest-pipeline.js";
import { createWalkForwardWindows, splitWalkForward, type WalkForwardOptions, type WalkForwardWindow } from "./walk-forward.js";
import { analyzeParameterStability, type StrategyParameterCandidate, type ParameterStabilityReport } from "./parameter-stability.js";
import type { StrategyExecutionConfig } from "./strategy-execution-adapter.js";
import type { RobustnessThresholds } from "./robustness.js";
import type { StressScenario } from "./stress-testing.js";
import type { PerformanceMetrics } from "./performance-metrics.js";

export interface WalkForwardParameterSelectionWindow extends WalkForwardWindow {
  selection: ParameterStabilityReport;
  test: BacktestPipelineResult;
}

export interface WalkForwardParameterSelectionResult {
  windows: WalkForwardParameterSelectionWindow[];
  outOfSample: PerformanceMetrics;
}

export interface WalkForwardParameterSelectionInput {
  candles: readonly Candle[];
  initialCapital: number;
  candidates: readonly StrategyParameterCandidate[];
  quantity: number;
  execution?: StrategyExecutionConfig["execution"];
  stressScenarios: readonly StressScenario[];
  robustnessThresholds: RobustnessThresholds;
  walkForward: WalkForwardOptions;
  stabilitySpreadThresholdPct?: number;
}

function aggregateOutOfSampleMetrics(windows: readonly WalkForwardParameterSelectionWindow[]): PerformanceMetrics {
  const tradeCount = windows.reduce((sum, window) => sum + window.test.metrics.tradeCount, 0);
  const netProfit = windows.reduce((sum, window) => sum + window.test.metrics.netProfit, 0);
  const initialCapital = windows[0]?.test.baseline.initialCapital ?? 0;
  const totalReturnPct = initialCapital === 0 ? 0 : (netProfit / initialCapital) * 100;
  const maxDrawdownPct = windows.reduce((max, window) => Math.max(max, window.test.metrics.maxDrawdownPct), 0);
  let winningTrades = 0;
  let losingTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  for (const window of windows) {
    const metrics = window.test.metrics;
    const wins = (metrics.winRatePct / 100) * metrics.tradeCount;
    const losses = metrics.tradeCount - wins;
    winningTrades += wins;
    losingTrades += losses;
    grossProfit += metrics.averageWin * wins;
    grossLoss += metrics.averageLoss * losses;
  }

  const winRatePct = tradeCount === 0 ? 0 : (winningTrades / tradeCount) * 100;
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Number.POSITIVE_INFINITY : 0) : grossProfit / grossLoss;
  const averageWin = winningTrades === 0 ? 0 : grossProfit / winningTrades;
  const averageLoss = losingTrades === 0 ? 0 : grossLoss / losingTrades;

  return {
    totalReturnPct,
    netProfit,
    maxDrawdownPct,
    tradeCount,
    winRatePct,
    profitFactor,
    expectancy: tradeCount === 0 ? 0 : netProfit / tradeCount,
    averageWin,
    averageLoss
  };
}

export function runWalkForwardParameterSelection(input: WalkForwardParameterSelectionInput): WalkForwardParameterSelectionResult {
  if (input.candidates.length === 0) throw new Error("at least one strategy candidate is required");

  const windows = createWalkForwardWindows(input.candles.length, input.walkForward).map((window) => {
    const { train, test } = splitWalkForward(input.candles, window);
    const selection = analyzeParameterStability({
      candles: train,
      initialCapital: input.initialCapital,
      candidates: input.candidates,
      quantity: input.quantity,
      execution: input.execution,
      stressScenarios: input.stressScenarios,
      robustnessThresholds: input.robustnessThresholds,
      stabilitySpreadThresholdPct: input.stabilitySpreadThresholdPct
    });

    if (selection.best === undefined) throw new Error("parameter selection produced no best candidate");

    const strategyConfig = input.execution === undefined
      ? { quantity: input.quantity, strategy: selection.best.candidate.strategy }
      : { quantity: input.quantity, strategy: selection.best.candidate.strategy, execution: input.execution };
    const test = runBacktestPipeline({
      candles: test,
      initialCapital: input.initialCapital,
      strategy: strategyConfig,
      stressScenarios: input.stressScenarios,
      robustnessThresholds: input.robustnessThresholds
    });

    return { ...window, selection, test };
  });

  return { windows, outOfSample: aggregateOutOfSampleMetrics(windows) };
}

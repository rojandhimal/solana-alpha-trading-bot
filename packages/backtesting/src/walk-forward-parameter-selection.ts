import type { Candle } from "./execution-model.js";
import type { BacktestPipelineResult } from "./backtest-pipeline.js";
import { runBacktestPipeline } from "./backtest-pipeline.js";
import {
  createWalkForwardWindows,
  splitWalkForward,
  type WalkForwardOptions,
  type WalkForwardWindow,
} from "./walk-forward.js";
import {
  analyzeParameterStability,
  type StrategyParameterCandidate,
  type ParameterStabilityReport,
} from "./parameter-stability.js";
import { aggregateWalkForwardOutOfSampleMetrics } from "./walk-forward-pipeline.js";
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
  requireStableSelection?: boolean;
  minTrades?: number;
}

export function runWalkForwardParameterSelection(
  input: WalkForwardParameterSelectionInput,
): WalkForwardParameterSelectionResult {
  if (input.candidates.length === 0)
    throw new Error("at least one strategy candidate is required");
  if (!Number.isFinite(input.initialCapital) || input.initialCapital <= 0)
    throw new Error("initialCapital must be positive and finite");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0)
    throw new Error("quantity must be positive and finite");
  const requireStableSelection = input.requireStableSelection ?? true;
  const minTrades = input.minTrades ?? 3;
  if (!Number.isInteger(minTrades) || minTrades < 0)
    throw new Error("minTrades must be a non-negative integer");
  const ranges = createWalkForwardWindows(
    input.candles.length,
    input.walkForward,
  );
  if (ranges.length === 0)
    throw new Error("at least one complete OOS window is required");
  let currentCapital = input.initialCapital;
  const windows = ranges.map((window) => {
    const { train, test: testCandles } = splitWalkForward(
      input.candles,
      window,
    );
    const stabilityInput = {
      candles: train,
      initialCapital: input.initialCapital,
      candidates: input.candidates,
      quantity: input.quantity,
      stressScenarios: input.stressScenarios,
      robustnessThresholds: input.robustnessThresholds,
      minTrades,
    };

    const stabilityInputWithExecution =
      input.execution === undefined
        ? input.stabilitySpreadThresholdPct === undefined
          ? stabilityInput
          : {
              ...stabilityInput,
              stabilitySpreadThresholdPct: input.stabilitySpreadThresholdPct,
            }
        : input.stabilitySpreadThresholdPct === undefined
          ? { ...stabilityInput, execution: input.execution }
          : {
              ...stabilityInput,
              execution: input.execution,
              stabilitySpreadThresholdPct: input.stabilitySpreadThresholdPct,
            };
    const selection = analyzeParameterStability(stabilityInputWithExecution);
    if (selection.best === undefined)
      throw new Error("parameter selection produced no best candidate");
    if (requireStableSelection && !selection.stable)
      throw new Error(
        `unstable parameter selection for walk-forward window ${window.trainStart}-${window.testEnd}: score spread ${selection.scoreSpreadPct.toFixed(2)}% exceeds the allowed threshold or best score is non-positive`,
      );
    // Selection remains training-only; OOS execution uses the actual capital path.
    const quantity = input.quantity * (currentCapital / input.initialCapital);
    const strategyConfig =
      input.execution === undefined
        ? { quantity, strategy: selection.best.candidate.strategy }
        : {
            quantity,
            strategy: selection.best.candidate.strategy,
            execution: input.execution,
          };
    const testResult = runBacktestPipeline({
      candles: testCandles,
      initialCapital: currentCapital,
      strategy: strategyConfig,
      liquidateAtEnd: true,
      stressScenarios: input.stressScenarios,
      robustnessThresholds: input.robustnessThresholds,
    });
    currentCapital = testResult.baseline.finalEquity;
    if (!Number.isFinite(currentCapital) || currentCapital <= 0)
      throw new Error("OOS capital exhausted");
    return { ...window, selection, test: testResult };
  });
  return {
    windows,
    outOfSample: aggregateWalkForwardOutOfSampleMetrics(windows),
  };
}

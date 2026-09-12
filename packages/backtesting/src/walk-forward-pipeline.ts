import type { Candle, ExecutionFill } from "./execution-model.js";
import { runBacktestPipeline, type BacktestPipelineInput, type BacktestPipelineResult } from "./backtest-pipeline.js";
import { createWalkForwardWindows, splitWalkForward, type WalkForwardOptions, type WalkForwardWindow } from "./walk-forward.js";
import { evaluateWalkForwardRobustness, type RobustnessReport } from "./robustness.js";
import type { PerformanceMetrics } from "./performance-metrics.js";
import type { StrategyExecutionConfig } from "./strategy-execution-adapter.js";

export type WalkForwardStrategyOptimizer = (
  trainCandles: readonly Candle[],
  baseStrategy: StrategyExecutionConfig
) => StrategyExecutionConfig;

export interface WalkForwardPipelineWindow extends WalkForwardWindow {
  train: BacktestPipelineResult;
  test: BacktestPipelineResult;
  selectedStrategy?: StrategyExecutionConfig;
}

export interface WalkForwardConsistency {
  windowCount: number;
  profitableWindowPct: number;
  averageOosReturnPct: number;
  medianOosReturnPct: number;
  worstOosReturnPct: number;
  averageOosDrawdownPct: number;
  worstOosDrawdownPct: number;
}

export interface WalkForwardPipelineResult {
  windows: WalkForwardPipelineWindow[];
  outOfSample: PerformanceMetrics;
  consistency: WalkForwardConsistency;
  robustness: RobustnessReport;
}

export interface WalkForwardPipelineInput extends Omit<BacktestPipelineInput, "candles"> {
  candles: readonly Candle[];
  walkForward: WalkForwardOptions;
  strategyOptimizer?: WalkForwardStrategyOptimizer;
}

function fillsForRange(fills: readonly ExecutionFill[], start: number, end: number): ExecutionFill[] {
  return fills
    .filter((fill) => fill.signalIndex >= start && fill.executionIndex >= start && fill.signalIndex < end && fill.executionIndex < end)
    .map((fill) => ({ ...fill, signalIndex: fill.signalIndex - start, executionIndex: fill.executionIndex - start }));
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function aggregateOutOfSampleMetrics(windows: readonly WalkForwardPipelineWindow[]): PerformanceMetrics {
  const tradeCount = windows.reduce((sum, window) => sum + window.test.metrics.tradeCount, 0);
  const initialCapital = windows[0]?.test.baseline.initialCapital ?? 0;
  let compoundedEquity = initialCapital;
  let peakEquity = initialCapital;
  let maxDrawdownPct = 0;
  for (const window of windows) {
    const windowInitialCapital = window.test.baseline.initialCapital;
    if (!Number.isFinite(windowInitialCapital) || windowInitialCapital <= 0) continue;
    for (const point of window.test.baseline.equityCurve) {
      const normalizedEquity = point.equity / windowInitialCapital;
      const equity = compoundedEquity * normalizedEquity;
      peakEquity = Math.max(peakEquity, equity);
      const drawdownPct = peakEquity === 0 ? 0 : ((peakEquity - equity) / peakEquity) * 100;
      maxDrawdownPct = Math.max(maxDrawdownPct, drawdownPct);
    }
    compoundedEquity *= window.test.baseline.finalEquity / windowInitialCapital;
  }
  const netProfit = compoundedEquity - initialCapital;
  const totalReturnPct = initialCapital === 0 ? 0 : (netProfit / initialCapital) * 100;
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
  return { totalReturnPct, netProfit, maxDrawdownPct, tradeCount, winRatePct, profitFactor, expectancy: tradeCount === 0 ? 0 : netProfit / tradeCount, averageWin, averageLoss };
}

export function aggregateWalkForwardOutOfSampleMetrics(
  windows: readonly { test: BacktestPipelineResult }[]
): PerformanceMetrics {
  return aggregateOutOfSampleMetrics(windows as readonly WalkForwardPipelineWindow[]);
}

function calculateConsistency(windows: readonly WalkForwardPipelineWindow[]): WalkForwardConsistency {
  const returns = windows.map((window) => window.test.metrics.totalReturnPct);
  const drawdowns = windows.map((window) => window.test.metrics.maxDrawdownPct);
  const profitable = returns.filter((value) => value > 0).length;
  return {
    windowCount: windows.length,
    profitableWindowPct: windows.length === 0 ? 0 : (profitable / windows.length) * 100,
    averageOosReturnPct: returns.length === 0 ? 0 : returns.reduce((sum, value) => sum + value, 0) / returns.length,
    medianOosReturnPct: median(returns),
    worstOosReturnPct: returns.length === 0 ? 0 : Math.min(...returns),
    averageOosDrawdownPct: drawdowns.length === 0 ? 0 : drawdowns.reduce((sum, value) => sum + value, 0) / drawdowns.length,
    worstOosDrawdownPct: drawdowns.length === 0 ? 0 : Math.max(...drawdowns)
  };
}

export function runWalkForwardPipeline(input: WalkForwardPipelineInput): WalkForwardPipelineResult {
  const { candles: inputCandles, walkForward, strategyOptimizer, strategy: baseStrategy, ...pipelineConfig } = input;
  const windows = createWalkForwardWindows(inputCandles.length, walkForward).map((window) => {
    const selectedStrategy = baseStrategy && strategyOptimizer ? strategyOptimizer(inputCandles.slice(window.trainStart, window.trainEnd), baseStrategy) : baseStrategy;
    const strategyConfig = selectedStrategy === undefined ? {} : { strategy: selectedStrategy };
    const { train, test } = splitWalkForward(inputCandles, window);
    const trainInput: BacktestPipelineInput = input.fills
      ? { ...pipelineConfig, fills: fillsForRange(input.fills, window.trainStart, window.trainEnd), candles: train, ...strategyConfig }
      : { ...pipelineConfig, candles: train, ...strategyConfig };
    const testInput: BacktestPipelineInput = input.fills
      ? { ...pipelineConfig, fills: fillsForRange(input.fills, window.testStart, window.testEnd), candles: test, ...strategyConfig }
      : { ...pipelineConfig, candles: test, ...strategyConfig };
    const result = { ...window, train: runBacktestPipeline(trainInput), test: runBacktestPipeline(testInput) };
    return selectedStrategy === undefined ? result : { ...result, selectedStrategy };
  });
  const outOfSample = aggregateOutOfSampleMetrics(windows);
  const consistency = calculateConsistency(windows);
  const robustness = evaluateWalkForwardRobustness({ outOfSample, consistency }, input.robustnessThresholds);
  return { windows, outOfSample, consistency, robustness };
}

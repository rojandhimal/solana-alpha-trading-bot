import type { Candle, ExecutionFill } from "./execution-model.js";
import { runBacktestPipeline, type BacktestPipelineInput, type BacktestPipelineResult } from "./backtest-pipeline.js";
import { createWalkForwardWindows, splitWalkForward, type WalkForwardOptions, type WalkForwardWindow } from "./walk-forward.js";
import { evaluateWalkForwardRobustness, type RobustnessReport } from "./robustness.js";
import type { PerformanceMetrics } from "./performance-metrics.js";

export interface WalkForwardPipelineWindow extends WalkForwardWindow {
  train: BacktestPipelineResult;
  test: BacktestPipelineResult;
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
}

function fillsForRange(
  fills: readonly ExecutionFill[],
  start: number,
  end: number
): ExecutionFill[] {
  return fills
    .filter(
      (fill) =>
        fill.signalIndex >= start &&
        fill.executionIndex >= start &&
        fill.signalIndex < end &&
        fill.executionIndex < end
    )
    .map((fill) => ({
      ...fill,
      signalIndex: fill.signalIndex - start,
      executionIndex: fill.executionIndex - start
    }));
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle]!;
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + upper) / 2 : upper;
}

function aggregateOutOfSampleMetrics(windows: readonly WalkForwardPipelineWindow[]): PerformanceMetrics {
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
  const windows = createWalkForwardWindows(input.candles.length, input.walkForward).map((window) => {
    const { train, test } = splitWalkForward(input.candles, window);
    const trainInput: BacktestPipelineInput = input.fills
      ? { ...input, fills: fillsForRange(input.fills, window.trainStart, window.trainEnd), candles: train }
      : { ...input, candles: train };
    const testInput: BacktestPipelineInput = input.fills
      ? { ...input, fills: fillsForRange(input.fills, window.testStart, window.testEnd), candles: test }
      : { ...input, candles: test };

    return {
      ...window,
      train: runBacktestPipeline(trainInput),
      test: runBacktestPipeline(testInput)
    };
  });

  const outOfSample = aggregateOutOfSampleMetrics(windows);
  const consistency = calculateConsistency(windows);
  const robustness = evaluateWalkForwardRobustness({ outOfSample, consistency }, input.robustnessThresholds);

  return { windows, outOfSample, consistency, robustness };
}

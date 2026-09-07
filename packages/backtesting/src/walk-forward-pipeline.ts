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

/**
 * Aggregates OOS windows as a stitched equity curve. Each test window is
 * independently backtested from the same starting capital, so its equity is
 * rebased to the capital carried forward from the previous window. This avoids
 * treating each window's profit as if it were earned independently from a
 * fresh account when calculating total return and drawdown.
 */
export function aggregateWalkForwardOutOfSampleMetrics(
  windows: readonly { test: BacktestPipelineResult }[]
): PerformanceMetrics {
  if (windows.length === 0) {
    return {
      totalReturnPct: 0,
      netProfit: 0,
      maxDrawdownPct: 0,
      tradeCount: 0,
      winRatePct: 0,
      profitFactor: 0,
      expectancy: 0,
      averageWin: 0,
      averageLoss: 0
    };
  }

  const startingCapital = windows[0]?.test.baseline.initialCapital ?? 0;
  let carriedCapital = startingCapital;
  let peakEquity = startingCapital;
  let maxDrawdownPct = 0;
  let tradeCount = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  for (const window of windows) {
    const test = window.test;
    const windowInitialCapital = test.baseline.initialCapital;
    const equityCurve = test.baseline.equityCurve;

    if (windowInitialCapital <= 0 || !Number.isFinite(windowInitialCapital)) {
      throw new Error("walk-forward test initialCapital must be positive and finite");
    }

    for (const point of equityCurve) {
      const stitchedEquity = carriedCapital * (point.equity / windowInitialCapital);
      peakEquity = Math.max(peakEquity, stitchedEquity);
      const drawdownPct = peakEquity === 0 ? 0 : ((peakEquity - stitchedEquity) / peakEquity) * 100;
      maxDrawdownPct = Math.max(maxDrawdownPct, drawdownPct);
    }

    carriedCapital = carriedCapital * (test.baseline.finalEquity / windowInitialCapital);

    const metrics = test.metrics;
    tradeCount += metrics.tradeCount;
    const wins = (metrics.winRatePct / 100) * metrics.tradeCount;
    const losses = metrics.tradeCount - wins;
    winningTrades += wins;
    losingTrades += losses;
    grossProfit += metrics.averageWin * wins;
    grossLoss += metrics.averageLoss * losses;
  }

  const netProfit = carriedCapital - startingCapital;
  const totalReturnPct = startingCapital === 0 ? 0 : (netProfit / startingCapital) * 100;
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

  const outOfSample = aggregateWalkForwardOutOfSampleMetrics(windows);
  const consistency = calculateConsistency(windows);
  const robustness = evaluateWalkForwardRobustness({ outOfSample, consistency }, input.robustnessThresholds);

  return { windows, outOfSample, consistency, robustness };
}

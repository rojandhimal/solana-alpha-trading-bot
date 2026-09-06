import type { Candle } from "./execution-model.js";
import { runBacktestPipeline, type BacktestPipelineInput, type BacktestPipelineResult } from "./backtest-pipeline.js";
import { createWalkForwardWindows, splitWalkForward, type WalkForwardOptions, type WalkForwardWindow } from "./walk-forward.js";
import type { PerformanceMetrics } from "./performance-metrics.js";

export interface WalkForwardPipelineWindow extends WalkForwardWindow {
  train: BacktestPipelineResult;
  test: BacktestPipelineResult;
}

export interface WalkForwardPipelineResult {
  windows: WalkForwardPipelineWindow[];
  outOfSample: PerformanceMetrics;
}

export interface WalkForwardPipelineInput extends Omit<BacktestPipelineInput, "candles"> {
  candles: readonly Candle[];
  walkForward: WalkForwardOptions;
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

export function runWalkForwardPipeline(input: WalkForwardPipelineInput): WalkForwardPipelineResult {
  const windows = createWalkForwardWindows(input.candles.length, input.walkForward).map((window) => {
    const { train, test } = splitWalkForward(input.candles, window);
    return {
      ...window,
      train: runBacktestPipeline({ ...input, candles: train }),
      test: runBacktestPipeline({ ...input, candles: test })
    };
  });

  return { windows, outOfSample: aggregateOutOfSampleMetrics(windows) };
}

import type { Candle } from "./execution-model.js";
import { runBacktestPipeline, type BacktestPipelineInput, type BacktestPipelineResult } from "./backtest-pipeline.js";
import { createWalkForwardWindows, splitWalkForward, type WalkForwardOptions, type WalkForwardWindow } from "./walk-forward.js";

export interface WalkForwardPipelineResult {
  windows: Array<WalkForwardWindow & { train: BacktestPipelineResult; test: BacktestPipelineResult }>;
}

export interface WalkForwardPipelineInput extends Omit<BacktestPipelineInput, "candles"> {
  candles: readonly Candle[];
  walkForward: WalkForwardOptions;
}

export function runWalkForwardPipeline(input: WalkForwardPipelineInput): WalkForwardPipelineResult {
  const windows = createWalkForwardWindows(input.candles.length, input.walkForward);
  return {
    windows: windows.map((window) => {
      const { train, test } = splitWalkForward(input.candles, window);
      return {
        ...window,
        train: runBacktestPipeline({ ...input, candles: train }),
        test: runBacktestPipeline({ ...input, candles: test })
      };
    })
  };
}

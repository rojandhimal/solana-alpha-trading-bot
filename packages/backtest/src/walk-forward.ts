import type { OhlcvBar } from "../../market-data/src/historical-source.js";
import type { BacktestConfig, BacktestResult, BacktestStrategy } from "./engine.js";
import { runBacktest } from "./engine.js";

export interface WalkForwardConfig extends BacktestConfig {
  trainBars: number;
  testBars: number;
  stepBars?: number;
}

export interface WalkForwardWindow {
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
  result: BacktestResult;
}

export function runWalkForward(
  bars: readonly OhlcvBar[],
  strategy: BacktestStrategy,
  config: WalkForwardConfig,
): readonly WalkForwardWindow[] {
  if (config.trainBars <= 0 || config.testBars <= 0) throw new Error("trainBars and testBars must be positive");
  const step = config.stepBars ?? config.testBars;
  if (step <= 0) throw new Error("stepBars must be positive");

  const windows: WalkForwardWindow[] = [];
  for (let start = 0; start + config.trainBars + config.testBars <= bars.length; start += step) {
    const testStart = start + config.trainBars;
    const testEnd = testStart + config.testBars;
    windows.push({
      trainStart: start,
      trainEnd: testStart,
      testStart,
      testEnd,
      result: runBacktest(bars.slice(testStart, testEnd), strategy, config),
    });
  }
  return windows;
}

import { describe, expect, it } from "vitest";
import { runWalkForwardPipeline } from "./walk-forward-pipeline.js";

const candles = Array.from({ length: 20 }, (_, i) => ({ open: 100 + i, high: 101 + i, low: 99 + i, close: 100.5 + i }));

describe("walk-forward pipeline", () => {
  it("runs a complete backtest for each train/test window", () => {
    const result = runWalkForwardPipeline({
      candles,
      initialCapital: 10_000,
      stressScenarios: [],
      robustnessThresholds: { minPassingScenarioRatePct: 0, maxDrawdownPct: 100, minProfitFactor: 0, minExpectancy: -Infinity },
      fills: [],
      walkForward: { trainingBars: 10, testingBars: 5 }
    });

    expect(result.windows).toHaveLength(2);
    expect(result.windows[0]?.train.baseline.finalEquity).toBe(10_000);
    expect(result.windows[0]?.test.baseline.finalEquity).toBe(10_000);
  });
});

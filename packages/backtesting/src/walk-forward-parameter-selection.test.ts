import { describe, expect, it } from "vitest";
import { runWalkForwardParameterSelection } from "./walk-forward-parameter-selection.js";

const candles = Array.from({ length: 60 }, (_, i) => {
  const close = 100 + i * 0.5;
  return { open: close, high: close + 1, low: close - 1, close, volume: 100 + i };
});

const candidate = {
  fastPeriod: 5,
  slowPeriod: 10,
  rsiPeriod: 5,
  momentumPeriod: 5,
  atrPeriod: 5,
  volumePeriod: 5,
  entryThreshold: 0.5
};

const thresholds = {
  minPassingScenarioRatePct: 0,
  maxDrawdownPct: 100,
  minProfitFactor: 0,
  minExpectancy: -1_000
};

describe("walk-forward parameter selection", () => {
  it("selects parameters from training data and evaluates the selected candidate only on the following test window", () => {
    const result = runWalkForwardParameterSelection({
      candles,
      initialCapital: 10_000,
      candidates: [
        { label: "baseline", strategy: candidate },
        { label: "slower", strategy: { ...candidate, fastPeriod: 8, slowPeriod: 16 } }
      ],
      quantity: 1,
      execution: { slippagePct: 0, feePct: 0, executionDelayBars: 0, liquidityMultiplier: 1, volatilityMultiplier: 1 },
      stressScenarios: [],
      robustnessThresholds: thresholds,
      walkForward: { trainingBars: 30, testingBars: 15 }
    });

    expect(result.windows).toHaveLength(2);
    expect(result.windows[0]?.selection.candidates).toHaveLength(2);
    expect(result.windows[0]?.selection.best).toBeDefined();
    expect(result.windows[0]?.test.baseline.initialCapital).toBe(10_000);
    expect(result.outOfSample.tradeCount).toBe(
      result.windows.reduce((sum, window) => sum + window.test.metrics.tradeCount, 0)
    );
  });

  it("fails fast when no candidates are provided", () => {
    expect(() => runWalkForwardParameterSelection({
      candles,
      initialCapital: 10_000,
      candidates: [],
      quantity: 1,
      stressScenarios: [],
      robustnessThresholds: thresholds,
      walkForward: { trainingBars: 30, testingBars: 15 }
    })).toThrow("at least one strategy candidate is required");
  });
});

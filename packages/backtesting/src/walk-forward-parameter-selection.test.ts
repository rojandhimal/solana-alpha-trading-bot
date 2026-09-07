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
      walkForward: { trainingBars: 30, testingBars: 15 },
      requireStableSelection: false
    });

    expect(result.windows).toHaveLength(2);
    expect(result.windows[0]?.selection.candidates).toHaveLength(2);
    expect(result.windows[0]?.selection.best).toBeDefined();
    expect(result.windows[0]?.test.baseline.initialCapital).toBe(10_000);
    expect(result.outOfSample.tradeCount).toBe(
      result.windows.reduce((sum, window) => sum + window.test.metrics.tradeCount, 0)
    );
  });

  it("does not let changes in the first OOS window affect parameter selection", () => {
    const futureChangedCandles = candles.map((candle, index) =>
      index >= 30 && index < 45
        ? { ...candle, open: candle.open * 3, high: candle.high * 3, low: candle.low * 3, close: candle.close * 3 }
        : candle
    );

    const input = {
      initialCapital: 10_000,
      candidates: [
        { label: "baseline", strategy: candidate },
        { label: "slower", strategy: { ...candidate, fastPeriod: 8, slowPeriod: 16 } }
      ],
      quantity: 1,
      stressScenarios: [],
      robustnessThresholds: thresholds,
      walkForward: { trainingBars: 30, testingBars: 15 },
      requireStableSelection: false
    } as const;

    const original = runWalkForwardParameterSelection({ ...input, candles });
    const changed = runWalkForwardParameterSelection({ ...input, candles: futureChangedCandles });

    expect(changed.windows[0]?.selection.candidates.map((item) => item.candidate.label))
      .toEqual(original.windows[0]?.selection.candidates.map((item) => item.candidate.label));
    expect(changed.windows[0]?.selection.candidates.map((item) => item.riskAdjustedScore))
      .toEqual(original.windows[0]?.selection.candidates.map((item) => item.riskAdjustedScore));
    expect(changed.windows[0]?.selection.best?.candidate.label)
      .toBe(original.windows[0]?.selection.best?.candidate.label);
  });

  it("fails closed by default when only one candidate is available", () => {
    expect(() => runWalkForwardParameterSelection({
      candles,
      initialCapital: 10_000,
      candidates: [{ label: "only", strategy: candidate }],
      quantity: 1,
      stressScenarios: [],
      robustnessThresholds: thresholds,
      walkForward: { trainingBars: 30, testingBars: 15 }
    })).toThrow("unstable parameter selection");
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

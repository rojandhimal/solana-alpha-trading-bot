import { describe, expect, it } from "vitest";
import { analyzeParameterStability } from "./parameter-stability.js";

const candles = Array.from({ length: 60 }, (_, i) => {
  const close = 100 + i * 0.5;
  return { open: close, high: close + 1, low: close - 1, close, volume: 100 + i };
});

const base = {
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

describe("parameter stability analysis", () => {
  it("backtests every candidate, ranks them deterministically, and exposes the best candidate", () => {
    const result = analyzeParameterStability({
      candles,
      initialCapital: 10_000,
      quantity: 1,
      candidates: [
        { label: "baseline", strategy: base },
        { label: "slower", strategy: { ...base, fastPeriod: 8, slowPeriod: 16 } }
      ],
      execution: { slippagePct: 0, feePct: 0, executionDelayBars: 0, liquidityMultiplier: 1, volatilityMultiplier: 1 },
      stressScenarios: [],
      robustnessThresholds: thresholds
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((candidate) => candidate.rank)).toEqual([1, 2]);
    expect(result.best?.rank).toBe(1);
    expect(result.candidates.every((candidate) => Number.isFinite(candidate.riskAdjustedScore))).toBe(true);
    expect(result.scoreSpreadPct).toBeGreaterThanOrEqual(0);
    expect(typeof result.stable).toBe("boolean");
  });

  it("rejects an empty candidate set and invalid stability thresholds", () => {
    expect(() => analyzeParameterStability({
      candles,
      initialCapital: 10_000,
      quantity: 1,
      candidates: [],
      stressScenarios: [],
      robustnessThresholds: thresholds
    })).toThrow("at least one strategy candidate is required");

    expect(() => analyzeParameterStability({
      candles,
      initialCapital: 10_000,
      quantity: 1,
      candidates: [{ strategy: base }],
      stabilitySpreadThresholdPct: -1,
      stressScenarios: [],
      robustnessThresholds: thresholds
    })).toThrow("stabilitySpreadThresholdPct must be non-negative");
  });
});

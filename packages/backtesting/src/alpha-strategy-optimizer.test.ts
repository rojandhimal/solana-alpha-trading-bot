import { describe, expect, it } from "vitest";
import { optimizeAlphaStrategy } from "./alpha-strategy-optimizer.js";

const base = {
  quantity: 1,
  strategy: { fastPeriod: 5, slowPeriod: 10, rsiPeriod: 5, momentumPeriod: 5, atrPeriod: 5, volumePeriod: 5, entryThreshold: 0.5 },
  execution: { slippagePct: 0, feePct: 0, executionDelayBars: 0, liquidityMultiplier: 1, volatilityMultiplier: 1 }
};

const candles = Array.from({ length: 40 }, (_, i) => {
  const close = 100 + i;
  return { open: close, high: close + 1, low: close - 1, close, volume: 100 };
});

describe("alpha strategy optimizer", () => {
  it("selects a candidate using training candles only", () => {
    const result = optimizeAlphaStrategy(candles, base, {
      fastPeriods: [3, 5], slowPeriods: [10], rsiPeriods: [5], momentumPeriods: [5], atrPeriods: [5], volumePeriods: [5], entryThresholds: [0.5], minTrades: 0
    });
    expect(result.strategy.strategy).toMatchObject({ fastPeriod: expect.any(Number), slowPeriod: 10 });
    expect(result.strategy.execution).toEqual(base.execution);
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("rejects empty training data", () => {
    expect(() => optimizeAlphaStrategy([], base)).toThrow("trainCandles must not be empty");
  });
});

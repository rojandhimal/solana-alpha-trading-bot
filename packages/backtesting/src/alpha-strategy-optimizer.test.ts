import { describe, expect, it } from "vitest";
import { optimizeAlphaStrategy } from "./alpha-strategy-optimizer.js";

const base = {
  quantity: 1,
  strategy: { fastPeriod: 5, slowPeriod: 10, rsiPeriod: 5, momentumPeriod: 5, atrPeriod: 5, volumePeriod: 5, entryThreshold: 0.5 },
  execution: { slippagePct: 0, feePct: 0, executionDelayBars: 0, liquidityMultiplier: 1, volatilityMultiplier: 1 }
};
const candles = Array.from({ length: 80 }, (_, i) => { const close = 100 + i; return { open: close, high: close + 1, low: close - 1, close, volume: 100 }; });

describe("alpha strategy optimizer", () => {
  it("uses an inner validation split and deterministic selection", () => {
    const options = { fastPeriods: [3, 5], slowPeriods: [10], rsiPeriods: [5], momentumPeriods: [5], atrPeriods: [5], volumePeriods: [5], entryThresholds: [0.5], minTrades: 0, validationFraction: 0.25 } as const;
    const first = optimizeAlphaStrategy(candles, base, options);
    const second = optimizeAlphaStrategy(candles, base, options);
    expect(first).toEqual(second);
    expect(first.strategy.strategy).toMatchObject({ fastPeriod: expect.any(Number), slowPeriod: 10 });
    expect(first.validationScore).toEqual(expect.any(Number));
  });

  it("rejects insufficient training data for inner validation", () => {
    expect(() => optimizeAlphaStrategy([], base)).toThrow("at least four candles");
  });

  it("propagates the supplied initial capital", () => {
    const result = optimizeAlphaStrategy(candles, base, { fastPeriods: [3], slowPeriods: [10], rsiPeriods: [5], momentumPeriods: [5], atrPeriods: [5], volumePeriods: [5], entryThresholds: [0.5], minTrades: 0, initialCapital: 20_000 });
    expect(result.initialCapital).toBe(20_000);
  });

  it("rejects invalid initial capital", () => {
    expect(() => optimizeAlphaStrategy(candles, base, { initialCapital: 0 })).toThrow("initialCapital must be positive and finite");
  });

  it("rejects invalid validation fractions", () => {
    expect(() => optimizeAlphaStrategy(candles, base, { validationFraction: 0.5 })).toThrow("validationFraction");
  });
});

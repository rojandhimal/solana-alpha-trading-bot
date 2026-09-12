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

  it("uses the supplied initial capital for optimization scoring", () => {
    const result = optimizeAlphaStrategy(candles, base, {
      fastPeriods: [3], slowPeriods: [10], rsiPeriods: [5], momentumPeriods: [5], atrPeriods: [5], volumePeriods: [5], entryThresholds: [0.5], minTrades: 0, initialCapital: 20_000
    });
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("filters candidates below the minimum trade count", () => {
    const result = optimizeAlphaStrategy(candles, base, {
      fastPeriods: [3], slowPeriods: [10], rsiPeriods: [5], momentumPeriods: [5], atrPeriods: [5], volumePeriods: [5], entryThresholds: [0.5], minTrades: 999
    });
    expect(result.score).toBe(Number.NEGATIVE_INFINITY);
    expect(result.tradeCount).toBe(0);
  });

  it("rejects an oversized candidate grid instead of truncating it", () => {
    expect(() => optimizeAlphaStrategy(candles, base, {
      fastPeriods: [3, 4, 5], slowPeriods: [10, 11, 12], rsiPeriods: [5, 6], momentumPeriods: [5, 6], atrPeriods: [5, 6], volumePeriods: [5, 6], entryThresholds: [0.4, 0.5, 0.6], maxCandidates: 10
    })).toThrow("exceeding maxCandidates 10");
  });

  it("rejects invalid optimizer guard values", () => {
    expect(() => optimizeAlphaStrategy(candles, base, { minProfitFactor: -1 })).toThrow("minProfitFactor must be non-negative and finite");
    expect(() => optimizeAlphaStrategy(candles, base, { minExpectancy: Number.NaN })).toThrow("minExpectancy must be finite");
    expect(() => optimizeAlphaStrategy(candles, base, { maxCandidates: 0 })).toThrow("maxCandidates must be a positive integer");
  });

  it("rejects invalid initial capital", () => {
    expect(() => optimizeAlphaStrategy(candles, base, { initialCapital: 0 })).toThrow("initialCapital must be positive and finite");
  });

  it("rejects empty training data", () => {
    expect(() => optimizeAlphaStrategy([], base)).toThrow("trainCandles must not be empty");
  });
});

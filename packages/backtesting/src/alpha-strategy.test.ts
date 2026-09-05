import { describe, expect, it } from "vitest";
import { calculateFeatures, generateSignal, type StrategyCandle } from "./alpha-strategy.js";

function candles(count: number, trend: number, volume = 100): StrategyCandle[] {
  return Array.from({ length: count }, (_, i) => {
    const close = 100 + i * trend;
    return { open: close - trend * 0.5, high: close + 1, low: close - 1, close, volume };
  });
}

describe("alpha strategy", () => {
  it("returns neutral RSI for insufficient history", () => {
    const features = calculateFeatures(candles(5, 0));
    expect(features.rsi).toBe(50);
  });

  it("detects bullish trend and positive momentum", () => {
    const features = calculateFeatures(candles(60, 1));
    expect(features.fastEma).toBeGreaterThan(features.slowEma);
    expect(features.momentumPct).toBeGreaterThan(0);
  });

  it("detects bearish trend and negative momentum", () => {
    const features = calculateFeatures(candles(60, -1));
    expect(features.fastEma).toBeLessThan(features.slowEma);
    expect(features.momentumPct).toBeLessThan(0);
  });

  it("generates LONG for strong bullish conditions", () => {
    const signal = generateSignal(candles(60, 1));
    expect(signal.side).toBe("LONG");
    expect(signal.score).toBeGreaterThanOrEqual(0.5);
  });

  it("generates SHORT for strong bearish conditions", () => {
    const signal = generateSignal(candles(60, -1));
    expect(signal.side).toBe("SHORT");
    expect(signal.score).toBeLessThanOrEqual(-0.5);
  });

  it("does not manufacture a directional signal in a flat market", () => {
    const signal = generateSignal(candles(60, 0));
    expect(signal.side).toBe("FLAT");
    expect(signal.score).toBe(0);
  });

  it("rejects invalid configuration", () => {
    expect(() => generateSignal(candles(60, 1), { fastPeriod: 0, slowPeriod: 30, rsiPeriod: 14, momentumPeriod: 10, atrPeriod: 14, volumePeriod: 20, entryThreshold: 0.5 })).toThrow();
    expect(() => generateSignal(candles(60, 1), { fastPeriod: 10, slowPeriod: 30, rsiPeriod: 14, momentumPeriod: 10, atrPeriod: 14, volumePeriod: 20, entryThreshold: 1.1 })).toThrow();
  });
});

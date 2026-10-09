import { describe, expect, it } from "vitest";
import { generateStrategyFills } from "./strategy-execution-adapter.js";
import { generateSignal, type AlphaStrategyConfig, type StrategyCandle } from "./alpha-strategy.js";

function candles(count: number, trend: number): StrategyCandle[] {
  return Array.from({ length: count }, (_, i) => {
    const close = 100 + i * trend;
    return { open: close, high: close + 1, low: close - 1, close, volume: 100 };
  });
}

describe("strategy execution adapter", () => {
  it("creates executable BUY fills from a bullish strategy", () => {
    const fills = generateStrategyFills(candles(60, 1), { quantity: 1 });
    expect(fills.length).toBeGreaterThan(0);
    expect(fills[0]?.side).toBe("BUY");
  });

  it("creates executable SELL fills from a bearish strategy", () => {
    const fills = generateStrategyFills(candles(60, -1), { quantity: 1 });
    expect(fills.length).toBeGreaterThan(0);
    expect(fills[0]?.side).toBe("SELL");
  });

  it("does not trade a flat market", () => {
    const fills = generateStrategyFills(candles(60, 0), { quantity: 1 });
    expect(fills).toHaveLength(0);
  });

  it("bounded lookback preserves the full-history strategy signals", () => {
    const input = candles(180, 0.25);
    const strategy: AlphaStrategyConfig = { fastPeriod: 7, slowPeriod: 23, rsiPeriod: 11, momentumPeriod: 9, atrPeriod: 13, volumePeriod: 17, entryThreshold: 0.5 };
    const lookback = Math.max(strategy.slowPeriod * 3, strategy.rsiPeriod + 1, strategy.momentumPeriod + 1, strategy.atrPeriod + 1, strategy.volumePeriod);
    for (let index = 0; index < input.length; index += 1) {
      const full = generateSignal(input.slice(0, index + 1), strategy);
      const bounded = generateSignal(input.slice(Math.max(0, index + 1 - lookback), index + 1), strategy);
      expect(bounded).toEqual(full);
    }
  });

  it("rejects invalid quantity", () => {
    expect(() => generateStrategyFills(candles(60, 1), { quantity: 0 })).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { generateStrategyFills } from "./strategy-execution-adapter.js";
import type { StrategyCandle } from "./alpha-strategy.js";

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

  it("rejects invalid quantity", () => {
    expect(() => generateStrategyFills(candles(60, 1), { quantity: 0 })).toThrow();
  });
});

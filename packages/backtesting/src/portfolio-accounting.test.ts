import { describe, expect, it } from "vitest";
import { accountFills } from "./portfolio-accounting.js";
import type { Candle, ExecutionFill } from "./execution-model.js";

const candles: Candle[] = [
  { open: 100, high: 100, low: 100, close: 100 },
  { open: 110, high: 110, low: 110, close: 110 },
  { open: 120, high: 120, low: 120, close: 120 }
];

const fill = (executionIndex: number, side: "BUY" | "SELL", quantity: number, price: number, fee = 0): ExecutionFill => ({
  signalIndex: executionIndex,
  executionIndex,
  side,
  quantity,
  referencePrice: price,
  fillPrice: price,
  fee
});

function equityAt(result: ReturnType<typeof accountFills>, index: number) {
  const point = result.equityCurve[index];
  expect(point).toBeDefined();
  return point!;
}

describe("portfolio accounting", () => {
  it("marks an open position to market", () => {
    const result = accountFills(candles, [fill(0, "BUY", 1, 100)], 1_000);
    expect(result.finalEquity).toBe(1_020);
    expect(equityAt(result, 0).positionQuantity).toBe(1);
    expect(equityAt(result, 2).unrealizedPnl).toBe(20);
  });

  it("realizes PnL and charges fees on entry and exit", () => {
    const result = accountFills(candles, [fill(0, "BUY", 2, 100, 1), fill(1, "SELL", 2, 110, 1)], 1_000);
    expect(result.realizedPnl).toBe(18);
    expect(result.feesPaid).toBe(2);
    expect(result.finalEquity).toBe(1_018);
    expect(result.completedTrades).toBe(1);
  });

  it("supports partial exits and keeps the remaining position", () => {
    const result = accountFills(candles, [fill(0, "BUY", 2, 100), fill(1, "SELL", 1, 110)], 1_000);
    expect(equityAt(result, 1).positionQuantity).toBe(1);
    expect(result.realizedPnl).toBe(10);
    expect(result.finalEquity).toBe(1_020);
  });

  it("rejects an oversell", () => {
    expect(() => accountFills(candles, [fill(0, "SELL", 1, 100)], 1_000)).toThrow(/SELL quantity exceeds position/);
  });

  it("rejects a buy that exceeds available cash", () => {
    expect(() => accountFills(candles, [fill(0, "BUY", 11, 100)], 1_000)).toThrow(/insufficient cash/);
  });
});

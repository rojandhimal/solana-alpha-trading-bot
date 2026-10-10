import { describe, expect, it } from "vitest";
import type { Candle, ExecutionFill } from "./execution-model.js";
import { accountFills } from "./portfolio-accounting.js";
import { attributeLongTrades, attributeTrades } from "./trade-attribution.js";
import { InMemoryPaperTradingRepository } from "./paper-trading-persistence.js";

const candles: Candle[] = [100, 110, 120].map((price) => ({
  open: price,
  high: price,
  low: price,
  close: price,
}));
const fill = (
  index: number,
  side: "BUY" | "SELL",
  quantity = 1,
  price = 100,
): ExecutionFill => ({
  signalIndex: index,
  executionIndex: index,
  side,
  quantity,
  referencePrice: price,
  fillPrice: price,
  fee: 0,
});

describe("fill integrity across accounting, attribution and persistence", () => {
  it.each([
    { fillPrice: NaN },
    { referencePrice: 0 },
    { fee: -1 },
    { fee: Infinity },
    { side: "UNKNOWN" },
    { signalIndex: 2 },
    { executionIndex: 0.5 },
    {
      signalIndex: Number.MAX_SAFE_INTEGER + 1,
      executionIndex: Number.MAX_SAFE_INTEGER + 1,
    },
    { quantity: 1e308, fillPrice: 100 },
    { quantity: Number.MIN_VALUE, fillPrice: Number.MIN_VALUE },
  ])("rejects malformed or unrepresentable fills: %j", async (override) => {
    const invalid = { ...fill(0, "BUY"), ...override } as ExecutionFill;
    expect(() => attributeTrades([invalid])).toThrow();
    expect(() => attributeLongTrades([invalid])).toThrow();
    expect(() => accountFills(candles, [invalid], 1000)).toThrow();
    const repository = new InMemoryPaperTradingRepository();
    await expect(
      repository.saveTrade({
        sessionId: "integrity",
        sequence: 0,
        fill: invalid,
        recordedAtMs: 0,
      }),
    ).rejects.toThrow();
    expect(await repository.listTrades("integrity")).toEqual([]);
  });

  it("rejects decreasing execution indices instead of reconciling differently", () => {
    const unordered = [fill(1, "BUY"), fill(0, "SELL")];
    expect(() => attributeTrades(unordered)).toThrow(/order/);
    expect(() =>
      accountFills(candles, unordered, 1000, { allowShort: true }),
    ).toThrow(/order/);
  });

  it.each(["LONG", "SHORT"] as const)(
    "preserves small %s partial positions and fees",
    (side) => {
      const entrySide = side === "LONG" ? "BUY" : "SELL";
      const exitSide = side === "LONG" ? "SELL" : "BUY";
      const fills = [
        { ...fill(0, entrySide, 1e-10), fee: 1e-12 },
        { ...fill(1, exitSide, 5e-11, 110), fee: 5e-13 },
        { ...fill(2, exitSide, 5e-11, 120), fee: 5e-13 },
      ];
      const result = accountFills(candles, fills, 1, { allowShort: true });
      expect(result.equityCurve[1]?.positionQuantity).toBe(
        side === "LONG" ? 5e-11 : -5e-11,
      );
      expect(result.equityCurve[2]?.positionQuantity).toBe(0);
      const trades = attributeTrades(fills);
      expect(trades).toHaveLength(2);
      expect(
        trades.reduce((sum, trade) => sum + trade.entryFee + trade.exitFee, 0),
      ).toBeCloseTo(2e-12, 24);
      expect(trades.reduce((sum, trade) => sum + trade.netPnl, 0)).toBeCloseTo(
        result.realizedPnl,
        23,
      );
    },
  );

  it("rejects even a small oversell in long-only attribution and accounting", () => {
    const fills = [fill(0, "BUY", 1e-10), fill(1, "SELL", 2e-10)];
    expect(() => attributeLongTrades(fills)).toThrow(/exceeds/);
    expect(() => accountFills(candles, fills, 1)).toThrow(/exceeds/);
  });

  it("rejects mark-to-market overflow instead of returning infinite equity", () => {
    const huge = [{ open: 1, high: 1e308, low: 1, close: 1e308 }];
    expect(() => accountFills(huge, [fill(0, "BUY", 10, 1)], 100)).toThrow(
      /overflow/,
    );
  });

  it("rejects aggregate arithmetic overflow even when individual fills are finite", () => {
    const fills = [fill(0, "SELL", 1, 1e308), fill(0, "SELL", 1, 1e308)];
    expect(() =>
      accountFills(candles, fills, 100, { allowShort: true }),
    ).toThrow(/overflow/);
  });

  it("does not allow absolute cash tolerance to finance a small position", () => {
    expect(() => accountFills(candles, [fill(0, "BUY", 1e-12)], 1e-12)).toThrow(
      /insufficient cash/,
    );
  });

  it("preserves same-candle order for a valid close and reversal", () => {
    const fills = [
      fill(0, "BUY"),
      fill(1, "SELL", 1, 110),
      fill(1, "SELL", 1, 110),
      fill(2, "BUY", 1, 120),
    ];
    const trades = attributeTrades(fills);
    const result = accountFills(candles, fills, 1000, { allowShort: true });
    expect(trades.map((trade) => trade.side)).toEqual(["LONG", "SHORT"]);
    expect(trades.reduce((sum, trade) => sum + trade.netPnl, 0)).toBe(
      result.netProfit,
    );
  });
});

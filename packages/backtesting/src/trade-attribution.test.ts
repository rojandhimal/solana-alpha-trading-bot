import { describe, expect, it } from "vitest";
import { attributeLongTrades } from "./trade-attribution.js";
import type { ExecutionFill } from "./execution-model.js";

const fill = (index: number, side: "BUY" | "SELL", quantity: number, price: number, fee = 0): ExecutionFill => ({ signalIndex: index, executionIndex: index, side, quantity, referencePrice: price, fillPrice: price, fee });

describe("trade attribution", () => {
  it("attributes a complete long trade", () => {
    const trades = attributeLongTrades([fill(1, "BUY", 2, 100, 2), fill(4, "SELL", 2, 110, 2)]);
    expect(trades).toHaveLength(1);
    expect(trades[0]?.grossPnl).toBe(20);
    expect(trades[0]?.netPnl).toBe(16);
    expect(trades[0]?.holdingBars).toBe(3);
  });

  it("handles partial exits using FIFO lots", () => {
    const trades = attributeLongTrades([fill(0, "BUY", 2, 100), fill(1, "SELL", 1, 110), fill(2, "SELL", 1, 90)]);
    expect(trades).toHaveLength(2);
    expect(trades[0]?.netPnl).toBe(10);
    expect(trades[1]?.netPnl).toBe(-10);
  });

  it("rejects an oversell", () => {
    expect(() => attributeLongTrades([fill(1, "SELL", 1, 100)])).toThrow(/exceeds open long/);
  });
});

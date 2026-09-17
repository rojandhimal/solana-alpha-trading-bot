import { describe, expect, it } from "vitest";
import { executeRequest, type Candle } from "./execution-model.js";

const candles: Candle[] = [
  { open: 100, high: 102, low: 99, close: 101 },
  { open: 110, high: 112, low: 109, close: 111 },
  { open: 120, high: 122, low: 119, close: 121 }
];

describe("event-based paper execution", () => {
  it("executes on the delayed candle rather than the signal candle", () => {
    const fill = executeRequest(candles, { signalIndex: 0, side: "BUY", quantity: 1 }, {
      executionDelayBars: 2, slippagePct: 0, feePct: 0, liquidityMultiplier: 1, volatilityMultiplier: 1
    });
    expect(fill?.executionIndex).toBe(2);
    expect(fill?.referencePrice).toBe(120);
  });

  it("applies adverse slippage by side", () => {
    const buy = executeRequest(candles, { signalIndex: 0, side: "BUY", quantity: 1 }, {
      executionDelayBars: 0, slippagePct: 1, feePct: 0, liquidityMultiplier: 1, volatilityMultiplier: 1
    });
    const sell = executeRequest(candles, { signalIndex: 0, side: "SELL", quantity: 1 }, {
      executionDelayBars: 0, slippagePct: 1, feePct: 0, liquidityMultiplier: 1, volatilityMultiplier: 1
    });
    expect(buy?.fillPrice).toBe(101);
    expect(sell?.fillPrice).toBe(99);
  });

  it("returns null when delayed execution falls outside the data", () => {
    const fill = executeRequest(candles, { signalIndex: 2, side: "BUY", quantity: 1 }, {
      executionDelayBars: 1, slippagePct: 0, feePct: 0, liquidityMultiplier: 1, volatilityMultiplier: 1
    });
    expect(fill).toBeNull();
  });
});

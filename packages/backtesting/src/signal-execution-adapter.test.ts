import { describe, expect, it } from "vitest";
import { executeSignals } from "./signal-execution-adapter.js";
import type { Candle } from "./execution-model.js";

const candles: Candle[] = [
  { open: 100, high: 102, low: 99, close: 101 },
  { open: 110, high: 112, low: 109, close: 111 },
  { open: 120, high: 122, low: 119, close: 121 }
];

const baseStress = {
  slippageMultiplier: 1,
  feeMultiplier: 1,
  liquidityMultiplier: 1,
  executionDelayBars: 0,
  volatilityMultiplier: 1
};

describe("strategy signal execution adapter", () => {
  it("converts strategy signals into paper fills", () => {
    const result = executeSignals(candles, [{ signalIndex: 0, side: "BUY", quantity: 2 }], baseStress, {
      baseSlippagePct: 0,
      baseFeePct: 0
    });
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0]?.fillPrice).toBe(100);
  });

  it("applies delay, slippage, volatility and liquidity stress parameters", () => {
    const result = executeSignals(candles, [{ signalIndex: 0, side: "BUY", quantity: 1 }], {
      ...baseStress,
      executionDelayBars: 2,
      slippageMultiplier: 2,
      liquidityMultiplier: 0.5,
      volatilityMultiplier: 2
    }, { baseSlippagePct: 1, baseFeePct: 0 });

    expect(result.fills[0]?.executionIndex).toBe(2);
    // 1% base × 2× slippage × 2× volatility = 8% effective slippage
    // Lower liquidity (0.5) further increases execution cost through division.
    expect(result.fills[0]?.fillPrice).toBeCloseTo(129.6);
  });

  it("records signals that cannot be executed", () => {
    const result = executeSignals(candles, [{ signalIndex: 2, side: "SELL", quantity: 1 }], {
      ...baseStress,
      executionDelayBars: 1
    }, { baseSlippagePct: 0, baseFeePct: 0 });
    expect(result.fills).toHaveLength(0);
    expect(result.skippedSignals).toEqual([2]);
  });
});

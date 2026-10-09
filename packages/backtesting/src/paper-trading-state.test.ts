import { describe, expect, it } from "vitest";
import { PaperTradingState, selectRiskReducingFills } from "./paper-trading-state.js";

const makeCandle = (index: number) => ({
  timestamp: index * 60_000,
  open: 100 + index,
  high: 101 + index,
  low: 99 + index,
  close: 100 + index,
  volume: 1_000
});

describe("PaperTradingState", () => {
  it("processes candles incrementally and exposes snapshots", () => {
    const state = new PaperTradingState({
      initialCapital: 10_000,
      execution: { quantity: 1, strategy: { fastPeriod: 3, slowPeriod: 5, rsiPeriod: 3, momentumPeriod: 3, atrPeriod: 3, volumePeriod: 3, entryThreshold: 0.5 } }
    });
    expect(state.append(makeCandle(0)).candleCount).toBe(1);
    expect(state.append(makeCandle(1)).candleCount).toBe(2);
    state.append(makeCandle(2));
    const before = state.getFills().length;
    state.append(makeCandle(3));
    expect(state.getFills().length).toBeGreaterThanOrEqual(before);
    expect(new Set(state.getFills().map((fill) => `${fill.signalIndex}:${fill.executionIndex}:${fill.side}`)).size).toBe(state.getFills().length);
  });


  it("allows only exposure-reducing fills and prevents same-batch position flips", () => {
    const sellClose = { signalIndex: 1, executionIndex: 1, side: "SELL" as const, quantity: 1, referencePrice: 100, fillPrice: 99, fee: 0.1 };
    const sellFlip = { ...sellClose, signalIndex: 1, executionIndex: 1, quantity: 1 };
    expect(selectRiskReducingFills([sellClose, sellFlip], 1)).toEqual([sellClose]);

    const buyClose = { ...sellClose, side: "BUY" as const, fillPrice: 101 };
    const buyFlip = { ...buyClose };
    expect(selectRiskReducingFills([buyClose, buyFlip], -1)).toEqual([buyClose]);
    expect(selectRiskReducingFills([sellClose], 0)).toEqual([]);
  });

  it("rejects non-increasing timestamps", () => {
    const state = new PaperTradingState({ initialCapital: 10_000, execution: { quantity: 1 } });
    state.append(makeCandle(1));
    expect(() => state.append(makeCandle(1))).toThrow("candle timestamp must be strictly increasing");
  });

  it("validates malformed candle values", () => {
    const state = new PaperTradingState({ initialCapital: 10_000, execution: { quantity: 1 } });
    expect(() => state.append({ ...makeCandle(1), close: Number.NaN })).toThrow("candle values must be finite");
    expect(() => state.append({ ...makeCandle(1), volume: -1 })).toThrow("non-negative");
  });

  it("blocks exposure that exceeds the configured ceiling", () => {
    const state = new PaperTradingState({
      initialCapital: 10_000,
      execution: { quantity: 100, strategy: { fastPeriod: 2, slowPeriod: 3, rsiPeriod: 2, momentumPeriod: 2, atrPeriod: 2, volumePeriod: 2, entryThreshold: 0.4 } },
      riskLimits: { maxPositionNotionalPct: 0.01 }
    });
    const snapshot = state.append(makeCandle(0));
    expect(snapshot.accounting.equityCurve.at(-1)?.positionQuantity ?? 0).toBe(0);
  });
});

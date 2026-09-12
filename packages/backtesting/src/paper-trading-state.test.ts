import { describe, expect, it } from "vitest";
import { PaperTradingState } from "./paper-trading-state.js";

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
    const first = state.append(makeCandle(0));
    const second = state.append(makeCandle(1));
    expect(first.candleCount).toBe(1);
    expect(second.candleCount).toBe(2);
    expect(state.snapshot().candleCount).toBe(2);
  });

  it("rejects non-increasing timestamps", () => {
    const state = new PaperTradingState({ initialCapital: 10_000, execution: { quantity: 1 } });
    state.append(makeCandle(1));
    expect(() => state.append(makeCandle(1))).toThrow("candle timestamp must be strictly increasing");
  });

  it("validates malformed candle values", () => {
    const state = new PaperTradingState({ initialCapital: 10_000, execution: { quantity: 1 } });
    expect(() => state.append({ ...makeCandle(1), close: Number.NaN })).toThrow("candle values must be finite");
  });
});

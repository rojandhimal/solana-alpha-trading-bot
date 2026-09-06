import { describe, expect, it } from "vitest";
import { InMemoryHistoricalDataSource } from "../../market-data/src/historical-source.js";
import { toBacktestCandles } from "./market-data.js";

describe("historical source backtesting integration", () => {
  it("loads deterministic OHLCV data and converts it to backtest candles", async () => {
    const source = new InMemoryHistoricalDataSource([
      { timestamp: 1_000, open: 10, high: 12, low: 9, close: 11, volume: 100 },
      { timestamp: 2_000, open: 11, high: 14, low: 10, close: 13, volume: 120 },
      { timestamp: 3_000, open: 13, high: 15, low: 12, close: 14, volume: 140 }
    ]);

    const bars = await source.load({ symbol: "SOL", interval: "1m", startTime: 1_000, endTime: 3_000 });
    const candles = toBacktestCandles(bars);

    expect(candles).toEqual([
      { open: 10, high: 12, low: 9, close: 11 },
      { open: 11, high: 14, low: 10, close: 13 },
      { open: 13, high: 15, low: 12, close: 14 }
    ]);
  });
});

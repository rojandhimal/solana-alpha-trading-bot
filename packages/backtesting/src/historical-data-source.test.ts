import { describe, expect, it } from "vitest";
import type { HistoricalCandle } from "./market-data.js";
import { InMemoryHistoricalDataSource } from "./historical-data-source.js";

const candles: HistoricalCandle[] = [
  { timestamp: 1, open: 100, high: 101, low: 99, close: 100.5, volume: 10 },
  { timestamp: 2, open: 100.5, high: 102, low: 100, close: 101.5, volume: 20 },
  { timestamp: 3, open: 101.5, high: 103, low: 101, close: 102.5, volume: 30 },
];

describe("historical data source", () => {
  it("returns candles within the requested range", async () => {
    const source = new InMemoryHistoricalDataSource(candles);
    await expect(source.getCandles({ symbol: "SOL/USDC", interval: "5m", startTime: 2, endTime: 3 })).resolves.toEqual(candles.slice(1));
  });
});

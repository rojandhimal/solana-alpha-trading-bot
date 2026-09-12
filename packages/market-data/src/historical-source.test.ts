import { describe, expect, it } from "vitest";
import { InMemoryHistoricalDataSource } from "./historical-source.js";

const bars = [
  { timestamp: 1_000, open: 100, high: 101, low: 99, close: 100.5, volume: 10 },
  { timestamp: 2_000, open: 100.5, high: 102, low: 100, close: 101.5, volume: 12 },
  { timestamp: 3_000, open: 101.5, high: 103, low: 101, close: 102.5, volume: 14 }
];

describe("historical data source", () => {
  it("returns all bars when no time bounds are supplied", async () => {
    const source = new InMemoryHistoricalDataSource(bars);
    await expect(source.load({ symbol: "SOL/USDC", interval: "5m" })).resolves.toEqual(bars);
  });

  it("filters bars using inclusive time bounds", async () => {
    const source = new InMemoryHistoricalDataSource(bars);
    await expect(source.load({ symbol: "SOL/USDC", interval: "5m", startTime: 2_000, endTime: 3_000 })).resolves.toEqual(bars.slice(1));
  });
});

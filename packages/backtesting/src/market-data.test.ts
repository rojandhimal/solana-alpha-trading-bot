import { describe, expect, it } from "vitest";
import { parseCandleCsv, toBacktestCandles } from "./market-data.js";

describe("historical market data", () => {
  const csv = `timestamp,open,high,low,close,volume\n1000,100,105,99,104,500\n1060,104,108,103,107,700`;

  it("parses validated OHLCV candles", () => {
    const candles = parseCandleCsv(csv);
    expect(candles).toHaveLength(2);
    expect(candles[0]).toEqual({ timestamp: 1000, open: 100, high: 105, low: 99, close: 104, volume: 500 });
    expect(toBacktestCandles(candles)[1]).toEqual({ open: 104, high: 108, low: 103, close: 107 });
  });

  it("rejects non-monotonic timestamps", () => {
    expect(() => parseCandleCsv(csv.replace("1060", "1000"))).toThrow(/strictly increasing/);
  });

  it("rejects invalid OHLC ranges and negative volume", () => {
    expect(() => parseCandleCsv(csv.replace("105,99", "98,99"))).toThrow(/OHLC range/);
    expect(() => parseCandleCsv(csv.replace(",700", ",-1"))).toThrow(/volume cannot be negative/);
  });

  it("supports custom column names", () => {
    const custom = `time,open_px,high_px,low_px,close_px,vol\n1000,1,2,0.5,1.5,10`;
    expect(parseCandleCsv(custom, { timestampColumn: "time", openColumn: "open_px", highColumn: "high_px", lowColumn: "low_px", closeColumn: "close_px", volumeColumn: "vol" })).toHaveLength(1);
  });
});

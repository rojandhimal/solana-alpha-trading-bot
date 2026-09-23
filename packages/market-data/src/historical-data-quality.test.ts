import { describe, expect, it } from "vitest";
import { assertHistoricalDataQuality, auditHistoricalData } from "./historical-data-quality.js";

const bar = (timestamp: number, close = 100) => ({
  timestamp,
  open: close - 1,
  high: close + 1,
  low: close - 2,
  close,
  volume: 100
});

describe("historical data quality", () => {
  it("accepts ordered unique OHLCV bars and reports coverage", () => {
    const query = { symbol: "SOL", interval: "1m", startTime: 60_000, endTime: 180_000 };
    const report = auditHistoricalData([bar(60_000), bar(120_000), bar(180_000)], query, {
      expectedIntervalMs: 60_000,
      requireRangeCoverage: true
    });

    expect(report).toMatchObject({
      valid: true,
      barCount: 3,
      firstTimestamp: 60_000,
      lastTimestamp: 180_000,
      duplicateTimestampCount: 0,
      outOfOrderCount: 0,
      invalidCandleCount: 0,
      invalidVolumeCount: 0,
      gapCount: 0,
      largestGapMs: 0
    });
    expect(report.errors).toEqual([]);
  });

  it("detects duplicates, ordering errors, malformed candles, invalid volume, and gaps", () => {
    const bars = [
      bar(60_000),
      { ...bar(180_000), high: 90 },
      { ...bar(120_000), volume: -1 },
      bar(180_000)
    ];
    const report = auditHistoricalData(bars, undefined, { expectedIntervalMs: 60_000 });

    expect(report.valid).toBe(false);
    expect(report.duplicateTimestampCount).toBe(1);
    expect(report.outOfOrderCount).toBe(1);
    expect(report.invalidCandleCount).toBe(1);
    expect(report.invalidVolumeCount).toBe(1);
    expect(report.gapCount).toBe(1);
    expect(report.largestGapMs).toBe(120_000);
  });

  it("enforces requested range coverage when explicitly enabled", () => {
    const report = auditHistoricalData([bar(120_000), bar(180_000)], {
      symbol: "SOL",
      interval: "1m",
      startTime: 60_000,
      endTime: 240_000
    }, { requireRangeCoverage: true });

    expect(report.valid).toBe(false);
    expect(report.errors).toEqual([
      "historical data does not cover the requested start time",
      "historical data does not cover the requested end time"
    ]);
  });

  it("asserts instead of silently accepting invalid data", () => {
    expect(() => assertHistoricalDataQuality([{ ...bar(60_000), low: 101 }])).toThrow("historical data quality check failed");
  });
});

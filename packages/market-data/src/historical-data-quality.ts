import type { HistoricalDataQuery, OhlcvBar } from "./historical-source.js";

export interface HistoricalDataQualityOptions {
  expectedIntervalMs?: number;
  maxGapCount?: number;
  requireRangeCoverage?: boolean;
}

export interface HistoricalDataQualityReport {
  valid: boolean;
  barCount: number;
  firstTimestamp?: number;
  lastTimestamp?: number;
  duplicateTimestampCount: number;
  outOfOrderCount: number;
  invalidCandleCount: number;
  invalidVolumeCount: number;
  gapCount: number;
  gapTimestamps: readonly number[];
  largestGapMs: number;
  coverageStart?: number;
  coverageEnd?: number;
  errors: readonly string[];
}

export function auditHistoricalData(
  bars: readonly OhlcvBar[],
  query?: HistoricalDataQuery,
  options: HistoricalDataQualityOptions = {},
): HistoricalDataQualityReport {
  const errors: string[] = [];
  const expectedIntervalMs = options.expectedIntervalMs;

  if (
    expectedIntervalMs !== undefined &&
    (!Number.isFinite(expectedIntervalMs) || expectedIntervalMs <= 0)
  ) {
    throw new Error("expectedIntervalMs must be a positive finite number");
  }
  if (
    options.maxGapCount !== undefined &&
    (!Number.isInteger(options.maxGapCount) || options.maxGapCount < 0)
  ) {
    throw new Error("maxGapCount must be a non-negative integer");
  }

  let duplicateTimestampCount = 0;
  let outOfOrderCount = 0;
  let invalidCandleCount = 0;
  let invalidVolumeCount = 0;
  let gapCount = 0;
  const gapTimestamps: number[] = [];
  let largestGapMs = 0;
  const seen = new Set<number>();
  if (bars.length === 0) errors.push("historical data is empty");
  if (query?.startTime !== undefined && !Number.isSafeInteger(query.startTime))
    throw new Error("startTime must be an integer UTC timestamp");
  if (query?.endTime !== undefined && !Number.isSafeInteger(query.endTime))
    throw new Error("endTime must be an integer UTC timestamp");

  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index]!;
    if (!Number.isSafeInteger(bar.timestamp) || bar.timestamp <= 0) {
      invalidCandleCount += 1;
      errors.push(`bar ${index} has an invalid timestamp`);
      continue;
    }
    if (seen.has(bar.timestamp)) duplicateTimestampCount += 1;
    seen.add(bar.timestamp);

    const previous = bars[index - 1];
    if (previous !== undefined && bar.timestamp <= previous.timestamp)
      outOfOrderCount += 1;

    const prices = [bar.open, bar.high, bar.low, bar.close];
    if (
      prices.some((price) => !Number.isFinite(price) || price <= 0) ||
      bar.high < Math.max(bar.open, bar.close) ||
      bar.low > Math.min(bar.open, bar.close) ||
      bar.high < bar.low
    ) {
      invalidCandleCount += 1;
    }

    if (!Number.isFinite(bar.volume) || bar.volume < 0) invalidVolumeCount += 1;

    if (
      (query?.startTime !== undefined && bar.timestamp < query.startTime) ||
      (query?.endTime !== undefined && bar.timestamp > query.endTime)
    )
      errors.push(`bar ${index} is outside requested range`);
    if (previous !== undefined && expectedIntervalMs !== undefined) {
      const delta = bar.timestamp - previous.timestamp;
      if (delta > 0 && delta !== expectedIntervalMs)
        errors.push(`bar ${index} has inconsistent interval`);
      if (delta > expectedIntervalMs) {
        gapCount += 1;
        gapTimestamps.push(bar.timestamp);
        largestGapMs = Math.max(largestGapMs, delta);
      }
    }
  }

  if (duplicateTimestampCount > 0)
    errors.push(`found ${duplicateTimestampCount} duplicate timestamps`);
  if (outOfOrderCount > 0)
    errors.push(`found ${outOfOrderCount} out-of-order bars`);
  if (invalidCandleCount > 0)
    errors.push(`found ${invalidCandleCount} invalid candles`);
  if (invalidVolumeCount > 0)
    errors.push(`found ${invalidVolumeCount} invalid volumes`);
  if (options.maxGapCount !== undefined && gapCount > options.maxGapCount) {
    errors.push(
      `found ${gapCount} gaps, exceeding maximum ${options.maxGapCount}; first gap ends at ${new Date(gapTimestamps[0]!).toISOString()}`,
    );
  }

  const firstTimestamp = bars[0]?.timestamp;
  const lastTimestamp = bars[bars.length - 1]?.timestamp;
  const coverageStart = query?.startTime;
  const coverageEnd = query?.endTime;
  if (options.requireRangeCoverage && query !== undefined && bars.length > 0) {
    if (
      query.startTime !== undefined &&
      firstTimestamp !== undefined &&
      firstTimestamp > query.startTime
    ) {
      errors.push("historical data does not cover the requested start time");
    }
    if (
      query.endTime !== undefined &&
      lastTimestamp !== undefined &&
      lastTimestamp < query.endTime
    ) {
      errors.push("historical data does not cover the requested end time");
    }
  }

  const report: HistoricalDataQualityReport = {
    valid: errors.length === 0,
    barCount: bars.length,
    duplicateTimestampCount,
    outOfOrderCount,
    invalidCandleCount,
    invalidVolumeCount,
    gapCount,
    gapTimestamps,
    largestGapMs,
    errors,
  };

  if (firstTimestamp !== undefined) report.firstTimestamp = firstTimestamp;
  if (lastTimestamp !== undefined) report.lastTimestamp = lastTimestamp;
  if (coverageStart !== undefined) report.coverageStart = coverageStart;
  if (coverageEnd !== undefined) report.coverageEnd = coverageEnd;

  return report;
}

export function assertHistoricalDataQuality(
  bars: readonly OhlcvBar[],
  query?: HistoricalDataQuery,
  options: HistoricalDataQualityOptions = {},
): HistoricalDataQualityReport {
  const report = auditHistoricalData(bars, query, options);
  if (!report.valid)
    throw new Error(
      `historical data quality check failed: ${report.errors.join("; ")}`,
    );
  return report;
}

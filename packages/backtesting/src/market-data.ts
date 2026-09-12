import type { Candle } from "./execution-model.js";

export interface HistoricalCandle extends Candle {
  timestamp: number;
  volume: number;
}

export interface CsvCandleOptions {
  timestampColumn?: string;
  openColumn?: string;
  highColumn?: string;
  lowColumn?: string;
  closeColumn?: string;
  volumeColumn?: string;
}

function parseNumber(value: string, field: string, line: number): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) throw new Error(`invalid ${field} at CSV line ${line}`);
  return parsed;
}

export function parseCandleCsv(csv: string, options: CsvCandleOptions = {}): HistoricalCandle[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must contain a header and at least one candle");

  const headers = lines[0]!.split(",").map((header) => header.trim().toLowerCase());
  const column = (name: string | undefined, fallback: string) => headers.indexOf((name ?? fallback).toLowerCase());
  const timestamp = column(options.timestampColumn, "timestamp");
  const open = column(options.openColumn, "open");
  const high = column(options.highColumn, "high");
  const low = column(options.lowColumn, "low");
  const close = column(options.closeColumn, "close");
  const volume = column(options.volumeColumn, "volume");
  const required = { timestamp, open, high, low, close, volume };
  for (const [name, index] of Object.entries(required)) {
    if (index < 0) throw new Error(`missing required CSV column: ${name}`);
  }

  const candles = lines.slice(1).map((line, offset) => {
    const fields = line.split(",");
    const lineNumber = offset + 2;
    const result = {
      timestamp: parseNumber(fields[timestamp] ?? "", "timestamp", lineNumber),
      open: parseNumber(fields[open] ?? "", "open", lineNumber),
      high: parseNumber(fields[high] ?? "", "high", lineNumber),
      low: parseNumber(fields[low] ?? "", "low", lineNumber),
      close: parseNumber(fields[close] ?? "", "close", lineNumber),
      volume: parseNumber(fields[volume] ?? "", "volume", lineNumber)
    };
    if (result.high < Math.max(result.open, result.close) || result.low > Math.min(result.open, result.close)) {
      throw new Error(`invalid OHLC range at CSV line ${lineNumber}`);
    }
    if (result.volume < 0) throw new Error(`volume cannot be negative at CSV line ${lineNumber}`);
    return result;
  });

  for (let i = 1; i < candles.length; i += 1) {
    if (candles[i]!.timestamp <= candles[i - 1]!.timestamp) throw new Error(`timestamps must be strictly increasing at CSV line ${i + 2}`);
  }
  return candles;
}

export function toBacktestCandles(candles: readonly HistoricalCandle[]): Candle[] {
  return candles.map(({ open, high, low, close }) => ({ open, high, low, close }));
}

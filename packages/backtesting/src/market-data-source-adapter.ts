import type { HistoricalDataQuery, HistoricalDataSource, OhlcvBar } from "@alpha/market-data";
import type { HistoricalCandle } from "./market-data.js";

export interface BacktestingHistoricalDataSource {
  load(query: HistoricalDataQuery): Promise<readonly HistoricalCandle[]>;
}

export function createBacktestingHistoricalDataSource(source: HistoricalDataSource): BacktestingHistoricalDataSource {
  return {
    async load(query) {
      const bars = await source.load(query);
      return bars.map(toHistoricalCandle);
    }
  };
}

function toHistoricalCandle(bar: OhlcvBar): HistoricalCandle {
  return {
    timestamp: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume
  };
}

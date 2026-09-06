import type { HistoricalCandle } from "./market-data.js";

export interface HistoricalDataRequest {
  symbol: string;
  interval: string;
  startTime?: number;
  endTime?: number;
}

export interface HistoricalDataSource {
  getCandles(request: HistoricalDataRequest): Promise<HistoricalCandle[]>;
}

export class InMemoryHistoricalDataSource implements HistoricalDataSource {
  constructor(private readonly candles: readonly HistoricalCandle[]) {}

  async getCandles(request: HistoricalDataRequest): Promise<HistoricalCandle[]> {
    return this.candles.filter((candle) => {
      if (request.startTime !== undefined && candle.timestamp < request.startTime) return false;
      if (request.endTime !== undefined && candle.timestamp > request.endTime) return false;
      return true;
    });
  }
}

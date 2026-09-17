export interface OhlcvBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalDataQuery {
  symbol: string;
  startTime?: number;
  endTime?: number;
  interval: string;
}

export interface HistoricalDataSource {
  load(query: HistoricalDataQuery): Promise<readonly OhlcvBar[]>;
}

export class InMemoryHistoricalDataSource implements HistoricalDataSource {
  constructor(private readonly bars: readonly OhlcvBar[]) {}

  async load(query: HistoricalDataQuery): Promise<readonly OhlcvBar[]> {
    return this.bars.filter((bar) =>
      (query.startTime === undefined || bar.timestamp >= query.startTime) &&
      (query.endTime === undefined || bar.timestamp <= query.endTime)
    );
  }
}

import { z } from "zod";
import type { HistoricalDataQuery, HistoricalDataSource, OhlcvBar } from "./historical-source.js";

const responseSchema = z.object({
  success: z.boolean().optional(),
  data: z.object({
    items: z.array(z.object({
      unixTime: z.number(),
      o: z.coerce.number(),
      h: z.coerce.number(),
      l: z.coerce.number(),
      c: z.coerce.number(),
      v: z.coerce.number()
    }))
  }).optional()
});

export interface BirdeyeOhlcvSourceOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class BirdeyeOhlcvSource implements HistoricalDataSource {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BirdeyeOhlcvSourceOptions) {
    if (!options.apiKey.trim()) throw new Error("apiKey is required");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://public-api.birdeye.so").replace(/\\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async load(query: HistoricalDataQuery): Promise<readonly OhlcvBar[]> {
    const url = new URL(`${this.baseUrl}/defi/v3/ohlcv`);
    url.searchParams.set("address", query.symbol);
    url.searchParams.set("type", query.interval);
    if (query.startTime !== undefined) url.searchParams.set("time_from", String(Math.floor(query.startTime / 1000)));
    if (query.endTime !== undefined) url.searchParams.set("time_to", String(Math.floor(query.endTime / 1000)));
    url.searchParams.set("currency", "usd");
    url.searchParams.set("chart_type", "price");
    url.searchParams.set("outlier", "false");

    const response = await this.fetchImpl(url, {
      headers: { "X-API-KEY": this.apiKey, "x-chain": "solana" },
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`Birdeye OHLCV returned HTTP ${response.status}`);

    const parsed = responseSchema.parse(await response.json());
    const items = parsed.data?.items ?? [];
    return items
      .map((item) => ({
        timestamp: item.unixTime * 1000,
        open: item.o,
        high: item.h,
        low: item.l,
        close: item.c,
        volume: item.v
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }
}

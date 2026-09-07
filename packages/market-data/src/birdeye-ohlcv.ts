import { z } from "zod";
import type { HistoricalDataQuery, HistoricalDataSource, OhlcvBar } from "./historical-source.js";

const responseSchema = z.object({
  success: z.boolean().optional(),
  data: z.object({
    items: z.array(z.object({
      unixTime: z.number().finite().positive(),
      o: z.coerce.number().finite(),
      h: z.coerce.number().finite(),
      l: z.coerce.number().finite(),
      c: z.coerce.number().finite(),
      v: z.coerce.number().finite().nonnegative()
    }))
  })
});

export interface BirdeyeOhlcvSourceOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  sleepImpl?: (delayMs: number) => Promise<void>;
}

const MAX_RECORDS_PER_REQUEST = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;

export class BirdeyeOhlcvSource implements HistoricalDataSource {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleepImpl: (delayMs: number) => Promise<void>;

  constructor(options: BirdeyeOhlcvSourceOptions) {
    if (!options.apiKey.trim()) throw new Error("apiKey is required");
    if (options.maxRetries !== undefined && (!Number.isInteger(options.maxRetries) || options.maxRetries < 0)) {
      throw new Error("maxRetries must be a non-negative integer");
    }
    if (options.retryBaseDelayMs !== undefined && (!Number.isFinite(options.retryBaseDelayMs) || options.retryBaseDelayMs < 0)) {
      throw new Error("retryBaseDelayMs must be non-negative");
    }

    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://public-api.birdeye.so").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.sleepImpl = options.sleepImpl ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  }

  async load(query: HistoricalDataQuery): Promise<readonly OhlcvBar[]> {
    if (query.startTime !== undefined && query.endTime !== undefined && query.startTime > query.endTime) {
      throw new Error("startTime must be less than or equal to endTime");
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    let cursorSeconds = query.endTime === undefined ? nowSeconds : Math.floor(query.endTime / 1000);
    const startSeconds = query.startTime === undefined ? undefined : Math.floor(query.startTime / 1000);
    const barsByTimestamp = new Map<number, OhlcvBar>();

    do {
      const page = await this.fetchPage(query, cursorSeconds);
      if (page.length === 0) break;

      for (const bar of page) {
        if (query.startTime !== undefined && bar.timestamp < query.startTime) continue;
        if (query.endTime !== undefined && bar.timestamp > query.endTime) continue;
        barsByTimestamp.set(bar.timestamp, bar);
      }

      const oldestTimestamp = page[0]?.timestamp;
      if (oldestTimestamp === undefined) break;
      const oldestSeconds = Math.floor(oldestTimestamp / 1000);
      if (startSeconds === undefined || oldestSeconds <= startSeconds || page.length < MAX_RECORDS_PER_REQUEST) break;
      cursorSeconds = oldestSeconds - 1;
    } while (true);

    return [...barsByTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
  }

  private async fetchPage(query: HistoricalDataQuery, cursorSeconds: number): Promise<OhlcvBar[]> {
    const url = new URL(`${this.baseUrl}/defi/v3/ohlcv`);
    url.searchParams.set("address", query.symbol);
    url.searchParams.set("type", query.interval);
    url.searchParams.set("mode", "count");
    url.searchParams.set("count_limit", String(MAX_RECORDS_PER_REQUEST));
    if (query.startTime !== undefined && query.endTime === undefined) {
      url.searchParams.set("time_from", String(Math.floor(query.startTime / 1000)));
    } else {
      url.searchParams.set("time_to", String(cursorSeconds));
    }
    url.searchParams.set("currency", "usd");
    url.searchParams.set("chart_type", "price");
    url.searchParams.set("outlier", "false");

    for (let attempt = 0; ; attempt += 1) {
      const response = await this.fetchImpl(url, {
        headers: { "X-API-KEY": this.apiKey, "x-chain": "solana" },
        signal: AbortSignal.timeout(15_000)
      });

      if (response.ok) {
        const parsed = responseSchema.parse(await response.json());
        return parsed.data.items.map(toOhlcvBar).sort((a, b) => a.timestamp - b.timestamp);
      }

      if (response.status !== 429 || attempt >= this.maxRetries) {
        throw new Error(`Birdeye OHLCV returned HTTP ${response.status}`);
      }

      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
      const delayMs = Number.isFinite(retryAfter) && retryAfter >= 0
        ? retryAfter * 1000
        : this.retryBaseDelayMs * 2 ** attempt;
      await this.sleepImpl(delayMs);
    }
  }
}

function toOhlcvBar(item: {
  unixTime: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}): OhlcvBar {
  if (item.o <= 0 || item.h <= 0 || item.l <= 0 || item.c <= 0) {
    throw new Error("Birdeye OHLCV contains non-positive price data");
  }
  if (item.h < Math.max(item.o, item.c) || item.l > Math.min(item.o, item.c) || item.h < item.l) {
    throw new Error("Birdeye OHLCV contains invalid candle bounds");
  }

  return {
    timestamp: item.unixTime * 1000,
    open: item.o,
    high: item.h,
    low: item.l,
    close: item.c,
    volume: item.v
  };
}

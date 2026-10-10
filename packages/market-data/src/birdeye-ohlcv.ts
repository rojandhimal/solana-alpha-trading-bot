import {
  requestProvider,
  validateProviderQuery,
  storeProviderBar,
} from "./provider-request.js";
import { z } from "zod";
import type {
  HistoricalDataQuery,
  HistoricalDataSource,
  OhlcvBar,
} from "./historical-source.js";

const numericValue = z
  .union([z.number(), z.string().trim().min(1)])
  .transform(Number)
  .pipe(z.number().finite());
const responseSchema = z.object({
  success: z.boolean().optional(),
  data: z.object({
    items: z.array(
      z.object({
        unixTime: z.number().finite().positive(),
        o: numericValue,
        h: numericValue,
        l: numericValue,
        c: numericValue,
        v: numericValue.refine((value) => value >= 0),
      }),
    ),
  }),
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
    if (
      options.maxRetries !== undefined &&
      (!Number.isInteger(options.maxRetries) || options.maxRetries < 0)
    ) {
      throw new Error("maxRetries must be a non-negative integer");
    }
    if (
      options.retryBaseDelayMs !== undefined &&
      (!Number.isFinite(options.retryBaseDelayMs) ||
        options.retryBaseDelayMs < 0)
    ) {
      throw new Error("retryBaseDelayMs must be non-negative");
    }

    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://public-api.birdeye.so").replace(
      /\/$/,
      "",
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs =
      options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.sleepImpl =
      options.sleepImpl ??
      ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  }

  async load(query: HistoricalDataQuery): Promise<readonly OhlcvBar[]> {
    validateProviderQuery(query);
    if (
      query.startTime !== undefined &&
      query.endTime !== undefined &&
      query.startTime > query.endTime
    ) {
      throw new Error("startTime must be less than or equal to endTime");
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    let cursorSeconds =
      query.endTime === undefined
        ? nowSeconds
        : Math.floor(query.endTime / 1000);
    const startSeconds =
      query.startTime === undefined
        ? undefined
        : Math.floor(query.startTime / 1000);
    const barsByTimestamp = new Map<number, OhlcvBar>();

    do {
      const page = await this.fetchPage(query, cursorSeconds);
      if (page.length === 0) break;

      for (const bar of page) {
        if (query.startTime !== undefined && bar.timestamp < query.startTime)
          continue;
        if (query.endTime !== undefined && bar.timestamp > query.endTime)
          continue;
        storeProviderBar(barsByTimestamp, bar);
      }

      const oldestTimestamp = page[0]?.timestamp;
      if (oldestTimestamp === undefined) break;
      const oldestSeconds = Math.floor(oldestTimestamp / 1000);
      if (
        startSeconds === undefined ||
        oldestSeconds <= startSeconds ||
        page.length < MAX_RECORDS_PER_REQUEST
      )
        break;
      if (oldestSeconds >= cursorSeconds)
        throw new Error("Birdeye OHLCV pagination did not advance");
      cursorSeconds = oldestSeconds - 1;
    } while (true);

    return [...barsByTimestamp.values()].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
  }

  private async fetchPage(
    query: HistoricalDataQuery,
    cursorSeconds: number,
  ): Promise<OhlcvBar[]> {
    const url = new URL(`${this.baseUrl}/defi/v3/ohlcv`);
    url.searchParams.set("address", query.symbol);
    url.searchParams.set("type", query.interval);
    url.searchParams.set("mode", "count");
    url.searchParams.set("count_limit", String(MAX_RECORDS_PER_REQUEST));
    url.searchParams.set("time_to", String(cursorSeconds));
    url.searchParams.set("currency", "usd");
    url.searchParams.set("chart_type", "price");
    url.searchParams.set("outlier", "false");

    const response = await requestProvider(
      url,
      { headers: { "X-API-KEY": this.apiKey, "x-chain": "solana" } },
      {
        provider: "Birdeye",
        fetchImpl: this.fetchImpl,
        maxRetries: this.maxRetries,
        retryBaseDelayMs: this.retryBaseDelayMs,
        sleepImpl: this.sleepImpl,
      },
    );
    const parsed = responseSchema.parse(await response.json());
    if (parsed.success === false)
      throw new Error("Birdeye OHLCV response indicates failure");
    return parsed.data.items
      .map(toOhlcvBar)
      .sort((a, b) => a.timestamp - b.timestamp);
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
  if (
    item.h < Math.max(item.o, item.c) ||
    item.l > Math.min(item.o, item.c) ||
    item.h < item.l
  ) {
    throw new Error("Birdeye OHLCV contains invalid candle bounds");
  }

  return {
    timestamp: item.unixTime * 1000,
    open: item.o,
    high: item.h,
    low: item.l,
    close: item.c,
    volume: item.v,
  };
}

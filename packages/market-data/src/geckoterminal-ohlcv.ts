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
  data: z.object({
    id: z.string(),
    type: z.string(),
    attributes: z.object({
      ohlcv_list: z.array(z.array(numericValue).length(6)),
    }),
  }),
  meta: z
    .object({
      base: z.object({ address: z.string().min(1) }),
      quote: z.object({ address: z.string().min(1) }),
    })
    .optional(),
});

export interface GeckoTerminalOhlcvSourceOptions {
  poolAddress: string;
  /** Pin the requested asset instead of assuming the provider's base token. */
  tokenAddress?: string;
  /** Minimum spacing between pages; public research runners use 6500 ms. */
  minRequestIntervalMs?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  sleepImpl?: (delayMs: number) => Promise<void>;
  pageLimit?: number;
}

const DEFAULT_BASE_URL = "https://api.geckoterminal.com/api/v2";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;
const DEFAULT_PAGE_LIMIT = 1000;
const DEFAULT_USER_AGENT = "solana-alpha-trading-bot/0.1";
const DEFAULT_API_VERSION = "20230203";

export class GeckoTerminalOhlcvSource implements HistoricalDataSource {
  private readonly baseUrl: string;
  private readonly poolAddress: string;
  private readonly tokenAddress: string | undefined;
  private readonly minRequestIntervalMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleepImpl: (delayMs: number) => Promise<void>;
  private readonly pageLimit: number;

  constructor(options: GeckoTerminalOhlcvSourceOptions) {
    if (!options.poolAddress.trim()) throw new Error("poolAddress is required");
    if (
      options.tokenAddress !== undefined &&
      !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(options.tokenAddress)
    )
      throw new Error("tokenAddress must be a Solana token address");
    if (
      options.minRequestIntervalMs !== undefined &&
      (!Number.isFinite(options.minRequestIntervalMs) ||
        options.minRequestIntervalMs < 0 ||
        options.minRequestIntervalMs > 30_000)
    )
      throw new Error("minRequestIntervalMs must be between 0 and 30000");
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
    if (
      options.pageLimit !== undefined &&
      (!Number.isInteger(options.pageLimit) ||
        options.pageLimit <= 0 ||
        options.pageLimit > 1000)
    ) {
      throw new Error("pageLimit must be an integer between 1 and 1000");
    }

    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.poolAddress = options.poolAddress;
    this.tokenAddress = options.tokenAddress;
    this.minRequestIntervalMs = options.minRequestIntervalMs ?? 0;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs =
      options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.sleepImpl =
      options.sleepImpl ??
      ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    this.pageLimit = options.pageLimit ?? DEFAULT_PAGE_LIMIT;
  }

  async load(query: HistoricalDataQuery): Promise<readonly OhlcvBar[]> {
    validateProviderQuery(query);
    if (this.tokenAddress !== undefined && query.symbol !== this.tokenAddress)
      throw new Error("query symbol does not match configured tokenAddress");
    if (!query.symbol.trim()) throw new Error("symbol is required");
    if (!query.interval.trim()) throw new Error("interval is required");
    if (
      query.startTime !== undefined &&
      query.endTime !== undefined &&
      query.startTime > query.endTime
    ) {
      throw new Error("startTime must be less than or equal to endTime");
    }

    const timeframe = toGeckoTimeframe(query.interval);
    const pool = encodeURIComponent(this.poolAddress);
    const bars = new Map<number, OhlcvBar>();
    let beforeTimestamp =
      query.endTime === undefined
        ? undefined
        : Math.floor(query.endTime / 1000) + 1;

    let pageCount = 0;
    for (;;) {
      const url = new URL(
        `${this.baseUrl}/networks/solana/pools/${pool}/ohlcv/${timeframe}`,
      );
      url.searchParams.set("currency", "usd");
      url.searchParams.set("limit", String(this.pageLimit));
      url.searchParams.set("aggregate", String(toAggregate(query.interval)));
      url.searchParams.set("include_empty_intervals", "false");
      if (this.tokenAddress !== undefined)
        url.searchParams.set("token", this.tokenAddress);
      if (beforeTimestamp !== undefined)
        url.searchParams.set("before_timestamp", String(beforeTimestamp));

      if (pageCount > 0 && this.minRequestIntervalMs > 0)
        await this.sleepImpl(this.minRequestIntervalMs);
      const response = await this.fetchWithRetry(url);
      pageCount += 1;
      const parsed = responseSchema.parse(await response.json());
      if (
        this.tokenAddress !== undefined &&
        (!parsed.meta ||
          ![parsed.meta.base.address, parsed.meta.quote.address].includes(
            this.tokenAddress,
          ))
      )
        throw new Error(
          "GeckoTerminal response token metadata does not match requested asset",
        );
      const page = parsed.data.attributes.ohlcv_list.map(toOhlcvBar);
      if (page.length === 0) break;

      let oldestTimestamp = Number.POSITIVE_INFINITY;
      for (const bar of page) {
        oldestTimestamp = Math.min(oldestTimestamp, bar.timestamp);
        if (
          (query.startTime === undefined || bar.timestamp >= query.startTime) &&
          (query.endTime === undefined || bar.timestamp <= query.endTime)
        ) {
          storeProviderBar(bars, bar);
        }
      }

      if (query.startTime !== undefined && oldestTimestamp <= query.startTime)
        break;
      if (page.length < this.pageLimit) break;

      const nextBeforeTimestamp = Math.floor(oldestTimestamp / 1000);
      if (
        beforeTimestamp !== undefined &&
        nextBeforeTimestamp >= beforeTimestamp
      )
        break;
      beforeTimestamp = nextBeforeTimestamp;
    }

    return [...bars.values()].sort((a, b) => a.timestamp - b.timestamp);
  }

  private async fetchWithRetry(url: URL): Promise<Response> {
    return requestProvider(
      url,
      {
        headers: {
          Accept: `application/json;version=${DEFAULT_API_VERSION}`,
          "User-Agent": DEFAULT_USER_AGENT,
        },
      },
      {
        provider: "GeckoTerminal",
        fetchImpl: this.fetchImpl,
        maxRetries: this.maxRetries,
        retryBaseDelayMs: this.retryBaseDelayMs,
        sleepImpl: this.sleepImpl,
      },
    );
  }
}

function toGeckoTimeframe(interval: string): "minute" | "hour" | "day" {
  const normalized = interval.trim().toUpperCase();
  if (["1M", "5M", "15M"].includes(normalized)) return "minute";
  if (["1H", "4H"].includes(normalized)) return "hour";
  if (normalized === "1D") return "day";
  throw new Error(`unsupported GeckoTerminal interval: ${interval}`);
}

function toAggregate(interval: string): number {
  const normalized = interval.trim().toUpperCase();
  if (normalized === "1M" || normalized === "1H" || normalized === "1D")
    return 1;
  if (normalized === "5M") return 5;
  if (normalized === "15M") return 15;
  if (normalized === "4H") return 4;
  throw new Error(`unsupported GeckoTerminal interval: ${interval}`);
}

function toOhlcvBar(row: readonly number[]): OhlcvBar {
  const [timestampSeconds, open, high, low, close, volume] = row;
  if (
    timestampSeconds === undefined ||
    open === undefined ||
    high === undefined ||
    low === undefined ||
    close === undefined ||
    volume === undefined
  ) {
    throw new Error("GeckoTerminal OHLCV row is incomplete");
  }
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    !Number.isSafeInteger(timestampSeconds * 1000) ||
    timestampSeconds <= 0 ||
    open <= 0 ||
    high <= 0 ||
    low <= 0 ||
    close <= 0 ||
    volume < 0
  ) {
    throw new Error("GeckoTerminal OHLCV contains invalid values");
  }
  if (
    high < Math.max(open, close) ||
    low > Math.min(open, close) ||
    high < low
  ) {
    throw new Error("GeckoTerminal OHLCV contains invalid candle bounds");
  }
  return { timestamp: timestampSeconds * 1000, open, high, low, close, volume };
}

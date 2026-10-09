import { z } from "zod";
import type { HistoricalDataQuery, HistoricalDataSource, OhlcvBar } from "./historical-source.js";

const candleSchema = z.array(z.unknown()).length(6);
const DEFAULT_BASE_URL = "https://api.exchange.coinbase.com";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_PAGE_LIMIT = 300;
const DEFAULT_USER_AGENT = "solana-alpha-trading-bot/0.1";
const HOUR_MS = 60 * 60 * 1000;

export interface CoinbaseOhlcvSourceOptions {
  productId: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  sleepImpl?: (delayMs: number) => Promise<void>;
  pageLimit?: number;
}

export class CoinbaseOhlcvSource implements HistoricalDataSource {
  private readonly productId: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleepImpl: (delayMs: number) => Promise<void>;
  private readonly pageLimit: number;

  constructor(options: CoinbaseOhlcvSourceOptions) {
    if (!options.productId.trim()) throw new Error("productId is required");
    if (options.maxRetries !== undefined && (!Number.isInteger(options.maxRetries) || options.maxRetries < 0)) {
      throw new Error("maxRetries must be a non-negative integer");
    }
    if (options.retryBaseDelayMs !== undefined && (!Number.isFinite(options.retryBaseDelayMs) || options.retryBaseDelayMs < 0)) {
      throw new Error("retryBaseDelayMs must be non-negative");
    }
    if (options.pageLimit !== undefined && (!Number.isInteger(options.pageLimit) || options.pageLimit <= 0 || options.pageLimit > 300)) {
      throw new Error("pageLimit must be an integer between 1 and 300");
    }

    this.productId = options.productId.trim().toUpperCase();
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.sleepImpl = options.sleepImpl ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    this.pageLimit = options.pageLimit ?? DEFAULT_PAGE_LIMIT;
  }

  async load(query: HistoricalDataQuery): Promise<readonly OhlcvBar[]> {
    const querySymbol = query.symbol.trim().toUpperCase();
    if (!querySymbol) throw new Error("symbol is required");
    if (querySymbol !== this.productId) throw new Error("symbol must match configured Coinbase product ID");
    if (!query.interval.trim()) throw new Error("interval is required");
    if (query.interval.trim().toUpperCase() !== "1H") {
      throw new Error(`Coinbase source currently supports only 1H interval, received ${query.interval}`);
    }
    if (query.startTime !== undefined && !Number.isFinite(query.startTime)) throw new Error("startTime must be finite");
    if (query.endTime !== undefined && !Number.isFinite(query.endTime)) throw new Error("endTime must be finite");
    if (query.startTime !== undefined && query.endTime !== undefined && query.startTime > query.endTime) {
      throw new Error("startTime must be less than or equal to endTime");
    }

    const endTime = query.endTime ?? Date.now();
    const startTime = query.startTime ?? endTime - (this.pageLimit - 1) * HOUR_MS;
    const bars = new Map<number, OhlcvBar>();
    let cursor = startTime;

    while (cursor <= endTime) {
      const pageEnd = Math.min(endTime, cursor + (this.pageLimit - 1) * HOUR_MS);
      const url = new URL(`${this.baseUrl}/products/${encodeURIComponent(this.productId)}/candles`);
      url.searchParams.set("granularity", "3600");
      url.searchParams.set("start", new Date(cursor).toISOString());
      url.searchParams.set("end", new Date(pageEnd).toISOString());

      const page = await this.fetchPage(url);
      for (const bar of page) {
        if (bar.timestamp >= startTime && bar.timestamp <= endTime) bars.set(bar.timestamp, bar);
      }

      if (pageEnd >= endTime) break;
      const nextCursor = pageEnd + HOUR_MS;
      if (nextCursor <= cursor) throw new Error("Coinbase OHLCV pagination did not advance");
      cursor = nextCursor;
      // Stay below the public endpoint's documented rate limit.
      await this.sleepImpl(350);
    }

    return [...bars.values()].sort((a, b) => a.timestamp - b.timestamp);
  }

  private async fetchPage(url: URL): Promise<OhlcvBar[]> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.fetchImpl(url, {
        headers: { Accept: "application/json", "User-Agent": DEFAULT_USER_AGENT },
        signal: AbortSignal.timeout(15_000)
      });
      if (response.ok) {
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) throw new Error("Coinbase OHLCV response must be an array");
        return payload.map((row) => toOhlcvBar(candleSchema.parse(row)));
      }

      if ((response.status !== 429 && response.status < 500) || attempt >= this.maxRetries) {
        const body = await response.text().catch(() => "");
        const detail = body.trim() ? `: ${body.trim().slice(0, 500)}` : "";
        throw new Error(`Coinbase OHLCV returned HTTP ${response.status}${detail}`);
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

function toOhlcvBar(row: readonly unknown[]): OhlcvBar {
  const timestampSeconds = toFiniteNumber(row[0]);
  const low = toFiniteNumber(row[1]);
  const high = toFiniteNumber(row[2]);
  const open = toFiniteNumber(row[3]);
  const close = toFiniteNumber(row[4]);
  const volume = toFiniteNumber(row[5]);
  const timestamp = timestampSeconds * 1000;

  if (timestamp <= 0 || open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) {
    throw new Error("Coinbase OHLCV contains invalid values");
  }
  if (high < Math.max(open, close) || low > Math.min(open, close) || high < low) {
    throw new Error("Coinbase OHLCV contains invalid candle bounds");
  }
  return { timestamp, open, high, low, close, volume };
}

function toFiniteNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error("Coinbase OHLCV contains a non-numeric value");
  return number;
}

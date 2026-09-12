import { z } from "zod";
import type { HistoricalDataQuery, HistoricalDataSource, OhlcvBar } from "./historical-source.js";

const klineSchema = z.array(z.unknown()).min(6);
const DEFAULT_BASE_URL = "https://api.binance.com";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;
const DEFAULT_PAGE_LIMIT = 1000;
const DEFAULT_USER_AGENT = "solana-alpha-trading-bot/0.1";

export interface BinanceOhlcvSourceOptions {
  symbol: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  sleepImpl?: (delayMs: number) => Promise<void>;
  pageLimit?: number;
}

export class BinanceOhlcvSource implements HistoricalDataSource {
  private readonly symbol: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleepImpl: (delayMs: number) => Promise<void>;
  private readonly pageLimit: number;

  constructor(options: BinanceOhlcvSourceOptions) {
    if (!options.symbol.trim()) throw new Error("symbol is required");
    if (options.maxRetries !== undefined && (!Number.isInteger(options.maxRetries) || options.maxRetries < 0)) {
      throw new Error("maxRetries must be a non-negative integer");
    }
    if (options.retryBaseDelayMs !== undefined && (!Number.isFinite(options.retryBaseDelayMs) || options.retryBaseDelayMs < 0)) {
      throw new Error("retryBaseDelayMs must be non-negative");
    }
    if (options.pageLimit !== undefined && (!Number.isInteger(options.pageLimit) || options.pageLimit <= 0 || options.pageLimit > 1000)) {
      throw new Error("pageLimit must be an integer between 1 and 1000");
    }

    this.symbol = options.symbol.trim().toUpperCase();
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.sleepImpl = options.sleepImpl ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    this.pageLimit = options.pageLimit ?? DEFAULT_PAGE_LIMIT;
  }

  async load(query: HistoricalDataQuery): Promise<readonly OhlcvBar[]> {
    if (!query.symbol.trim()) throw new Error("symbol is required");
    if (!query.interval.trim()) throw new Error("interval is required");
    if (query.startTime !== undefined && query.endTime !== undefined && query.startTime > query.endTime) {
      throw new Error("startTime must be less than or equal to endTime");
    }
    if (query.interval.trim().toUpperCase() !== "1H") {
      throw new Error(`Binance source currently supports only 1H interval, received ${query.interval}`);
    }

    const startTime = query.startTime;
    const endTime = query.endTime;
    const bars = new Map<number, OhlcvBar>();
    let cursor = startTime;

    for (;;) {
      const url = new URL(`${this.baseUrl}/api/v3/klines`);
      url.searchParams.set("symbol", this.symbol);
      url.searchParams.set("interval", "1h");
      url.searchParams.set("limit", String(this.pageLimit));
      if (cursor !== undefined) url.searchParams.set("startTime", String(cursor));
      if (endTime !== undefined) url.searchParams.set("endTime", String(endTime));

      const page = await this.fetchPage(url);
      if (page.length === 0) break;

      for (const bar of page) {
        if (startTime !== undefined && bar.timestamp < startTime) continue;
        if (endTime !== undefined && bar.timestamp > endTime) continue;
        bars.set(bar.timestamp, bar);
      }

      if (page.length < this.pageLimit) break;
      const lastTimestamp = page[page.length - 1]?.timestamp;
      if (lastTimestamp === undefined) break;
      const nextCursor = lastTimestamp + 60 * 60 * 1000;
      if (cursor !== undefined && nextCursor <= cursor) break;
      if (endTime !== undefined && nextCursor > endTime) break;
      cursor = nextCursor;
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
        if (!Array.isArray(payload)) throw new Error("Binance OHLCV response must be an array");
        return payload.map((row) => toOhlcvBar(klineSchema.parse(row)));
      }

      if ((response.status !== 429 && response.status < 500) || attempt >= this.maxRetries) {
        const body = await response.text().catch(() => "");
        const detail = body.trim() ? `: ${body.trim().slice(0, 500)}` : "";
        throw new Error(`Binance OHLCV returned HTTP ${response.status}${detail}`);
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
  const timestamp = toFiniteNumber(row[0]);
  const open = toFiniteNumber(row[1]);
  const high = toFiniteNumber(row[2]);
  const low = toFiniteNumber(row[3]);
  const close = toFiniteNumber(row[4]);
  // Binance row[7] is quote-volume (USDT), which keeps volume semantics
  // comparable with the USD-denominated DEX research source.
  const quoteVolume = toFiniteNumber(row[7]);
  if (timestamp <= 0 || open <= 0 || high <= 0 || low <= 0 || close <= 0 || quoteVolume < 0) {
    throw new Error("Binance OHLCV contains invalid values");
  }
  if (high < Math.max(open, close) || low > Math.min(open, close) || high < low) {
    throw new Error("Binance OHLCV contains invalid candle bounds");
  }
  return { timestamp, open, high, low, close, volume: quoteVolume };
}

function toFiniteNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error("Binance OHLCV contains a non-numeric value");
  return number;
}

import { z } from "zod";
import type { HistoricalDataQuery, HistoricalDataSource, OhlcvBar } from "./historical-source.js";

const responseSchema = z.object({
  data: z.object({
    id: z.string(),
    type: z.string(),
    attributes: z.object({
      ohlcv_list: z.array(z.array(z.coerce.number().finite()).length(6))
    })
  })
});

export interface GeckoTerminalOhlcvSourceOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  sleepImpl?: (delayMs: number) => Promise<void>;
}

const DEFAULT_BASE_URL = "https://api.geckoterminal.com/api/v2";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;

export class GeckoTerminalOhlcvSource implements HistoricalDataSource {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleepImpl: (delayMs: number) => Promise<void>;

  constructor(options: GeckoTerminalOhlcvSourceOptions = {}) {
    if (options.maxRetries !== undefined && (!Number.isInteger(options.maxRetries) || options.maxRetries < 0)) {
      throw new Error("maxRetries must be a non-negative integer");
    }
    if (options.retryBaseDelayMs !== undefined && (!Number.isFinite(options.retryBaseDelayMs) || options.retryBaseDelayMs < 0)) {
      throw new Error("retryBaseDelayMs must be non-negative");
    }

    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.sleepImpl = options.sleepImpl ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  }

  async load(query: HistoricalDataQuery): Promise<readonly OhlcvBar[]> {
    if (!query.symbol.trim()) throw new Error("symbol is required");
    if (!query.interval.trim()) throw new Error("interval is required");
    if (query.startTime !== undefined && query.endTime !== undefined && query.startTime > query.endTime) {
      throw new Error("startTime must be less than or equal to endTime");
    }

    const timeframe = toGeckoTimeframe(query.interval);
    const address = encodeURIComponent(query.symbol);
    const url = new URL(`${this.baseUrl}/networks/solana/tokens/${address}/ohlcv/${timeframe}`);
    url.searchParams.set("currency", "usd");
    url.searchParams.set("include_empty_intervals", "false");
    url.searchParams.set("limit", "1000");
    if (query.startTime !== undefined) url.searchParams.set("before_timestamp", String(Math.floor(query.startTime / 1000)));
    if (query.endTime !== undefined) url.searchParams.set("after_timestamp", String(Math.floor(query.endTime / 1000)));

    const response = await this.fetchWithRetry(url);
    const parsed = responseSchema.parse(await response.json());
    const bars = parsed.data.attributes.ohlcv_list.map(toOhlcvBar);

    return bars
      .filter((bar) => query.startTime === undefined || bar.timestamp >= query.startTime)
      .filter((bar) => query.endTime === undefined || bar.timestamp <= query.endTime)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  private async fetchWithRetry(url: URL): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
      if (response.ok) return response;

      if ((response.status !== 429 && response.status < 500) || attempt >= this.maxRetries) {
        throw new Error(`GeckoTerminal OHLCV returned HTTP ${response.status}`);
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

function toGeckoTimeframe(interval: string): string {
  const normalized = interval.trim().toUpperCase();
  if (normalized === "1M") return "minute";
  if (normalized === "5M") return "minute";
  if (normalized === "15M") return "minute";
  if (normalized === "1H") return "hour";
  if (normalized === "4H") return "hour";
  if (normalized === "1D") return "day";
  throw new Error(`unsupported GeckoTerminal interval: ${interval}`);
}

function toOhlcvBar(row: readonly number[]): OhlcvBar {
  const [timestampSeconds, open, high, low, close, volume] = row;
  if (timestampSeconds === undefined || open === undefined || high === undefined || low === undefined || close === undefined || volume === undefined) {
    throw new Error("GeckoTerminal OHLCV row is incomplete");
  }
  if (timestampSeconds <= 0 || open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) {
    throw new Error("GeckoTerminal OHLCV contains invalid values");
  }
  if (high < Math.max(open, close) || low > Math.min(open, close) || high < low) {
    throw new Error("GeckoTerminal OHLCV contains invalid candle bounds");
  }
  return { timestamp: timestampSeconds * 1000, open, high, low, close, volume };
}

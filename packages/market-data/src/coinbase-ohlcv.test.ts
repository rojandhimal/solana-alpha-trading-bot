import { describe, expect, it, vi } from "vitest";
import { CoinbaseOhlcvSource } from "./coinbase-ohlcv.js";

function response(rows: readonly unknown[], status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify({ candles: rows }), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

const ROW = { start: "1700000000", low: "99", high: "101", open: "100", close: "100.5", volume: "123.45" };

describe("CoinbaseOhlcvSource", () => {
  it("requests public 1h candles and maps seconds to milliseconds", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/api/v3/brokerage/market/products/SOL-USD/candles");
      expect(url.searchParams.get("granularity")).toBe("ONE_HOUR");
      expect(url.searchParams.get("limit")).toBe("350");
      expect(new Headers(init?.headers).get("accept")).toBe("application/json");
      return response([ROW]);
    });

    const bars = await new CoinbaseOhlcvSource({ productId: "sol-usd", fetchImpl }).load({
      symbol: "SOL-USD",
      interval: "1H",
      startTime: 1_700_000_000_000,
      endTime: 1_700_000_000_000
    });

    expect(bars).toEqual([{ timestamp: 1_700_000_000_000, open: 100, high: 101, low: 99, close: 100.5, volume: 123.45 }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects mismatched products and unsupported intervals", async () => {
    const source = new CoinbaseOhlcvSource({ productId: "SOL-USD", fetchImpl: vi.fn() });
    await expect(source.load({ symbol: "BTC-USD", interval: "1H" })).rejects.toThrow("symbol must match configured Coinbase product ID");
    await expect(source.load({ symbol: "SOL-USD", interval: "5M" })).rejects.toThrow("supports only 1H");
  });

  it("validates candle shape and price bounds", async () => {
    const malformed = new CoinbaseOhlcvSource({ productId: "SOL-USD", fetchImpl: vi.fn(async () => response([{ start: 1, low: 2, high: 3 }])) });
    await expect(malformed.load({ symbol: "SOL-USD", interval: "1H" })).rejects.toThrow();

    const invalid = new CoinbaseOhlcvSource({ productId: "SOL-USD", fetchImpl: vi.fn(async () => response([{ start: 1_700_000_000, low: "99", high: "98", open: "100", close: "100", volume: "1" }])) });
    await expect(invalid.load({ symbol: "SOL-USD", interval: "1H" })).rejects.toThrow("invalid candle bounds");
  });

  it("paginates within the 300-candle API cap and sorts/deduplicates results", async () => {
    const calls: URL[] = [];
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      calls.push(url);
      const start = Number(url.searchParams.get("start")) * 1000;
      if (start === 1_700_000_000_000) {
        return response([ROW, { start: "1700003600", low: "100", high: "102", open: "100.5", close: "101", volume: "20" }]);
      }
      return response([{ start: "1700007200", low: "101", high: "103", open: "101", close: "102", volume: "30" }]);
    });
    const sleepImpl = vi.fn(async () => undefined);

    const bars = await new CoinbaseOhlcvSource({ productId: "SOL-USD", fetchImpl, pageLimit: 2, sleepImpl }).load({
      symbol: "SOL-USD",
      interval: "1H",
      startTime: 1_700_000_000_000,
      endTime: 1_700_007_200_000
    });

    expect(calls).toHaveLength(2);
    expect(Number(calls[1]!.searchParams.get("start")) * 1000).toBe(1_700_007_200_000);
    expect(bars.map((bar) => bar.timestamp)).toEqual([1_700_000_000_000, 1_700_003_600_000, 1_700_007_200_000]);
    expect(sleepImpl).toHaveBeenCalledWith(350);
  });

  it("retries rate limits and transient server errors", async () => {
    let attempt = 0;
    const sleepImpl = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) return response([], 429, { "retry-after": "2" });
      if (attempt === 2) return response([], 503);
      return response([ROW]);
    });

    const bars = await new CoinbaseOhlcvSource({ productId: "SOL-USD", fetchImpl, sleepImpl, retryBaseDelayMs: 10 }).load({
      symbol: "SOL-USD",
      interval: "1H",
      startTime: 1_700_000_000_000,
      endTime: 1_700_000_000_000
    });

    expect(bars).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleepImpl).toHaveBeenNthCalledWith(1, 2000);
    expect(sleepImpl).toHaveBeenNthCalledWith(2, 20);
  });
});

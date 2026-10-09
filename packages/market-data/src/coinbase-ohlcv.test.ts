import { describe, expect, it, vi } from "vitest";
import { CoinbaseOhlcvSource } from "./coinbase-ohlcv.js";

function response(rows: readonly unknown[][], status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(rows), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

const ROW = [1_700_000_000, "99", "101", "100", "100.5", "123.45"];

describe("CoinbaseOhlcvSource", () => {
  it("requests public 1h candles and maps seconds to milliseconds", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/products/SOL-USD/candles");
      expect(url.searchParams.get("granularity")).toBe("3600");
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
    const malformed = new CoinbaseOhlcvSource({ productId: "SOL-USD", fetchImpl: vi.fn(async () => response([[1, 2, 3]])) });
    await expect(malformed.load({ symbol: "SOL-USD", interval: "1H" })).rejects.toThrow();

    const invalid = new CoinbaseOhlcvSource({ productId: "SOL-USD", fetchImpl: vi.fn(async () => response([[1_700_000_000, "99", "98", "100", "100", "1"]])) });
    await expect(invalid.load({ symbol: "SOL-USD", interval: "1H" })).rejects.toThrow("invalid candle bounds");
  });

  it("paginates within the 300-candle API cap and sorts/deduplicates results", async () => {
    const calls: URL[] = [];
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      calls.push(url);
      const start = Date.parse(url.searchParams.get("start")!);
      if (start === 1_700_000_000_000) {
        return response([ROW, [1_700_003_600, "100", "102", "100.5", "101", "20"]]);
      }
      return response([[1_700_007_200, "101", "103", "101", "102", "30"]]);
    });
    const sleepImpl = vi.fn(async () => undefined);

    const bars = await new CoinbaseOhlcvSource({ productId: "SOL-USD", fetchImpl, pageLimit: 2, sleepImpl }).load({
      symbol: "SOL-USD",
      interval: "1H",
      startTime: 1_700_000_000_000,
      endTime: 1_700_007_200_000
    });

    expect(calls).toHaveLength(2);
    expect(Date.parse(calls[1]!.searchParams.get("start")!)).toBe(1_700_007_200_000);
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

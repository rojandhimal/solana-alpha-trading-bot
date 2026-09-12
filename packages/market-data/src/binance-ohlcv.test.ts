import { describe, expect, it, vi } from "vitest";
import { BinanceOhlcvSource } from "./binance-ohlcv.js";

function response(rows: readonly unknown[][], status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(rows), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

const ROW = [1_700_000_000_000, "100", "101", "99", "100.5", "123", 1_700_000_359_999, "12345", "100", "0", "0", "0"];

describe("BinanceOhlcvSource", () => {
  it("requests SOLUSDT 1h klines and maps quote volume", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/api/v3/klines");
      expect(url.searchParams.get("symbol")).toBe("SOLUSDT");
      expect(url.searchParams.get("interval")).toBe("1h");
      expect(url.searchParams.get("limit")).toBe("1000");
      expect(new Headers(init?.headers).get("accept")).toBe("application/json");
      return response([ROW]);
    });

    const bars = await new BinanceOhlcvSource({ symbol: "solusdt", fetchImpl }).load({ symbol: "SOLUSDT", interval: "1H" });

    expect(bars).toEqual([{ timestamp: 1_700_000_000_000, open: 100, high: 101, low: 99, close: 100.5, volume: 12345 }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("requires at least eight kline fields", async () => {
    const fetchImpl = vi.fn(async () => response([[1_700_000_000_000, 100, 101, 99, 100, 1]]));
    await expect(new BinanceOhlcvSource({ symbol: "SOLUSDT", fetchImpl }).load({ symbol: "SOLUSDT", interval: "1H" })).rejects.toThrow();
  });

  it("rejects a query for a different symbol", async () => {
    const source = new BinanceOhlcvSource({ symbol: "SOLUSDT", fetchImpl: vi.fn() });
    await expect(source.load({ symbol: "BTCUSDT", interval: "1H" })).rejects.toThrow("symbol must match configured Binance symbol");
  });

  it("paginates forward and filters the requested range", async () => {
    const calls: URL[] = [];
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      calls.push(url);
      const start = Number(url.searchParams.get("startTime"));
      if (start === 1_700_000_000_000) return response([ROW, [1_700_003_600_000, "101", "102", "100", "101", "1", 1_700_003_959_999, "20000"]]);
      return response([[1_700_007_200_000, "102", "103", "101", "102", "1", 1_700_007_559_999, "30000"]]);
    });

    const bars = await new BinanceOhlcvSource({ symbol: "SOLUSDT", fetchImpl, pageLimit: 2 }).load({
      symbol: "SOLUSDT",
      interval: "1H",
      startTime: 1_700_000_000_000,
      endTime: 1_700_007_200_000
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]?.searchParams.get("startTime")).toBe("1700003600000");
    expect(bars.map((bar) => bar.timestamp)).toEqual([1_700_000_000_000, 1_700_003_600_000, 1_700_007_200_000]);
  });

  it("retries rate limits and transient server errors", async () => {
    let attempt = 0;
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) return response([], 429, { "retry-after": "2" });
      if (attempt === 2) return response([], 503);
      return response([ROW]);
    });

    const bars = await new BinanceOhlcvSource({ symbol: "SOLUSDT", fetchImpl, sleepImpl: sleep, retryBaseDelayMs: 10 }).load({ symbol: "SOLUSDT", interval: "1H" });

    expect(bars).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 2000);
    expect(sleep).toHaveBeenNthCalledWith(2, 20);
  });
});

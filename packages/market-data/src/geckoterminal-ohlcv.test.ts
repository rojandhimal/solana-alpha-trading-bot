import { describe, expect, it, vi } from "vitest";
import { GeckoTerminalOhlcvSource } from "./geckoterminal-ohlcv.js";

const TEST_POOL = "test_pool";

function response(rows: readonly number[][], status = 200): Response {
  return new Response(JSON.stringify({
    data: {
      id: TEST_POOL,
      type: "ohlcv",
      attributes: { ohlcv_list: rows }
    }
  }), { status, headers: { "content-type": "application/json" } });
}

describe("GeckoTerminalOhlcvSource", () => {
  it("requests the pool OHLCV endpoint with the correct timeframe and aggregate", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      expect(url.pathname).toContain(`/networks/solana/pools/${TEST_POOL}/ohlcv/hour`);
      expect(url.searchParams.get("aggregate")).toBe("1");
      expect(url.searchParams.get("limit")).toBe("1000");
      return response([[1_700_000_000, 100, 101, 99, 100.5, 10]]);
    });

    const source = new GeckoTerminalOhlcvSource({ poolAddress: TEST_POOL, fetchImpl });
    const bars = await source.load({ symbol: "SOL", interval: "1H" });

    expect(bars).toEqual([{ timestamp: 1_700_000_000_000, open: 100, high: 101, low: 99, close: 100.5, volume: 10 }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("requires a pool address", () => {
    expect(() => new GeckoTerminalOhlcvSource({ poolAddress: "" })).toThrow("poolAddress is required");
  });

  it("passes minute aggregates for 5M and 15M", async () => {
    for (const [interval, aggregate] of [["5M", "5"], ["15M", "15"]] as const) {
      const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(String(input));
        expect(url.pathname).toContain(`/pools/${TEST_POOL}/ohlcv/minute`);
        expect(url.searchParams.get("aggregate")).toBe(aggregate);
        return response([[1_700_000_000, 100, 101, 99, 100.5, 10]]);
      });
      await new GeckoTerminalOhlcvSource({ poolAddress: TEST_POOL, fetchImpl }).load({ symbol: "SOL", interval });
    }
  });

  it("paginates backwards and filters the requested range", async () => {
    const calls: URL[] = [];
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      calls.push(url);
      const before = url.searchParams.get("before_timestamp");
      if (before === "1700000721") return response([[1_700_000_720, 102, 103, 101, 102, 10], [1_700_000_360, 101, 102, 100, 101, 10]]);
      return response([[1_700_000_000, 100, 101, 99, 100, 10]]);
    });

    const source = new GeckoTerminalOhlcvSource({ poolAddress: TEST_POOL, fetchImpl, pageLimit: 2 });
    const bars = await source.load({
      symbol: "SOL",
      interval: "1H",
      startTime: 1_700_000_000_000,
      endTime: 1_700_000_720_000
    });

    expect(calls.length).toBe(2);
    expect(calls[0]?.searchParams.get("before_timestamp")).toBe("1700000721");
    expect(calls[1]?.searchParams.get("before_timestamp")).toBe("1700000360");
    expect(bars.map((bar) => bar.timestamp)).toEqual([1_700_000_000_000, 1_700_000_360_000, 1_700_000_720_000]);
  });

  it("retries rate limits and transient server errors", async () => {
    let attempt = 0;
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) return new Response("rate limited", { status: 429, headers: { "retry-after": "2" } });
      if (attempt === 2) return new Response("temporary", { status: 503 });
      return response([[1_700_000_000, 100, 101, 99, 100, 1]]);
    });

    const bars = await new GeckoTerminalOhlcvSource({ poolAddress: TEST_POOL, fetchImpl, sleepImpl: sleep, retryBaseDelayMs: 10 }).load({ symbol: "SOL", interval: "1H" });

    expect(bars).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 2000);
    expect(sleep).toHaveBeenNthCalledWith(2, 20);
  });

  it("rejects invalid candle bounds", async () => {
    const fetchImpl = vi.fn(async () => response([[1_700_000_000, 100, 99, 98, 100, 1]]));
    await expect(new GeckoTerminalOhlcvSource({ poolAddress: TEST_POOL, fetchImpl }).load({ symbol: "SOL", interval: "1H" })).rejects.toThrow("invalid candle bounds");
  });
});

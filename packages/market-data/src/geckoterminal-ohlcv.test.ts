import { describe, expect, it, vi } from "vitest";
import { GeckoTerminalOhlcvSource } from "./geckoterminal-ohlcv.js";

const TEST_POOL = "test_pool";
const SOL_TOKEN = "So11111111111111111111111111111111111111112";
const USDC_TOKEN = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function response(rows: readonly number[][], status = 200): Response {
  return new Response(
    JSON.stringify({
      data: {
        id: TEST_POOL,
        type: "ohlcv",
        attributes: { ohlcv_list: rows },
      },
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

describe("GeckoTerminalOhlcvSource", () => {
  it("requests the pool OHLCV endpoint with the correct timeframe, aggregate, and API version", async () => {
    const fetchImpl = vi.fn(
      async (input: URL | RequestInfo, init?: RequestInit) => {
        const url = new URL(String(input));
        expect(url.pathname).toContain(
          `/networks/solana/pools/${TEST_POOL}/ohlcv/hour`,
        );
        expect(url.searchParams.get("aggregate")).toBe("1");
        expect(url.searchParams.get("limit")).toBe("1000");
        expect(new Headers(init?.headers).get("accept")).toBe(
          "application/json;version=20230203",
        );
        return response([[1_700_000_000, 100, 101, 99, 100.5, 10]]);
      },
    );

    const source = new GeckoTerminalOhlcvSource({
      poolAddress: TEST_POOL,
      fetchImpl,
    });
    const bars = await source.load({ symbol: "SOL", interval: "1H" });

    expect(bars).toEqual([
      {
        timestamp: 1_700_000_000_000,
        open: 100,
        high: 101,
        low: 99,
        close: 100.5,
        volume: 10,
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("requires a pool address", () => {
    expect(() => new GeckoTerminalOhlcvSource({ poolAddress: "" })).toThrow(
      "poolAddress is required",
    );
  });

  it("pins the asset and refuses synthetic empty intervals", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("token")).toBe(SOL_TOKEN);
      expect(url.searchParams.get("currency")).toBe("usd");
      expect(url.searchParams.get("include_empty_intervals")).toBe("false");
      return new Response(
        JSON.stringify({
          data: {
            id: TEST_POOL,
            type: "ohlcv",
            attributes: { ohlcv_list: [[1_700_000_000, 100, 101, 99, 100, 1]] },
          },
          meta: {
            base: { address: USDC_TOKEN },
            quote: { address: SOL_TOKEN },
          },
        }),
      );
    });
    const bars = await new GeckoTerminalOhlcvSource({
      poolAddress: TEST_POOL,
      tokenAddress: SOL_TOKEN,
      fetchImpl,
    }).load({ symbol: SOL_TOKEN, interval: "1H" });
    expect(bars).toHaveLength(1);
  });

  it("rejects a query for another asset before requesting data", async () => {
    const fetchImpl = vi.fn();
    await expect(
      new GeckoTerminalOhlcvSource({
        poolAddress: TEST_POOL,
        tokenAddress: SOL_TOKEN,
        fetchImpl,
      }).load({ symbol: USDC_TOKEN, interval: "1H" }),
    ).rejects.toThrow("query symbol does not match");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    { base: { address: USDC_TOKEN }, quote: { address: USDC_TOKEN } },
  ])("rejects missing or mismatched provider token metadata", async (meta) => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              id: TEST_POOL,
              type: "ohlcv",
              attributes: {
                ohlcv_list: [[1_700_000_000, 100, 101, 99, 100, 1]],
              },
            },
            ...(meta === undefined ? {} : { meta }),
          }),
        ),
    );
    await expect(
      new GeckoTerminalOhlcvSource({
        poolAddress: TEST_POOL,
        tokenAddress: SOL_TOKEN,
        fetchImpl,
      }).load({ symbol: SOL_TOKEN, interval: "1H" }),
    ).rejects.toThrow("token metadata does not match");
  });

  it.each(["SOL", "", " So11111111111111111111111111111111111111112"])(
    "rejects invalid configured token addresses",
    (tokenAddress) => {
      expect(
        () =>
          new GeckoTerminalOhlcvSource({
            poolAddress: TEST_POOL,
            tokenAddress,
          }),
      ).toThrow("tokenAddress");
    },
  );

  it.each([-1, Infinity, 30_001])(
    "rejects invalid page request spacing",
    (minRequestIntervalMs) => {
      expect(
        () =>
          new GeckoTerminalOhlcvSource({
            poolAddress: TEST_POOL,
            minRequestIntervalMs,
          }),
      ).toThrow("minRequestIntervalMs");
    },
  );

  it("paces successful pagination without changing candles", async () => {
    const sleepImpl = vi.fn(async () => undefined);
    let page = 0;
    const fetchImpl = vi.fn(async () =>
      ++page === 1
        ? response([[1_700_003_600, 100, 101, 99, 100, 1]])
        : response([[1_700_000_000, 100, 101, 99, 100, 1]]),
    );
    const bars = await new GeckoTerminalOhlcvSource({
      poolAddress: TEST_POOL,
      fetchImpl,
      sleepImpl,
      pageLimit: 1,
      minRequestIntervalMs: 6500,
    }).load({ symbol: "SOL", interval: "1H", startTime: 1_700_000_000_000 });
    expect(bars).toHaveLength(2);
    expect(sleepImpl).toHaveBeenCalledExactlyOnceWith(6500);
  });

  it.each([1_700_000_000.5, Number.MAX_SAFE_INTEGER])(
    "rejects invalid provider timestamp units before conversion",
    async (timestamp) => {
      const fetchImpl = vi.fn(async () =>
        response([[timestamp, 100, 101, 99, 100, 1]]),
      );
      await expect(
        new GeckoTerminalOhlcvSource({
          poolAddress: TEST_POOL,
          fetchImpl,
        }).load({ symbol: "SOL", interval: "1H" }),
      ).rejects.toThrow("invalid values");
    },
  );

  it("passes minute aggregates for 5M and 15M", async () => {
    for (const [interval, aggregate] of [
      ["5M", "5"],
      ["15M", "15"],
    ] as const) {
      const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(String(input));
        expect(url.pathname).toContain(`/pools/${TEST_POOL}/ohlcv/minute`);
        expect(url.searchParams.get("aggregate")).toBe(aggregate);
        return response([[1_700_000_000, 100, 101, 99, 100.5, 10]]);
      });
      await new GeckoTerminalOhlcvSource({
        poolAddress: TEST_POOL,
        fetchImpl,
      }).load({ symbol: "SOL", interval });
    }
  });

  it("paginates backwards and filters the requested range", async () => {
    const calls: URL[] = [];
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      calls.push(url);
      const before = url.searchParams.get("before_timestamp");
      if (before === "1700000721")
        return response([
          [1_700_000_720, 102, 103, 101, 102, 10],
          [1_700_000_360, 101, 102, 100, 101, 10],
        ]);
      return response([[1_700_000_000, 100, 101, 99, 100, 10]]);
    });

    const source = new GeckoTerminalOhlcvSource({
      poolAddress: TEST_POOL,
      fetchImpl,
      pageLimit: 2,
    });
    const bars = await source.load({
      symbol: "SOL",
      interval: "1H",
      startTime: 1_700_000_000_000,
      endTime: 1_700_000_720_000,
    });

    expect(calls.length).toBe(2);
    expect(calls[0]?.searchParams.get("before_timestamp")).toBe("1700000721");
    expect(calls[1]?.searchParams.get("before_timestamp")).toBe("1700000360");
    expect(bars.map((bar) => bar.timestamp)).toEqual([
      1_700_000_000_000, 1_700_000_360_000, 1_700_000_720_000,
    ]);
  });

  it("retries rate limits and transient server errors", async () => {
    let attempt = 0;
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1)
        return new Response("rate limited", {
          status: 429,
          headers: { "retry-after": "2" },
        });
      if (attempt === 2) return new Response("temporary", { status: 503 });
      return response([[1_700_000_000, 100, 101, 99, 100, 1]]);
    });

    const bars = await new GeckoTerminalOhlcvSource({
      poolAddress: TEST_POOL,
      fetchImpl,
      sleepImpl: sleep,
      retryBaseDelayMs: 10,
    }).load({ symbol: "SOL", interval: "1H" });

    expect(bars).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 2000);
    expect(sleep).toHaveBeenNthCalledWith(2, 20);
  });

  it("rejects invalid candle bounds", async () => {
    const fetchImpl = vi.fn(async () =>
      response([[1_700_000_000, 100, 99, 98, 100, 1]]),
    );
    await expect(
      new GeckoTerminalOhlcvSource({ poolAddress: TEST_POOL, fetchImpl }).load({
        symbol: "SOL",
        interval: "1H",
      }),
    ).rejects.toThrow("invalid candle bounds");
  });
});

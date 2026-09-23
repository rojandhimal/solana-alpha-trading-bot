import { describe, expect, it, vi } from "vitest";
import { BirdeyeOhlcvSource } from "./birdeye-ohlcv.js";

describe("BirdeyeOhlcvSource", () => {
  it("maps and sorts normalized OHLCV data", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toContain("/defi/v3/ohlcv");
      expect(String(input)).toContain("address=So11111111111111111111111111111111111111112");
      expect(String(input)).toContain("mode=count");
      expect(String(input)).toContain("count_limit=5000");
      expect(init?.headers).toEqual({ "X-API-KEY": "test-key", "x-chain": "solana" });
      return new Response(JSON.stringify({
        success: true,
        data: { items: [
          { unixTime: 100, o: "10", h: "11", l: "9", c: "10.5", v: "100" },
          { unixTime: 40, o: 8, h: 9, l: 7, c: 8.5, v: 80 }
        ] }
      }), { status: 200 });
    };

    const source = new BirdeyeOhlcvSource({ apiKey: "test-key", fetchImpl, baseUrl: "https://example.test" });
    await expect(source.load({ symbol: "So11111111111111111111111111111111111111112", interval: "5m", startTime: 40_000, endTime: 100_000 })).resolves.toEqual([
      { timestamp: 40_000, open: 8, high: 9, low: 7, close: 8.5, volume: 80 },
      { timestamp: 100_000, open: 10, high: 11, low: 9, close: 10.5, volume: 100 }
    ]);
  });

  it("rejects invalid candle bounds", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      data: { items: [{ unixTime: 100, o: 10, h: 9, l: 8, c: 10, v: 1 }] }
    }), { status: 200 });
    const source = new BirdeyeOhlcvSource({ apiKey: "test-key", fetchImpl, maxRetries: 0 });

    await expect(source.load({ symbol: "SOL", interval: "1m" })).rejects.toThrow("invalid candle bounds");
  });

  it("retries rate limits with exponential backoff", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { items: [] } }), { status: 200 }));
    const sleepImpl = vi.fn(async () => undefined);
    const source = new BirdeyeOhlcvSource({ apiKey: "test-key", fetchImpl, maxRetries: 1, retryBaseDelayMs: 10, sleepImpl });

    await expect(source.load({ symbol: "SOL", interval: "1m" })).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledWith(10);
  });
});

import { describe, expect, it, vi } from "vitest";
import { BirdeyeOhlcvSource } from "./birdeye-ohlcv.js";

describe("BirdeyeOhlcvSource contract", () => {
  it("uses count mode for bounded historical windows and normalizes bars", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { items: [
        { unixTime: 200, o: "20", h: "22", l: "19", c: "21", v: "2000" },
        { unixTime: 100, o: "10", h: "12", l: "9", c: "11", v: "1000" }
      ] }
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const source = new BirdeyeOhlcvSource({ apiKey: "test-key", baseUrl: "https://example.test", fetchImpl });
    const bars = await source.load({ symbol: "SOL", interval: "1m", startTime: 100_000, endTime: 200_000 });

    expect(bars).toEqual([
      { timestamp: 100_000, open: 10, high: 12, low: 9, close: 11, volume: 1000 },
      { timestamp: 200_000, open: 20, high: 22, low: 19, close: 21, volume: 2000 }
    ]);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const request = fetchImpl.mock.calls[0]?.[0];
    const options = fetchImpl.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    expect(String(request)).toContain("address=SOL");
    expect(String(request)).toContain("mode=count");
    expect(String(request)).toContain("count_limit=5000");
    expect(String(request)).toContain("time_to=200");
    expect(options?.headers).toEqual({ "X-API-KEY": "test-key", "x-chain": "solana" });
  });

  it("paginates bounded ranges when a page is full", async () => {
    const page = Array.from({ length: 5000 }, (_, index) => ({
      unixTime: 10_000 - index,
      o: 10,
      h: 11,
      l: 9,
      c: 10,
      v: 100
    }));
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { items: page } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { items: [
        { unixTime: 4_000, o: 10, h: 11, l: 9, c: 10, v: 100 }
      ] } }), { status: 200 }));

    const source = new BirdeyeOhlcvSource({ apiKey: "test-key", baseUrl: "https://example.test", fetchImpl });
    const bars = await source.load({ symbol: "SOL", interval: "1m", startTime: 4_000_000, endTime: 10_000_000 });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(bars.at(0)?.timestamp).toBe(4_000_000);
    expect(bars.at(-1)?.timestamp).toBe(10_000_000);
  });

  it("retries 429 responses when configured", async () => {
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

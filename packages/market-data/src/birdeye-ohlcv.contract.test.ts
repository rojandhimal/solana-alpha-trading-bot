import { describe, expect, it, vi } from "vitest";
import { BirdeyeOhlcvSource } from "./birdeye-ohlcv.js";

describe("BirdeyeOhlcvSource", () => {
  it("maps and sorts Birdeye OHLCV items", async () => {
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
    const [request, options] = fetchImpl.mock.calls[0];
    expect(String(request)).toContain("address=SOL");
    expect(String(request)).toContain("time_from=100");
    expect(String(request)).toContain("time_to=200");
    expect(options?.headers).toEqual({ "X-API-KEY": "test-key", "x-chain": "solana" });
  });

  it("rejects non-success HTTP responses", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("rate limited", { status: 429 }));
    const source = new BirdeyeOhlcvSource({ apiKey: "test-key", fetchImpl });

    await expect(source.load({ symbol: "SOL", interval: "1m" })).rejects.toThrow("Birdeye OHLCV returned HTTP 429");
  });
});

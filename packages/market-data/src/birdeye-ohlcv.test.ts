import { describe, expect, it } from "vitest";
import { BirdeyeOhlcvSource } from "./birdeye-ohlcv.js";

describe("BirdeyeOhlcvSource", () => {
  it("maps Solana OHLCV response into normalized bars", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toContain("/defi/v3/ohlcv");
      expect(String(input)).toContain("address=So11111111111111111111111111111111111111112");
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
    await expect(source.load({ symbol: "So11111111111111111111111111111111111111112", interval: "5m" })).resolves.toEqual([
      { timestamp: 40_000, open: 8, high: 9, low: 7, close: 8.5, volume: 80 },
      { timestamp: 100_000, open: 10, high: 11, low: 9, close: 10.5, volume: 100 }
    ]);
  });

  it("rejects non-success HTTP responses", async () => {
    const fetchImpl: typeof fetch = async () => new Response("rate limited", { status: 429 });
    const source = new BirdeyeOhlcvSource({ apiKey: "test-key", fetchImpl });
    await expect(source.load({ symbol: "token", interval: "5m" })).rejects.toThrow("HTTP 429");
  });
});

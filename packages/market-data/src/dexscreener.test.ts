import { afterEach, describe, expect, it, vi } from "vitest";
import { DexScreenerClient } from "./dexscreener.js";
const token = "So11111111111111111111111111111111111111112";
const pair = {
  chainId: "solana",
  dexId: "raydium",
  pairAddress: "pool",
  baseToken: { address: token, name: "SOL", symbol: "SOL" },
  quoteToken: { address: "quote", name: "USD", symbol: "USD" },
  priceUsd: "100",
  liquidity: { usd: 1000000 },
  volume: { h24: 1000000, h1: 10000 },
  txns: { h24: { buys: 10, sells: 10 } },
};
afterEach(() => vi.unstubAllGlobals());
describe("DEX Screener endpoint contract", () => {
  it("parses the documented bare-array response instead of silently returning no pairs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([pair]))),
    );
    expect(await new DexScreenerClient().getTokenPairs(token)).toHaveLength(1);
  });
  it("rejects wrong identity and malformed response envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ pairs: [pair] }))),
    );
    await expect(new DexScreenerClient().getTokenPairs(token)).rejects.toThrow(
      /array/,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify([{ ...pair, chainId: "ethereum" }])),
      ),
    );
    await expect(new DexScreenerClient().getTokenPairs(token)).rejects.toThrow(
      /identity/,
    );
  });
});

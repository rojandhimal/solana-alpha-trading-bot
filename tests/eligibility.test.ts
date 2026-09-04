import { describe, expect, it } from "vitest";
import { evaluateEligibility } from "../packages/market-data/src/eligibility.js";
import type { TokenPair } from "../packages/market-data/src/types.js";

const basePair: TokenPair = {
  chainId: "solana",
  dexId: "test",
  pairAddress: "pair",
  baseToken: { address: "token", name: "Test", symbol: "TEST" },
  quoteToken: { address: "quote", name: "USD", symbol: "USDC" },
  priceUsd: 1,
  liquidityUsd: 1_000_000,
  marketCapUsd: 10_000_000,
  fdvUsd: 10_000_000,
  volume24hUsd: 2_000_000,
  volume1hUsd: 100_000,
  buys24h: 10_000,
  sells24h: 5_000,
  pairCreatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  url: null
};

describe("token eligibility", () => {
  it("accepts a sufficiently liquid and active pair", () => {
    expect(evaluateEligibility(basePair)).toEqual({ eligible: true, reasons: [] });
  });

  it("rejects insufficient liquidity", () => {
    const result = evaluateEligibility({ ...basePair, liquidityUsd: 10_000 });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("INSUFFICIENT_LIQUIDITY");
  });

  it("rejects insufficient volume", () => {
    const result = evaluateEligibility({ ...basePair, volume24hUsd: 10_000 });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("INSUFFICIENT_VOLUME");
  });

  it("rejects a newly created pair", () => {
    const result = evaluateEligibility({ ...basePair, pairCreatedAt: new Date() });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("PAIR_TOO_NEW");
  });

  it("rejects an unknown pair age", () => {
    const result = evaluateEligibility({ ...basePair, pairCreatedAt: null });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("UNKNOWN_PAIR_AGE");
  });
});

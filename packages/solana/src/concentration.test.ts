import { describe, expect, it } from "vitest";
import { calculateConcentration } from "./concentration.js";
import type { LargestTokenAccount, TokenAmount } from "./rpc.js";

const supply: TokenAmount = {
  amount: "1000000",
  decimals: 6,
  uiAmount: 1,
  uiAmountString: "1",
};

const accounts: LargestTokenAccount[] = Array.from({ length: 20 }, (_, i) => ({
  address: `account-${i}`,
  amount: String(50_000 - i * 1_000),
  decimals: 6,
  uiAmount: null,
  uiAmountString: "0",
}));

describe("calculateConcentration", () => {
  it("calculates top holder concentration", () => {
    const result = calculateConcentration(supply, accounts);
    expect(result.top1Percent).toBe(5);
    expect(result.top5Percent).toBe(24);
    expect(result.top10Percent).toBe(45.5);
    expect(result.top20Percent).toBe(81);
  });

  it("does not overflow normal integer token supplies", () => {
    const largeSupply: TokenAmount = { ...supply, amount: "100000000000000000000000000" };
    const result = calculateConcentration(largeSupply, accounts);
    expect(result.top20Percent).toBe(0);
  });
});

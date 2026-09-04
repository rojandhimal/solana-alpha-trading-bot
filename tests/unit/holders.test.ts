import { describe, expect, it } from "vitest";
import { analyzeHolders, type Holder } from "../../packages/holders/src/index.js";

describe("holder concentration", () => {
  it("flags extreme top-holder concentration", () => {
    const holders: Holder[] = [
      { address: "a", balance: 400n, percentage: 0, isProgram: false, isKnownBurnAddress: false },
      { address: "b", balance: 100n, percentage: 0, isProgram: false, isKnownBurnAddress: false },
      { address: "c", balance: 100n, percentage: 0, isProgram: false, isKnownBurnAddress: false }
    ];
    const result = analyzeHolders(holders, 1000n);
    expect(result.top1Percentage).toBe(40);
    expect(result.concentrationRisk).toBe("HIGH");
  });

  it("returns unknown when holder data is unavailable", () => {
    const result = analyzeHolders([], 1000n);
    expect(result.concentrationRisk).toBe("UNKNOWN");
    expect(result.findings).toContain("INSUFFICIENT_HOLDER_DATA");
  });
});

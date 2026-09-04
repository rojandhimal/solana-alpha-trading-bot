import { describe, expect, it } from "vitest";
import { simulateExit } from "../../packages/liquidity/src/index.js";

describe("exit simulation", () => {
  it("passes a small position against deep liquidity", () => {
    const result = simulateExit({
      positionUsd: 500,
      poolLiquidityUsd: 1_000_000,
      expectedSlippagePercent: 0.2,
      feePercent: 0.3
    });
    expect(result.decision).toBe("PASS");
    expect(result.expectedReceivedUsd).toBeGreaterThan(490);
  });

  it("rejects a position that is too large for the pool", () => {
    const result = simulateExit({
      positionUsd: 60_000,
      poolLiquidityUsd: 1_000_000,
      expectedSlippagePercent: 0.5,
      feePercent: 0.3
    });
    expect(result.decision).toBe("REJECT");
    expect(result.reasons).toContain("POSITION_TOO_LARGE_FOR_POOL");
  });
});

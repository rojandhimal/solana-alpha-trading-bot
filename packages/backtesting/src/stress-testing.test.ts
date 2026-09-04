import { describe, expect, it } from "vitest";
import { getStressParameters, runStressScenarios } from "./stress-testing.js";

describe("stress testing", () => {
  it("returns deterministic adverse execution parameters", () => {
    expect(getStressParameters("LIQUIDITY_SHOCK")).toEqual({
      slippageMultiplier: 3,
      feeMultiplier: 1,
      liquidityMultiplier: 0.5,
      executionDelayBars: 0,
      volatilityMultiplier: 1
    });
  });

  it("runs each requested scenario", () => {
    const results = runStressScenarios(["BASE", "HIGH_SLIPPAGE", "EXECUTION_DELAY"], (parameters) => ({
      totalReturnPct: 10 / parameters.slippageMultiplier,
      maxDrawdownPct: 5 * parameters.volatilityMultiplier,
      tradeCount: 20,
      profitFactor: 1.4,
      expectancy: 4
    }));

    expect(results).toHaveLength(3);
    expect(results[1]?.scenario).toBe("HIGH_SLIPPAGE");
    expect(results[2]?.parameters.executionDelayBars).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { evaluateParameterStability } from "./parameter-stability.js";

describe("parameter stability", () => {
  it("passes when the majority of nearby variants are acceptable", () => {
    const result = evaluateParameterStability([
      { totalReturnPct: 5, maxDrawdownPct: 10, profitFactor: 1.5 },
      { totalReturnPct: 3, maxDrawdownPct: 20, profitFactor: 1.2 },
      { totalReturnPct: 1, maxDrawdownPct: 30, profitFactor: 1.1 },
      { totalReturnPct: -1, maxDrawdownPct: 40, profitFactor: 0.8 }
    ], { minAcceptableRatePct: 75 });
    expect(result.tested).toBe(4);
    expect(result.acceptable).toBe(3);
    expect(result.acceptableRatePct).toBe(75);
    expect(result.passed).toBe(true);
  });

  it("fails when the parameter neighborhood is fragile", () => {
    const result = evaluateParameterStability([
      { totalReturnPct: 10, maxDrawdownPct: 10, profitFactor: 1.5 },
      { totalReturnPct: -5, maxDrawdownPct: 45, profitFactor: 0.7 },
      { totalReturnPct: -3, maxDrawdownPct: 50, profitFactor: 0.8 }
    ], { minAcceptableRatePct: 50 });
    expect(result.passed).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { buildRobustnessReport } from "./stress-report.js";

const metrics = (overrides = {}) => ({ totalReturnPct: 10, maxDrawdownPct: 10, tradeCount: 50, profitFactor: 1.5, expectancy: 5, ...overrides });

describe("robustness report", () => {
  it("passes when the required scenario rate passes", () => {
    const report = buildRobustnessReport([
      { scenario: "BASE", parameters: { slippageMultiplier: 1, feeMultiplier: 1, liquidityMultiplier: 1, executionDelayBars: 0, volatilityMultiplier: 1 }, metrics: metrics() },
      { scenario: "HIGH_FEES", parameters: { slippageMultiplier: 1, feeMultiplier: 2, liquidityMultiplier: 1, executionDelayBars: 0, volatilityMultiplier: 1 }, metrics: metrics() },
      { scenario: "HIGH_SLIPPAGE", parameters: { slippageMultiplier: 2, feeMultiplier: 1, liquidityMultiplier: 1, executionDelayBars: 0, volatilityMultiplier: 1 }, metrics: metrics({ profitFactor: 0.9 }) }
    ], { maxDrawdownPct: 20, minProfitFactor: 1.2, minExpectancy: 0, minPassingScenarioRatePct: 66.67 });

    expect(report.passed).toBe(true);
    expect(report.passingScenarioRatePct).toBeCloseTo(66.666, 2);
    expect(report.lowestProfitFactor).toBe(0.9);
  });

  it("fails empty results", () => {
    const report = buildRobustnessReport([], { maxDrawdownPct: 20, minProfitFactor: 1.2, minExpectancy: 0, minPassingScenarioRatePct: 50 });
    expect(report.passed).toBe(false);
    expect(report.passingScenarioRatePct).toBe(0);
  });
});

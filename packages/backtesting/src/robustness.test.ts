import { describe, expect, it } from "vitest";
import { evaluateRobustness, evaluateWalkForwardRobustness } from "./robustness.js";

describe("robustness evaluation", () => {
  const thresholds = { maxDrawdownPct: 20, minProfitFactor: 1.2, minExpectancy: 0, minPassingScenarioRatePct: 80 };
  const results = [
    { scenario: "BASE" as const, parameters: {} as never, metrics: { totalReturnPct: 20, maxDrawdownPct: 10, tradeCount: 100, profitFactor: 1.6, expectancy: 8 } },
    { scenario: "HIGH_FEES" as const, parameters: {} as never, metrics: { totalReturnPct: 15, maxDrawdownPct: 12, tradeCount: 100, profitFactor: 1.4, expectancy: 5 } },
    { scenario: "HIGH_SLIPPAGE" as const, parameters: {} as never, metrics: { totalReturnPct: 5, maxDrawdownPct: 18, tradeCount: 100, profitFactor: 1.25, expectancy: 1 } },
    { scenario: "LIQUIDITY_SHOCK" as const, parameters: {} as never, metrics: { totalReturnPct: -2, maxDrawdownPct: 25, tradeCount: 100, profitFactor: 0.9, expectancy: -1 } },
    { scenario: "EXECUTION_DELAY" as const, parameters: {} as never, metrics: { totalReturnPct: 8, maxDrawdownPct: 14, tradeCount: 100, profitFactor: 1.3, expectancy: 3 } }
  ];

  it("passes when enough scenarios remain profitable", () => {
    const report = evaluateRobustness(results, thresholds);
    expect(report.passingScenarioRatePct).toBe(80);
    expect(report.passed).toBe(true);
  });

  it("fails when the robustness floor is violated", () => {
    const report = evaluateRobustness(results, { ...thresholds, minPassingScenarioRatePct: 100 });
    expect(report.passed).toBe(false);
    expect(report.failures).toContain("TOO_FEW_SCENARIOS_PASS");
  });

  it("accepts positive infinity profit factor when expectancy and drawdown are valid", () => {
    const report = evaluateRobustness([
      { scenario: "BASE" as const, parameters: {} as never, metrics: { totalReturnPct: 10, maxDrawdownPct: 2, tradeCount: 10, profitFactor: Number.POSITIVE_INFINITY, expectancy: 5 } }
    ], { ...thresholds, minPassingScenarioRatePct: 100 });
    expect(report.passed).toBe(true);
  });

  it("rejects NaN and negative infinity metrics", () => {
    const report = evaluateRobustness([
      { scenario: "BASE" as const, parameters: {} as never, metrics: { totalReturnPct: 10, maxDrawdownPct: Number.NaN, tradeCount: 10, profitFactor: 2, expectancy: 5 } }
    ], { ...thresholds, minPassingScenarioRatePct: 100 });
    expect(report.passed).toBe(false);
  });

  it("rejects an empty stress run", () => {
    const report = evaluateRobustness([], thresholds);
    expect(report.failures).toContain("NO_STRESS_RESULTS");
  });

  it("evaluates walk-forward robustness using existing OOS metrics and consistency", () => {
    const report = evaluateWalkForwardRobustness(
      {
        outOfSample: { maxDrawdownPct: 12, profitFactor: 1.5, expectancy: 4 } as never,
        consistency: {
          windowCount: 5,
          profitableWindowPct: 80,
          averageOosReturnPct: 3,
          medianOosReturnPct: 2.5,
          worstOosReturnPct: -1,
          averageOosDrawdownPct: 6,
          worstOosDrawdownPct: 12
        }
      },
      thresholds
    );

    expect(report.passed).toBe(true);
    expect(report.passingScenarioRatePct).toBe(80);
    expect(report.worstDrawdownPct).toBe(12);
    expect(report.worstProfitFactor).toBe(1.5);
    expect(report.worstExpectancy).toBe(4);
  });

  it("fails walk-forward robustness when OOS consistency falls below the floor", () => {
    const report = evaluateWalkForwardRobustness(
      {
        outOfSample: { maxDrawdownPct: 12, profitFactor: 1.5, expectancy: 4 } as never,
        consistency: {
          windowCount: 5,
          profitableWindowPct: 60,
          averageOosReturnPct: 1,
          medianOosReturnPct: 0.5,
          worstOosReturnPct: -3,
          averageOosDrawdownPct: 8,
          worstOosDrawdownPct: 12
        }
      },
      thresholds
    );

    expect(report.passed).toBe(false);
    expect(report.failures).toContain("TOO_FEW_OOS_WINDOWS_PROFITABLE");
  });
});

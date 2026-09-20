import { describe, expect, it } from "vitest";
import { evaluatePreDashboardGates } from "./pre-dashboard-gates.js";
import type { WalkForwardPipelineResult } from "./walk-forward-pipeline.js";

function result(returns: number[]): WalkForwardPipelineResult {
  const windows = returns.map((totalReturnPct) => ({
    trainStart: 0,
    trainEnd: 1,
    testStart: 1,
    testEnd: 2,
    train: {} as never,
    test: {
      metrics: {
        totalReturnPct,
        netProfit: totalReturnPct,
        maxDrawdownPct: 5,
        tradeCount: 2,
        winRatePct: 50,
        profitFactor: 1.5,
        expectancy: 1,
        averageWin: 2,
        averageLoss: 1
      },
      trades: [
        { returnPct: totalReturnPct / 2 },
        { returnPct: totalReturnPct / 2 }
      ]
    } as never,
  }));
  return {
    windows,
    outOfSample: {
      totalReturnPct: returns.reduce((a, b) => a + b, 0),
      netProfit: returns.reduce((a, b) => a + b, 0),
      maxDrawdownPct: 5,
      tradeCount: returns.length * 2,
      winRatePct: 50,
      profitFactor: 1.5,
      expectancy: 1,
      averageWin: 2,
      averageLoss: 1
    },
    consistency: {
      windowCount: returns.length,
      profitableWindowPct: 100,
      averageOosReturnPct: returns.reduce((a, b) => a + b, 0) / returns.length,
      medianOosReturnPct: returns[0]!,
      worstOosReturnPct: Math.min(...returns),
      averageOosDrawdownPct: 5,
      worstOosDrawdownPct: 5
    },
    robustness: { passed: true, passingScenarioRatePct: 100, worstDrawdownPct: 5, worstProfitFactor: 1.5, worstExpectancy: 1, failures: [] }
  };
}

describe("pre-dashboard readiness gates", () => {
  it("uses test-window returns and trade returns", () => {
    const value = evaluatePreDashboardGates({ baseline: result([1, 1, 1, 1, 1]), optimized: result([1, 1, 1, 1, 1]) });
    expect(value.statistical?.oosWindowReturnCi).toBeDefined();
    expect(value.statistical?.monteCarlo).toBeDefined();
    expect(value.reasons).not.toContain("insufficient finite OOS window returns for statistical validation");
  });

  it("fails when the OOS window confidence interval is not positive", () => {
    const value = evaluatePreDashboardGates({ baseline: result([-1, -1, -1, -1, -1]), optimized: result([-1, -1, -1, -1, -1]) });
    expect(value.passed).toBe(false);
    expect(value.reasons.some((reason) => reason.includes("95% bootstrap CI lower bound"))).toBe(true);
  });
});

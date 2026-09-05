import { describe, expect, it } from "vitest";
import { calculatePerformanceMetrics } from "./performance-metrics.js";
import type { PortfolioAccountingResult } from "./portfolio-accounting.js";

const result: PortfolioAccountingResult = {
  initialCapital: 1_000,
  finalEquity: 1_120,
  netProfit: 120,
  realizedPnl: 100,
  feesPaid: 5,
  completedTrades: 4,
  equityCurve: [
    { index: 0, cash: 1_000, positionQuantity: 0, averageEntryPrice: 0, positionValue: 0, equity: 1_000, realizedPnl: 0, unrealizedPnl: 0, feesPaid: 0, drawdownPct: 0 },
    { index: 1, cash: 900, positionQuantity: 1, averageEntryPrice: 100, positionValue: 90, equity: 990, realizedPnl: 0, unrealizedPnl: -10, feesPaid: 1, drawdownPct: 1 },
    { index: 2, cash: 1_120, positionQuantity: 0, averageEntryPrice: 0, positionValue: 0, equity: 1_120, realizedPnl: 120, unrealizedPnl: 0, feesPaid: 5, drawdownPct: 0 }
  ]
};

describe("performance metrics", () => {
  it("calculates return and maximum drawdown from the accounting result", () => {
    const metrics = calculatePerformanceMetrics(result);
    expect(metrics.totalReturnPct).toBeCloseTo(12, 6);
    expect(metrics.netProfit).toBe(120);
    expect(metrics.maxDrawdownPct).toBeCloseTo(1, 6);
    expect(metrics.tradeCount).toBe(4);
  });

  it("does not invent trade-level metrics without trade attribution", () => {
    const metrics = calculatePerformanceMetrics(result);
    expect(metrics.winRatePct).toBe(0);
    expect(metrics.profitFactor).toBe(0);
    expect(metrics.expectancy).toBe(0);
  });
});

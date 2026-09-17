import { describe, expect, it } from "vitest";
import { calculatePerformanceMetrics } from "./performance-metrics.js";
import type { PortfolioAccountingResult } from "./portfolio-accounting.js";
import type { CompletedTrade } from "./trade-attribution.js";

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

const trade = (netPnl: number): CompletedTrade => ({
  entryIndex: 0,
  exitIndex: 1,
  side: "LONG",
  quantity: 1,
  entryReferencePrice: 100,
  exitReferencePrice: 100 + netPnl,
  entryPrice: 100,
  exitPrice: 100 + netPnl,
  entryFee: 0,
  exitFee: 0,
  grossPnl: netPnl,
  netPnl,
  returnPct: netPnl,
  holdingBars: 1
});

describe("performance metrics", () => {
  it("calculates return and maximum drawdown from the accounting result", () => {
    const metrics = calculatePerformanceMetrics(result);
    expect(metrics.totalReturnPct).toBeCloseTo(12, 6);
    expect(metrics.netProfit).toBe(120);
    expect(metrics.maxDrawdownPct).toBeCloseTo(1, 6);
    expect(metrics.tradeCount).toBe(0);
  });

  it("calculates win rate, profit factor and expectancy from completed trades", () => {
    const metrics = calculatePerformanceMetrics(result, [trade(20), trade(10), trade(-5), trade(-5)]);
    expect(metrics.tradeCount).toBe(4);
    expect(metrics.winRatePct).toBe(50);
    expect(metrics.profitFactor).toBeCloseTo(3, 6);
    expect(metrics.averageWin).toBe(15);
    expect(metrics.averageLoss).toBe(5);
    expect(metrics.expectancy).toBe(5);
  });

  it("handles all winners without inventing a finite profit factor", () => {
    const metrics = calculatePerformanceMetrics(result, [trade(10), trade(20)]);
    expect(metrics.winRatePct).toBe(100);
    expect(metrics.profitFactor).toBe(Number.POSITIVE_INFINITY);
    expect(metrics.expectancy).toBe(15);
  });

  it("handles all losers", () => {
    const metrics = calculatePerformanceMetrics(result, [trade(-10), trade(-20)]);
    expect(metrics.winRatePct).toBe(0);
    expect(metrics.profitFactor).toBe(0);
    expect(metrics.expectancy).toBe(-15);
  });

  it("handles breakeven and empty trade histories", () => {
    const breakeven = calculatePerformanceMetrics(result, [trade(0)]);
    expect(breakeven.winRatePct).toBe(0);
    expect(breakeven.profitFactor).toBe(0);
    expect(breakeven.expectancy).toBe(0);

    const empty = calculatePerformanceMetrics(result);
    expect(empty.tradeCount).toBe(0);
    expect(empty.expectancy).toBe(0);
  });
});

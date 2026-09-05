import type { EquityPoint, PortfolioAccountingResult } from "./portfolio-accounting.js";

export interface PerformanceMetrics {
  totalReturnPct: number;
  netProfit: number;
  maxDrawdownPct: number;
  tradeCount: number;
  winRatePct: number;
  profitFactor: number;
  expectancy: number;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function calculatePerformanceMetrics(result: PortfolioAccountingResult): PerformanceMetrics {
  const curve: readonly EquityPoint[] = result.equityCurve;
  const initialCapital = result.initialCapital;
  const totalReturnPct = initialCapital === 0 ? 0 : (result.netProfit / initialCapital) * 100;
  const maxDrawdownPct = curve.reduce((max, point) => Math.max(max, finiteOrZero(point.drawdownPct)), 0);

  // Portfolio accounting exposes realized PnL but not individual trade PnLs yet.
  // Until trade-level attribution exists, profit factor, win rate and expectancy
  // are intentionally reported as zero rather than inferred incorrectly.
  return {
    totalReturnPct,
    netProfit: result.netProfit,
    maxDrawdownPct,
    tradeCount: result.completedTrades,
    winRatePct: 0,
    profitFactor: 0,
    expectancy: 0
  };
}

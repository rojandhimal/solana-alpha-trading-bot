import type { EquityPoint, PortfolioAccountingResult } from "./portfolio-accounting.js";
import type { CompletedTrade } from "./trade-attribution.js";

export interface PerformanceMetrics {
  totalReturnPct: number;
  netProfit: number;
  maxDrawdownPct: number;
  tradeCount: number;
  winRatePct: number;
  profitFactor: number;
  expectancy: number;
  averageWin: number;
  averageLoss: number;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function calculatePerformanceMetrics(
  result: PortfolioAccountingResult,
  trades: readonly CompletedTrade[] = []
): PerformanceMetrics {
  const curve: readonly EquityPoint[] = result.equityCurve;
  const initialCapital = result.initialCapital;
  const totalReturnPct = initialCapital === 0 ? 0 : (result.netProfit / initialCapital) * 100;
  const maxDrawdownPct = curve.reduce((max, point) => Math.max(max, finiteOrZero(point.drawdownPct)), 0);

  const wins = trades.filter((trade) => trade.netPnl > 0);
  const losses = trades.filter((trade) => trade.netPnl < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossLoss = losses.reduce((sum, trade) => sum + Math.abs(trade.netPnl), 0);
  const averageWin = wins.length === 0 ? 0 : grossProfit / wins.length;
  const averageLoss = losses.length === 0 ? 0 : grossLoss / losses.length;
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Number.POSITIVE_INFINITY : 0) : grossProfit / grossLoss;
  const winRatePct = trades.length === 0 ? 0 : (wins.length / trades.length) * 100;
  const expectancy = trades.length === 0 ? 0 : trades.reduce((sum, trade) => sum + trade.netPnl, 0) / trades.length;

  return {
    totalReturnPct,
    netProfit: result.netProfit,
    maxDrawdownPct,
    tradeCount: trades.length,
    winRatePct,
    profitFactor,
    expectancy,
    averageWin,
    averageLoss
  };
}

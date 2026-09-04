export interface BacktestMetrics {
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  profitFactor: number;
  expectancy: number;
  tradeCount: number;
}

export interface ValidationThresholds {
  minTrades: number;
  minProfitFactor: number;
  minExpectancy: number;
  maxDrawdownPct: number;
  minWinRatePct: number;
}

export interface ValidationResult {
  passed: boolean;
  failures: string[];
}

export function validateBacktest(metrics: BacktestMetrics, thresholds: ValidationThresholds): ValidationResult {
  const failures: string[] = [];
  if (metrics.tradeCount < thresholds.minTrades) failures.push("INSUFFICIENT_TRADES");
  if (metrics.profitFactor < thresholds.minProfitFactor) failures.push("PROFIT_FACTOR_TOO_LOW");
  if (metrics.expectancy <= thresholds.minExpectancy) failures.push("EXPECTANCY_NOT_POSITIVE");
  if (metrics.maxDrawdownPct > thresholds.maxDrawdownPct) failures.push("DRAWDOWN_TOO_HIGH");
  if (metrics.winRatePct < thresholds.minWinRatePct) failures.push("WIN_RATE_TOO_LOW");
  return { passed: failures.length === 0, failures };
}

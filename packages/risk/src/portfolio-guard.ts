export interface PortfolioGuardConfig {
  maxDailyLossPct: number;
  maxDrawdownPct: number;
  maxOpenPositions: number;
}

export interface PortfolioGuardState {
  startingDayEquity: number;
  peakEquity: number;
  openPositions: number;
}

export interface PortfolioGuardResult {
  allowed: boolean;
  dailyLossPct: number;
  drawdownPct: number;
  reason?: "DAILY_LOSS_LIMIT" | "MAX_DRAWDOWN" | "MAX_OPEN_POSITIONS" | "INVALID_EQUITY";
}

export function evaluatePortfolioGuard(
  currentEquity: number,
  state: PortfolioGuardState,
  config: PortfolioGuardConfig
): PortfolioGuardResult {
  if (!Number.isFinite(currentEquity) || currentEquity < 0 || !Number.isFinite(state.startingDayEquity) || state.startingDayEquity <= 0 || !Number.isFinite(state.peakEquity) || state.peakEquity <= 0) {
    return { allowed: false, dailyLossPct: 0, drawdownPct: 0, reason: "INVALID_EQUITY" };
  }

  const dailyLossPct = Math.max(0, (state.startingDayEquity - currentEquity) / state.startingDayEquity * 100);
  const drawdownPct = Math.max(0, (state.peakEquity - currentEquity) / state.peakEquity * 100);
  const maxDailyLossPct = Math.max(0, config.maxDailyLossPct);
  const maxDrawdownPct = Math.max(0, config.maxDrawdownPct);
  const maxOpenPositions = Math.max(0, Math.floor(config.maxOpenPositions));

  if (dailyLossPct >= maxDailyLossPct && maxDailyLossPct > 0) return { allowed: false, dailyLossPct, drawdownPct, reason: "DAILY_LOSS_LIMIT" };
  if (drawdownPct >= maxDrawdownPct && maxDrawdownPct > 0) return { allowed: false, dailyLossPct, drawdownPct, reason: "MAX_DRAWDOWN" };
  if (state.openPositions >= maxOpenPositions && maxOpenPositions > 0) return { allowed: false, dailyLossPct, drawdownPct, reason: "MAX_OPEN_POSITIONS" };

  return { allowed: true, dailyLossPct, drawdownPct };
}

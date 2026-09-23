import { accountFills, type PortfolioAccountingResult } from "./portfolio-accounting.js";
import { generateStrategyFills, type StrategyExecutionConfig } from "./strategy-execution-adapter.js";
import type { StrategyCandle } from "./alpha-strategy.js";

export interface PaperTradingRiskLimits { maxDrawdownPct: number; maxPositionNotionalPct: number; }
export interface PaperTradingSessionConfig { initialCapital: number; execution: StrategyExecutionConfig; riskLimits?: Partial<PaperTradingRiskLimits>; allowShort?: boolean; }
export interface PaperTradingSessionResult { fills: ReturnType<typeof generateStrategyFills>; accounting: PortfolioAccountingResult; risk: { halted: boolean; reasons: string[]; maxObservedDrawdownPct: number; maxObservedPositionNotionalPct: number; }; }
const DEFAULT_RISK_LIMITS: PaperTradingRiskLimits = { maxDrawdownPct: 35, maxPositionNotionalPct: 100 };
function accountingFor(candles: readonly StrategyCandle[], fills: ReturnType<typeof generateStrategyFills>, initialCapital: number, allowShort: boolean | undefined): PortfolioAccountingResult {
  return allowShort === undefined ? accountFills(candles, fills, initialCapital) : accountFills(candles, fills, initialCapital, { allowShort });
}
function validateLimits(limits: PaperTradingRiskLimits): void {
  if (!Number.isFinite(limits.maxDrawdownPct) || limits.maxDrawdownPct < 0 || limits.maxDrawdownPct > 100) throw new Error("maxDrawdownPct must be between 0 and 100");
  if (!Number.isFinite(limits.maxPositionNotionalPct) || limits.maxPositionNotionalPct <= 0 || limits.maxPositionNotionalPct > 1000) throw new Error("maxPositionNotionalPct must be > 0 and <= 1000");
}
export function runPaperTradingSession(candles: readonly StrategyCandle[], config: PaperTradingSessionConfig): PaperTradingSessionResult {
  if (!Number.isFinite(config.initialCapital) || config.initialCapital <= 0) throw new Error("initialCapital must be positive");
  const riskLimits = { ...DEFAULT_RISK_LIMITS, ...config.riskLimits }; validateLimits(riskLimits);
  const fills = generateStrategyFills(candles, config.execution);
  const accounting = accountingFor(candles, fills, config.initialCapital, config.allowShort);
  let maxObservedDrawdownPct = 0; let maxObservedPositionNotionalPct = 0;
  for (const point of accounting.equityCurve) { maxObservedDrawdownPct = Math.max(maxObservedDrawdownPct, point.drawdownPct); maxObservedPositionNotionalPct = Math.max(maxObservedPositionNotionalPct, Math.abs(point.positionValue) / Math.max(point.equity, 1e-9) * 100); }
  const reasons: string[] = [];
  if (maxObservedDrawdownPct > riskLimits.maxDrawdownPct) reasons.push(`max drawdown ${maxObservedDrawdownPct.toFixed(2)}% exceeded ${riskLimits.maxDrawdownPct.toFixed(2)}%`);
  if (maxObservedPositionNotionalPct > riskLimits.maxPositionNotionalPct) reasons.push(`max position notional ${maxObservedPositionNotionalPct.toFixed(2)}% exceeded ${riskLimits.maxPositionNotionalPct.toFixed(2)}%`);
  return { fills, accounting, risk: { halted: reasons.length > 0, reasons, maxObservedDrawdownPct, maxObservedPositionNotionalPct } };
}
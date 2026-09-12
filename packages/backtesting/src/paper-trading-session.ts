import { accountFills, type PortfolioAccountingResult } from "./portfolio-accounting.js";
import { generateStrategyFills, type StrategyExecutionConfig } from "./strategy-execution-adapter.js";
import type { StrategyCandle } from "./alpha-strategy.js";

export interface PaperTradingRiskLimits {
  maxDrawdownPct: number;
  maxPositionNotionalPct: number;
}

export interface PaperTradingSessionConfig {
  initialCapital: number;
  execution: StrategyExecutionConfig;
  riskLimits?: Partial<PaperTradingRiskLimits>;
  allowShort?: boolean;
}

export interface PaperTradingSessionResult {
  fills: ReturnType<typeof generateStrategyFills>;
  accounting: PortfolioAccountingResult;
  risk: {
    halted: boolean;
    reasons: string[];
    maxObservedDrawdownPct: number;
    maxObservedPositionNotionalPct: number;
  };
}

const DEFAULT_RISK_LIMITS: PaperTradingRiskLimits = {
  maxDrawdownPct: 35,
  maxPositionNotionalPct: 100
};

function validateLimits(limits: PaperTradingRiskLimits): void {
  if (!Number.isFinite(limits.maxDrawdownPct) || limits.maxDrawdownPct < 0 || limits.maxDrawdownPct > 100) {
    throw new Error("maxDrawdownPct must be between 0 and 100");
  }
  if (!Number.isFinite(limits.maxPositionNotionalPct) || limits.maxPositionNotionalPct <= 0 || limits.maxPositionNotionalPct > 1000) {
    throw new Error("maxPositionNotionalPct must be > 0 and <= 1000");
  }
}

/** Runs the existing strategy/execution/accounting pipeline as a paper-trading session.
 * This is deliberately non-broker-connected: it produces fills and risk telemetry only.
 */
export function runPaperTradingSession(
  candles: readonly StrategyCandle[],
  config: PaperTradingSessionConfig
): PaperTradingSessionResult {
  if (!Number.isFinite(config.initialCapital) || config.initialCapital <= 0) {
    throw new Error("initialCapital must be positive");
  }

  const riskLimits = { ...DEFAULT_RISK_LIMITS, ...config.riskLimits };
  validateLimits(riskLimits);

  const fills = generateStrategyFills(candles, config.execution);
  const accounting = accountFills(candles, fills, config.initialCapital, { allowShort: config.allowShort });

  let maxObservedDrawdownPct = 0;
  let maxObservedPositionNotionalPct = 0;
  for (const point of accounting.equityCurve) {
    maxObservedDrawdownPct = Math.max(maxObservedDrawdownPct, point.drawdownPct);
    const positionNotionalPct = accounting.initialCapital === 0
      ? 0
      : Math.abs(point.positionValue) / accounting.initialCapital * 100;
    maxObservedPositionNotionalPct = Math.max(maxObservedPositionNotionalPct, positionNotionalPct);
  }

  const reasons: string[] = [];
  if (maxObservedDrawdownPct > riskLimits.maxDrawdownPct) {
    reasons.push(`max drawdown ${maxObservedDrawdownPct.toFixed(2)}% exceeded ${riskLimits.maxDrawdownPct.toFixed(2)}%`);
  }
  if (maxObservedPositionNotionalPct > riskLimits.maxPositionNotionalPct) {
    reasons.push(`max position notional ${maxObservedPositionNotionalPct.toFixed(2)}% exceeded ${riskLimits.maxPositionNotionalPct.toFixed(2)}%`);
  }

  return {
    fills,
    accounting,
    risk: {
      halted: reasons.length > 0,
      reasons,
      maxObservedDrawdownPct,
      maxObservedPositionNotionalPct
    }
  };
}

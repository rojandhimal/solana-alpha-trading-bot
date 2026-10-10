import { PaperTradingState } from "./paper-trading-state.js";
import type { PortfolioAccountingResult } from "./portfolio-accounting.js";
import {
  generateStrategyFills,
  type StrategyExecutionConfig,
} from "./strategy-execution-adapter.js";
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
/** Batch sessions replay the same enforcing state used for incremental paper trading. */
export function runPaperTradingSession(
  candles: readonly StrategyCandle[],
  config: PaperTradingSessionConfig,
): PaperTradingSessionResult {
  const state = new PaperTradingState(config);
  for (const candle of candles) state.append(candle);
  const snapshot = state.snapshot();
  return {
    fills: [...state.getFills()],
    accounting: snapshot.accounting,
    risk: snapshot.risk,
  };
}

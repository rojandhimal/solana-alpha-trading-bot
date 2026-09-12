import type { ExecutionFill } from "./execution-model.js";
import { accountFills, type PortfolioAccountingResult } from "./portfolio-accounting.js";
import type { StrategyCandle } from "./alpha-strategy.js";
import type { StrategyExecutionConfig } from "./strategy-execution-adapter.js";
import { generateStrategyFills } from "./strategy-execution-adapter.js";
import type { PaperTradingRiskLimits } from "./paper-trading-session.js";

export interface PaperTradingSnapshot {
  candleCount: number;
  fillCount: number;
  accounting: PortfolioAccountingResult;
  risk: { halted: boolean; reasons: string[]; maxObservedDrawdownPct: number; maxObservedPositionNotionalPct: number };
}
export interface PaperTradingStateConfig { initialCapital: number; execution: StrategyExecutionConfig; riskLimits?: Partial<PaperTradingRiskLimits>; allowShort?: boolean; }

function riskFor(accounting: PortfolioAccountingResult, limits: PaperTradingRiskLimits) {
  const maxDrawdownPct = Math.max(...accounting.equityCurve.map((p) => p.drawdownPct), 0);
  const maxPositionNotionalPct = Math.max(...accounting.equityCurve.map((p) => Math.abs(p.positionValue) / accounting.initialCapital * 100), 0);
  const reasons: string[] = [];
  if (maxDrawdownPct > limits.maxDrawdownPct) reasons.push(`max drawdown ${maxDrawdownPct.toFixed(2)}% exceeded ${limits.maxDrawdownPct.toFixed(2)}%`);
  if (maxPositionNotionalPct > limits.maxPositionNotionalPct) reasons.push(`max position notional ${maxPositionNotionalPct.toFixed(2)}% exceeded ${limits.maxPositionNotionalPct.toFixed(2)}%`);
  return { halted: reasons.length > 0, reasons, maxObservedDrawdownPct: maxDrawdownPct, maxObservedPositionNotionalPct: maxPositionNotionalPct };
}

export class PaperTradingState {
  private readonly candles: StrategyCandle[] = [];
  private readonly fills: ExecutionFill[] = [];
  private halted = false;
  private readonly riskLimits: PaperTradingRiskLimits;
  private readonly config: PaperTradingStateConfig;

  constructor(config: PaperTradingStateConfig) {
    if (!Number.isFinite(config.initialCapital) || config.initialCapital <= 0) throw new Error("initialCapital must be positive");
    const riskLimits: PaperTradingRiskLimits = { maxDrawdownPct: 35, maxPositionNotionalPct: 100, ...config.riskLimits };
    if (!Number.isFinite(riskLimits.maxDrawdownPct) || riskLimits.maxDrawdownPct < 0 || riskLimits.maxDrawdownPct > 100) throw new Error("maxDrawdownPct must be between 0 and 100");
    if (!Number.isFinite(riskLimits.maxPositionNotionalPct) || riskLimits.maxPositionNotionalPct <= 0 || riskLimits.maxPositionNotionalPct > 1000) throw new Error("maxPositionNotionalPct must be > 0 and <= 1000");
    this.config = config;
    this.riskLimits = riskLimits;
  }

  append(candle: StrategyCandle): PaperTradingSnapshot {
    if (![candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)) throw new Error("candle values must be finite");
    if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0 || candle.volume < 0) throw new Error("candle prices must be positive and volume must be non-negative");
    if (this.candles.length > 0) {
      const previous = this.candles.at(-1)!;
      if (previous.timestamp !== undefined && candle.timestamp !== undefined && candle.timestamp <= previous.timestamp) throw new Error("candle timestamp must be strictly increasing");
    }
    this.candles.push(candle);
    const proposed = generateStrategyFills(this.candles, this.config.execution);
    const newFills = proposed.slice(this.fills.length);
    let candidateFills = newFills;
    const before = accountFills(this.candles, this.fills, this.config.initialCapital, { allowShort: this.config.allowShort });
    const beforePosition = before.equityCurve.at(-1)?.positionQuantity ?? 0;

    if (this.halted) {
      candidateFills = newFills.filter((fill) => beforePosition > 0 ? fill.side === "SELL" : beforePosition < 0 ? fill.side === "BUY" : false);
    } else if (candidateFills.length > 0) {
      const trial = accountFills(this.candles, [...this.fills, ...candidateFills], this.config.initialCapital, { allowShort: this.config.allowShort });
      const trialPositionPct = Math.abs(trial.equityCurve.at(-1)?.positionValue ?? 0) / this.config.initialCapital * 100;
      if (trialPositionPct > this.riskLimits.maxPositionNotionalPct) {
        // Preserve a close/reduce operation but never open exposure above the configured limit.
        candidateFills = candidateFills.filter((fill) => beforePosition > 0 ? fill.side === "SELL" : beforePosition < 0 ? fill.side === "BUY" : false);
      }
    }

    this.fills.push(...candidateFills);
    const accounting = accountFills(this.candles, this.fills, this.config.initialCapital, { allowShort: this.config.allowShort });
    const risk = riskFor(accounting, this.riskLimits);
    this.halted = this.halted || risk.halted;
    return { candleCount: this.candles.length, fillCount: this.fills.length, accounting, risk: { ...risk, halted: this.halted } };
  }

  snapshot(): PaperTradingSnapshot {
    const accounting = accountFills(this.candles, this.fills, this.config.initialCapital, { allowShort: this.config.allowShort });
    const risk = riskFor(accounting, this.riskLimits);
    return { candleCount: this.candles.length, fillCount: this.fills.length, accounting, risk: { ...risk, halted: this.halted || risk.halted } };
  }
  getCandles(): readonly StrategyCandle[] { return this.candles; }
  getFills(): readonly ExecutionFill[] { return this.fills; }
}

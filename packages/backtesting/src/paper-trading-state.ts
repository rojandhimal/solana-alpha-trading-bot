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
  risk: {
    halted: boolean;
    reasons: string[];
    maxObservedDrawdownPct: number;
    maxObservedPositionNotionalPct: number;
  };
}

export interface PaperTradingStateConfig {
  initialCapital: number;
  execution: StrategyExecutionConfig;
  riskLimits?: Partial<PaperTradingRiskLimits>;
  allowShort?: boolean;
}

export class PaperTradingState {
  private readonly candles: StrategyCandle[] = [];
  private readonly fills: ExecutionFill[] = [];
  private halted = false;
  private readonly riskLimits: PaperTradingRiskLimits;
  private readonly config: PaperTradingStateConfig;

  constructor(config: PaperTradingStateConfig) {
    if (!Number.isFinite(config.initialCapital) || config.initialCapital <= 0) throw new Error("initialCapital must be positive");
    const riskLimits: PaperTradingRiskLimits = {
      maxDrawdownPct: 35,
      maxPositionNotionalPct: 100,
      ...config.riskLimits
    };
    if (!Number.isFinite(riskLimits.maxDrawdownPct) || riskLimits.maxDrawdownPct < 0 || riskLimits.maxDrawdownPct > 100) throw new Error("maxDrawdownPct must be between 0 and 100");
    if (!Number.isFinite(riskLimits.maxPositionNotionalPct) || riskLimits.maxPositionNotionalPct <= 0 || riskLimits.maxPositionNotionalPct > 1000) throw new Error("maxPositionNotionalPct must be > 0 and <= 1000");
    this.config = config;
    this.riskLimits = riskLimits;
  }

  append(candle: StrategyCandle): PaperTradingSnapshot {
    if (this.halted) return this.snapshot();
    if (![candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)) throw new Error("candle values must be finite");
    if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0 || candle.volume < 0) throw new Error("candle prices must be positive and volume must be non-negative");

    const previousCount = this.candles.length;
    this.candles.push(candle);
    const newFills = generateStrategyFills(this.candles, this.config.execution);
    this.fills.splice(0, this.fills.length, ...newFills);
    const accounting = accountFills(this.candles, this.fills, this.config.initialCapital, { allowShort: this.config.allowShort });
    const point = accounting.equityCurve.at(-1);
    const maxDrawdown = Math.max(...accounting.equityCurve.map((entry) => entry.drawdownPct), 0);
    const maxPositionPct = Math.max(...accounting.equityCurve.map((entry) => Math.abs(entry.positionValue) / accounting.initialCapital * 100), 0);
    const reasons: string[] = [];
    if (maxDrawdown > this.riskLimits.maxDrawdownPct) reasons.push(`max drawdown ${maxDrawdown.toFixed(2)}% exceeded ${this.riskLimits.maxDrawdownPct.toFixed(2)}%`);
    if (maxPositionPct > this.riskLimits.maxPositionNotionalPct) reasons.push(`max position notional ${maxPositionPct.toFixed(2)}% exceeded ${this.riskLimits.maxPositionNotionalPct.toFixed(2)}%`);
    this.halted = reasons.length > 0;
    if (previousCount === this.candles.length) throw new Error("internal state update failed");
    return { candleCount: this.candles.length, fillCount: this.fills.length, accounting, risk: { halted: this.halted, reasons, maxObservedDrawdownPct: maxDrawdown, maxObservedPositionNotionalPct: maxPositionPct } };
  }

  snapshot(): PaperTradingSnapshot {
    const accounting = accountFills(this.candles, this.fills, this.config.initialCapital, { allowShort: this.config.allowShort });
    const maxDrawdown = Math.max(...accounting.equityCurve.map((entry) => entry.drawdownPct), 0);
    const maxPositionPct = Math.max(...accounting.equityCurve.map((entry) => Math.abs(entry.positionValue) / accounting.initialCapital * 100), 0);
    const reasons: string[] = [];
    if (maxDrawdown > this.riskLimits.maxDrawdownPct) reasons.push(`max drawdown ${maxDrawdown.toFixed(2)}% exceeded ${this.riskLimits.maxDrawdownPct.toFixed(2)}%`);
    if (maxPositionPct > this.riskLimits.maxPositionNotionalPct) reasons.push(`max position notional ${maxPositionPct.toFixed(2)}% exceeded ${this.riskLimits.maxPositionNotionalPct.toFixed(2)}%`);
    return { candleCount: this.candles.length, fillCount: this.fills.length, accounting, risk: { halted: this.halted || reasons.length > 0, reasons, maxObservedDrawdownPct: maxDrawdown, maxObservedPositionNotionalPct: maxPositionPct } };
  }

  getCandles(): readonly StrategyCandle[] { return this.candles; }
  getFills(): readonly ExecutionFill[] { return this.fills; }
}

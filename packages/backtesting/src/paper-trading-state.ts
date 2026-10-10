import type { ExecutionFill } from "./execution-model.js";
import {
  accountFills,
  type PortfolioAccountingResult,
} from "./portfolio-accounting.js";
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

function accountingFor(
  candles: readonly StrategyCandle[],
  fills: readonly ExecutionFill[],
  initialCapital: number,
  allowShort: boolean | undefined,
): PortfolioAccountingResult {
  return allowShort === undefined
    ? accountFills(candles, fills, initialCapital)
    : accountFills(candles, fills, initialCapital, { allowShort });
}
function fillKey(fill: ExecutionFill): string {
  return [
    fill.signalIndex,
    fill.executionIndex,
    fill.side,
    fill.quantity,
    fill.referencePrice,
    fill.fillPrice,
    fill.fee,
  ].join("|");
}
/** Select only fills that strictly reduce absolute exposure; never allow a same-batch flip. */
export function selectRiskReducingFills(
  fills: readonly ExecutionFill[],
  currentPositionQuantity: number,
): ExecutionFill[] {
  if (!Number.isFinite(currentPositionQuantity))
    throw new Error("currentPositionQuantity must be finite");
  const selected: ExecutionFill[] = [];
  let position = currentPositionQuantity;
  for (const fill of fills) {
    const nextPosition =
      position + (fill.side === "BUY" ? fill.quantity : -fill.quantity);
    if (
      Math.abs(nextPosition) < Math.abs(position) &&
      (nextPosition === 0 || Math.sign(nextPosition) === Math.sign(position))
    ) {
      selected.push(fill);
      position = nextPosition;
    }
  }
  return selected;
}

function riskFor(
  accounting: PortfolioAccountingResult,
  limits: PaperTradingRiskLimits,
) {
  const maxDrawdownPct = Math.max(
    ...accounting.equityCurve.map((p) => p.drawdownPct),
    0,
  );
  const maxPositionNotionalPct = Math.max(
    ...accounting.equityCurve.map(
      (p) => (Math.abs(p.positionValue) / Math.max(p.equity, 1e-9)) * 100,
    ),
    0,
  );
  const reasons: string[] = [];
  if (maxDrawdownPct > limits.maxDrawdownPct)
    reasons.push(
      `max drawdown ${maxDrawdownPct.toFixed(2)}% exceeded ${limits.maxDrawdownPct.toFixed(2)}%`,
    );
  if (maxPositionNotionalPct > limits.maxPositionNotionalPct)
    reasons.push(
      `max position notional ${maxPositionNotionalPct.toFixed(2)}% exceeded ${limits.maxPositionNotionalPct.toFixed(2)}%`,
    );
  return {
    halted: reasons.length > 0,
    reasons,
    maxObservedDrawdownPct: maxDrawdownPct,
    maxObservedPositionNotionalPct: maxPositionNotionalPct,
  };
}

export class PaperTradingState {
  private readonly candles: StrategyCandle[] = [];
  private readonly fills: ExecutionFill[] = [];
  private readonly processedFillKeys = new Set<string>();
  private halted = false;
  private readonly haltReasons = new Set<string>();
  private readonly riskLimits: PaperTradingRiskLimits;
  private readonly config: PaperTradingStateConfig;

  constructor(config: PaperTradingStateConfig) {
    if (!Number.isFinite(config.initialCapital) || config.initialCapital <= 0)
      throw new Error("initialCapital must be positive");
    const riskLimits: PaperTradingRiskLimits = {
      maxDrawdownPct: 35,
      maxPositionNotionalPct: 100,
      ...config.riskLimits,
    };
    if (
      !Number.isFinite(riskLimits.maxDrawdownPct) ||
      riskLimits.maxDrawdownPct < 0 ||
      riskLimits.maxDrawdownPct > 100
    )
      throw new Error("maxDrawdownPct must be between 0 and 100");
    if (
      !Number.isFinite(riskLimits.maxPositionNotionalPct) ||
      riskLimits.maxPositionNotionalPct <= 0 ||
      riskLimits.maxPositionNotionalPct > 1000
    )
      throw new Error("maxPositionNotionalPct must be > 0 and <= 1000");
    this.config = structuredClone(config);
    this.riskLimits = riskLimits;
  }

  append(candle: StrategyCandle): PaperTradingSnapshot {
    if (
      ![
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume,
      ].every(Number.isFinite)
    )
      throw new Error("candle values must be finite");
    if (
      candle.open <= 0 ||
      candle.high <= 0 ||
      candle.low <= 0 ||
      candle.close <= 0 ||
      candle.volume < 0
    )
      throw new Error(
        "candle prices must be positive and volume must be non-negative",
      );
    if (
      candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close) ||
      candle.high < candle.low
    )
      throw new Error("invalid candle bounds");
    if (
      candle.timestamp !== undefined &&
      (!Number.isSafeInteger(candle.timestamp) || candle.timestamp < 0)
    )
      throw new Error("invalid candle timestamp");
    const previous = this.candles.at(-1);
    if (
      previous &&
      (previous.timestamp === undefined) !== (candle.timestamp === undefined)
    )
      throw new Error("candle timestamps must be consistently supplied");
    if (
      previous?.timestamp !== undefined &&
      candle.timestamp !== undefined &&
      candle.timestamp <= previous.timestamp
    )
      throw new Error("candle timestamp must be strictly increasing");
    const nextCandles = [...this.candles, { ...candle }];
    const proposed = generateStrategyFills(nextCandles, this.config.execution);
    const newFills = proposed.filter(
      (fill) => !this.processedFillKeys.has(fillKey(fill)),
    );
    const atOpen = [
      ...nextCandles.slice(0, -1),
      { ...candle, close: candle.open },
    ];
    const before = accountingFor(
      atOpen,
      this.fills,
      this.config.initialCapital,
      this.config.allowShort,
    );
    let nextHalted = this.halted || riskFor(before, this.riskLimits).halted;
    const reasons = new Set([
      ...this.haltReasons,
      ...riskFor(before, this.riskLimits).reasons,
    ]);
    const candidateFills: ExecutionFill[] = [];
    // Evaluate each fill before accepting it, including intermediate reversal legs.
    for (const fill of newFills) {
      const current = accountingFor(
        atOpen,
        [...this.fills, ...candidateFills],
        this.config.initialCapital,
        this.config.allowShort,
      );
      const position = current.equityCurve.at(-1)?.positionQuantity ?? 0;
      const reducing = selectRiskReducingFills([fill], position).length > 0;
      if (nextHalted && !reducing) continue;
      try {
        const trial = accountingFor(
          atOpen,
          [...this.fills, ...candidateFills, fill],
          this.config.initialCapital,
          this.config.allowShort,
        );
        const risk = riskFor(trial, this.riskLimits);
        if (risk.halted && !reducing) {
          nextHalted = true;
          risk.reasons.forEach((reason) => reasons.add(reason));
          continue;
        }
        candidateFills.push(fill);
        if (risk.halted) {
          nextHalted = true;
          risk.reasons.forEach((reason) => reasons.add(reason));
        }
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !/insufficient cash|SELL quantity exceeds position/.test(
            error.message,
          )
        )
          throw error;
        nextHalted = true;
        reasons.add("execution rejected by cash or short-position constraint");
      }
    }
    const accounting = accountingFor(
      nextCandles,
      [...this.fills, ...candidateFills],
      this.config.initialCapital,
      this.config.allowShort,
    );
    const risk = riskFor(accounting, this.riskLimits);
    // Commit only after all validation/accounting succeeds.
    this.candles.push({ ...candle });
    for (const fill of newFills) this.processedFillKeys.add(fillKey(fill));
    this.fills.push(...candidateFills);
    this.halted = nextHalted || risk.halted;
    [...reasons, ...risk.reasons].forEach((reason) =>
      this.haltReasons.add(reason),
    );
    return {
      candleCount: this.candles.length,
      fillCount: this.fills.length,
      accounting,
      risk: { ...risk, halted: this.halted, reasons: [...this.haltReasons] },
    };
  }

  halt(reason: string): void {
    if (!reason.trim()) throw new Error("halt reason is required");
    this.halted = true;
    this.haltReasons.add(reason);
  }

  snapshot(): PaperTradingSnapshot {
    const accounting = accountingFor(
      this.candles,
      this.fills,
      this.config.initialCapital,
      this.config.allowShort,
    );
    const risk = riskFor(accounting, this.riskLimits);
    return {
      candleCount: this.candles.length,
      fillCount: this.fills.length,
      accounting,
      risk: {
        ...risk,
        halted: this.halted || risk.halted,
        reasons: [...new Set([...this.haltReasons, ...risk.reasons])],
      },
    };
  }
  getCandles(): readonly StrategyCandle[] {
    return this.candles.map((c) => ({ ...c }));
  }
  getFills(): readonly ExecutionFill[] {
    return this.fills.map((f) => ({ ...f }));
  }
}

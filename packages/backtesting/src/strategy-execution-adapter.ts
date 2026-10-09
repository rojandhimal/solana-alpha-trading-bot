import { executeRequest, type Candle, type ExecutionFill, type ExecutionModelParameters } from "./execution-model.js";
import { generateSignal, type AlphaStrategyConfig, type StrategyCandle } from "./alpha-strategy.js";

export interface StrategyExecutionConfig { quantity: number; strategy?: AlphaStrategyConfig; execution?: ExecutionModelParameters; }
export type StrategyPosition = "LONG" | "SHORT" | "FLAT";
export interface StatefulStrategyFills { fills: ExecutionFill[]; finalPosition: StrategyPosition; }

const DEFAULT_EXECUTION: ExecutionModelParameters = { executionDelayBars: 0, slippagePct: 0.1, feePct: 0.1, liquidityMultiplier: 1, volatilityMultiplier: 1 };
const DEFAULT_STRATEGY: AlphaStrategyConfig = { fastPeriod: 10, slowPeriod: 30, rsiPeriod: 14, momentumPeriod: 10, atrPeriod: 14, volumePeriod: 20, entryThreshold: 0.5 };

function requiredHistoryLength(strategy: AlphaStrategyConfig): number {
  return Math.max(strategy.slowPeriod * 3, strategy.rsiPeriod + 1, strategy.momentumPeriod + 1, strategy.atrPeriod + 1, strategy.volumePeriod);
}

export function generateStrategyFillsWithState(candles: readonly StrategyCandle[], config: StrategyExecutionConfig, initialPosition: StrategyPosition = "FLAT"): StatefulStrategyFills {
  if (!Number.isFinite(config.quantity) || config.quantity <= 0) throw new Error("quantity must be positive");
  const execution = { ...DEFAULT_EXECUTION, ...config.execution };
  const executionCandles: Candle[] = candles.map(({ open, high, low, close }) => ({ open, high, low, close }));
  const strategy = config.strategy ?? DEFAULT_STRATEGY;
  const historyLength = requiredHistoryLength(strategy);
  const fills: ExecutionFill[] = [];
  let position: StrategyPosition = initialPosition;
  for (let index = 0; index < candles.length; index += 1) {
    // Every feature uses a bounded lookback. Avoid copying/recalculating the full prefix
    // for every bar; this keeps grid-search walk-forward runs tractable without changing signals.
    const historyStart = Math.max(0, index + 1 - historyLength);
    const signal = generateSignal(candles.slice(historyStart, index + 1), strategy);
    const target = signal.side;
    if (target === position) continue;
    if (position !== "FLAT") {
      const closeSide = position === "LONG" ? "SELL" : "BUY";
      const closeFill = executeRequest(executionCandles, { signalIndex: index, side: closeSide, quantity: config.quantity }, execution);
      if (closeFill) fills.push(closeFill); else continue;
      position = "FLAT";
    }
    if (target !== "FLAT") {
      const openSide = target === "LONG" ? "BUY" : "SELL";
      const openFill = executeRequest(executionCandles, { signalIndex: index, side: openSide, quantity: config.quantity }, execution);
      if (openFill) { fills.push(openFill); position = target; }
    }
  }
  return { fills, finalPosition: position };
}

export function generateStrategyFills(candles: readonly StrategyCandle[], config: StrategyExecutionConfig): ExecutionFill[] {
  return generateStrategyFillsWithState(candles, config).fills;
}

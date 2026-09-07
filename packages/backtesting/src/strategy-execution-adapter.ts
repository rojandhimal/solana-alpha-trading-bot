import { executeRequest, type Candle, type ExecutionFill, type ExecutionModelParameters } from "./execution-model.js";
import { generateSignal, type AlphaStrategyConfig, type StrategyCandle } from "./alpha-strategy.js";

export interface StrategyExecutionConfig {
  quantity: number;
  strategy?: AlphaStrategyConfig;
  execution?: ExecutionModelParameters;
}

export type StrategyPosition = "LONG" | "SHORT" | "FLAT";

export interface StatefulStrategyFills {
  fills: ExecutionFill[];
  finalPosition: StrategyPosition;
}

const DEFAULT_EXECUTION: ExecutionModelParameters = {
  executionDelayBars: 0,
  slippagePct: 0.1,
  feePct: 0.1,
  liquidityMultiplier: 1,
  volatilityMultiplier: 1
};

/** Converts strategy candles to executable fills using signal transitions.
 * A new position is opened on LONG/SHORT from FLAT; a transition to the
 * opposite direction closes the current position and opens the new one.
 * FLAT closes an open position. The final open position is not force-closed.
 */
export function generateStrategyFillsWithState(
  candles: readonly StrategyCandle[],
  config: StrategyExecutionConfig,
  initialPosition: StrategyPosition = "FLAT"
): StatefulStrategyFills {
  if (!Number.isFinite(config.quantity) || config.quantity <= 0) throw new Error("quantity must be positive");

  const execution = { ...DEFAULT_EXECUTION, ...config.execution };
  const executionCandles: Candle[] = candles.map(({ open, high, low, close }) => ({ open, high, low, close }));
  const fills: ExecutionFill[] = [];
  let position: StrategyPosition = initialPosition;

  for (let index = 0; index < candles.length; index += 1) {
    const signal = generateSignal(candles.slice(0, index + 1), config.strategy);
    const target = signal.side;

    if (target === position) continue;

    if (position !== "FLAT") {
      const closeSide = position === "LONG" ? "SELL" : "BUY";
      const closeFill = executeRequest(executionCandles, { signalIndex: index, side: closeSide, quantity: config.quantity }, execution);
      if (closeFill) fills.push(closeFill);
      else continue;
      position = "FLAT";
    }

    if (target !== "FLAT") {
      const openSide = target === "LONG" ? "BUY" : "SELL";
      const openFill = executeRequest(executionCandles, { signalIndex: index, side: openSide, quantity: config.quantity }, execution);
      if (openFill) {
        fills.push(openFill);
        position = target;
      }
    }
  }

  return { fills, finalPosition: position };
}

export function generateStrategyFills(
  candles: readonly StrategyCandle[],
  config: StrategyExecutionConfig
): ExecutionFill[] {
  return generateStrategyFillsWithState(candles, config).fills;
}

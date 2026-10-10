import {
  executeRequest,
  validateExecutionParameters,
  type Candle,
  type ExecutionFill,
  type ExecutionModelParameters,
} from "./execution-model.js";
import {
  generateSignal,
  type AlphaStrategyConfig,
  type StrategyCandle,
} from "./alpha-strategy.js";

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
  executionDelayBars: 1,
  slippagePct: 0.1,
  feePct: 0.1,
  liquidityMultiplier: 1,
  volatilityMultiplier: 1,
};
const DEFAULT_STRATEGY: AlphaStrategyConfig = {
  fastPeriod: 10,
  slowPeriod: 30,
  rsiPeriod: 14,
  momentumPeriod: 10,
  atrPeriod: 14,
  volumePeriod: 20,
  entryThreshold: 0.5,
};

function requiredHistoryLength(strategy: AlphaStrategyConfig): number {
  return Math.max(
    strategy.slowPeriod * 3,
    strategy.rsiPeriod + 1,
    strategy.momentumPeriod + 1,
    strategy.atrPeriod + 1,
    strategy.volumePeriod,
  );
}

export function generateStrategyFillsWithState(
  candles: readonly StrategyCandle[],
  config: StrategyExecutionConfig,
  initialPosition: StrategyPosition = "FLAT",
  strategySchedule?: readonly AlphaStrategyConfig[],
): StatefulStrategyFills {
  if (!Number.isFinite(config.quantity) || config.quantity <= 0)
    throw new Error("quantity must be positive");
  const execution = { ...DEFAULT_EXECUTION, ...config.execution };
  validateExecutionParameters(execution);
  if (!["LONG", "SHORT", "FLAT"].includes(initialPosition))
    throw new Error("invalid initial position");
  if (strategySchedule && strategySchedule.length !== candles.length)
    throw new Error("strategy schedule must cover every candle");
  for (const strategy of strategySchedule ?? []) {
    if (!strategy) throw new Error("strategy schedule must cover every candle");
    generateSignal([], strategy); // Reject invalid selections even while an order is pending.
  }
  // Signals consume the completed candle; its open is already in the past.
  if (
    !Number.isInteger(execution.executionDelayBars) ||
    execution.executionDelayBars < 0
  )
    throw new Error("executionDelayBars must be a non-negative integer");
  execution.executionDelayBars = Math.max(1, execution.executionDelayBars);
  const executionCandles: Candle[] = candles.map(
    ({ open, high, low, close }) => ({ open, high, low, close }),
  );
  const fills: ExecutionFill[] = [];
  let position: StrategyPosition = initialPosition;
  let pending:
    | { signalIndex: number; executionIndex: number; target: StrategyPosition }
    | undefined;
  for (let index = 0; index < candles.length; index += 1) {
    // Positions change only when the delayed execution bar actually arrives.
    if (pending?.executionIndex === index) {
      if (position !== "FLAT") {
        const closeFill = executeRequest(
          executionCandles,
          {
            signalIndex: pending.signalIndex,
            side: position === "LONG" ? "SELL" : "BUY",
            quantity: config.quantity,
          },
          execution,
        );
        if (closeFill) fills.push(closeFill);
      }
      if (pending.target !== "FLAT") {
        const openFill = executeRequest(
          executionCandles,
          {
            signalIndex: pending.signalIndex,
            side: pending.target === "LONG" ? "BUY" : "SELL",
            quantity: config.quantity,
          },
          execution,
        );
        if (openFill) fills.push(openFill);
      }
      position = pending.target;
      pending = undefined;
    }
    if (pending) continue; // One pending transition; no duplicate exposure orders.
    // Only the configuration effective at this completed candle can signal.
    // Pending transitions keep their original target across parameter changes.
    const strategy =
      strategySchedule?.[index] ?? config.strategy ?? DEFAULT_STRATEGY;
    const historyLength = requiredHistoryLength(strategy);
    const historyStart = Math.max(0, index + 1 - historyLength);
    const target = generateSignal(
      candles.slice(historyStart, index + 1),
      strategy,
    ).side;
    if (target !== position)
      pending = {
        signalIndex: index,
        executionIndex: index + execution.executionDelayBars,
        target,
      };
  }
  return { fills, finalPosition: position };
}

export function generateStrategyFills(
  candles: readonly StrategyCandle[],
  config: StrategyExecutionConfig,
): ExecutionFill[] {
  return generateStrategyFillsWithState(candles, config).fills;
}

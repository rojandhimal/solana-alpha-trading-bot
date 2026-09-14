import { executeRequest, type Candle, type ExecutionFill, type ExecutionModelParameters } from "./execution-model.js";
import { generateSignal, type AlphaStrategyConfig, type StrategyCandle } from "./alpha-strategy.js";

export interface StrategyExecutionConfig {
  quantity: number;
  strategy?: AlphaStrategyConfig;
  execution?: ExecutionModelParameters;
}

const DEFAULT_EXECUTION: ExecutionModelParameters = {
  executionDelayBars: 0,
  slippagePct: 0.1,
  feePct: 0.1,
  liquidityMultiplier: 1,
  volatilityMultiplier: 1
};

function validateExecution(execution: ExecutionModelParameters): void {
  if (!Number.isInteger(execution.executionDelayBars) || execution.executionDelayBars < 0) throw new Error("executionDelayBars must be a non-negative integer");
  if (!Number.isFinite(execution.slippagePct) || execution.slippagePct < 0) throw new Error("slippagePct must be non-negative");
  if (!Number.isFinite(execution.feePct) || execution.feePct < 0) throw new Error("feePct must be non-negative");
  if (!Number.isFinite(execution.liquidityMultiplier) || execution.liquidityMultiplier <= 0) throw new Error("liquidityMultiplier must be positive");
  if (!Number.isFinite(execution.volatilityMultiplier) || execution.volatilityMultiplier <= 0) throw new Error("volatilityMultiplier must be positive");
}

/** Converts strategy candles to executable fills using signal transitions. */
export function generateStrategyFills(
  candles: readonly StrategyCandle[],
  config: StrategyExecutionConfig
): ExecutionFill[] {
  if (!Number.isFinite(config.quantity) || config.quantity <= 0) throw new Error("quantity must be positive");
  const execution = { ...DEFAULT_EXECUTION, ...config.execution };
  validateExecution(execution);
  const executionCandles: Candle[] = candles.map(({ open, high, low, close }) => ({ open, high, low, close }));
  const fills: ExecutionFill[] = [];
  let position: "LONG" | "SHORT" | "FLAT" = "FLAT";

  for (let index = 0; index < candles.length; index += 1) {
    const signal = generateSignal(candles.slice(0, index + 1), config.strategy);
    const target = signal.side;
    if (target === position) continue;

    if (position !== "FLAT") {
      const closeSide = position === "LONG" ? "SELL" : "BUY";
      const closeFill = executeRequest(executionCandles, { signalIndex: index, side: closeSide, quantity: config.quantity }, execution);
      if (!closeFill) continue;
      fills.push(closeFill);
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
  return fills;
}

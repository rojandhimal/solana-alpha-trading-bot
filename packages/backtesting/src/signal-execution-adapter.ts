import { executeRequest, type Candle, type ExecutionFill, type ExecutionModelParameters, type ExecutionSide } from "./execution-model.js";
import type { StressParameters } from "./stress-testing.js";

export interface StrategySignal {
  signalIndex: number;
  side: ExecutionSide;
  quantity: number;
}

export interface PaperExecutionConfig {
  baseSlippagePct: number;
  baseFeePct: number;
}

export interface PaperExecutionResult {
  fills: ExecutionFill[];
  skippedSignals: number[];
}

export function executeSignals(
  candles: readonly Candle[],
  signals: readonly StrategySignal[],
  stress: StressParameters,
  config: PaperExecutionConfig
): PaperExecutionResult {
  const parameters: ExecutionModelParameters = {
    executionDelayBars: stress.executionDelayBars,
    slippagePct: config.baseSlippagePct * stress.slippageMultiplier,
    feePct: config.baseFeePct * stress.feeMultiplier,
    liquidityMultiplier: stress.liquidityMultiplier,
    volatilityMultiplier: stress.volatilityMultiplier
  };

  const fills: ExecutionFill[] = [];
  const skippedSignals: number[] = [];
  for (const signal of signals) {
    const fill = executeRequest(candles, signal, parameters);
    if (fill) fills.push(fill);
    else skippedSignals.push(signal.signalIndex);
  }
  return { fills, skippedSignals };
}

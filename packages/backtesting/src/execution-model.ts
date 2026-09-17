export type ExecutionSide = "BUY" | "SELL";

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ExecutionRequest {
  signalIndex: number;
  side: ExecutionSide;
  quantity: number;
}

export interface ExecutionModelParameters {
  executionDelayBars: number;
  slippagePct: number;
  feePct: number;
  liquidityMultiplier: number;
  volatilityMultiplier: number;
}

export interface ExecutionFill {
  signalIndex: number;
  executionIndex: number;
  side: ExecutionSide;
  quantity: number;
  referencePrice: number;
  fillPrice: number;
  fee: number;
}

export function executeRequest(
  candles: readonly Candle[],
  request: ExecutionRequest,
  parameters: ExecutionModelParameters
): ExecutionFill | null {
  if (!Number.isInteger(request.signalIndex) || request.signalIndex < 0) throw new Error("signalIndex must be a non-negative integer");
  if (!Number.isFinite(request.quantity) || request.quantity <= 0) throw new Error("quantity must be positive");
  if (!Number.isInteger(parameters.executionDelayBars) || parameters.executionDelayBars < 0) throw new Error("executionDelayBars must be a non-negative integer");
  if (parameters.liquidityMultiplier <= 0) throw new Error("liquidityMultiplier must be positive");
  if (parameters.volatilityMultiplier <= 0) throw new Error("volatilityMultiplier must be positive");
  if (parameters.slippagePct < 0 || parameters.feePct < 0) throw new Error("cost percentages cannot be negative");

  const executionIndex = request.signalIndex + parameters.executionDelayBars;
  const candle = candles[executionIndex];
  if (!candle) return null;

  const referencePrice = candle.open;
  const effectiveSlippage = parameters.slippagePct * parameters.volatilityMultiplier / parameters.liquidityMultiplier;
  const direction = request.side === "BUY" ? 1 : -1;
  const fillPrice = referencePrice * (1 + direction * effectiveSlippage / 100);
  const notional = fillPrice * request.quantity;
  const fee = notional * parameters.feePct / 100;

  return { signalIndex: request.signalIndex, executionIndex, side: request.side, quantity: request.quantity, referencePrice, fillPrice, fee };
}

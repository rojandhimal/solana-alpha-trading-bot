export interface ExitSimulationInput {
  positionUsd: number;
  poolLiquidityUsd: number;
  expectedSlippagePercent: number;
  feePercent: number;
}

export interface ExitSimulation {
  grossUsd: number;
  priceImpactUsd: number;
  feeUsd: number;
  expectedReceivedUsd: number;
  effectiveLossPercent: number;
  decision: "PASS" | "WARN" | "REJECT";
  reasons: string[];
}

export function simulateExit(input: ExitSimulationInput): ExitSimulation {
  const reasons: string[] = [];

  if (!Number.isFinite(input.positionUsd) || input.positionUsd <= 0) {
    throw new Error("positionUsd must be a positive finite number");
  }
  if (!Number.isFinite(input.poolLiquidityUsd) || input.poolLiquidityUsd <= 0) {
    throw new Error("poolLiquidityUsd must be a positive finite number");
  }
  if (!Number.isFinite(input.expectedSlippagePercent) || input.expectedSlippagePercent < 0) {
    throw new Error("expectedSlippagePercent must be non-negative");
  }
  if (!Number.isFinite(input.feePercent) || input.feePercent < 0) {
    throw new Error("feePercent must be non-negative");
  }

  const liquidityRatio = input.positionUsd / input.poolLiquidityUsd;
  const impactPercent = Math.min(100, liquidityRatio * 100);
  const priceImpactUsd = input.positionUsd * (impactPercent / 100);
  const feeUsd = input.positionUsd * (input.feePercent / 100);
  const slippageUsd = input.positionUsd * (input.expectedSlippagePercent / 100);
  const expectedReceivedUsd = Math.max(0, input.positionUsd - priceImpactUsd - feeUsd - slippageUsd);
  const effectiveLossPercent = ((input.positionUsd - expectedReceivedUsd) / input.positionUsd) * 100;

  if (liquidityRatio > 0.05) reasons.push("POSITION_TOO_LARGE_FOR_POOL");
  if (input.expectedSlippagePercent > 1) reasons.push("HIGH_EXPECTED_SLIPPAGE");
  if (effectiveLossPercent > 5) reasons.push("HIGH_EXIT_COST");

  let decision: ExitSimulation["decision"] = "PASS";
  if (reasons.includes("POSITION_TOO_LARGE_FOR_POOL") || effectiveLossPercent > 10) decision = "REJECT";
  else if (reasons.length > 0) decision = "WARN";

  return {
    grossUsd: input.positionUsd,
    priceImpactUsd,
    feeUsd: feeUsd + slippageUsd,
    expectedReceivedUsd,
    effectiveLossPercent,
    decision,
    reasons
  };
}

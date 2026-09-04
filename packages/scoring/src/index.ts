export type SignalDecision = "BUY_CANDIDATE" | "WATCH" | "REJECT";

export interface ScoringInput {
  safetyScore: number;
  liquidityScore: number;
  holderRiskScore: number;
  exitabilityScore: number;
  momentumScore: number;
  flowScore: number;
  volatilityScore: number;
  marketRegimeScore: number;
  dataQualityScore: number;
  hardVeto: boolean;
}

export interface PrecisionScore {
  signalScore: number;
  confidenceScore: number;
  decision: SignalDecision;
  hardVeto: boolean;
  reasons: string[];
}

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export function calculatePrecisionScore(input: ScoringInput): PrecisionScore {
  const safety = clamp(input.safetyScore);
  const liquidity = clamp(input.liquidityScore);
  const holderRisk = clamp(input.holderRiskScore);
  const exitability = clamp(input.exitabilityScore);
  const momentum = clamp(input.momentumScore);
  const flow = clamp(input.flowScore);
  const volatility = clamp(input.volatilityScore);
  const regime = clamp(input.marketRegimeScore);
  const quality = clamp(input.dataQualityScore);

  const signalScore = Math.round(
    safety * 0.20 +
      liquidity * 0.15 +
      holderRisk * 0.10 +
      exitability * 0.15 +
      momentum * 0.10 +
      flow * 0.10 +
      volatility * 0.05 +
      regime * 0.05 +
      quality * 0.10
  );

  const confidenceScore = Math.round(
    quality * 0.45 + safety * 0.20 + liquidity * 0.15 + exitability * 0.20
  );

  const reasons: string[] = [];
  if (input.hardVeto) reasons.push("HARD_SAFETY_VETO");
  if (safety < 70) reasons.push("SAFETY_BELOW_THRESHOLD");
  if (liquidity < 60) reasons.push("LIQUIDITY_BELOW_THRESHOLD");
  if (exitability < 60) reasons.push("EXITABILITY_BELOW_THRESHOLD");
  if (quality < 60) reasons.push("DATA_QUALITY_LOW");
  if (holderRisk < 50) reasons.push("HOLDER_CONCENTRATION_RISK");

  let decision: SignalDecision = "WATCH";
  if (
    !input.hardVeto &&
    signalScore >= 80 &&
    confidenceScore >= 70 &&
    safety >= 70 &&
    liquidity >= 60 &&
    exitability >= 60
  ) {
    decision = "BUY_CANDIDATE";
  } else if (input.hardVeto || safety < 50 || liquidity < 30 || exitability < 30) {
    decision = "REJECT";
  }

  return {
    signalScore: clamp(signalScore),
    confidenceScore: clamp(confidenceScore),
    decision,
    hardVeto: input.hardVeto,
    reasons
  };
}

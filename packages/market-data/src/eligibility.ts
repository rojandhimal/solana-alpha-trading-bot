import { config } from "@alpha/config";
import type { TokenPair } from "./types.js";

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export function evaluateEligibility(pair: TokenPair): EligibilityResult {
  const reasons: string[] = [];

  if (pair.chainId !== "solana") reasons.push("NOT_SOLANA");
  if (pair.liquidityUsd === null || pair.liquidityUsd < config.MIN_LIQUIDITY_USD) reasons.push("INSUFFICIENT_LIQUIDITY");
  if (pair.volume24hUsd < config.MIN_VOLUME_24H_USD) reasons.push("INSUFFICIENT_VOLUME");

  if (pair.pairCreatedAt === null) {
    reasons.push("UNKNOWN_PAIR_AGE");
  } else {
    const ageMinutes = (Date.now() - pair.pairCreatedAt.getTime()) / 60_000;
    if (!Number.isFinite(ageMinutes) || ageMinutes < 0) reasons.push("INVALID_PAIR_AGE");
    else if (ageMinutes < config.MIN_PAIR_AGE_MINUTES) reasons.push("PAIR_TOO_NEW");
  }

  return { eligible: reasons.length === 0, reasons };
}

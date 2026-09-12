export interface ParameterStabilityResult {
  tested: number;
  acceptable: number;
  acceptableRatePct: number;
  passed: boolean;
}

export interface ParameterStabilityOptions {
  minReturnPct?: number;
  maxDrawdownPct?: number;
  minProfitFactor?: number;
  minAcceptableRatePct?: number;
}

export interface ParameterVariantMetrics { totalReturnPct: number; maxDrawdownPct: number; profitFactor: number; }

export function evaluateParameterStability(
  variants: readonly ParameterVariantMetrics[],
  options: ParameterStabilityOptions = {}
): ParameterStabilityResult {
  if (variants.length === 0) throw new Error("parameter variants must not be empty");
  const minReturnPct = options.minReturnPct ?? 0;
  const maxDrawdownPct = options.maxDrawdownPct ?? 35;
  const minProfitFactor = options.minProfitFactor ?? 1;
  const minAcceptableRatePct = options.minAcceptableRatePct ?? 50;
  if (![minReturnPct, maxDrawdownPct, minProfitFactor, minAcceptableRatePct].every(Number.isFinite)) throw new Error("stability thresholds must be finite");
  if (maxDrawdownPct < 0 || minAcceptableRatePct < 0 || minAcceptableRatePct > 100) throw new Error("invalid stability thresholds");
  const acceptable = variants.filter((variant) => Number.isFinite(variant.totalReturnPct) && Number.isFinite(variant.maxDrawdownPct) && Number.isFinite(variant.profitFactor) && variant.totalReturnPct >= minReturnPct && variant.maxDrawdownPct <= maxDrawdownPct && variant.profitFactor >= minProfitFactor).length;
  const acceptableRatePct = acceptable / variants.length * 100;
  return { tested: variants.length, acceptable, acceptableRatePct, passed: acceptableRatePct >= minAcceptableRatePct };
}

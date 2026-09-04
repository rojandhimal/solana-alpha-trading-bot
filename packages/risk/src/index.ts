export interface RiskConfig {
  accountEquity: number;
  riskPerTradePct: number;
  maxPositionPct: number;
  maxPortfolioExposurePct: number;
  stopLossPct: number;
  feePct: number;
  slippagePct: number;
}

export interface RiskInput {
  entryPrice: number;
  stopPrice: number;
  existingExposure: number;
  config: RiskConfig;
}

export interface RiskPlan {
  approved: boolean;
  quantity: number;
  notional: number;
  riskAmount: number;
  effectiveStopDistancePct: number;
  estimatedFees: number;
  estimatedSlippage: number;
  reasons: string[];
}

const nonNegative = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0);

export function calculateRiskPlan(input: RiskInput): RiskPlan {
  const { entryPrice, stopPrice, existingExposure, config } = input;
  const reasons: string[] = [];

  if (!Number.isFinite(entryPrice) || entryPrice <= 0) reasons.push("INVALID_ENTRY_PRICE");
  if (!Number.isFinite(stopPrice) || stopPrice <= 0 || stopPrice >= entryPrice) reasons.push("INVALID_STOP_PRICE");
  if (!Number.isFinite(config.accountEquity) || config.accountEquity <= 0) reasons.push("INVALID_ACCOUNT_EQUITY");

  const equity = nonNegative(config.accountEquity);
  const riskBudget = equity * Math.min(nonNegative(config.riskPerTradePct), 100) / 100;
  const maxPosition = equity * Math.min(nonNegative(config.maxPositionPct), 100) / 100;
  const maxExposure = equity * Math.min(nonNegative(config.maxPortfolioExposurePct), 100) / 100;
  const availableExposure = Math.max(0, maxExposure - nonNegative(existingExposure));
  const positionNotional = Math.min(maxPosition, availableExposure);
  const stopDistancePct = entryPrice > 0 ? Math.abs(entryPrice - stopPrice) / entryPrice * 100 : 0;
  const totalCostPct = nonNegative(config.feePct) * 2 + nonNegative(config.slippagePct) * 2;
  const effectiveStopDistancePct = stopDistancePct + totalCostPct;

  if (stopDistancePct <= 0) reasons.push("ZERO_STOP_DISTANCE");
  if (availableExposure <= 0) reasons.push("EXPOSURE_LIMIT_REACHED");
  if (effectiveStopDistancePct <= 0) reasons.push("INVALID_EFFECTIVE_RISK");

  const riskPerUnit = entryPrice * effectiveStopDistancePct / 100;
  const riskLimitedQuantity = riskPerUnit > 0 ? riskBudget / riskPerUnit : 0;
  const quantity = Math.max(0, Math.min(riskLimitedQuantity, positionNotional / Math.max(entryPrice, Number.EPSILON)));
  const notional = quantity * Math.max(entryPrice, 0);
  const estimatedFees = notional * nonNegative(config.feePct) / 100 * 2;
  const estimatedSlippage = notional * nonNegative(config.slippagePct) / 100 * 2;
  const riskAmount = notional * effectiveStopDistancePct / 100;

  const approved = reasons.length === 0 && quantity > 0 && riskAmount <= riskBudget + 1e-9;
  if (!approved && quantity <= 0 && !reasons.includes("EXPOSURE_LIMIT_REACHED")) reasons.push("POSITION_SIZE_ZERO");

  return {
    approved,
    quantity,
    notional,
    riskAmount,
    effectiveStopDistancePct,
    estimatedFees,
    estimatedSlippage,
    reasons
  };
}

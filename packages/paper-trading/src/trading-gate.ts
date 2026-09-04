import type { PrecisionScore } from "../../scoring/src/index.js";
import { calculateRiskPlan, type RiskConfig } from "../../risk/src/index.js";
import { evaluatePortfolioGuard, type PortfolioGuardConfig, type PortfolioGuardState } from "../../risk/src/portfolio-guard.js";
import type { PaperPortfolio } from "./index.js";

export interface TradeCandidate {
  symbol: string;
  entryPrice: number;
  stopPrice: number;
}

export interface TradingGateConfig {
  risk: RiskConfig;
  portfolio: PortfolioGuardConfig;
}

export interface TradingGateResult {
  approved: boolean;
  reasons: string[];
  quantity: number;
}

export function evaluateTradingGate(
  score: PrecisionScore,
  candidate: TradeCandidate,
  portfolio: PaperPortfolio,
  portfolioState: PortfolioGuardState,
  currentEquity: number,
  config: TradingGateConfig
): TradingGateResult {
  if (score.decision !== "BUY_CANDIDATE" || score.hardVeto) {
    return { approved: false, reasons: ["SIGNAL_NOT_APPROVED"], quantity: 0 };
  }

  const guard = evaluatePortfolioGuard(currentEquity, portfolioState, config.portfolio);
  if (!guard.allowed) return { approved: false, reasons: [guard.reason ?? "PORTFOLIO_GUARD"], quantity: 0 };

  const existingExposure = Object.values(portfolio.positions).reduce(
    (sum, position) => sum + position.investedNotional,
    0
  );

  const riskPlan = calculateRiskPlan({
    entryPrice: candidate.entryPrice,
    stopPrice: candidate.stopPrice,
    existingExposure,
    config: { ...config.risk, accountEquity: currentEquity }
  });

  if (!riskPlan.approved) return { approved: false, reasons: riskPlan.reasons, quantity: 0 };
  return { approved: true, reasons: [], quantity: riskPlan.quantity };
}

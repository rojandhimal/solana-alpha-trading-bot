import { describe, expect, it } from "vitest";
import { calculatePrecisionScore } from "../../scoring/src/index.js";
import { createPaperPortfolio } from "./index.js";
import { evaluateTradingGate } from "./trading-gate.js";

const score = calculatePrecisionScore({
  safetyScore: 95,
  liquidityScore: 90,
  holderRiskScore: 90,
  exitabilityScore: 90,
  momentumScore: 90,
  flowScore: 90,
  volatilityScore: 80,
  marketRegimeScore: 85,
  dataQualityScore: 95,
  hardVeto: false
});

const config = {
  risk: { accountEquity: 10_000, riskPerTradePct: 1, maxPositionPct: 10, maxPortfolioExposurePct: 30, stopLossPct: 5, feePct: 0.25, slippagePct: 0.25 },
  portfolio: { maxDailyLossPct: 5, maxDrawdownPct: 10, maxOpenPositions: 3 }
};

const candidate = { symbol: "TEST", entryPrice: 100, stopPrice: 95 };

describe("trading gate", () => {
  it("requires the scoring engine before risk approval", () => {
    const result = evaluateTradingGate(score, candidate, createPaperPortfolio(10_000), { startingDayEquity: 10_000, peakEquity: 10_000, openPositions: 0 }, 10_000, config);
    expect(result.approved).toBe(true);
    expect(result.quantity).toBeGreaterThan(0);
  });

  it("blocks a low-quality signal before execution", () => {
    const weak = calculatePrecisionScore({ ...scoreInput(), safetyScore: 40, dataQualityScore: 40 });
    const result = evaluateTradingGate(weak, candidate, createPaperPortfolio(10_000), { startingDayEquity: 10_000, peakEquity: 10_000, openPositions: 0 }, 10_000, config);
    expect(result.approved).toBe(false);
    expect(result.reasons).toContain("SIGNAL_NOT_APPROVED");
  });

  it("blocks an otherwise valid signal after the daily loss limit", () => {
    const result = evaluateTradingGate(score, candidate, createPaperPortfolio(10_000), { startingDayEquity: 10_000, peakEquity: 10_000, openPositions: 0 }, 9_500, config);
    expect(result.approved).toBe(false);
    expect(result.reasons).toContain("DAILY_LOSS_LIMIT");
  });
});

function scoreInput() {
  return { safetyScore: 95, liquidityScore: 90, holderRiskScore: 90, exitabilityScore: 90, momentumScore: 90, flowScore: 90, volatilityScore: 80, marketRegimeScore: 85, dataQualityScore: 95, hardVeto: false };
}

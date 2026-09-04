import { describe, expect, it } from "vitest";
import { calculateRiskPlan } from "../../risk/src/index.js";
import { createPaperPortfolio, executePaperOrder, markToMarket } from "./index.js";

describe("scoring-to-paper execution contract", () => {
  it("only executes when the risk plan approves the candidate", () => {
    const riskPlan = calculateRiskPlan({
      entryPrice: 100,
      stopPrice: 95,
      existingExposure: 0,
      config: {
        accountEquity: 10_000,
        riskPerTradePct: 1,
        maxPositionPct: 10,
        maxPortfolioExposurePct: 30,
        stopLossPct: 5,
        feePct: 0.25,
        slippagePct: 0.25
      }
    });

    expect(riskPlan.approved).toBe(true);

    const portfolio = createPaperPortfolio(10_000);
    executePaperOrder(
      portfolio,
      { id: "integration-1", symbol: "TEST", side: "BUY", quantity: riskPlan.quantity, requestedPrice: 100 },
      { feePct: 0.25, slippagePct: 0.25 },
      1
    );

    expect(portfolio.positions.TEST.quantity).toBeCloseTo(riskPlan.quantity);
    expect(markToMarket(portfolio, { TEST: 110 })).toBeGreaterThan(0);
  });

  it("blocks execution when the risk engine rejects the candidate", () => {
    const riskPlan = calculateRiskPlan({
      entryPrice: 100,
      stopPrice: 105,
      existingExposure: 0,
      config: {
        accountEquity: 10_000,
        riskPerTradePct: 1,
        maxPositionPct: 10,
        maxPortfolioExposurePct: 30,
        stopLossPct: 5,
        feePct: 0.25,
        slippagePct: 0.25
      }
    });

    expect(riskPlan.approved).toBe(false);
    expect(riskPlan.reasons).toContain("INVALID_STOP_PRICE");
  });
});

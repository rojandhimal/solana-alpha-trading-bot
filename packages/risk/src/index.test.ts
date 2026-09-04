import { describe, expect, it } from "vitest";
import { calculateRiskPlan } from "./index.js";

const config = {
  accountEquity: 10_000,
  riskPerTradePct: 1,
  maxPositionPct: 10,
  maxPortfolioExposurePct: 30,
  stopLossPct: 5,
  feePct: 0.25,
  slippagePct: 0.25
};

describe("calculateRiskPlan", () => {
  it("sizes a position within risk and exposure limits", () => {
    const plan = calculateRiskPlan({
      entryPrice: 100,
      stopPrice: 95,
      existingExposure: 0,
      config
    });
    expect(plan.approved).toBe(true);
    expect(plan.notional).toBeLessThanOrEqual(1_000);
    expect(plan.riskAmount).toBeLessThanOrEqual(100 + 1e-9);
  });

  it("rejects an invalid stop", () => {
    const plan = calculateRiskPlan({ entryPrice: 100, stopPrice: 105, existingExposure: 0, config });
    expect(plan.approved).toBe(false);
    expect(plan.reasons).toContain("INVALID_STOP_PRICE");
  });

  it("rejects when portfolio exposure is already at the cap", () => {
    const plan = calculateRiskPlan({ entryPrice: 100, stopPrice: 95, existingExposure: 3_000, config });
    expect(plan.approved).toBe(false);
    expect(plan.reasons).toContain("EXPOSURE_LIMIT_REACHED");
  });

  it("accounts for fees and slippage in risk distance", () => {
    const plan = calculateRiskPlan({ entryPrice: 100, stopPrice: 95, existingExposure: 0, config });
    expect(plan.effectiveStopDistancePct).toBeGreaterThan(5);
    expect(plan.estimatedFees).toBeGreaterThan(0);
    expect(plan.estimatedSlippage).toBeGreaterThan(0);
  });
});

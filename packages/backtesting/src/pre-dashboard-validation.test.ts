import { describe, expect, it } from "vitest";
import { validatePreDashboardEvidence, type PreDashboardEvidence } from "./pre-dashboard-validation.js";

const passingEvidence = (): PreDashboardEvidence => ({
  dataQualityPassed: true,
  walkForwardWindowCount: 9,
  noLookAhead: true,
  optimizerTrainOnly: true,
  parameterStabilityPassed: true,
  stressRobustness: { passed: true, passingScenarioRatePct: 100, worstDrawdownPct: 10, worstProfitFactor: 1.2, worstExpectancy: 5, failures: [] },
  bootstrap: { estimate: 1, lowerPct: 0.2, upperPct: 2, confidencePct: 95, samples: 2000 },
  monteCarlo: { simulations: 5000, seed: 42, medianReturnPct: 10, lowerReturnPct: 1, upperReturnPct: 20, probabilityOfLossPct: 20, medianMaxDrawdownPct: 8, upperMaxDrawdownPct: 15 },
  paperTradingPassed: true,
  reconciliationPassed: true,
  securityPassed: true,
  ciPassed: true,
  liveTradingDisabled: true
});

describe("pre-dashboard validation", () => {
  it("passes complete evidence", () => {
    expect(validatePreDashboardEvidence(passingEvidence()).passed).toBe(true);
  });

  it("fails closed when a required gate is missing", () => {
    const evidence = passingEvidence();
    evidence.securityPassed = false;
    evidence.ciPassed = false;
    evidence.liveTradingDisabled = false;
    const result = validatePreDashboardEvidence(evidence);
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(expect.arrayContaining(["SECURITY_GATE_FAILED", "CI_NOT_GREEN", "LIVE_TRADING_MUST_REMAIN_DISABLED"]));
  });
});

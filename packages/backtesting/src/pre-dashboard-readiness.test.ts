import { describe, expect, it } from "vitest";
import { assertPreDashboardReadiness, evaluatePreDashboardReadiness, type PreDashboardEvidence } from "./pre-dashboard-readiness.js";

const goodEvidence = (): PreDashboardEvidence => ({
  commitSha: "release",
  dataset: { barCount: 1000, qualityPassed: true, provenanceRecorded: true, freshnessPassed: true },
  walkForward: { windowCount: 9, noOverlap: true, optimizerTrainOnly: true, parameterStabilityPassed: true },
  stress: { allScenariosEvaluated: true, robustness: { passed: true, passingScenarioRatePct: 100, worstDrawdownPct: 10, worstProfitFactor: 1.2, worstExpectancy: 2, failures: [] } },
  statistics: {
    bootstrap: { estimate: 1, lowerPct: 0.2, upperPct: 2, confidencePct: 95, samples: 2000 },
    monteCarlo: { simulations: 5000, seed: 42, medianReturnPct: 10, lowerReturnPct: -2, upperReturnPct: 30, probabilityOfLossPct: 10, medianMaxDrawdownPct: 8, upperMaxDrawdownPct: 20 },
    passed: true
  },
  paperTrading: { accepted: true, deterministicReplay: true, reconciliationPassed: true },
  security: { liveTradingDisabled: true, dependencyAuditPassed: true, secretScanPassed: true },
  ci: { typecheckPassed: true, testsPassed: true, buildPassed: true, securityWorkflowPassed: true }
});

describe("pre-dashboard readiness", () => {
  it("passes only when every mandatory evidence gate passes", () => {
    const result = evaluatePreDashboardReadiness(goodEvidence());
    expect(result).toEqual({ ready: true, status: "READY_FOR_DASHBOARD", failures: [] });
    expect(() => assertPreDashboardReadiness(goodEvidence())).not.toThrow();
  });

  it("fails closed when any evidence is missing or failed", () => {
    const evidence = goodEvidence();
    evidence.dataset.provenanceRecorded = false;
    evidence.ci.testsPassed = false;
    const result = evaluatePreDashboardReadiness(evidence);
    expect(result.ready).toBe(false);
    expect(result.status).toBe("NOT_VALIDATED");
    expect(result.failures).toEqual(expect.arrayContaining(["PROVENANCE_MISSING", "TESTS_FAILED"]));
    expect(() => assertPreDashboardReadiness(evidence)).toThrow("pre-dashboard readiness failed");
  });
});

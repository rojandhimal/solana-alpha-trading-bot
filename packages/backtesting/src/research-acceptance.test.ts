import { describe, expect, it } from "vitest";
import { evaluateResearchAcceptance, type ResearchAcceptanceEvidence, type ResearchAcceptanceThresholds } from "./research-acceptance.js";

const thresholds: ResearchAcceptanceThresholds = {
  minOosReturnPct: 5,
  maxOosDrawdownPct: 20,
  minOosTradeCount: 20,
  minOosProfitFactor: 1.2,
  minOosExpectancy: 10,
  minProfitableWindowPct: 60,
  requireParameterStability: true,
  minPassingStressScenarioRatePct: 80,
  maxMonteCarlo95DrawdownPct: 30
};

const evidence: ResearchAcceptanceEvidence = {
  outOfSample: { totalReturnPct: 12, maxDrawdownPct: 10, tradeCount: 50, profitFactor: 1.6, expectancy: 25 },
  profitableWindowPct: 75,
  parameterStability: { stable: true },
  stressRobustness: { passed: true, passingScenarioRatePct: 100 },
  monteCarlo: { percentile95MaxDrawdownPct: 18 }
};

describe("research acceptance gates", () => {
  it("passes when every configured gate is satisfied", () => {
    expect(evaluateResearchAcceptance(evidence, thresholds)).toEqual({ status: "PASS", failures: [] });
  });

  it("reports explicit failures instead of silently passing weak evidence", () => {
    const result = evaluateResearchAcceptance({ ...evidence, outOfSample: { ...evidence.outOfSample, totalReturnPct: 2, tradeCount: 5 }, monteCarlo: { percentile95MaxDrawdownPct: 40 } }, thresholds);
    expect(result.status).toBe("FAIL");
    expect(result.failures).toEqual(expect.arrayContaining(["OOS_RETURN_TOO_LOW", "OOS_TRADE_COUNT_TOO_LOW", "MONTE_CARLO_DRAWDOWN_TOO_HIGH"]));
  });

  it("fails closed as inconclusive when required evidence is missing", () => {
    const { monteCarlo: _monteCarlo, ...evidenceWithoutMonteCarlo } = evidence;
    const result = evaluateResearchAcceptance(evidenceWithoutMonteCarlo, thresholds);
    expect(result.status).toBe("INCONCLUSIVE");
    expect(result.failures).toContain("MONTE_CARLO_EVIDENCE_MISSING");
  });

  it("treats non-finite research metrics as inconclusive", () => {
    const result = evaluateResearchAcceptance({ ...evidence, outOfSample: { ...evidence.outOfSample, maxDrawdownPct: Number.NaN } }, thresholds);
    expect(result.status).toBe("INCONCLUSIVE");
    expect(result.failures).toEqual(["INVALID_OR_MISSING_OOS_METRICS"]);
  });

  it("requires parameter stability when configured", () => {
    const result = evaluateResearchAcceptance({ ...evidence, parameterStability: { stable: false } }, thresholds);
    expect(result.status).toBe("FAIL");
    expect(result.failures).toContain("PARAMETER_STABILITY_FAILED");
  });

  it("rejects invalid thresholds", () => {
    expect(() => evaluateResearchAcceptance(evidence, { ...thresholds, maxOosDrawdownPct: -1 })).toThrow("invalid research acceptance thresholds");
  });
});

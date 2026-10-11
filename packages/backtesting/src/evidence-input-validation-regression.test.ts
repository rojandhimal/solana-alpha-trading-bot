import { describe, expect, it } from "vitest";
import { evaluatePreDashboardGate, type PreDashboardEvidence } from "./pre-dashboard-gate.js";
import { validatePreDashboardEvidence, type PreDashboardValidationEvidence } from "./pre-dashboard-validation.js";
import { evaluateRobustness, evaluateWalkForwardRobustness } from "./robustness.js";
import type { WalkForwardPipelineResult } from "./walk-forward-pipeline.js";

function readiness(): PreDashboardEvidence {
  return {
    release: { commitSha: "abc", branch: "feature/x", dependencyLockSha: "lock" },
    dataset: { provider: "binance", symbol: "SOLUSDT", instrumentId: "SOLUSDT", interval: "1H", requestedStart: 1, requestedEnd: 10, actualStart: 1, actualEnd: 10, volumeSemantics: "quote volume", qualityPassed: true, freshnessPassed: true },
    walkForward: { baselinePassed: true, optimizedPassed: true, windows: 9, oosTradeCount: 30, oosReturnPct: 5, oosMaxDrawdownPct: 10, oosProfitFactor: 1.2, oosExpectancy: 10, profitableWindowPct: 60 },
    robustness: { parameterStabilityPassed: true, stressPassed: true, bootstrapPassed: true, monteCarloPassed: true },
    paperTrading: { observationCount: 1000, regimeCoveragePassed: true, acceptancePassed: true },
    controls: { executionRiskInvariantsPassed: true, persistenceIdempotencyPassed: true, reconciliationPassed: true, securityPassed: true, liveTradingDisabled: true },
    ci: { typecheckPassed: true, testsPassed: true, buildPassed: true }
  };
}

function validation(): PreDashboardValidationEvidence {
  return {
    dataQualityPassed: true, walkForwardWindowCount: 9, noLookAhead: true, optimizerTrainOnly: true,
    parameterStabilityPassed: true,
    stressRobustness: { passed: true, passingScenarioRatePct: 100, worstDrawdownPct: 10, worstProfitFactor: 1.2, worstExpectancy: 5, failures: [] },
    bootstrap: { estimate: 1, lowerPct: 0.2, upperPct: 2, confidencePct: 95, samples: 2000 },
    monteCarlo: { simulations: 5000, seed: 42, medianReturnPct: 10, lowerReturnPct: 1, upperReturnPct: 20, probabilityOfLossPct: 20, medianMaxDrawdownPct: 8, upperMaxDrawdownPct: 15 },
    paperTradingPassed: true, reconciliationPassed: true, securityPassed: true, ciPassed: true, liveTradingDisabled: true
  };
}

const thresholds = { maxDrawdownPct: 20, minProfitFactor: 1.2, minExpectancy: 0, minPassingScenarioRatePct: 80 };

function walkForward(): Pick<WalkForwardPipelineResult, "outOfSample" | "consistency"> {
  return {
    outOfSample: { totalReturnPct: 10, netProfit: 1000, maxDrawdownPct: 12, tradeCount: 10, winRatePct: 80, profitFactor: 1.5, expectancy: 4, averageWin: 6, averageLoss: 2 },
    consistency: { windowCount: 5, profitableWindowPct: 80, averageOosReturnPct: 3, medianOosReturnPct: 2.5, worstOosReturnPct: -1, averageOosDrawdownPct: 6, worstOosDrawdownPct: 12 }
  };
}

describe("evidence input validation regressions", () => {
  it("fails an explicit rejected stress verdict even without diagnostic reasons", () => {
    const evidence = validation();
    evidence.stressRobustness.passed = false;
    const result = validatePreDashboardEvidence(evidence);
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("STRESS_FAILED");
  });

  it("fails contradictory or missing stress report metrics", () => {
    for (const stress of [
      { ...validation().stressRobustness, failures: ["TOO_FEW_SCENARIOS_PASS"] },
      { ...validation().stressRobustness, worstDrawdownPct: null },
      { ...validation().stressRobustness, passingScenarioRatePct: 101 },
      { ...validation().stressRobustness, worstExpectancy: Number.POSITIVE_INFINITY }
    ]) expect(validatePreDashboardEvidence({ ...validation(), stressRobustness: stress }).passed).toBe(false);
  });

  it("fails malformed statistical summaries instead of accepting only their headline fields", () => {
    const evidence = validation();
    for (const bootstrap of [
      { ...evidence.bootstrap, samples: Number.NaN },
      { ...evidence.bootstrap, estimate: Number.POSITIVE_INFINITY },
      { ...evidence.bootstrap, confidencePct: 100 },
      { ...evidence.bootstrap, lowerPct: 3, upperPct: 2 }
    ]) expect(validatePreDashboardEvidence({ ...evidence, bootstrap }).failures).toContain("BOOTSTRAP_INVALID");
    for (const monteCarlo of [
      { ...evidence.monteCarlo, simulations: Number.NaN },
      { ...evidence.monteCarlo, probabilityOfLossPct: -1 },
      { ...evidence.monteCarlo, lowerReturnPct: 11, medianReturnPct: 10 },
      { ...evidence.monteCarlo, medianMaxDrawdownPct: -1 }
    ]) expect(validatePreDashboardEvidence({ ...evidence, monteCarlo }).failures).toContain("MONTE_CARLO_INVALID");
  });

  it("requires safe integer counts for walk-forward and elapsed paper observations", () => {
    for (const count of [Number.NaN, Number.POSITIVE_INFINITY, 2.5, Number.MAX_SAFE_INTEGER + 1]) {
      const evidence = readiness();
      evidence.walkForward.windows = count;
      evidence.paperTrading.observationCount = count;
      evidence.walkForward.oosTradeCount = count;
      const result = evaluatePreDashboardGate(evidence);
      expect(result.readyForDashboard).toBe(false);
      expect(result.failures).toEqual(expect.arrayContaining(["INSUFFICIENT_WALK_FORWARD_WINDOWS", "PAPER_TRADING_OBSERVATIONS_MISSING", "OOS_TRADE_EVIDENCE_MISSING"]));
      expect(validatePreDashboardEvidence({ ...validation(), walkForwardWindowCount: count }).passed).toBe(false);
    }
  });

  it("rejects reversed, noninteger or negative dataset date ranges", () => {
    for (const range of [
      { actualStart: 9, actualEnd: 2 },
      { requestedStart: -1 },
      { requestedEnd: 10.5 },
      { actualStart: 1.5 },
      { actualEnd: Number.MAX_SAFE_INTEGER + 1 }
    ]) {
      const evidence = readiness();
      Object.assign(evidence.dataset, range);
      expect(evaluatePreDashboardGate(evidence).readyForDashboard).toBe(false);
    }
  });

  it("rejects invalid percentages and negative drawdown or profit factor evidence", () => {
    for (const metrics of [{ profitableWindowPct: 101 }, { profitableWindowPct: -1 }, { oosMaxDrawdownPct: -1 }, { oosProfitFactor: -1 }]) {
      const evidence = readiness();
      Object.assign(evidence.walkForward, metrics);
      expect(evaluatePreDashboardGate(evidence).readyForDashboard).toBe(false);
    }
  });

  it("fails closed on missing evidence sections and truthy nonboolean verdicts", () => {
    expect(evaluatePreDashboardGate(null as unknown as PreDashboardEvidence).readyForDashboard).toBe(false);
    expect(validatePreDashboardEvidence({} as PreDashboardValidationEvidence).passed).toBe(false);
    const evidence = readiness();
    evidence.ci.testsPassed = "true" as unknown as boolean;
    expect(evaluatePreDashboardGate(evidence).failures).toContain("TESTS_FAILED");
    expect(validatePreDashboardEvidence({ ...validation(), securityPassed: "true" as unknown as boolean }).failures).toContain("SECURITY_GATE_FAILED");
  });

  it("rejects malformed walk-forward consistency counts, rates and metric domains", () => {
    for (const consistency of [
      { windowCount: Number.NaN }, { windowCount: -1 }, { windowCount: 2.5 },
      { windowCount: Number.MAX_SAFE_INTEGER + 1 }, { profitableWindowPct: Number.NaN },
      { profitableWindowPct: 101 }, { profitableWindowPct: -1 },
      { worstOosDrawdownPct: -1 }, { worstOosReturnPct: Number.POSITIVE_INFINITY }
    ]) {
      const evidence = walkForward();
      Object.assign(evidence.consistency, consistency);
      expect(evaluateWalkForwardRobustness(evidence, thresholds).passed).toBe(false);
    }
    const evidence = walkForward();
    evidence.outOfSample.expectancy = Number.POSITIVE_INFINITY;
    expect(evaluateWalkForwardRobustness(evidence, thresholds).passed).toBe(false);
  });

  it("rejects invalid stress metrics even when the configured passing floor is zero", () => {
    const report = evaluateRobustness([
      { scenario: "BASE", parameters: {} as never, metrics: { totalReturnPct: 10, maxDrawdownPct: Number.NaN, tradeCount: 10, profitFactor: 2, expectancy: 5 } }
    ], { ...thresholds, minPassingScenarioRatePct: 0 });
    expect(report.passed).toBe(false);
    expect(report.failures).toContain("INVALID_STRESS_METRICS");
  });

  it("fails incomplete robustness evidence without dereferencing absent metrics", () => {
    expect(evaluateWalkForwardRobustness({} as never, thresholds).passed).toBe(false);
    expect(evaluateRobustness([null] as never, thresholds).passed).toBe(false);
    expect(evaluateRobustness([{ scenario: "BASE" }] as never, thresholds).passed).toBe(false);
    expect(evaluateRobustness(null as never, thresholds).passed).toBe(false);
    expect(evaluateRobustness(new Array(1), { ...thresholds, minPassingScenarioRatePct: 0 }).passed).toBe(false);
    expect(() => evaluateRobustness([], {} as never)).toThrow("invalid robustness thresholds");
    expect(() => evaluateWalkForwardRobustness(walkForward(), { maxDrawdownPct: 20 } as never)).toThrow("invalid robustness thresholds");
  });

  it("preserves documented lossless profit factors and complete valid evidence", () => {
    const evidence = walkForward();
    evidence.outOfSample.profitFactor = Number.POSITIVE_INFINITY;
    expect(evaluateWalkForwardRobustness(evidence, thresholds).passed).toBe(true);
    expect(evaluatePreDashboardGate(readiness()).readyForDashboard).toBe(true);
    expect(validatePreDashboardEvidence(validation()).passed).toBe(true);
  });
});

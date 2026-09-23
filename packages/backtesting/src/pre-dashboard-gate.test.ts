import { describe, expect, it } from "vitest";
import { evaluatePreDashboardGate, type PreDashboardEvidence } from "./pre-dashboard-gate.js";

const base: PreDashboardEvidence = {
  release: { commitSha: "abc", branch: "feature/x", dependencyLockSha: "lock" },
  dataset: { provider: "binance", symbol: "SOLUSDT", instrumentId: "SOLUSDT", interval: "1H", requestedStart: 1, requestedEnd: 2, actualStart: 1, actualEnd: 2, volumeSemantics: "quote volume", qualityPassed: true, freshnessPassed: true },
  walkForward: { baselinePassed: true, optimizedPassed: true, windows: 9, oosTradeCount: 30, oosReturnPct: 5, oosMaxDrawdownPct: 10, oosProfitFactor: 1.2, oosExpectancy: 10, profitableWindowPct: 60 },
  robustness: { parameterStabilityPassed: true, stressPassed: true, bootstrapPassed: true, monteCarloPassed: true },
  paperTrading: { observationCount: 1000, regimeCoveragePassed: true, acceptancePassed: true },
  controls: { executionRiskInvariantsPassed: true, persistenceIdempotencyPassed: true, reconciliationPassed: true, securityPassed: true, liveTradingDisabled: true },
  ci: { typecheckPassed: true, testsPassed: true, buildPassed: true }
};

describe("pre-dashboard gate", () => {
  it("passes only when every evidence class is present and green", () => expect(evaluatePreDashboardGate(base)).toEqual({ status: "PASS", readyForDashboard: true, failures: [] }));
  it("fails closed when empirical evidence is missing", () => { const result = evaluatePreDashboardGate({ ...base, release: { ...base.release, dependencyLockSha: undefined }, paperTrading: { ...base.paperTrading, observationCount: 0 } }); expect(result.readyForDashboard).toBe(false); expect(result.failures).toEqual(expect.arrayContaining(["DEPENDENCY_LOCK_IDENTITY_MISSING", "PAPER_TRADING_OBSERVATIONS_MISSING"])); });
  it("never allows live trading to satisfy the gate", () => { const result = evaluatePreDashboardGate({ ...base, controls: { ...base.controls, liveTradingDisabled: false } }); expect(result.readyForDashboard).toBe(false); expect(result.failures).toContain("LIVE_TRADING_MUST_REMAIN_DISABLED"); });
});
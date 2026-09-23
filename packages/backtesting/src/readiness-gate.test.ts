import { describe, expect, it } from "vitest";
import { evaluatePreDashboardReadiness, assertPreDashboardReadiness, type ReadinessEvidence } from "./readiness-gate.js";

const complete: ReadinessEvidence = {
  dataProvenance:true,dataQuality:true,freshness:true,executionInvariants:true,riskInvariants:true,
  stateIdempotency:true,walkForwardOos:true,antiOverfitting:true,stress:true,statisticalRobustness:true,
  paperAcceptance:true,security:true,reproducibility:true,ci:true,releaseCommit:"abc123"
};

describe("pre-dashboard readiness gate", () => {
  it("passes only when every check and a release commit are verified", () => {
    expect(evaluatePreDashboardReadiness(complete).status).toBe("READY");
    expect(assertPreDashboardReadiness(complete).passed).toBe(true);
  });
  it("fails closed for any missing evidence", () => {
    const report = evaluatePreDashboardReadiness({...complete, security:false, releaseCommit:undefined});
    expect(report.status).toBe("NOT_VALIDATED");
    expect(report.blockers).toContain("SECURITY_NOT_VERIFIED");
    expect(report.blockers).toContain("RELEASE_COMMIT_NOT_PINNED");
  });
  it("deduplicates explicit blockers", () => {
    const report = evaluatePreDashboardReadiness({...complete, blockers:["SECURITY_NOT_VERIFIED","SECURITY_NOT_VERIFIED"]});
    expect(report.blockers.filter((x) => x === "SECURITY_NOT_VERIFIED")).toHaveLength(1);
  });
});

export interface ReadinessEvidence {
  dataProvenance: boolean; dataQuality: boolean; freshness: boolean;
  executionInvariants: boolean; riskInvariants: boolean; stateIdempotency: boolean;
  walkForwardOos: boolean; antiOverfitting: boolean; stress: boolean;
  statisticalRobustness: boolean; paperAcceptance: boolean; security: boolean;
  reproducibility: boolean; ci: boolean; releaseCommit?: string; blockers?: readonly string[];
}
export interface ReadinessReport { status: "READY" | "NOT_VALIDATED"; passed: boolean; releaseCommit: string | null; checks: ReadinessEvidence; blockers: string[]; }
const CHECKS: readonly (keyof ReadinessEvidence)[] = ["dataProvenance","dataQuality","freshness","executionInvariants","riskInvariants","stateIdempotency","walkForwardOos","antiOverfitting","stress","statisticalRobustness","paperAcceptance","security","reproducibility","ci"];
export function evaluatePreDashboardReadiness(evidence: ReadinessEvidence): ReadinessReport {
  const blockers = [...(evidence.blockers ?? [])];
  for (const check of CHECKS) if (evidence[check] !== true) blockers.push(check.toUpperCase() + "_NOT_VERIFIED");
  if (!evidence.releaseCommit) blockers.push("RELEASE_COMMIT_NOT_PINNED");
  const uniqueBlockers = [...new Set(blockers)];
  const passed = uniqueBlockers.length === 0;
  return { status: passed ? "READY" : "NOT_VALIDATED", passed, releaseCommit: evidence.releaseCommit ?? null, checks: evidence, blockers: uniqueBlockers };
}
export function assertPreDashboardReadiness(evidence: ReadinessEvidence): ReadinessReport {
  const report = evaluatePreDashboardReadiness(evidence);
  if (!report.passed) throw new Error("pre-dashboard readiness failed: " + report.blockers.join(", "));
  return report;
}

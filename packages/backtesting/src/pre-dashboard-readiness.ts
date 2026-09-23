import type { PerformanceMetrics } from "./performance-metrics.js";
import type { RobustnessReport } from "./robustness.js";
import type { BootstrapConfidenceInterval, MonteCarloSummary } from "./statistical-robustness.js";

export interface PreDashboardEvidence {
  commitSha: string;
  dataset: { barCount: number; qualityPassed: boolean; provenanceRecorded: boolean; freshnessPassed: boolean };
  walkForward: { windowCount: number; noOverlap: boolean; optimizerTrainOnly: boolean; parameterStabilityPassed: boolean };
  stress: { allScenariosEvaluated: boolean; robustness: RobustnessReport };
  statistics: { bootstrap: BootstrapConfidenceInterval; monteCarlo: MonteCarloSummary; passed: boolean };
  paperTrading: { accepted: boolean; deterministicReplay: boolean; reconciliationPassed: boolean };
  security: { liveTradingDisabled: boolean; dependencyAuditPassed: boolean; secretScanPassed: boolean };
  ci: { typecheckPassed: boolean; testsPassed: boolean; buildPassed: boolean; securityWorkflowPassed: boolean };
}

export interface PreDashboardReadinessResult {
  ready: boolean;
  status: "READY_FOR_DASHBOARD" | "NOT_VALIDATED";
  failures: string[];
}

function required(condition: boolean, code: string, failures: string[]): void {
  if (!condition) failures.push(code);
}

export function evaluatePreDashboardReadiness(evidence: PreDashboardEvidence): PreDashboardReadinessResult {
  const failures: string[] = [];
  required(Boolean(evidence.commitSha.trim()), "MISSING_RELEASE_COMMIT", failures);
  required(evidence.dataset.barCount > 0, "NO_DATASET", failures);
  required(evidence.dataset.qualityPassed, "DATA_QUALITY_FAILED", failures);
  required(evidence.dataset.provenanceRecorded, "PROVENANCE_MISSING", failures);
  required(evidence.dataset.freshnessPassed, "FRESHNESS_FAILED", failures);
  required(evidence.walkForward.windowCount >= 2, "INSUFFICIENT_WALK_FORWARD_WINDOWS", failures);
  required(evidence.walkForward.noOverlap, "WALK_FORWARD_OVERLAP", failures);
  required(evidence.walkForward.optimizerTrainOnly, "OPTIMIZER_OOS_LEAKAGE", failures);
  required(evidence.walkForward.parameterStabilityPassed, "PARAMETER_INSTABILITY", failures);
  required(evidence.stress.allScenariosEvaluated, "INCOMPLETE_STRESS_MATRIX", failures);
  required(evidence.stress.robustness.passed, "STRESS_ROBUSTNESS_FAILED", failures);
  required(evidence.statistics.passed, "STATISTICAL_ROBUSTNESS_FAILED", failures);
  required(evidence.paperTrading.accepted, "PAPER_TRADING_NOT_ACCEPTED", failures);
  required(evidence.paperTrading.deterministicReplay, "NON_DETERMINISTIC_REPLAY", failures);
  required(evidence.paperTrading.reconciliationPassed, "PAPER_RECONCILIATION_FAILED", failures);
  required(evidence.security.liveTradingDisabled, "LIVE_TRADING_NOT_DISABLED", failures);
  required(evidence.security.dependencyAuditPassed, "DEPENDENCY_AUDIT_FAILED", failures);
  required(evidence.security.secretScanPassed, "SECRET_SCAN_FAILED", failures);
  required(evidence.ci.typecheckPassed, "TYPECHECK_FAILED", failures);
  required(evidence.ci.testsPassed, "TESTS_FAILED", failures);
  required(evidence.ci.buildPassed, "BUILD_FAILED", failures);
  required(evidence.ci.securityWorkflowPassed, "SECURITY_CI_FAILED", failures);
  const ready = failures.length === 0;
  return { ready, status: ready ? "READY_FOR_DASHBOARD" : "NOT_VALIDATED", failures };
}

export function assertPreDashboardReadiness(evidence: PreDashboardEvidence): void {
  const result = evaluatePreDashboardReadiness(evidence);
  if (!result.ready) throw new Error(`pre-dashboard readiness failed: ${result.failures.join(",")}`);
}

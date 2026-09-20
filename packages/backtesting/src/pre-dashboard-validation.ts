import type { RobustnessReport } from "./robustness.js";
import type { BootstrapConfidenceInterval, MonteCarloSummary } from "./statistical-robustness.js";

export interface PreDashboardEvidence {
  dataQualityPassed: boolean;
  walkForwardWindowCount: number;
  noLookAhead: boolean;
  optimizerTrainOnly: boolean;
  parameterStabilityPassed: boolean;
  stressRobustness: RobustnessReport;
  bootstrap: BootstrapConfidenceInterval;
  monteCarlo: MonteCarloSummary;
  paperTradingPassed: boolean;
  reconciliationPassed: boolean;
  securityPassed: boolean;
  ciPassed: boolean;
  liveTradingDisabled: boolean;
}

export interface PreDashboardValidation {
  passed: boolean;
  failures: string[];
}

export function validatePreDashboardEvidence(evidence: PreDashboardEvidence): PreDashboardValidation {
  const failures: string[] = [];
  if (!evidence.dataQualityPassed) failures.push("DATA_QUALITY_FAILED");
  if (!Number.isInteger(evidence.walkForwardWindowCount) || evidence.walkForwardWindowCount < 2) failures.push("INSUFFICIENT_WALK_FORWARD_WINDOWS");
  if (!evidence.noLookAhead) failures.push("LOOK_AHEAD_NOT_PROVEN");
  if (!evidence.optimizerTrainOnly) failures.push("OPTIMIZER_SCOPE_NOT_PROVEN");
  if (!evidence.parameterStabilityPassed) failures.push("PARAMETER_STABILITY_FAILED");
  if (!evidence.stressRobustness.passed) failures.push(...evidence.stressRobustness.failures.map((failure) => `STRESS_${failure}`));
  if (!Number.isFinite(evidence.bootstrap.lowerPct) || !Number.isFinite(evidence.bootstrap.upperPct)) failures.push("BOOTSTRAP_INVALID");
  if (!Number.isFinite(evidence.monteCarlo.probabilityOfLossPct)) failures.push("MONTE_CARLO_INVALID");
  if (!evidence.paperTradingPassed) failures.push("PAPER_TRADING_NOT_ACCEPTED");
  if (!evidence.reconciliationPassed) failures.push("RECONCILIATION_NOT_PROVEN");
  if (!evidence.securityPassed) failures.push("SECURITY_GATE_FAILED");
  if (!evidence.ciPassed) failures.push("CI_NOT_GREEN");
  if (!evidence.liveTradingDisabled) failures.push("LIVE_TRADING_MUST_REMAIN_DISABLED");
  return { passed: failures.length === 0, failures };
}

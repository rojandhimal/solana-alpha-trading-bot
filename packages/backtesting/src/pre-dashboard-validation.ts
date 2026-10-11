import type { RobustnessReport } from "./robustness.js";
import type { BootstrapConfidenceInterval, MonteCarloSummary } from "./statistical-robustness.js";

export interface PreDashboardValidationEvidence {
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

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function percentage(value: unknown): value is number {
  return finite(value) && value >= 0 && value <= 100;
}

function nonnegative(value: unknown): value is number {
  return finite(value) && value >= 0;
}

export function validatePreDashboardEvidence(evidence: PreDashboardValidationEvidence): PreDashboardValidation {
  const failures: string[] = [];
  if (evidence?.dataQualityPassed !== true) failures.push("DATA_QUALITY_FAILED");
  if (!Number.isSafeInteger(evidence?.walkForwardWindowCount) || evidence.walkForwardWindowCount < 2) failures.push("INSUFFICIENT_WALK_FORWARD_WINDOWS");
  if (evidence?.noLookAhead !== true) failures.push("LOOK_AHEAD_NOT_PROVEN");
  if (evidence?.optimizerTrainOnly !== true) failures.push("OPTIMIZER_SCOPE_NOT_PROVEN");
  if (evidence?.parameterStabilityPassed !== true) failures.push("PARAMETER_STABILITY_FAILED");
  const stress = evidence?.stressRobustness;
  const stressFailuresValid = Array.isArray(stress?.failures) && stress.failures.every((failure) => typeof failure === "string" && failure.trim().length > 0);
  if (stress?.passed !== true) failures.push("STRESS_FAILED");
  if (!stressFailuresValid || !percentage(stress?.passingScenarioRatePct) || !nonnegative(stress?.worstDrawdownPct) ||
    !(nonnegative(stress?.worstProfitFactor) || stress?.worstProfitFactor === Number.POSITIVE_INFINITY) || !finite(stress?.worstExpectancy)) failures.push("STRESS_INVALID");
  if (stressFailuresValid) failures.push(...stress.failures.map((failure) => `STRESS_${failure}`));
  const bootstrap = evidence?.bootstrap;
  if (!finite(bootstrap?.estimate) || !finite(bootstrap?.lowerPct) || !finite(bootstrap?.upperPct) || bootstrap.lowerPct > bootstrap.upperPct ||
    !finite(bootstrap?.confidencePct) || bootstrap.confidencePct <= 0 || bootstrap.confidencePct >= 100 ||
    !Number.isSafeInteger(bootstrap?.samples) || bootstrap.samples < 100) failures.push("BOOTSTRAP_INVALID");
  const monteCarlo = evidence?.monteCarlo;
  if (!Number.isSafeInteger(monteCarlo?.simulations) || monteCarlo.simulations < 100 || !Number.isSafeInteger(monteCarlo?.seed) ||
    !finite(monteCarlo?.lowerReturnPct) || !finite(monteCarlo?.medianReturnPct) || !finite(monteCarlo?.upperReturnPct) ||
    monteCarlo.lowerReturnPct > monteCarlo.medianReturnPct || monteCarlo.medianReturnPct > monteCarlo.upperReturnPct ||
    !percentage(monteCarlo?.probabilityOfLossPct) || !nonnegative(monteCarlo?.medianMaxDrawdownPct) || !nonnegative(monteCarlo?.upperMaxDrawdownPct) ||
    monteCarlo.medianMaxDrawdownPct > monteCarlo.upperMaxDrawdownPct) failures.push("MONTE_CARLO_INVALID");
  if (evidence?.paperTradingPassed !== true) failures.push("PAPER_TRADING_NOT_ACCEPTED");
  if (evidence?.reconciliationPassed !== true) failures.push("RECONCILIATION_NOT_PROVEN");
  if (evidence?.securityPassed !== true) failures.push("SECURITY_GATE_FAILED");
  if (evidence?.ciPassed !== true) failures.push("CI_NOT_GREEN");
  if (evidence?.liveTradingDisabled !== true) failures.push("LIVE_TRADING_MUST_REMAIN_DISABLED");
  return { passed: failures.length === 0, failures };
}

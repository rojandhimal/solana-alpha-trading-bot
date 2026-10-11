export type PreDashboardStatus = "PASS" | "FAIL" | "INCONCLUSIVE";

export interface PreDashboardEvidence {
  release: { commitSha: string; branch: string; dependencyLockSha?: string };
  dataset: { provider: string; symbol: string; instrumentId: string; interval: string; requestedStart: number; requestedEnd: number; actualStart?: number; actualEnd?: number; volumeSemantics: string; qualityPassed: boolean; freshnessPassed: boolean };
  walkForward: { baselinePassed: boolean; optimizedPassed: boolean; windows: number; oosTradeCount: number; oosReturnPct: number; oosMaxDrawdownPct: number; oosProfitFactor: number; oosExpectancy: number; profitableWindowPct: number };
  robustness: { parameterStabilityPassed: boolean; stressPassed: boolean; bootstrapPassed: boolean; monteCarloPassed: boolean };
  paperTrading: { observationCount: number; regimeCoveragePassed: boolean; acceptancePassed: boolean };
  controls: { executionRiskInvariantsPassed: boolean; persistenceIdempotencyPassed: boolean; reconciliationPassed: boolean; securityPassed: boolean; liveTradingDisabled: boolean };
  ci: { typecheckPassed: boolean; testsPassed: boolean; buildPassed: boolean };
}

export interface PreDashboardGateResult { status: PreDashboardStatus; readyForDashboard: boolean; failures: string[]; }

function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function timestamp(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function nonempty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }

export function evaluatePreDashboardGate(evidence: PreDashboardEvidence): PreDashboardGateResult {
  const failures: string[] = [];
  if (!nonempty(evidence?.release?.commitSha)) failures.push("RELEASE_COMMIT_MISSING");
  if (!nonempty(evidence?.release?.branch)) failures.push("RELEASE_BRANCH_MISSING");
  if (!nonempty(evidence?.release?.dependencyLockSha)) failures.push("DEPENDENCY_LOCK_IDENTITY_MISSING");
  const dataset = evidence?.dataset;
  if (!nonempty(dataset?.provider) || !nonempty(dataset?.symbol) || !nonempty(dataset?.instrumentId) || !nonempty(dataset?.interval)) failures.push("DATASET_PROVENANCE_INCOMPLETE");
  if (!timestamp(dataset?.requestedStart) || !timestamp(dataset?.requestedEnd) || dataset.requestedStart > dataset.requestedEnd) failures.push("DATASET_REQUEST_RANGE_INVALID");
  if (!timestamp(dataset?.actualStart) || !timestamp(dataset?.actualEnd)) failures.push("DATASET_ACTUAL_RANGE_MISSING");
  else if (dataset.actualStart > dataset.actualEnd) failures.push("DATASET_ACTUAL_RANGE_INVALID");
  if (!nonempty(dataset?.volumeSemantics)) failures.push("DATASET_VOLUME_SEMANTICS_MISSING");
  if (dataset?.qualityPassed !== true) failures.push("DATA_QUALITY_FAILED");
  if (dataset?.freshnessPassed !== true) failures.push("DATA_FRESHNESS_FAILED");
  const wfo = evidence?.walkForward;
  if (wfo?.baselinePassed !== true) failures.push("BASELINE_WALK_FORWARD_FAILED");
  if (wfo?.optimizedPassed !== true) failures.push("OPTIMIZED_WALK_FORWARD_FAILED");
  if (!Number.isSafeInteger(wfo?.windows) || wfo.windows < 2) failures.push("INSUFFICIENT_WALK_FORWARD_WINDOWS");
  if (!Number.isSafeInteger(wfo?.oosTradeCount) || wfo.oosTradeCount <= 0) failures.push("OOS_TRADE_EVIDENCE_MISSING");
  if ([wfo?.oosReturnPct, wfo?.oosMaxDrawdownPct, wfo?.oosProfitFactor, wfo?.oosExpectancy, wfo?.profitableWindowPct].some((value) => !finite(value))) failures.push("NON_FINITE_WALK_FORWARD_EVIDENCE");
  if ((finite(wfo?.oosMaxDrawdownPct) && wfo.oosMaxDrawdownPct < 0) || (finite(wfo?.oosProfitFactor) && wfo.oosProfitFactor < 0) ||
    (finite(wfo?.profitableWindowPct) && (wfo.profitableWindowPct < 0 || wfo.profitableWindowPct > 100))) failures.push("INVALID_WALK_FORWARD_METRIC_DOMAIN");
  if (evidence?.robustness?.parameterStabilityPassed !== true) failures.push("PARAMETER_STABILITY_FAILED");
  if (evidence?.robustness?.stressPassed !== true) failures.push("STRESS_TEST_FAILED");
  if (evidence?.robustness?.bootstrapPassed !== true) failures.push("BOOTSTRAP_EVIDENCE_FAILED");
  if (evidence?.robustness?.monteCarloPassed !== true) failures.push("MONTE_CARLO_EVIDENCE_FAILED");
  if (!Number.isSafeInteger(evidence?.paperTrading?.observationCount) || evidence.paperTrading.observationCount <= 0) failures.push("PAPER_TRADING_OBSERVATIONS_MISSING");
  if (evidence?.paperTrading?.regimeCoveragePassed !== true) failures.push("PAPER_TRADING_REGIME_COVERAGE_FAILED");
  if (evidence?.paperTrading?.acceptancePassed !== true) failures.push("PAPER_TRADING_ACCEPTANCE_FAILED");
  if (evidence?.controls?.executionRiskInvariantsPassed !== true) failures.push("EXECUTION_RISK_INVARIANTS_FAILED");
  if (evidence?.controls?.persistenceIdempotencyPassed !== true) failures.push("PERSISTENCE_IDEMPOTENCY_FAILED");
  if (evidence?.controls?.reconciliationPassed !== true) failures.push("RECONCILIATION_FAILED");
  if (evidence?.controls?.securityPassed !== true) failures.push("SECURITY_CHECKS_FAILED");
  if (evidence?.controls?.liveTradingDisabled !== true) failures.push("LIVE_TRADING_MUST_REMAIN_DISABLED");
  if (evidence?.ci?.typecheckPassed !== true) failures.push("TYPECHECK_FAILED");
  if (evidence?.ci?.testsPassed !== true) failures.push("TESTS_FAILED");
  if (evidence?.ci?.buildPassed !== true) failures.push("BUILD_FAILED");
  const status: PreDashboardStatus = failures.length === 0 ? "PASS" : "FAIL";
  return { status, readyForDashboard: status === "PASS", failures };
}

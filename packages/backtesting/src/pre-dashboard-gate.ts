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

function finite(value: number): boolean { return Number.isFinite(value); }

export function evaluatePreDashboardGate(evidence: PreDashboardEvidence): PreDashboardGateResult {
  const failures: string[] = [];
  if (!evidence.release.commitSha.trim()) failures.push("RELEASE_COMMIT_MISSING");
  if (!evidence.release.branch.trim()) failures.push("RELEASE_BRANCH_MISSING");
  if (!evidence.release.dependencyLockSha?.trim()) failures.push("DEPENDENCY_LOCK_IDENTITY_MISSING");
  const dataset = evidence.dataset;
  if (!dataset.provider.trim() || !dataset.symbol.trim() || !dataset.instrumentId.trim() || !dataset.interval.trim()) failures.push("DATASET_PROVENANCE_INCOMPLETE");
  if (!finite(dataset.requestedStart) || !finite(dataset.requestedEnd) || dataset.requestedStart > dataset.requestedEnd) failures.push("DATASET_REQUEST_RANGE_INVALID");
  if (!finite(dataset.actualStart ?? Number.NaN) || !finite(dataset.actualEnd ?? Number.NaN)) failures.push("DATASET_ACTUAL_RANGE_MISSING");
  if (!dataset.volumeSemantics.trim()) failures.push("DATASET_VOLUME_SEMANTICS_MISSING");
  if (!dataset.qualityPassed) failures.push("DATA_QUALITY_FAILED");
  if (!dataset.freshnessPassed) failures.push("DATA_FRESHNESS_FAILED");
  const wfo = evidence.walkForward;
  if (!wfo.baselinePassed) failures.push("BASELINE_WALK_FORWARD_FAILED");
  if (!wfo.optimizedPassed) failures.push("OPTIMIZED_WALK_FORWARD_FAILED");
  if (wfo.windows < 2) failures.push("INSUFFICIENT_WALK_FORWARD_WINDOWS");
  if (!Number.isInteger(wfo.oosTradeCount) || wfo.oosTradeCount <= 0) failures.push("OOS_TRADE_EVIDENCE_MISSING");
  for (const value of [wfo.oosReturnPct, wfo.oosMaxDrawdownPct, wfo.oosProfitFactor, wfo.oosExpectancy, wfo.profitableWindowPct]) if (!finite(value)) failures.push("NON_FINITE_WALK_FORWARD_EVIDENCE");
  if (!evidence.robustness.parameterStabilityPassed) failures.push("PARAMETER_STABILITY_FAILED");
  if (!evidence.robustness.stressPassed) failures.push("STRESS_TEST_FAILED");
  if (!evidence.robustness.bootstrapPassed) failures.push("BOOTSTRAP_EVIDENCE_FAILED");
  if (!evidence.robustness.monteCarloPassed) failures.push("MONTE_CARLO_EVIDENCE_FAILED");
  if (evidence.paperTrading.observationCount <= 0) failures.push("PAPER_TRADING_OBSERVATIONS_MISSING");
  if (!evidence.paperTrading.regimeCoveragePassed) failures.push("PAPER_TRADING_REGIME_COVERAGE_FAILED");
  if (!evidence.paperTrading.acceptancePassed) failures.push("PAPER_TRADING_ACCEPTANCE_FAILED");
  if (!evidence.controls.executionRiskInvariantsPassed) failures.push("EXECUTION_RISK_INVARIANTS_FAILED");
  if (!evidence.controls.persistenceIdempotencyPassed) failures.push("PERSISTENCE_IDEMPOTENCY_FAILED");
  if (!evidence.controls.reconciliationPassed) failures.push("RECONCILIATION_FAILED");
  if (!evidence.controls.securityPassed) failures.push("SECURITY_CHECKS_FAILED");
  if (!evidence.controls.liveTradingDisabled) failures.push("LIVE_TRADING_MUST_REMAIN_DISABLED");
  if (!evidence.ci.typecheckPassed) failures.push("TYPECHECK_FAILED");
  if (!evidence.ci.testsPassed) failures.push("TESTS_FAILED");
  if (!evidence.ci.buildPassed) failures.push("BUILD_FAILED");
  const status: PreDashboardStatus = failures.length === 0 ? "PASS" : "FAIL";
  return { status, readyForDashboard: status === "PASS", failures };
}
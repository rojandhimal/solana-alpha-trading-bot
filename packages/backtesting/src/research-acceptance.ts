import type { MonteCarloTradeRobustnessResult } from "./monte-carlo-trade-robustness.js";
import type { ParameterStabilityReport } from "./parameter-stability.js";
import type { PerformanceMetrics } from "./performance-metrics.js";
import type { RobustnessReport } from "./robustness.js";

export interface ResearchAcceptanceThresholds {
  minOosReturnPct: number;
  maxOosDrawdownPct: number;
  minOosTradeCount: number;
  minOosProfitFactor: number;
  minOosExpectancy: number;
  minProfitableWindowPct: number;
  requireParameterStability: boolean;
  minPassingStressScenarioRatePct: number;
  maxMonteCarlo95DrawdownPct: number;
}

export interface ResearchAcceptanceEvidence {
  outOfSample: Pick<PerformanceMetrics, "totalReturnPct" | "maxDrawdownPct" | "tradeCount" | "profitFactor" | "expectancy">;
  profitableWindowPct: number;
  parameterStability?: Pick<ParameterStabilityReport, "stable">;
  stressRobustness: Pick<RobustnessReport, "passed" | "passingScenarioRatePct">;
  monteCarlo?: Pick<MonteCarloTradeRobustnessResult, "percentile95MaxDrawdownPct">;
}

export type ResearchAcceptanceStatus = "PASS" | "FAIL" | "INCONCLUSIVE";

export interface ResearchAcceptanceReport {
  status: ResearchAcceptanceStatus;
  failures: string[];
}

function valid(value: number): boolean {
  return Number.isFinite(value);
}

function validateThresholds(thresholds: ResearchAcceptanceThresholds): void {
  if (
    !valid(thresholds.minOosReturnPct) ||
    !valid(thresholds.maxOosDrawdownPct) ||
    !valid(thresholds.minOosTradeCount) ||
    !valid(thresholds.minOosProfitFactor) ||
    !valid(thresholds.minOosExpectancy) ||
    !valid(thresholds.minProfitableWindowPct) ||
    !valid(thresholds.minPassingStressScenarioRatePct) ||
    !valid(thresholds.maxMonteCarlo95DrawdownPct) ||
    thresholds.maxOosDrawdownPct < 0 ||
    thresholds.minOosTradeCount < 0 ||
    thresholds.minProfitableWindowPct < 0 ||
    thresholds.minProfitableWindowPct > 100 ||
    thresholds.minPassingStressScenarioRatePct < 0 ||
    thresholds.minPassingStressScenarioRatePct > 100 ||
    thresholds.maxMonteCarlo95DrawdownPct < 0
  ) {
    throw new Error("invalid research acceptance thresholds");
  }
}

export function evaluateResearchAcceptance(
  evidence: ResearchAcceptanceEvidence,
  thresholds: ResearchAcceptanceThresholds
): ResearchAcceptanceReport {
  validateThresholds(thresholds);
  const failures: string[] = [];
  const metrics = evidence.outOfSample;

  if (![metrics.totalReturnPct, metrics.maxDrawdownPct, metrics.tradeCount, metrics.profitFactor, metrics.expectancy, evidence.profitableWindowPct].every(valid)) {
    return { status: "INCONCLUSIVE", failures: ["INVALID_OR_MISSING_OOS_METRICS"] };
  }

  if (metrics.totalReturnPct < thresholds.minOosReturnPct) failures.push("OOS_RETURN_TOO_LOW");
  if (metrics.maxDrawdownPct > thresholds.maxOosDrawdownPct) failures.push("OOS_DRAWDOWN_TOO_HIGH");
  if (metrics.tradeCount < thresholds.minOosTradeCount) failures.push("OOS_TRADE_COUNT_TOO_LOW");
  if (metrics.profitFactor < thresholds.minOosProfitFactor) failures.push("OOS_PROFIT_FACTOR_TOO_LOW");
  if (metrics.expectancy < thresholds.minOosExpectancy) failures.push("OOS_EXPECTANCY_TOO_LOW");
  if (evidence.profitableWindowPct < thresholds.minProfitableWindowPct) failures.push("TOO_FEW_OOS_WINDOWS_PROFITABLE");

  if (thresholds.requireParameterStability && evidence.parameterStability?.stable !== true) {
    failures.push(evidence.parameterStability === undefined ? "PARAMETER_STABILITY_MISSING" : "PARAMETER_STABILITY_FAILED");
  }

  if (!valid(evidence.stressRobustness.passingScenarioRatePct)) return { status: "INCONCLUSIVE", failures: ["INVALID_STRESS_ROBUSTNESS"] };
  if (!evidence.stressRobustness.passed || evidence.stressRobustness.passingScenarioRatePct < thresholds.minPassingStressScenarioRatePct) failures.push("STRESS_ROBUSTNESS_FAILED");

  if (evidence.monteCarlo === undefined) return { status: "INCONCLUSIVE", failures: ["MONTE_CARLO_EVIDENCE_MISSING", ...failures] };
  if (!valid(evidence.monteCarlo.percentile95MaxDrawdownPct)) return { status: "INCONCLUSIVE", failures: ["INVALID_MONTE_CARLO_DRAWDOWN", ...failures] };
  if (evidence.monteCarlo.percentile95MaxDrawdownPct > thresholds.maxMonteCarlo95DrawdownPct) failures.push("MONTE_CARLO_DRAWDOWN_TOO_HIGH");

  return { status: failures.length === 0 ? "PASS" : "FAIL", failures };
}

import type { StressScenarioResult } from "./stress-testing.js";
import type { WalkForwardPipelineResult } from "./walk-forward-pipeline.js";

export interface RobustnessThresholds {
  maxDrawdownPct: number;
  minProfitFactor: number;
  minExpectancy: number;
  minPassingScenarioRatePct: number;
}

export interface RobustnessReport {
  passed: boolean;
  passingScenarioRatePct: number;
  worstDrawdownPct: number | null;
  worstProfitFactor: number | null;
  worstExpectancy: number | null;
  failures: string[];
}

function validMetric(value: number): boolean {
  return !Number.isNaN(value) && value !== Number.NEGATIVE_INFINITY;
}

function validateThresholds(thresholds: RobustnessThresholds): void {
  const invalidThresholds = Object.values(thresholds).some((value) => !Number.isFinite(value));
  if (invalidThresholds || thresholds.maxDrawdownPct < 0 || thresholds.minPassingScenarioRatePct < 0 || thresholds.minPassingScenarioRatePct > 100) {
    throw new Error("invalid robustness thresholds");
  }
}

export function evaluateRobustness(
  results: readonly StressScenarioResult[],
  thresholds: RobustnessThresholds
): RobustnessReport {
  if (results.length === 0) {
    return { passed: false, passingScenarioRatePct: 0, worstDrawdownPct: null, worstProfitFactor: null, worstExpectancy: null, failures: ["NO_STRESS_RESULTS"] };
  }

  validateThresholds(thresholds);

  const passing = results.filter(({ metrics }) =>
    validMetric(metrics.maxDrawdownPct) &&
    validMetric(metrics.profitFactor) &&
    validMetric(metrics.expectancy) &&
    metrics.maxDrawdownPct <= thresholds.maxDrawdownPct &&
    metrics.profitFactor >= thresholds.minProfitFactor &&
    metrics.expectancy > thresholds.minExpectancy
  );
  const passingScenarioRatePct = (passing.length / results.length) * 100;
  const worstDrawdownPct = Math.max(...results.map(({ metrics }) => metrics.maxDrawdownPct));
  const worstProfitFactor = Math.min(...results.map(({ metrics }) => metrics.profitFactor));
  const worstExpectancy = Math.min(...results.map(({ metrics }) => metrics.expectancy));
  const failures: string[] = [];

  if (passingScenarioRatePct < thresholds.minPassingScenarioRatePct) failures.push("TOO_FEW_SCENARIOS_PASS");

  return { passed: failures.length === 0, passingScenarioRatePct, worstDrawdownPct, worstProfitFactor, worstExpectancy, failures };
}

export function evaluateWalkForwardRobustness(
  result: Pick<WalkForwardPipelineResult, "outOfSample" | "consistency">,
  thresholds: RobustnessThresholds
): RobustnessReport {
  validateThresholds(thresholds);

  const { outOfSample, consistency } = result;
  if (consistency.windowCount === 0) {
    return { passed: false, passingScenarioRatePct: 0, worstDrawdownPct: null, worstProfitFactor: null, worstExpectancy: null, failures: ["NO_WALK_FORWARD_WINDOWS"] };
  }

  const failures: string[] = [];
  const metricsValid =
    validMetric(outOfSample.maxDrawdownPct) &&
    validMetric(outOfSample.profitFactor) &&
    validMetric(outOfSample.expectancy) &&
    validMetric(consistency.worstOosDrawdownPct) &&
    validMetric(consistency.worstOosReturnPct);

  if (!metricsValid) failures.push("INVALID_WALK_FORWARD_METRICS");
  if (consistency.profitableWindowPct < thresholds.minPassingScenarioRatePct) failures.push("TOO_FEW_OOS_WINDOWS_PROFITABLE");
  if (consistency.worstOosDrawdownPct > thresholds.maxDrawdownPct) failures.push("OOS_DRAWDOWN_TOO_HIGH");
  if (outOfSample.profitFactor < thresholds.minProfitFactor) failures.push("OOS_PROFIT_FACTOR_TOO_LOW");
  if (outOfSample.expectancy <= thresholds.minExpectancy) failures.push("OOS_EXPECTANCY_TOO_LOW");

  return {
    passed: failures.length === 0,
    passingScenarioRatePct: consistency.profitableWindowPct,
    worstDrawdownPct: consistency.worstOosDrawdownPct,
    worstProfitFactor: outOfSample.profitFactor,
    worstExpectancy: outOfSample.expectancy,
    failures
  };
}

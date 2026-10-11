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

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validDrawdown(value: unknown): value is number {
  return finite(value) && value >= 0;
}

function validProfitFactor(value: unknown): value is number {
  return (finite(value) && value >= 0) || value === Number.POSITIVE_INFINITY;
}

function validPercentage(value: unknown): value is number {
  return finite(value) && value >= 0 && value <= 100;
}

function validStressMetrics(metrics: StressScenarioResult["metrics"] | undefined): metrics is StressScenarioResult["metrics"] {
  return metrics !== undefined && finite(metrics?.totalReturnPct) && validDrawdown(metrics?.maxDrawdownPct) &&
    validProfitFactor(metrics?.profitFactor) && finite(metrics?.expectancy) &&
    Number.isSafeInteger(metrics?.tradeCount) && metrics.tradeCount >= 0;
}

function validateThresholds(thresholds: RobustnessThresholds): void {
  const invalidThresholds = [thresholds?.maxDrawdownPct, thresholds?.minProfitFactor, thresholds?.minExpectancy, thresholds?.minPassingScenarioRatePct].some((value) => !finite(value));
  if (invalidThresholds || thresholds.maxDrawdownPct < 0 || thresholds.minProfitFactor < 0 || thresholds.minPassingScenarioRatePct < 0 || thresholds.minPassingScenarioRatePct > 100) {
    throw new Error("invalid robustness thresholds");
  }
}

export function evaluateRobustness(
  results: readonly StressScenarioResult[],
  thresholds: RobustnessThresholds
): RobustnessReport {
  validateThresholds(thresholds);
  if (!Array.isArray(results)) {
    return { passed: false, passingScenarioRatePct: 0, worstDrawdownPct: null, worstProfitFactor: null, worstExpectancy: null, failures: ["INVALID_STRESS_RESULTS"] };
  }
  if (results.length === 0) {
    return { passed: false, passingScenarioRatePct: 0, worstDrawdownPct: null, worstProfitFactor: null, worstExpectancy: null, failures: ["NO_STRESS_RESULTS"] };
  }

  const metricsValid = Array.from(results).every((result) => validStressMetrics(result?.metrics));
  const passing = results.filter((result) => {
    const metrics = result?.metrics;
    return validStressMetrics(metrics) &&
      metrics.maxDrawdownPct <= thresholds.maxDrawdownPct &&
      metrics.profitFactor >= thresholds.minProfitFactor &&
      metrics.expectancy > thresholds.minExpectancy;
  });
  const passingScenarioRatePct = (passing.length / results.length) * 100;
  const worstDrawdownPct = metricsValid ? Math.max(...results.map(({ metrics }) => metrics.maxDrawdownPct)) : null;
  const worstProfitFactor = metricsValid ? Math.min(...results.map(({ metrics }) => metrics.profitFactor)) : null;
  const worstExpectancy = metricsValid ? Math.min(...results.map(({ metrics }) => metrics.expectancy)) : null;
  const failures: string[] = [];

  if (!metricsValid) failures.push("INVALID_STRESS_METRICS");
  if (passingScenarioRatePct < thresholds.minPassingScenarioRatePct) failures.push("TOO_FEW_SCENARIOS_PASS");

  return { passed: failures.length === 0, passingScenarioRatePct, worstDrawdownPct, worstProfitFactor, worstExpectancy, failures };
}

export function evaluateWalkForwardRobustness(
  result: Pick<WalkForwardPipelineResult, "outOfSample" | "consistency">,
  thresholds: RobustnessThresholds
): RobustnessReport {
  validateThresholds(thresholds);

  const outOfSample = result?.outOfSample;
  const consistency = result?.consistency;
  if (consistency?.windowCount === 0) {
    return { passed: false, passingScenarioRatePct: 0, worstDrawdownPct: null, worstProfitFactor: null, worstExpectancy: null, failures: ["NO_WALK_FORWARD_WINDOWS"] };
  }

  const failures: string[] = [];
  const metricsValid =
    Number.isSafeInteger(consistency?.windowCount) && consistency.windowCount > 0 &&
    validPercentage(consistency?.profitableWindowPct) &&
    validDrawdown(outOfSample?.maxDrawdownPct) &&
    validProfitFactor(outOfSample?.profitFactor) &&
    finite(outOfSample?.expectancy) &&
    validDrawdown(consistency?.worstOosDrawdownPct) &&
    finite(consistency?.worstOosReturnPct) &&
    finite(consistency?.averageOosReturnPct) && finite(consistency?.medianOosReturnPct) &&
    validDrawdown(consistency?.averageOosDrawdownPct);

  if (!metricsValid) failures.push("INVALID_WALK_FORWARD_METRICS");
  if (consistency?.profitableWindowPct < thresholds.minPassingScenarioRatePct) failures.push("TOO_FEW_OOS_WINDOWS_PROFITABLE");
  if (consistency?.worstOosDrawdownPct > thresholds.maxDrawdownPct) failures.push("OOS_DRAWDOWN_TOO_HIGH");
  if (outOfSample?.profitFactor < thresholds.minProfitFactor) failures.push("OOS_PROFIT_FACTOR_TOO_LOW");
  if (outOfSample?.expectancy <= thresholds.minExpectancy) failures.push("OOS_EXPECTANCY_TOO_LOW");

  return {
    passed: failures.length === 0,
    passingScenarioRatePct: validPercentage(consistency?.profitableWindowPct) ? consistency.profitableWindowPct : 0,
    worstDrawdownPct: validDrawdown(consistency?.worstOosDrawdownPct) ? consistency.worstOosDrawdownPct : null,
    worstProfitFactor: validProfitFactor(outOfSample?.profitFactor) ? outOfSample.profitFactor : null,
    worstExpectancy: finite(outOfSample?.expectancy) ? outOfSample.expectancy : null,
    failures
  };
}

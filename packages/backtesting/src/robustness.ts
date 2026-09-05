import type { StressScenarioResult } from "./stress-testing.js";

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

export function evaluateRobustness(
  results: readonly StressScenarioResult[],
  thresholds: RobustnessThresholds
): RobustnessReport {
  if (results.length === 0) {
    return { passed: false, passingScenarioRatePct: 0, worstDrawdownPct: null, worstProfitFactor: null, worstExpectancy: null, failures: ["NO_STRESS_RESULTS"] };
  }

  const invalidThresholds = Object.values(thresholds).some((value) => !Number.isFinite(value));
  if (invalidThresholds || thresholds.maxDrawdownPct < 0 || thresholds.minPassingScenarioRatePct < 0 || thresholds.minPassingScenarioRatePct > 100) {
    throw new Error("invalid robustness thresholds");
  }

  const passing = results.filter(({ metrics }) =>
    Number.isFinite(metrics.maxDrawdownPct) &&
    Number.isFinite(metrics.profitFactor) &&
    Number.isFinite(metrics.expectancy) &&
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

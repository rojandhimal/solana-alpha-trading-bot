import type { StressMetrics, StressScenarioResult } from "./stress-testing.js";

export interface RobustnessThresholds {
  maxDrawdownPct: number;
  minProfitFactor: number;
  minExpectancy: number;
  minPassingScenarioRatePct: number;
}

export interface ScenarioEvaluation {
  scenario: StressScenarioResult["scenario"];
  passed: boolean;
  failures: string[];
  metrics: StressMetrics;
}

export interface RobustnessReport {
  passed: boolean;
  passingScenarioRatePct: number;
  worstDrawdownPct: number | null;
  lowestProfitFactor: number | null;
  lowestExpectancy: number | null;
  scenarios: ScenarioEvaluation[];
}

function evaluate(metrics: StressMetrics, thresholds: RobustnessThresholds): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  if (metrics.maxDrawdownPct > thresholds.maxDrawdownPct) failures.push("DRAWDOWN_TOO_HIGH");
  if (metrics.profitFactor < thresholds.minProfitFactor) failures.push("PROFIT_FACTOR_TOO_LOW");
  if (metrics.expectancy <= thresholds.minExpectancy) failures.push("EXPECTANCY_NOT_POSITIVE");
  return { passed: failures.length === 0, failures };
}

export function buildRobustnessReport(
  results: readonly StressScenarioResult[],
  thresholds: RobustnessThresholds
): RobustnessReport {
  if (results.length === 0) {
    return { passed: false, passingScenarioRatePct: 0, worstDrawdownPct: null, lowestProfitFactor: null, lowestExpectancy: null, scenarios: [] };
  }

  const scenarios = results.map((result) => {
    const evaluation = evaluate(result.metrics, thresholds);
    return { scenario: result.scenario, passed: evaluation.passed, failures: evaluation.failures, metrics: result.metrics };
  });
  const passing = scenarios.filter((scenario) => scenario.passed).length;
  const drawdowns = scenarios.map((scenario) => scenario.metrics.maxDrawdownPct);
  const profitFactors = scenarios.map((scenario) => scenario.metrics.profitFactor);
  const expectancies = scenarios.map((scenario) => scenario.metrics.expectancy);
  const passingScenarioRatePct = (passing / scenarios.length) * 100;

  return {
    passed: passingScenarioRatePct >= thresholds.minPassingScenarioRatePct,
    passingScenarioRatePct,
    worstDrawdownPct: Math.max(...drawdowns),
    lowestProfitFactor: Math.min(...profitFactors),
    lowestExpectancy: Math.min(...expectancies),
    scenarios
  };
}

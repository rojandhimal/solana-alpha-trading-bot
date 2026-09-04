import { validateBacktest, type BacktestMetrics, type ValidationThresholds } from "./validation.js";
import { runWalkForward, type WalkForwardRunResult } from "./walk-forward-runner.js";
import type { WalkForwardConfig } from "./walk-forward.js";

export interface OosValidationResult {
  passed: boolean;
  windows: Array<{ index: number; metrics: BacktestMetrics; passed: boolean; failures: string[] }>;
  aggregate: BacktestMetrics | null;
}

export function validateWalkForwardOos<T>(
  data: readonly T[],
  walkForward: WalkForwardConfig,
  thresholds: ValidationThresholds,
  runWindow: (train: readonly T[], test: readonly T[], index: number) => BacktestMetrics,
  aggregate: (metrics: readonly BacktestMetrics[]) => BacktestMetrics
): OosValidationResult {
  const run: WalkForwardRunResult<BacktestMetrics> = runWalkForward(data, walkForward, runWindow, aggregate);
  const windows = run.windows.map((window) => {
    const validation = validateBacktest(window.metrics, thresholds);
    return { index: window.index, metrics: window.metrics, passed: validation.passed, failures: validation.failures };
  });
  const aggregateMetrics = run.aggregate;
  const aggregateValidation = aggregateMetrics ? validateBacktest(aggregateMetrics, thresholds) : { passed: false, failures: ["NO_OOS_WINDOWS"] };
  return {
    passed: windows.length > 0 && windows.every((window) => window.passed) && aggregateValidation.passed,
    windows,
    aggregate: aggregateMetrics
  };
}

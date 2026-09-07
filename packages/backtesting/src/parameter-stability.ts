import { runBacktestPipeline, type BacktestPipelineResult } from "./backtest-pipeline.js";
import type { AlphaStrategyConfig } from "./alpha-strategy.js";
import type { StrategyExecutionConfig } from "./strategy-execution-adapter.js";
import type { Candle } from "./execution-model.js";
import type { RobustnessThresholds } from "./robustness.js";
import type { StressScenario } from "./stress-testing.js";
import type { PerformanceMetrics } from "./performance-metrics.js";

export interface StrategyParameterCandidate {
  strategy: AlphaStrategyConfig;
  label?: string;
}

export interface ParameterStabilityResult {
  candidate: StrategyParameterCandidate;
  backtest: BacktestPipelineResult;
  riskAdjustedScore: number;
  rank: number;
}

export interface ParameterStabilityReport {
  candidates: ParameterStabilityResult[];
  best?: ParameterStabilityResult;
  scoreSpreadPct: number;
  stable: boolean;
}

export interface ParameterStabilityInput {
  candles: readonly Candle[];
  initialCapital: number;
  candidates: readonly StrategyParameterCandidate[];
  quantity: number;
  execution?: StrategyExecutionConfig["execution"];
  stressScenarios: readonly StressScenario[];
  robustnessThresholds: RobustnessThresholds;
  stabilitySpreadThresholdPct?: number;
}

/**
 * Scores candidates using percentage-point units only. Expectancy is normalized
 * by starting capital so a dollar-denominated metric cannot dominate return
 * and drawdown merely because the account is larger.
 */
export function calculateParameterStabilityScore(metrics: PerformanceMetrics, initialCapital: number): number {
  if (!Number.isFinite(initialCapital) || initialCapital <= 0) {
    throw new Error("initialCapital must be positive and finite");
  }
  const expectancyPct = (metrics.expectancy / initialCapital) * 100;
  return metrics.totalReturnPct - metrics.maxDrawdownPct + expectancyPct;
}

export function analyzeParameterStability(input: ParameterStabilityInput): ParameterStabilityReport {
  if (input.candidates.length === 0) throw new Error("at least one strategy candidate is required");
  const spreadThreshold = input.stabilitySpreadThresholdPct ?? 10;
  if (!Number.isFinite(spreadThreshold) || spreadThreshold < 0) throw new Error("stabilitySpreadThresholdPct must be non-negative");

  const candidates = input.candidates
    .map((candidate) => {
      const strategyConfig = input.execution === undefined
        ? { quantity: input.quantity, strategy: candidate.strategy }
        : { quantity: input.quantity, strategy: candidate.strategy, execution: input.execution };
      const backtest = runBacktestPipeline({
        candles: input.candles,
        initialCapital: input.initialCapital,
        strategy: strategyConfig,
        stressScenarios: input.stressScenarios,
        robustnessThresholds: input.robustnessThresholds
      });
      return {
        candidate,
        backtest,
        riskAdjustedScore: calculateParameterStabilityScore(backtest.metrics, input.initialCapital),
        rank: 0
      };
    })
    .sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore)
    .map((result, index) => ({ ...result, rank: index + 1 }));

  const best = candidates[0];
  const scores = candidates.map((candidate) => candidate.riskAdjustedScore);
  const minScore = Math.min(...scores);
  const scoreSpreadPct = best === undefined || best.riskAdjustedScore === 0
    ? 0
    : (Math.abs(best.riskAdjustedScore - minScore) / Math.abs(best.riskAdjustedScore)) * 100;

  if (best === undefined) {
    return { candidates, scoreSpreadPct, stable: false };
  }

  return {
    candidates,
    best,
    scoreSpreadPct,
    stable: candidates.length >= 2 && best.riskAdjustedScore > 0 && scoreSpreadPct <= spreadThreshold
  };
}

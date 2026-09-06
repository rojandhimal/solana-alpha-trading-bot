import { runBacktestPipeline, type BacktestPipelineResult } from "./backtest-pipeline.js";
import type { AlphaStrategyConfig } from "./alpha-strategy.js";
import type { StrategyExecutionConfig } from "./strategy-execution-adapter.js";
import type { Candle } from "./execution-model.js";
import type { RobustnessThresholds } from "./robustness.js";
import type { StressScenario } from "./stress-testing.js";

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

function score(result: BacktestPipelineResult): number {
  return result.metrics.totalReturnPct - result.metrics.maxDrawdownPct + result.metrics.expectancy;
}

export function analyzeParameterStability(input: ParameterStabilityInput): ParameterStabilityReport {
  if (input.candidates.length === 0) throw new Error("at least one strategy candidate is required");
  const spreadThreshold = input.stabilitySpreadThresholdPct ?? 10;
  if (!Number.isFinite(spreadThreshold) || spreadThreshold < 0) throw new Error("stabilitySpreadThresholdPct must be non-negative");

  const candidates = input.candidates
    .map((candidate) => {
      const backtest = runBacktestPipeline({
        candles: input.candles,
        initialCapital: input.initialCapital,
        strategy: { quantity: input.quantity, strategy: candidate.strategy, execution: input.execution },
        stressScenarios: input.stressScenarios,
        robustnessThresholds: input.robustnessThresholds
      });
      return { candidate, backtest, riskAdjustedScore: score(backtest), rank: 0 };
    })
    .sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore)
    .map((result, index) => ({ ...result, rank: index + 1 }));

  const best = candidates[0];
  const scores = candidates.map((candidate) => candidate.riskAdjustedScore);
  const positiveScores = scores.filter((value) => value > 0);
  const scoreSpreadPct = positiveScores.length < 2 || !best || best.riskAdjustedScore <= 0
    ? 0
    : ((best.riskAdjustedScore - Math.min(...positiveScores)) / best.riskAdjustedScore) * 100;

  return {
    candidates,
    best,
    scoreSpreadPct,
    stable: scoreSpreadPct <= spreadThreshold
  };
}

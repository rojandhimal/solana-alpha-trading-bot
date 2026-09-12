import type { Candle } from "./execution-model.js";
import { runBacktestPipeline } from "./backtest-pipeline.js";
import { calculateParameterStabilityScore } from "./parameter-stability.js";
import type { AlphaStrategyConfig } from "./alpha-strategy.js";
import type { StrategyExecutionConfig } from "./strategy-execution-adapter.js";

export interface AlphaStrategyOptimizationOptions {
  fastPeriods?: readonly number[];
  slowPeriods?: readonly number[];
  rsiPeriods?: readonly number[];
  momentumPeriods?: readonly number[];
  atrPeriods?: readonly number[];
  volumePeriods?: readonly number[];
  entryThresholds?: readonly number[];
  minTrades?: number;
  minProfitFactor?: number;
  minExpectancy?: number;
  maxCandidates?: number;
  initialCapital?: number;
}

export interface AlphaStrategyOptimizationResult {
  strategy: StrategyExecutionConfig;
  score: number;
  tradeCount: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  profitFactor: number;
  expectancy: number;
}

const DEFAULT_GRID: Required<Omit<AlphaStrategyOptimizationOptions, "minTrades" | "minProfitFactor" | "minExpectancy" | "maxCandidates" | "initialCapital">> = {
  fastPeriods: [5, 10, 15],
  slowPeriods: [20, 30, 40],
  rsiPeriods: [10, 14],
  momentumPeriods: [5, 10],
  atrPeriods: [10, 14],
  volumePeriods: [10, 20],
  entryThresholds: [0.4, 0.5, 0.6]
};

function valuesOrDefault<T>(values: readonly T[] | undefined, fallback: readonly T[]): readonly T[] {
  return values && values.length > 0 ? values : fallback;
}

function validatePeriods(name: string, values: readonly number[]): void {
  if (values.length === 0 || values.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new Error(`${name} must contain positive integers`);
  }
}

function candidateKey(strategy: AlphaStrategyConfig): string {
  return [
    strategy.fastPeriod,
    strategy.slowPeriod,
    strategy.rsiPeriod,
    strategy.momentumPeriod,
    strategy.atrPeriod,
    strategy.volumePeriod,
    strategy.entryThreshold
  ].join(":");
}

function candidateConfigs(base: StrategyExecutionConfig, options: AlphaStrategyOptimizationOptions): AlphaStrategyConfig[] {
  if (!base.strategy) throw new Error("base strategy configuration is required");
  const baseConfig = base.strategy;
  const fastPeriods = valuesOrDefault(options.fastPeriods, DEFAULT_GRID.fastPeriods);
  const slowPeriods = valuesOrDefault(options.slowPeriods, DEFAULT_GRID.slowPeriods);
  const rsiPeriods = valuesOrDefault(options.rsiPeriods, DEFAULT_GRID.rsiPeriods);
  const momentumPeriods = valuesOrDefault(options.momentumPeriods, DEFAULT_GRID.momentumPeriods);
  const atrPeriods = valuesOrDefault(options.atrPeriods, DEFAULT_GRID.atrPeriods);
  const volumePeriods = valuesOrDefault(options.volumePeriods, DEFAULT_GRID.volumePeriods);
  const entryThresholds = valuesOrDefault(options.entryThresholds, DEFAULT_GRID.entryThresholds);

  for (const [name, values] of Object.entries({ fastPeriods, slowPeriods, rsiPeriods, momentumPeriods, atrPeriods, volumePeriods })) {
    validatePeriods(name, values);
  }
  if (entryThresholds.length === 0 || entryThresholds.some((value) => !Number.isFinite(value))) {
    throw new Error("entryThresholds must contain finite values");
  }

  const candidates: AlphaStrategyConfig[] = [];
  const seen = new Set<string>();
  for (const fastPeriod of fastPeriods) {
    for (const slowPeriod of slowPeriods) {
      if (fastPeriod >= slowPeriod) continue;
      for (const rsiPeriod of rsiPeriods) {
        for (const momentumPeriod of momentumPeriods) {
          for (const atrPeriod of atrPeriods) {
            for (const volumePeriod of volumePeriods) {
              for (const entryThreshold of entryThresholds) {
                const candidate = { fastPeriod, slowPeriod, rsiPeriod, momentumPeriod, atrPeriod, volumePeriod, entryThreshold };
                const key = candidateKey(candidate);
                if (seen.has(key)) continue;
                seen.add(key);
                candidates.push(candidate);
              }
            }
          }
        }
      }
    }
  }
  return candidates.length > 0 ? candidates : [baseConfig];
}

export function optimizeAlphaStrategy(
  trainCandles: readonly Candle[],
  base: StrategyExecutionConfig,
  options: AlphaStrategyOptimizationOptions = {}
): AlphaStrategyOptimizationResult {
  if (trainCandles.length === 0) throw new Error("trainCandles must not be empty");
  const minTrades = options.minTrades ?? 3;
  if (!Number.isInteger(minTrades) || minTrades < 0) throw new Error("minTrades must be a non-negative integer");
  const minProfitFactor = options.minProfitFactor ?? 0;
  if (!Number.isFinite(minProfitFactor) || minProfitFactor < 0) throw new Error("minProfitFactor must be non-negative and finite");
  const minExpectancy = options.minExpectancy ?? -Number.MAX_VALUE;
  if (!Number.isFinite(minExpectancy)) throw new Error("minExpectancy must be finite");
  const maxCandidates = options.maxCandidates ?? 5_000;
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1) throw new Error("maxCandidates must be a positive integer");
  const initialCapital = options.initialCapital ?? 10_000;
  if (!Number.isFinite(initialCapital) || initialCapital <= 0) throw new Error("initialCapital must be positive and finite");

  const candidates = candidateConfigs(base, options);
  if (candidates.length > maxCandidates) {
    throw new Error(`candidate grid contains ${candidates.length} candidates, exceeding maxCandidates ${maxCandidates}`);
  }

  let best: AlphaStrategyOptimizationResult | undefined;
  for (const strategy of candidates) {
    const result = runBacktestPipeline({
      candles: trainCandles,
      strategy: { ...base, strategy },
      initialCapital,
      stressScenarios: [],
      robustnessThresholds: { minPassingScenarioRatePct: 0, maxDrawdownPct: 100, minProfitFactor: 0, minExpectancy: -Number.MAX_VALUE }
    });
    if (result.metrics.tradeCount < minTrades) continue;
    if (result.metrics.profitFactor < minProfitFactor) continue;
    if (result.metrics.expectancy < minExpectancy) continue;

    const candidate: AlphaStrategyOptimizationResult = {
      strategy: { ...base, strategy },
      score: calculateParameterStabilityScore(result.metrics, initialCapital),
      tradeCount: result.metrics.tradeCount,
      totalReturnPct: result.metrics.totalReturnPct,
      maxDrawdownPct: result.metrics.maxDrawdownPct,
      profitFactor: result.metrics.profitFactor,
      expectancy: result.metrics.expectancy
    };
    if (!best || candidate.score > best.score) best = candidate;
  }

  if (best) return best;
  return { strategy: base, score: Number.NEGATIVE_INFINITY, tradeCount: 0, totalReturnPct: 0, maxDrawdownPct: 0, profitFactor: 0, expectancy: 0 };
}

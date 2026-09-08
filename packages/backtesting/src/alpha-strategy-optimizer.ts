import type { Candle } from "./execution-model.js";
import { runBacktestPipeline } from "./backtest-pipeline.js";
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

const DEFAULT_GRID: Required<Omit<AlphaStrategyOptimizationOptions, "minTrades">> = {
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

function score(result: { metrics: { totalReturnPct: number; maxDrawdownPct: number; profitFactor: number; expectancy: number; tradeCount: number } }): number {
  const { totalReturnPct, maxDrawdownPct, profitFactor, expectancy, tradeCount } = result.metrics;
  if (![totalReturnPct, maxDrawdownPct, expectancy].every(Number.isFinite)) return Number.NEGATIVE_INFINITY;
  const boundedProfitFactor = Number.isFinite(profitFactor) ? profitFactor : profitFactor > 0 ? 10 : 0;
  return totalReturnPct + boundedProfitFactor * 2 + expectancy * 0.1 - maxDrawdownPct * 0.75 + Math.log1p(tradeCount);
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
  if (entryThresholds.some((value) => !Number.isFinite(value))) throw new Error("entryThresholds must be finite");

  const candidates: AlphaStrategyConfig[] = [];
  for (const fastPeriod of fastPeriods) {
    for (const slowPeriod of slowPeriods) {
      if (fastPeriod >= slowPeriod) continue;
      for (const rsiPeriod of rsiPeriods) {
        for (const momentumPeriod of momentumPeriods) {
          for (const atrPeriod of atrPeriods) {
            for (const volumePeriod of volumePeriods) {
              for (const entryThreshold of entryThresholds) {
                candidates.push({ fastPeriod, slowPeriod, rsiPeriod, momentumPeriod, atrPeriod, volumePeriod, entryThreshold });
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

  let best: AlphaStrategyOptimizationResult | undefined;
  for (const strategy of candidateConfigs(base, options)) {
    const result = runBacktestPipeline({
      candles: trainCandles,
      strategy: { ...base, strategy },
      initialCapital: 10_000,
      stressScenarios: [],
      robustnessThresholds: { minPassingScenarioRatePct: 0, maxDrawdownPct: 100, minProfitFactor: 0, minExpectancy: -Number.MAX_VALUE }
    });
    if (result.metrics.tradeCount < minTrades) continue;
    const candidate: AlphaStrategyOptimizationResult = {
      strategy: { ...base, strategy },
      score: score(result),
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

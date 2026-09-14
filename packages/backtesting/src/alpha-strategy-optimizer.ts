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
  validationFraction?: number;
}

export interface AlphaStrategyOptimizationResult {
  strategy: StrategyExecutionConfig;
  score: number;
  tradeCount: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  profitFactor: number;
  expectancy: number;
  validationScore: number;
}

const DEFAULT_GRID: Required<Omit<AlphaStrategyOptimizationOptions, "minTrades" | "validationFraction">> = {
  fastPeriods: [5, 10, 15], slowPeriods: [20, 30, 40], rsiPeriods: [10, 14], momentumPeriods: [5, 10], atrPeriods: [10, 14], volumePeriods: [10, 20], entryThresholds: [0.4, 0.5, 0.6]
};
function valuesOrDefault<T>(values: readonly T[] | undefined, fallback: readonly T[]): readonly T[] { return values && values.length > 0 ? values : fallback; }
function validatePeriods(name: string, values: readonly number[]): void { if (values.length === 0 || values.some((value) => !Number.isInteger(value) || value <= 0)) throw new Error(`${name} must contain positive integers`); }
function objective(metrics: { totalReturnPct: number; maxDrawdownPct: number; profitFactor: number; expectancy: number; tradeCount: number }): number {
  const { totalReturnPct, maxDrawdownPct, profitFactor, expectancy, tradeCount } = metrics;
  if (![totalReturnPct, maxDrawdownPct, expectancy].every(Number.isFinite)) return Number.NEGATIVE_INFINITY;
  const boundedProfitFactor = Number.isFinite(profitFactor) ? Math.min(profitFactor, 10) : profitFactor > 0 ? 10 : 0;
  return totalReturnPct + boundedProfitFactor * 2 + expectancy * 0.1 - maxDrawdownPct * 0.75 + Math.log1p(tradeCount);
}
function candidateConfigs(base: StrategyExecutionConfig, options: AlphaStrategyOptimizationOptions): AlphaStrategyConfig[] {
  if (!base.strategy) throw new Error("base strategy configuration is required");
  const baseConfig = base.strategy;
  const grids = {
    fastPeriods: valuesOrDefault(options.fastPeriods, DEFAULT_GRID.fastPeriods), slowPeriods: valuesOrDefault(options.slowPeriods, DEFAULT_GRID.slowPeriods), rsiPeriods: valuesOrDefault(options.rsiPeriods, DEFAULT_GRID.rsiPeriods), momentumPeriods: valuesOrDefault(options.momentumPeriods, DEFAULT_GRID.momentumPeriods), atrPeriods: valuesOrDefault(options.atrPeriods, DEFAULT_GRID.atrPeriods), volumePeriods: valuesOrDefault(options.volumePeriods, DEFAULT_GRID.volumePeriods), entryThresholds: valuesOrDefault(options.entryThresholds, DEFAULT_GRID.entryThresholds)
  };
  for (const [name, values] of Object.entries(grids).slice(0, 6)) validatePeriods(name, values as readonly number[]);
  if (grids.entryThresholds.some((value) => !Number.isFinite(value) || value <= 0 || value > 1)) throw new Error("entryThresholds must be > 0 and <= 1");
  const candidates: AlphaStrategyConfig[] = [];
  for (const fastPeriod of grids.fastPeriods) for (const slowPeriod of grids.slowPeriods) {
    if (fastPeriod >= slowPeriod) continue;
    for (const rsiPeriod of grids.rsiPeriods) for (const momentumPeriod of grids.momentumPeriods) for (const atrPeriod of grids.atrPeriods) for (const volumePeriod of grids.volumePeriods) for (const entryThreshold of grids.entryThresholds) {
      candidates.push({ fastPeriod, slowPeriod, rsiPeriod, momentumPeriod, atrPeriod, volumePeriod, entryThreshold });
    }
  }
  return candidates.length > 0 ? candidates : [baseConfig];
}

export function optimizeAlphaStrategy(trainCandles: readonly Candle[], base: StrategyExecutionConfig, options: AlphaStrategyOptimizationOptions = {}): AlphaStrategyOptimizationResult {
  if (trainCandles.length < 4) throw new Error("trainCandles must contain at least four candles");
  const minTrades = options.minTrades ?? 3;
  const validationFraction = options.validationFraction ?? 0.25;
  if (!Number.isInteger(minTrades) || minTrades < 0) throw new Error("minTrades must be a non-negative integer");
  if (!Number.isFinite(validationFraction) || validationFraction < 0.1 || validationFraction >= 0.5) throw new Error("validationFraction must be >= 0.1 and < 0.5");
  const validationBars = Math.max(1, Math.floor(trainCandles.length * validationFraction));
  const selectionBars = trainCandles.length - validationBars;
  if (selectionBars < 2) throw new Error("not enough candles for inner validation");
  const selectionCandles = trainCandles.slice(0, selectionBars);
  const validationCandles = trainCandles.slice(selectionBars);
  let best: AlphaStrategyOptimizationResult | undefined;
  for (const strategy of candidateConfigs(base, options)) {
    const fit = runBacktestPipeline({ candles: selectionCandles, strategy: { ...base, strategy }, initialCapital: 10_000, stressScenarios: [], robustnessThresholds: { minPassingScenarioRatePct: 0, maxDrawdownPct: 100, minProfitFactor: 0, minExpectancy: -Number.MAX_VALUE } });
    if (fit.metrics.tradeCount < minTrades) continue;
    const validation = runBacktestPipeline({ candles: validationCandles, strategy: { ...base, strategy }, initialCapital: 10_000, stressScenarios: [], robustnessThresholds: { minPassingScenarioRatePct: 0, maxDrawdownPct: 100, minProfitFactor: 0, minExpectancy: -Number.MAX_VALUE } });
    if (validation.metrics.tradeCount === 0) continue;
    const candidate: AlphaStrategyOptimizationResult = { strategy: { ...base, strategy }, score: objective(fit.metrics), tradeCount: fit.metrics.tradeCount, totalReturnPct: fit.metrics.totalReturnPct, maxDrawdownPct: fit.metrics.maxDrawdownPct, profitFactor: fit.metrics.profitFactor, expectancy: fit.metrics.expectancy, validationScore: objective(validation.metrics) };
    const combinedScore = candidate.validationScore * 0.6 + candidate.score * 0.4;
    if (!best || combinedScore > best.validationScore * 0.6 + best.score * 0.4 || (combinedScore === best.validationScore * 0.6 + best.score * 0.4 && JSON.stringify(candidate.strategy.strategy) < JSON.stringify(best.strategy.strategy))) best = candidate;
  }
  return best ?? { strategy: base, score: Number.NEGATIVE_INFINITY, tradeCount: 0, totalReturnPct: 0, maxDrawdownPct: 0, profitFactor: 0, expectancy: 0, validationScore: Number.NEGATIVE_INFINITY };
}

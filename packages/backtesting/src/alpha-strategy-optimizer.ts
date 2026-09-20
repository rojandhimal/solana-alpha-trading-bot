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
  initialCapital?: number;
}

export interface AlphaStrategyOptimizationResult {
  strategy: StrategyExecutionConfig;
  score: number;
  validationScore: number;
  tradeCount: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  profitFactor: number;
  expectancy: number;
}

const DEFAULT_GRID = {
  fastPeriods: [5, 10, 15], slowPeriods: [20, 30, 40], rsiPeriods: [10, 14], momentumPeriods: [5, 10], atrPeriods: [10, 14], volumePeriods: [10, 20], entryThresholds: [0.4, 0.5, 0.6]
} as const;
function valuesOrDefault<T>(values: readonly T[] | undefined, fallback: readonly T[]): readonly T[] { return values && values.length > 0 ? values : fallback; }
function validatePeriods(name: string, values: readonly number[]): void { if (values.length === 0 || values.some((value) => !Number.isInteger(value) || value <= 0)) throw new Error(`${name} must contain positive integers`); }
function objective(metrics: { totalReturnPct: number; maxDrawdownPct: number; profitFactor: number; expectancy: number; tradeCount: number }): number {
  const { totalReturnPct, maxDrawdownPct, profitFactor, expectancy, tradeCount } = metrics;
  if (![totalReturnPct, maxDrawdownPct, expectancy].every(Number.isFinite)) return Number.NEGATIVE_INFINITY;
  const boundedProfitFactor = Number.isFinite(profitFactor) ? Math.min(profitFactor, 5) : profitFactor > 0 ? 5 : 0;
  return totalReturnPct + boundedProfitFactor * 2 + expectancy * 0.1 - maxDrawdownPct * 0.75 + Math.log1p(tradeCount);
}
function candidateKey(strategy: AlphaStrategyConfig): string { return [strategy.fastPeriod, strategy.slowPeriod, strategy.rsiPeriod, strategy.momentumPeriod, strategy.atrPeriod, strategy.volumePeriod, strategy.entryThreshold].join(":"); }
function candidateConfigs(base: StrategyExecutionConfig, options: AlphaStrategyOptimizationOptions): AlphaStrategyConfig[] {
  if (!base.strategy) throw new Error("base strategy configuration is required");
  const f = valuesOrDefault(options.fastPeriods, DEFAULT_GRID.fastPeriods), s = valuesOrDefault(options.slowPeriods, DEFAULT_GRID.slowPeriods), r = valuesOrDefault(options.rsiPeriods, DEFAULT_GRID.rsiPeriods), m = valuesOrDefault(options.momentumPeriods, DEFAULT_GRID.momentumPeriods), a = valuesOrDefault(options.atrPeriods, DEFAULT_GRID.atrPeriods), v = valuesOrDefault(options.volumePeriods, DEFAULT_GRID.volumePeriods), t = valuesOrDefault(options.entryThresholds, DEFAULT_GRID.entryThresholds);
  for (const [name, values] of Object.entries({ fastPeriods: f, slowPeriods: s, rsiPeriods: r, momentumPeriods: m, atrPeriods: a, volumePeriods: v })) validatePeriods(name, values);
  if (t.some((value) => !Number.isFinite(value) || value <= 0 || value > 1)) throw new Error("entryThresholds must be > 0 and <= 1");
  const candidates: AlphaStrategyConfig[] = [];
  const seen = new Set<string>();
  for (const fastPeriod of f) for (const slowPeriod of s) if (fastPeriod < slowPeriod) for (const rsiPeriod of r) for (const momentumPeriod of m) for (const atrPeriod of a) for (const volumePeriod of v) for (const entryThreshold of t) { const candidate = { fastPeriod, slowPeriod, rsiPeriod, momentumPeriod, atrPeriod, volumePeriod, entryThreshold }; const key = candidateKey(candidate); if (seen.has(key)) continue; seen.add(key); candidates.push(candidate); }
  return candidates.length > 0 ? candidates : [base.strategy];
}
function runCandidate(candles: readonly Candle[], base: StrategyExecutionConfig, strategy: AlphaStrategyConfig, initialCapital: number) { return runBacktestPipeline({ candles, strategy: { ...base, strategy }, initialCapital, stressScenarios: [], robustnessThresholds: { minPassingScenarioRatePct: 0, maxDrawdownPct: 100, minProfitFactor: 0, minExpectancy: -Number.MAX_VALUE } }); }
export function optimizeAlphaStrategy(trainCandles: readonly Candle[], base: StrategyExecutionConfig, options: AlphaStrategyOptimizationOptions = {}): AlphaStrategyOptimizationResult {
  if (trainCandles.length < 4) throw new Error("trainCandles must contain at least four candles");
  const minTrades = options.minTrades ?? 3;
  const validationFraction = options.validationFraction ?? 0.25;
  const initialCapital = options.initialCapital ?? 10_000;
  if (!Number.isFinite(initialCapital) || initialCapital <= 0) throw new Error("initialCapital must be positive and finite");
  if (!Number.isInteger(minTrades) || minTrades < 0) throw new Error("minTrades must be a non-negative integer");
  if (!Number.isFinite(validationFraction) || validationFraction < 0.1 || validationFraction >= 0.5) throw new Error("validationFraction must be >= 0.1 and < 0.5");
  const validationBars = Math.max(1, Math.floor(trainCandles.length * validationFraction));
  const selectionBars = trainCandles.length - validationBars;
  if (selectionBars < 2 || validationBars < 2) throw new Error("not enough candles for inner validation");
  const selectionCandles = trainCandles.slice(0, selectionBars), validationCandles = trainCandles.slice(selectionBars);
  let best: AlphaStrategyOptimizationResult | undefined;
  let bestCombinedScore = Number.NEGATIVE_INFINITY;
  for (const strategy of candidateConfigs(base, options)) {
    const fit = runCandidate(selectionCandles, base, strategy, initialCapital);
    if (fit.metrics.tradeCount < minTrades) continue;
    const validation = runCandidate(validationCandles, base, strategy, initialCapital);
    if (validation.metrics.tradeCount === 0) continue;
    const candidate: AlphaStrategyOptimizationResult = { strategy: { ...base, strategy }, score: objective(fit.metrics), validationScore: objective(validation.metrics), tradeCount: fit.metrics.tradeCount, totalReturnPct: fit.metrics.totalReturnPct, maxDrawdownPct: fit.metrics.maxDrawdownPct, profitFactor: fit.metrics.profitFactor, expectancy: fit.metrics.expectancy };
    const combinedScore = candidate.validationScore * 0.6 + candidate.score * 0.4;
    if (!best || combinedScore > bestCombinedScore || (combinedScore === bestCombinedScore && JSON.stringify(candidate.strategy.strategy) < JSON.stringify(best.strategy.strategy))) { best = candidate; bestCombinedScore = combinedScore; }
  }
  return best ?? { strategy: base, score: Number.NEGATIVE_INFINITY, validationScore: Number.NEGATIVE_INFINITY, tradeCount: 0, totalReturnPct: 0, maxDrawdownPct: 0, profitFactor: 0, expectancy: 0 };
}

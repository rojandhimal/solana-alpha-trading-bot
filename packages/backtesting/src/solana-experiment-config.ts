import type { HistoricalExperimentConfig } from "./historical-experiment.js";
import type { AlphaStrategyConfig } from "./alpha-strategy.js";
import type { StressScenario } from "./stress-testing.js";

export const SOL_TOKEN_ADDRESS = "So11111111111111111111111111111111111111112";
export const SOL_GECKOTERMINAL_POOL_ADDRESS = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2";
export const SOL_RESEARCH_INTERVAL = "1H";
export const SOL_RESEARCH_EXPECTED_INTERVAL_MS = 60 * 60 * 1000;

// Fixed research period for reproducibility. This is configuration only; it does not
// imply that the strategy is profitable or suitable for live trading.
export const SOL_RESEARCH_START_MS = Date.parse("2025-01-01T00:00:00.000Z");
export const SOL_RESEARCH_END_MS = Date.parse("2025-12-31T23:00:00.000Z");

export const SOL_STRESS_SCENARIOS: readonly StressScenario[] = [
  "BASE",
  "HIGH_SLIPPAGE",
  "HIGH_FEES",
  "LIQUIDITY_SHOCK",
  "EXECUTION_DELAY",
  "VOLATILITY_SHOCK"
];

export const SOL_ROBUSTNESS_THRESHOLDS = {
  maxDrawdownPct: 35,
  minProfitFactor: 1.05,
  minExpectancy: 0,
  minPassingScenarioRatePct: 80
};

export const SOL_WALK_FORWARD = {
  trainingBars: 90 * 24,
  testingBars: 30 * 24,
  stepBars: 30 * 24
};

export const SOL_BASELINE_STRATEGY: AlphaStrategyConfig = {
  fastPeriod: 10,
  slowPeriod: 30,
  rsiPeriod: 14,
  momentumPeriod: 10,
  atrPeriod: 14,
  volumePeriod: 20,
  entryThreshold: 0.5
};

export function createSolHistoricalExperimentConfig(): HistoricalExperimentConfig {
  return {
    symbol: SOL_TOKEN_ADDRESS,
    query: {
      symbol: SOL_TOKEN_ADDRESS,
      startTime: SOL_RESEARCH_START_MS,
      endTime: SOL_RESEARCH_END_MS,
      interval: SOL_RESEARCH_INTERVAL
    },
    initialCapital: 10_000,
    baselineStrategy: {
      quantity: 1,
      strategy: SOL_BASELINE_STRATEGY
    },
    walkForward: SOL_WALK_FORWARD,
    stressScenarios: SOL_STRESS_SCENARIOS,
    robustnessThresholds: SOL_ROBUSTNESS_THRESHOLDS,
    dataQuality: {
      expectedIntervalMs: SOL_RESEARCH_EXPECTED_INTERVAL_MS,
      maxGapCount: 0
    }
  };
}

export const SOLANA_EXPERIMENT_CONFIG = createSolHistoricalExperimentConfig();

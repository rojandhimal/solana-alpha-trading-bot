import { describe, expect, it } from "vitest";
import { InMemoryHistoricalDataSource } from "../../market-data/src/historical-source.js";
import { runBacktestPipeline } from "./backtest-pipeline.js";
import { runHistoricalBacktest } from "./historical-backtest-runner.js";
import { runHistoricalExperiment, type HistoricalExperimentConfig } from "./historical-experiment.js";
import { runWalkForwardPipeline } from "./walk-forward-pipeline.js";

function waveBars(period = 3, trend = 0.1) {
  return Array.from({ length: 120 }, (_, i) => {
    const close = 100 + i * trend + Math.sin(i / period) * 3;
    return {
      timestamp: (i + 1) * 60_000,
      open: close - 0.25,
      high: close + 1,
      low: close - 1,
      close,
      volume: 100,
    };
  });
}

function experimentConfig(feePct = 0.1): HistoricalExperimentConfig {
  return {
    symbol: "SOL",
    query: { symbol: "SOL", interval: "1m", startTime: 60_000, endTime: 7_200_000 },
    initialCapital: 10_000,
    baselineStrategy: {
      quantity: 1,
      strategy: {
        fastPeriod: 2, slowPeriod: 5, rsiPeriod: 3, momentumPeriod: 2,
        atrPeriod: 3, volumePeriod: 3, entryThreshold: 0.5,
      },
      execution: {
        executionDelayBars: 1, slippagePct: 0, feePct,
        liquidityMultiplier: 1, volatilityMultiplier: 1,
      },
    },
    walkForward: { trainingBars: 60, testingBars: 30 },
    stressScenarios: ["BASE", "HIGH_FEES"],
    robustnessThresholds: {
      minPassingScenarioRatePct: 100, maxDrawdownPct: 100,
      minProfitFactor: 0, minExpectancy: 0,
    },
    acceptanceThresholds: {
      minOosReturnPct: -100, maxOosDrawdownPct: 100, minOosTradeCount: 0,
      minOosProfitFactor: 0, minOosExpectancy: -1_000, minProfitableWindowPct: 0,
      requireParameterStability: false, minPassingStressScenarioRatePct: 100,
      maxMonteCarlo95DrawdownPct: 100,
    },
    optimization: {
      fastPeriods: [2], slowPeriods: [5], rsiPeriods: [3], momentumPeriods: [2],
      atrPeriods: [3], volumePeriods: [3], entryThresholds: [0.5], minTrades: 0,
    },
  };
}

describe("historical strategy evidence", () => {
  it("preserves volume-dependent fills through the historical backtest adapter", async () => {
    const bars = Array.from({ length: 30 }, (_, i) => ({
      timestamp: (i + 1) * 60_000, open: 100 + i, high: 102 + i,
      low: 99 + i, close: 101 + i, volume: 1_000,
    }));
    const config = experimentConfig();
    const strategy = {
      ...config.baselineStrategy,
      strategy: { ...config.baselineStrategy.strategy!, entryThreshold: 0.9 },
    };
    const pipelineConfig = {
      initialCapital: config.initialCapital, strategy,
      stressScenarios: config.stressScenarios,
      robustnessThresholds: config.robustnessThresholds,
    };
    const direct = runBacktestPipeline({ candles: bars, ...pipelineConfig });
    const historical = await runHistoricalBacktest(
      new InMemoryHistoricalDataSource(bars),
      { ...config.query, endTime: bars.at(-1)!.timestamp },
      pipelineConfig,
    );
    expect(direct.fills).toHaveLength(1);
    expect(historical).toEqual(direct);
  });

  it("uses the same OHLCV strategy in historical and direct walk-forward evaluation", async () => {
    const bars = waveBars();
    const config = experimentConfig();
    config.baselineStrategy = {
      ...config.baselineStrategy,
      strategy: { ...config.baselineStrategy.strategy!, entryThreshold: 0.9 },
    };
    const direct = runWalkForwardPipeline({
      candles: bars, initialCapital: config.initialCapital,
      strategy: config.baselineStrategy, walkForward: config.walkForward,
      stressScenarios: config.stressScenarios,
      robustnessThresholds: config.robustnessThresholds,
    });
    const historical = await runHistoricalExperiment(new InMemoryHistoricalDataSource(bars), config);
    expect(direct.outOfSample.tradeCount).toBeGreaterThan(0);
    expect(historical.baseline).toEqual(direct);
  });

  it("rejects failed execution stress even when WFO consistency passes", async () => {
    const result = await runHistoricalExperiment(
      new InMemoryHistoricalDataSource(waveBars()), experimentConfig(0.5),
    );
    expect(result.optimized.robustness.passed).toBe(true);
    expect(result.optimized.windows[0]!.test.robustness.passingScenarioRatePct).toBe(50);
    expect(result.optimized.windows[0]!.test.stressResults.find((value) => value.scenario === "HIGH_FEES")!.metrics.expectancy).toBeLessThan(0);
    expect(result.acceptance).toEqual({ status: "FAIL", failures: ["STRESS_ROBUSTNESS_FAILED"] });
  });

  it("accepts required stability when every training neighborhood is stable", async () => {
    const config = experimentConfig();
    config.acceptanceThresholds = { ...config.acceptanceThresholds!, requireParameterStability: true };
    const result = await runHistoricalExperiment(new InMemoryHistoricalDataSource(waveBars(5, 0.3)), config);
    expect(result.trainingParameterStability).toHaveLength(result.optimized.windows.length);
    expect(result.trainingParameterStability!.every((report) => report.stable)).toBe(true);
    expect(result.acceptance).toEqual({ status: "PASS", failures: [] });
  });

  it("reports measured instability instead of missing stability evidence", async () => {
    const config = experimentConfig();
    config.acceptanceThresholds = { ...config.acceptanceThresholds!, requireParameterStability: true };
    const result = await runHistoricalExperiment(new InMemoryHistoricalDataSource(waveBars()), config);
    expect(result.trainingParameterStability!.some((report) => !report.stable)).toBe(true);
    expect(result.acceptance).toEqual({ status: "FAIL", failures: ["PARAMETER_STABILITY_FAILED"] });
  });
});

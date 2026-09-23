import { describe, expect, it } from "vitest";
import { InMemoryHistoricalDataSource } from "../../market-data/src/historical-source.js";
import { runHistoricalExperiment, summarizeHistoricalExperiment } from "./historical-experiment.js";

const bars = Array.from({ length: 60 }, (_, i) => {
  const close = 100 + i + Math.sin(i / 2);
  return {
    timestamp: (i + 1) * 60_000,
    open: close - 0.25,
    high: close + 1,
    low: close - 1,
    close,
    volume: 100
  };
});

const strategy = {
  quantity: 1,
  strategy: {
    fastPeriod: 5,
    slowPeriod: 10,
    rsiPeriod: 5,
    momentumPeriod: 5,
    atrPeriod: 5,
    volumePeriod: 5,
    entryThreshold: 0.5
  },
  execution: {
    executionDelayBars: 0,
    slippagePct: 0,
    feePct: 0,
    liquidityMultiplier: 1,
    volatilityMultiplier: 1
  }
};

const permissiveThresholds = {
  minPassingScenarioRatePct: 0,
  maxDrawdownPct: 100,
  minProfitFactor: 0,
  minExpectancy: -1_000
};

const acceptanceThresholds = {
  minOosReturnPct: -100,
  maxOosDrawdownPct: 100,
  minOosTradeCount: 0,
  minOosProfitFactor: 0,
  minOosExpectancy: -1_000,
  minProfitableWindowPct: 0,
  requireParameterStability: false,
  minPassingStressScenarioRatePct: 0,
  maxMonteCarlo95DrawdownPct: 100
};

describe("historical experiment", () => {
  it("audits the dataset once and runs baseline and optimized WFO from the same candles", async () => {
    let loadCount = 0;
    const source = new InMemoryHistoricalDataSource(bars);
    const countingSource = {
      load: async (query: Parameters<typeof source.load>[0]) => {
        loadCount += 1;
        return source.load(query);
      }
    };

    const query = {
      symbol: "SOL",
      startTime: bars[0]!.timestamp,
      endTime: bars.at(-1)!.timestamp,
      interval: "1m"
    };

    const result = await runHistoricalExperiment(countingSource, {
      symbol: "SOL",
      query,
      initialCapital: 10_000,
      baselineStrategy: strategy,
      walkForward: { trainingBars: 30, testingBars: 15 },
      stressScenarios: [],
      robustnessThresholds: permissiveThresholds,
      acceptanceThresholds,
      optimization: {
        fastPeriods: [5],
        slowPeriods: [10],
        rsiPeriods: [5],
        momentumPeriods: [5],
        atrPeriods: [5],
        volumePeriods: [5],
        entryThresholds: [0.5],
        minTrades: 0
      }
    });

    expect(loadCount).toBe(1);
    expect(result.dataset).toMatchObject({
      valid: true,
      barCount: 60,
      firstTimestamp: bars[0]!.timestamp,
      lastTimestamp: bars.at(-1)!.timestamp
    });
    expect(result.baseline.windows).toHaveLength(2);
    expect(result.optimized.windows).toHaveLength(2);
    expect(result.optimized.windows.every((window) => window.selectedStrategy !== undefined)).toBe(true);
    expect(result.optimized.outOfSampleTrades.length).toBe(result.optimized.outOfSample.tradeCount);
    expect(result.acceptance).toBeDefined();

    const summary = summarizeHistoricalExperiment(result);
    expect(summary).toMatchObject({
      symbol: "SOL",
      barCount: 60,
      rangeStart: bars[0]!.timestamp,
      rangeEnd: bars.at(-1)!.timestamp,
      acceptanceStatus: result.acceptance!.status
    });
    expect(Number.isFinite(summary.baselineReturnPct)).toBe(true);
    expect(Number.isFinite(summary.optimizedReturnPct)).toBe(true);
  });

  it("rejects incomplete historical coverage before WFO", async () => {
    const source = new InMemoryHistoricalDataSource(bars.slice(1));
    await expect(runHistoricalExperiment(source, {
      symbol: "SOL",
      query: {
        symbol: "SOL",
        startTime: bars[0]!.timestamp,
        endTime: bars.at(-1)!.timestamp,
        interval: "1m"
      },
      initialCapital: 10_000,
      baselineStrategy: strategy,
      walkForward: { trainingBars: 30, testingBars: 15 },
      stressScenarios: [],
      robustnessThresholds: permissiveThresholds,
      optimization: { fastPeriods: [5], slowPeriods: [10], minTrades: 0 }
    })).rejects.toThrow("historical data quality check failed");
  });
});

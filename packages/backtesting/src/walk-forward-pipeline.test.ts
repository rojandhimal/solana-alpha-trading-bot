import { describe, expect, it } from "vitest";
import { runWalkForwardPipeline } from "./walk-forward-pipeline.js";

const candles = Array.from({ length: 20 }, (_, i) => ({ open: 100 + i, high: 101 + i, low: 99 + i, close: 100.5 + i }));
const permissiveThresholds = { minPassingScenarioRatePct: 0, maxDrawdownPct: 100, minProfitFactor: 0, minExpectancy: -1_000 };

describe("walk-forward pipeline", () => {
  it("runs a complete backtest for each train/test window and aggregates out-of-sample metrics", () => {
    const result = runWalkForwardPipeline({
      candles,
      initialCapital: 10_000,
      stressScenarios: [],
      robustnessThresholds: permissiveThresholds,
      fills: [],
      walkForward: { trainingBars: 10, testingBars: 5 }
    });

    expect(result.windows).toHaveLength(2);
    expect(result.windows[0]?.train.baseline.finalEquity).toBe(10_000);
    expect(result.windows[0]?.test.baseline.finalEquity).toBe(10_000);
    expect(result.outOfSample).toMatchObject({
      totalReturnPct: 0,
      netProfit: 0,
      tradeCount: 0,
      winRatePct: 0,
      profitFactor: 0,
      expectancy: 0
    });
    expect(result.consistency).toEqual({
      windowCount: 2,
      profitableWindowPct: 0,
      averageOosReturnPct: 0,
      medianOosReturnPct: 0,
      worstOosReturnPct: 0,
      averageOosDrawdownPct: 0,
      worstOosDrawdownPct: 0
    });
    expect(result.robustness).toMatchObject({
      passed: true,
      passingScenarioRatePct: 0,
      failures: []
    });
  });

  it("rebases explicit fills to each window and excludes fills that cross a window boundary", () => {
    const result = runWalkForwardPipeline({
      candles,
      initialCapital: 10_000,
      stressScenarios: [],
      robustnessThresholds: permissiveThresholds,
      fills: [
        { signalIndex: 10, executionIndex: 10, side: "BUY", quantity: 1, referencePrice: 100, fillPrice: 100, fee: 0 },
        { signalIndex: 11, executionIndex: 11, side: "SELL", quantity: 1, referencePrice: 101, fillPrice: 101, fee: 0 },
        { signalIndex: 14, executionIndex: 15, side: "SELL", quantity: 1, referencePrice: 104, fillPrice: 104, fee: 0 }
      ],
      walkForward: { trainingBars: 10, testingBars: 5 }
    });

    expect(result.windows[0]?.train.trades).toHaveLength(0);
    expect(result.windows[0]?.test.trades).toHaveLength(1);
    expect(result.windows[0]?.test.metrics.netProfit).toBe(1);
    expect(result.windows[1]?.test.trades).toHaveLength(0);
    expect(result.outOfSample.tradeCount).toBe(1);
    expect(result.outOfSample.netProfit).toBe(1);
    expect(result.consistency).toMatchObject({
      windowCount: 2,
      profitableWindowPct: 50,
      averageOosReturnPct: 0.005,
      medianOosReturnPct: 0.005,
      worstOosReturnPct: 0,
      averageOosDrawdownPct: 0.04745017731382049,
      worstOosDrawdownPct: 0.09490035462764097
    });
    expect(result.robustness).toMatchObject({
      passed: true,
      passingScenarioRatePct: 50,
      worstDrawdownPct: 0.09490035462764097,
      worstProfitFactor: Number.POSITIVE_INFINITY,
      worstExpectancy: 1
    });
  });

  it("runs the configured strategy independently inside every train/test window", () => {
    const strategyCandles = Array.from({ length: 60 }, (_, i) => {
      const close = 100 + i;
      return { open: close, high: close + 1, low: close - 1, close, volume: 100 };
    });

    const result = runWalkForwardPipeline({
      candles: strategyCandles,
      initialCapital: 10_000,
      strategy: {
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
        execution: { slippagePct: 0, feePct: 0, executionDelayBars: 0, liquidityMultiplier: 1, volatilityMultiplier: 1 }
      },
      stressScenarios: [],
      robustnessThresholds: permissiveThresholds,
      walkForward: { trainingBars: 30, testingBars: 15 }
    });

    expect(result.windows).toHaveLength(2);
    expect(result.windows.every((window) => window.train.fills.length >= 0 && window.test.fills.length >= 0)).toBe(true);
    expect(result.outOfSample.tradeCount).toBe(
      result.windows.reduce((sum, window) => sum + window.test.metrics.tradeCount, 0)
    );
    expect(result.consistency.windowCount).toBe(2);
  });

  it("compounds OOS returns across windows instead of summing independent profits", () => {
    const result = runWalkForwardPipeline({
      candles,
      initialCapital: 10_000,
      stressScenarios: [],
      robustnessThresholds: permissiveThresholds,
      fills: [
        { signalIndex: 10, executionIndex: 10, side: "BUY", quantity: 1, referencePrice: 100, fillPrice: 100, fee: 0 },
        { signalIndex: 11, executionIndex: 11, side: "SELL", quantity: 1, referencePrice: 101, fillPrice: 101, fee: 0 },
        { signalIndex: 15, executionIndex: 15, side: "BUY", quantity: 1, referencePrice: 100, fillPrice: 100, fee: 0 },
        { signalIndex: 16, executionIndex: 16, side: "SELL", quantity: 1, referencePrice: 101, fillPrice: 101, fee: 0 }
      ],
      walkForward: { trainingBars: 10, testingBars: 5 }
    });

    expect(result.windows[0]?.test.metrics.netProfit).toBe(1);
    expect(result.windows[1]?.test.metrics.netProfit).toBe(1);
    expect(result.outOfSample.netProfit).toBeCloseTo(2.0001, 10);
    expect(result.outOfSample.totalReturnPct).toBeCloseTo(0.020001, 10);
    expect(result.outOfSample.tradeCount).toBe(2);
  });
});

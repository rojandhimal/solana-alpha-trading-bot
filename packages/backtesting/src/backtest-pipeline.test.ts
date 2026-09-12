import { describe, expect, it } from "vitest";
import { runBacktestPipeline } from "./backtest-pipeline.js";
import type { Candle, ExecutionFill } from "./execution-model.js";

const candles: Candle[] = [
  { open: 100, high: 100, low: 100, close: 100 },
  { open: 110, high: 110, low: 110, close: 110 },
  { open: 120, high: 120, low: 120, close: 120 }
];
const fills: ExecutionFill[] = [
  { signalIndex: 0, executionIndex: 0, side: "BUY", quantity: 1, referencePrice: 100, fillPrice: 100, fee: 1 },
  { signalIndex: 1, executionIndex: 1, side: "SELL", quantity: 1, referencePrice: 110, fillPrice: 110, fee: 1 }
];

const thresholds = { maxDrawdownPct: 20, minProfitFactor: 1, minExpectancy: -1, minPassingScenarioRatePct: 100 };

describe("backtest pipeline", () => {
  it("connects accounting, attribution, metrics and robustness", () => {
    const result = runBacktestPipeline({
      candles,
      fills,
      initialCapital: 1_000,
      stressScenarios: ["BASE", "HIGH_FEES"],
      robustnessThresholds: thresholds
    });

    expect(result.baseline.finalEquity).toBe(1_008);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]?.netPnl).toBe(8);
    expect(result.metrics.winRatePct).toBe(100);
    expect(result.stressResults).toHaveLength(2);
    expect(result.robustness.passed).toBe(true);
  });

  it("allows a scenario runner to transform fills", () => {
    const result = runBacktestPipeline({
      candles,
      fills,
      initialCapital: 1_000,
      stressScenarios: ["BASE", "HIGH_FEES"],
      robustnessThresholds: thresholds,
      runScenario: (scenarioFills, parameters) => scenarioFills.map((fill) => ({ ...fill, fee: fill.fee * parameters.feeMultiplier }))
    });

    expect(result.stressResults[1]?.metrics.totalReturnPct).toBeLessThan(result.stressResults[0]?.metrics.totalReturnPct ?? Infinity);
  });
});

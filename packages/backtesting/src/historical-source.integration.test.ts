import { describe, expect, it } from "vitest";
import { InMemoryHistoricalDataSource } from "../../market-data/src/historical-source.js";
import { toBacktestCandles } from "./market-data.js";
import { runBacktestPipeline } from "./backtest-pipeline.js";
import type { ExecutionFill } from "./execution-model.js";

describe("historical source backtesting integration", () => {
  it("loads deterministic OHLCV data and runs it through the backtest pipeline", async () => {
    const source = new InMemoryHistoricalDataSource([
      { timestamp: 1_000, open: 100, high: 100, low: 100, close: 100, volume: 100 },
      { timestamp: 2_000, open: 110, high: 110, low: 110, close: 110, volume: 120 },
      { timestamp: 3_000, open: 120, high: 120, low: 120, close: 120, volume: 140 }
    ]);

    const bars = await source.load({ symbol: "SOL", interval: "1m", startTime: 1_000, endTime: 3_000 });
    const candles = toBacktestCandles(bars);
    const fills: ExecutionFill[] = [
      { signalIndex: 0, executionIndex: 0, side: "BUY", quantity: 1, referencePrice: 100, fillPrice: 100, fee: 1 },
      { signalIndex: 1, executionIndex: 1, side: "SELL", quantity: 1, referencePrice: 110, fillPrice: 110, fee: 1 }
    ];

    const result = runBacktestPipeline({
      candles,
      fills,
      initialCapital: 1_000,
      stressScenarios: ["BASE", "HIGH_FEES"],
      robustnessThresholds: { maxDrawdownPct: 20, minProfitFactor: 1, minExpectancy: -1, minPassingScenarioRatePct: 100 }
    });

    expect(result.baseline.finalEquity).toBe(1_008);
    expect(result.trades).toHaveLength(1);
    expect(result.metrics.tradeCount).toBe(1);
    expect(result.stressResults).toHaveLength(2);
  });
});

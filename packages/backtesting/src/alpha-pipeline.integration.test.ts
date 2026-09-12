import { describe, expect, it } from "vitest";
import { generateStrategyFills } from "./strategy-execution-adapter.js";
import { runBacktestPipeline } from "./backtest-pipeline.js";
import type { StrategyCandle } from "./alpha-strategy.js";

function makeTrendCandles(trend: number, count = 60): StrategyCandle[] {
  return Array.from({ length: count }, (_, i) => {
    const close = 100 + i * trend;
    return { open: close, high: close + 1, low: close - 1, close, volume: 100 };
  });
}

describe("alpha strategy backtest integration", () => {
  it("turns a bullish candle series into executable strategy fills", () => {
    const candles = makeTrendCandles(1);
    const fills = generateStrategyFills(candles, { quantity: 1 });

    expect(fills.length).toBeGreaterThan(0);
    expect(fills.some((fill) => fill.side === "BUY")).toBe(true);
  });

  it("produces a complete pipeline result from strategy-generated fills", () => {
    const candles = makeTrendCandles(1);
    const fills = generateStrategyFills(candles, { quantity: 1 });

    const result = runBacktestPipeline({
      candles,
      fills,
      initialCapital: 1_000,
      stressScenarios: ["BASE", "HIGH_FEES"],
      robustnessThresholds: {
        maxDrawdownPct: 100,
        minProfitFactor: 0,
        minExpectancy: -1_000,
        minPassingScenarioRatePct: 0
      }
    });

    expect(result.trades).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.stressResults).toHaveLength(2);
    expect(result.robustness).toBeDefined();
  });
});

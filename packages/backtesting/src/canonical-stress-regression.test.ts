import { describe, expect, it } from "vitest";
import { runBacktestPipeline } from "./backtest-pipeline.js";
import { generateStrategyFills } from "./strategy-execution-adapter.js";
import { accountFills } from "./portfolio-accounting.js";
import { attributeTrades } from "./trade-attribution.js";
import { calculatePerformanceMetrics } from "./performance-metrics.js";
it("stress delay re-executes the canonical strategy on actual delayed bars", () => {
  const candles = Array.from({ length: 50 }, (_, i) => {
    const price = 100 + 10 * Math.sin(i / 3);
    return {
      open: price,
      close: price,
      high: price + 1,
      low: price - 1,
      volume: 100,
    };
  });
  const strategy = {
    quantity: 1,
    execution: {
      executionDelayBars: 1,
      slippagePct: 0.1,
      feePct: 0.1,
      liquidityMultiplier: 1,
      volatilityMultiplier: 1,
    },
  };
  const result = runBacktestPipeline({
    candles,
    strategy,
    initialCapital: 1000,
    stressScenarios: ["BASE", "EXECUTION_DELAY"],
    robustnessThresholds: {
      maxDrawdownPct: 100,
      minProfitFactor: 0,
      minExpectancy: -1000,
      minPassingScenarioRatePct: 0,
    },
  });
  expect(result.stressResults[0]!.metrics).toEqual(result.metrics);
  const delayed = generateStrategyFills(candles, {
    ...strategy,
    execution: { ...strategy.execution, executionDelayBars: 3 },
  });
  expect(result.stressResults[1]!.metrics).toEqual(
    calculatePerformanceMetrics(
      accountFills(candles, delayed, 1000, { allowShort: true }),
      attributeTrades(delayed),
    ),
  );
});

import { describe, expect, it } from "vitest";
import { InMemoryHistoricalDataSource } from "../../market-data/src/historical-source.js";
import { runHistoricalBacktest } from "./historical-backtest-runner.js";

const stressScenarios = ["BASE"] as const;

const robustnessThresholds = {
  minTotalReturnPct: -100,
  maxDrawdownPct: 100,
  minProfitFactor: 0,
  minExpectancy: -Infinity,
  minPassingScenarioRatePct: 0
};

describe("runHistoricalBacktest", () => {
  it("passes historical bars through the existing strategy backtest pipeline", async () => {
    const source = new InMemoryHistoricalDataSource(
      Array.from({ length: 40 }, (_, index) => {
        const close = 100 + index;
        return { timestamp: (index + 1) * 60_000, open: close - 0.5, high: close + 1, low: close - 1, close, volume: 1_000 + index };
      })
    );

    const result = await runHistoricalBacktest(source, {
      symbol: "SOL",
      interval: "1m",
      startTime: 60_000,
      endTime: 2_400_000
    }, {
      initialCapital: 10_000,
      strategy: { quantity: 1 },
      stressScenarios,
      robustnessThresholds
    });

    expect(result.baseline).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.stressResults).toHaveLength(1);
    expect(result.robustness).toBeDefined();
  });

  it("rejects an empty historical range", async () => {
    const source = new InMemoryHistoricalDataSource([]);

    await expect(runHistoricalBacktest(source, {
      symbol: "SOL",
      interval: "1m"
    }, {
      initialCapital: 10_000,
      strategy: { quantity: 1 },
      stressScenarios,
      robustnessThresholds
    })).rejects.toThrow("historical source returned no candles");
  });
});

import { describe, expect, it } from "vitest";
import { runWalkForwardParameterSelection } from "./walk-forward-parameter-selection.js";
import { runBacktestPipeline } from "./backtest-pipeline.js";

const strategy = {
  fastPeriod: 2,
  slowPeriod: 4,
  rsiPeriod: 2,
  momentumPeriod: 2,
  atrPeriod: 2,
  volumePeriod: 2,
  entryThreshold: 0.5,
};
const candles = Array.from({ length: 50 }, (_, index) => ({
  open: 100 + index,
  high: 101 + index,
  low: 99 + index,
  close: 100 + index,
  volume: 100,
}));
const execution = {
  executionDelayBars: 1,
  slippagePct: 0.1,
  feePct: 0.1,
  liquidityMultiplier: 1,
  volatilityMultiplier: 1,
};
const robustnessThresholds = {
  minPassingScenarioRatePct: 0,
  maxDrawdownPct: 100,
  minProfitFactor: 0,
  minExpectancy: -1000,
};
const input = {
  candles,
  initialCapital: 1000,
  candidates: [{ strategy }],
  quantity: 1,
  execution,
  stressScenarios: ["BASE", "HIGH_FEES"] as const,
  robustnessThresholds,
  walkForward: { trainingBars: 20, testingBars: 10 },
  requireStableSelection: false,
  minTrades: 0,
};

describe("parameter-selection OOS capital and terminal exposure", () => {
  it("funds each OOS window from realized prior-window capital with proportional sizing", () => {
    const result = runWalkForwardParameterSelection(input);
    let capital = input.initialCapital;
    for (const window of result.windows) {
      expect(window.test.baseline.initialCapital).toBe(capital);
      expect(window.test.fills[0]?.quantity).toBeCloseTo(
        (input.quantity * capital) / input.initialCapital,
        12,
      );
      expect(window.test.baseline.equityCurve.at(-1)?.positionQuantity).toBe(0);
      expect(window.test.stressResults[0]?.metrics).toEqual(
        window.test.metrics,
      );
      capital = window.test.baseline.finalEquity;
    }
    expect(result.outOfSample.netProfit).toBeCloseTo(
      capital - input.initialCapital,
      10,
    );
  });

  it("reconciles closed-trade PnL with aggregate OOS equity after costs", () => {
    const result = runWalkForwardParameterSelection(input);
    const trades = result.windows.flatMap((window) => window.test.trades);
    expect(trades.length).toBeGreaterThan(0);
    expect(trades.reduce((sum, trade) => sum + trade.netPnl, 0)).toBeCloseTo(
      result.outOfSample.netProfit,
      10,
    );
    expect(
      result.outOfSample.expectancy * result.outOfSample.tradeCount,
    ).toBeCloseTo(result.outOfSample.netProfit, 10);
  });

  it.each([1, -1])(
    "liquidates small terminal strategy positions for trend %i",
    (trend) => {
      const bars = candles.slice(0, 10).map((_bar, index) => {
        const price = 100 + trend * index;
        return {
          open: price,
          high: price + 1,
          low: price - 1,
          close: price,
          volume: 100,
        };
      });
      const result = runBacktestPipeline({
        candles: bars,
        initialCapital: 1,
        strategy: { quantity: 1e-10, strategy, execution },
        liquidateAtEnd: true,
        stressScenarios: ["BASE"],
        robustnessThresholds,
      });
      expect(result.fills).toHaveLength(2);
      expect(result.trades).toHaveLength(1);
      expect(result.baseline.equityCurve.at(-1)?.positionQuantity).toBe(0);
      expect(result.fills.at(-1)?.fee).toBeGreaterThan(0);
      expect(result.stressResults[0]?.metrics).toEqual(result.metrics);
    },
  );

  it("rejects a dataset with no complete OOS window instead of returning zero performance", () => {
    expect(() =>
      runWalkForwardParameterSelection({
        ...input,
        candles: candles.slice(0, 20),
      }),
    ).toThrow(/complete.*window/);
  });

  it.each([{ initialCapital: NaN }, { quantity: NaN }])(
    "validates numeric configuration even without windows: %j",
    (override) => {
      expect(() =>
        runWalkForwardParameterSelection({
          ...input,
          candles: [],
          ...override,
        }),
      ).toThrow(/positive/);
    },
  );
});

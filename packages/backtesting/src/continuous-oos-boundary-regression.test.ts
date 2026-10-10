import { describe, expect, it } from "vitest";
import { runContinuousOosSimulation } from "./continuous-oos-simulation.js";
import { generateStrategyFills } from "./strategy-execution-adapter.js";
import type { WalkForwardParameterSelectionWindow } from "./walk-forward-parameter-selection.js";

const strategy = {
  fastPeriod: 2,
  slowPeriod: 4,
  rsiPeriod: 2,
  momentumPeriod: 2,
  atrPeriod: 2,
  volumePeriod: 2,
  entryThreshold: 0.5,
};
const candles = Array.from({ length: 40 }, (_, index) => {
  const close = 100 + (index < 20 ? index : 40 - index);
  return { open: close, high: close + 1, low: close - 1, close, volume: 10 };
});
const window = (
  testStart: number,
  testEnd: number,
): WalkForwardParameterSelectionWindow => ({
  trainStart: 0,
  trainEnd: testStart,
  testStart,
  testEnd,
  selection: {
    candidates: [],
    best: {
      candidate: { strategy },
      backtest: undefined as never,
      riskAdjustedScore: 1,
      rank: 1,
    },
    scoreSpreadPct: 0,
    stable: true,
  },
  test: undefined as never,
});

describe("continuous OOS window boundaries", () => {
  it("honors an old pending target when the selected parameters change", () => {
    const next = window(12, 40);
    next.selection.best!.candidate.strategy = {
      ...strategy,
      entryThreshold: 1,
      momentumPeriod: 100,
      rsiPeriod: 100,
    };
    const execution = {
      executionDelayBars: 3,
      slippagePct: 0,
      feePct: 0,
      liquidityMultiplier: 1,
      volatilityMultiplier: 1,
    };
    const result = runContinuousOosSimulation({
      candles,
      windows: [window(10, 12), next],
      initialCapital: 10000,
      quantity: 1,
      execution,
    });
    expect(
      result.fills.map(({ side, signalIndex, executionIndex }) => ({
        side,
        signalIndex,
        executionIndex,
      })),
    ).toEqual([
      { side: "BUY", signalIndex: 1, executionIndex: 4 },
      { side: "SELL", signalIndex: 4, executionIndex: 7 },
    ]);
    expect(result.finalPosition).toBe("FLAT");
  });
  it.each([1, 3, 8])(
    "preserves history and pending fills with %i-bar delay",
    (executionDelayBars) => {
      const execution = {
        executionDelayBars,
        slippagePct: 0.1,
        feePct: 0.1,
        liquidityMultiplier: 1,
        volatilityMultiplier: 1,
      };
      const full = generateStrategyFills(candles.slice(10, 40), {
        quantity: 1,
        strategy,
        execution,
      });
      const result = runContinuousOosSimulation({
        candles,
        windows: [window(10, 12), window(12, 23), window(23, 40)],
        initialCapital: 10000,
        quantity: 1,
        execution,
      });
      expect(result.fills).toEqual(full);
      expect(
        result.fills.some(
          (fill) => fill.signalIndex < 2 && fill.executionIndex >= 2,
        ),
      ).toBe(true);
    },
  );

  it("rejects gaps instead of hiding unobserved exposure and execution time", () => {
    expect(() =>
      runContinuousOosSimulation({
        candles,
        windows: [window(10, 20), window(21, 40)],
        initialCapital: 10000,
        quantity: 1,
      }),
    ).toThrow(/contiguous/);
  });

  it.each([NaN, 10.5, Infinity])(
    "rejects invalid window index %s",
    (testStart) => {
      expect(() =>
        runContinuousOosSimulation({
          candles,
          windows: [window(testStart, 30)],
          initialCapital: 10000,
          quantity: 1,
        }),
      ).toThrow(/integer/);
    },
  );
});

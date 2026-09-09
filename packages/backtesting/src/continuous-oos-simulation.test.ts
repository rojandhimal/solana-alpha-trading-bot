import { describe, expect, it } from "vitest";
import { runContinuousOosSimulation } from "./continuous-oos-simulation.js";
import type { WalkForwardParameterSelectionWindow } from "./walk-forward-parameter-selection.js";

const strategy = {
  fastPeriod: 5,
  slowPeriod: 10,
  rsiPeriod: 5,
  momentumPeriod: 5,
  atrPeriod: 5,
  volumePeriod: 5,
  entryThreshold: 0.5
};

function candles(count: number, trend: number) {
  return Array.from({ length: count }, (_, i) => {
    const close = 100 + i * trend;
    return { open: close, high: close + 1, low: close - 1, close };
  });
}

function window(testStart: number, testEnd: number): WalkForwardParameterSelectionWindow {
  return {
    trainStart: Math.max(0, testStart - 10),
    trainEnd: testStart,
    testStart,
    testEnd,
    selection: {
      candidates: [],
      best: { candidate: { strategy }, backtest: undefined as never, riskAdjustedScore: 1, rank: 1 },
      scoreSpreadPct: 0,
      stable: true
    },
    test: undefined as never
  };
}

describe("continuous OOS simulation", () => {
  const execution = { slippagePct: 0, feePct: 0, executionDelayBars: 0, liquidityMultiplier: 1, volatilityMultiplier: 1 };

  it("rejects empty windows", () => {
    expect(() => runContinuousOosSimulation({ candles: candles(30, 1), windows: [], initialCapital: 10_000, quantity: 1 })).toThrow("at least one walk-forward window is required");
  });

  it("rejects windows outside the candle range", () => {
    expect(() => runContinuousOosSimulation({ candles: candles(30, 1), windows: [window(20, 31)], initialCapital: 10_000, quantity: 1 })).toThrow("outside candle range");
  });

  it("rejects overlapping OOS windows", () => {
    expect(() => runContinuousOosSimulation({ candles: candles(40, 1), windows: [window(10, 25), window(20, 35)], initialCapital: 10_000, quantity: 1 })).toThrow("windows overlap");
  });

  it("rejects a window without a selected strategy", () => {
    const invalidWindow = window(10, 20);
    invalidWindow.selection.best = undefined;

    expect(() => runContinuousOosSimulation({
      candles: candles(30, 1),
      windows: [invalidWindow],
      initialCapital: 10_000,
      quantity: 1,
      execution
    })).toThrow("walk-forward window has no selected strategy");
  });

  it("runs ordered non-overlapping windows and returns a continuous result", () => {
    const result = runContinuousOosSimulation({
      candles: candles(60, 1),
      windows: [window(30, 45), window(15, 30)],
      initialCapital: 10_000,
      quantity: 1,
      execution
    });

    expect(result.accounting.initialCapital).toBe(10_000);
    expect(result.accounting.equityCurve).toHaveLength(30);
    expect(result.finalPosition).toBe("LONG");
    expect(result.fills.every((fill) => fill.signalIndex >= 0 && fill.executionIndex >= 0)).toBe(true);
  });

  it("offsets fills from later OOS windows into the combined OOS timeline", () => {
    const first = runContinuousOosSimulation({
      candles: candles(60, 1),
      windows: [window(15, 30)],
      initialCapital: 10_000,
      quantity: 1,
      execution
    });
    const combined = runContinuousOosSimulation({
      candles: candles(60, 1),
      windows: [window(30, 45), window(15, 30)],
      initialCapital: 10_000,
      quantity: 1,
      execution
    });

    expect(first.fills.length).toBeGreaterThan(0);
    expect(combined.fills.length).toBeGreaterThan(first.fills.length);

    const secondWindowFills = combined.fills.filter((fill) => fill.signalIndex >= 15);
    expect(secondWindowFills.length).toBeGreaterThan(0);
    expect(secondWindowFills.every((fill) => fill.signalIndex >= 15 && fill.executionIndex >= 15)).toBe(true);
  });
});

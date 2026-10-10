import { describe, expect, it } from "vitest";
import { accountFills } from "./portfolio-accounting.js";
import { executeRequest, type ExecutionFill } from "./execution-model.js";
import { generateStrategyFills } from "./strategy-execution-adapter.js";
import { createWalkForwardWindows } from "./walk-forward.js";
import {
  PaperTradingState,
  selectRiskReducingFills,
} from "./paper-trading-state.js";
const candles = [100, 90].map((price) => ({
  open: price,
  high: price,
  low: price,
  close: price,
  volume: 100,
  timestamp: price === 100 ? 1 : 2,
}));
const fill = (
  index: number,
  side: "BUY" | "SELL",
  price: number,
  fee = 1,
): ExecutionFill => ({
  signalIndex: index,
  executionIndex: index,
  side,
  quantity: 1,
  referencePrice: price,
  fillPrice: price,
  fee,
});
describe("accounting and execution security regressions", () => {
  it("short entry fees reconcile open and closed PnL to equity", () => {
    const result = accountFills(
      candles,
      [fill(0, "SELL", 100), fill(1, "BUY", 90)],
      1000,
      { allowShort: true },
    );
    expect(result.equityCurve[0]!.unrealizedPnl).toBe(-1);
    expect(result.realizedPnl).toBe(8);
    expect(result.netProfit).toBe(8);
  });
  it("rejects ignored future fills and negative or nonfinite fees", () => {
    expect(() => accountFills(candles, [fill(2, "BUY", 100)], 1000)).toThrow();
    for (const fee of [-1, NaN, Infinity])
      expect(() =>
        accountFills(candles, [fill(0, "BUY", 100, fee)], 1000),
      ).toThrow();
  });
  it("rejects nonfinite execution costs and invalid sell fill prices", () => {
    const base = {
      executionDelayBars: 0,
      slippagePct: 0,
      feePct: 0,
      liquidityMultiplier: 1,
      volatilityMultiplier: 1,
    };
    expect(() =>
      executeRequest(
        candles,
        { signalIndex: 0, side: "BUY", quantity: 1 },
        { ...base, feePct: NaN },
      ),
    ).toThrow();
    expect(() =>
      executeRequest(
        candles,
        { signalIndex: 0, side: "SELL", quantity: 1 },
        { ...base, slippagePct: 100 },
      ),
    ).toThrow();
  });
  it("strategy decisions always execute after their completed signal candle", () => {
    const trend = Array.from({ length: 60 }, (_, i) => ({
      open: 100 + i,
      high: 101 + i,
      low: 99 + i,
      close: 100 + i,
      volume: 100,
    }));
    const fills = generateStrategyFills(trend, {
      quantity: 1,
      execution: {
        executionDelayBars: 0,
        slippagePct: 0,
        feePct: 0,
        liquidityMultiplier: 1,
        volatilityMultiplier: 1,
      },
    });
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every((f) => f.executionIndex > f.signalIndex)).toBe(true);
    const prefix = generateStrategyFills(trend.slice(0, 40), { quantity: 1 });
    expect(
      fills.filter((f) => f.executionIndex < 40).map((f) => f.signalIndex),
    ).toEqual(prefix.map((f) => f.signalIndex));
  });
  it("rejects overlapping OOS windows", () => {
    expect(() =>
      createWalkForwardWindows(100, {
        trainingBars: 20,
        testingBars: 10,
        stepBars: 5,
      }),
    ).toThrow(/overlap/);
  });
  it("halt reductions cannot cross through zero with a smaller opposite position", () => {
    expect(
      selectRiskReducingFills([{ ...fill(0, "SELL", 100), quantity: 1.5 }], 1),
    ).toEqual([]);
  });
  it("paper state rejects invalid OHLC and inconsistent timestamps", () => {
    const state = new PaperTradingState({
      initialCapital: 1000,
      execution: { quantity: 1 },
    });
    expect(() => state.append({ ...candles[0]!, high: 90 })).toThrow(/bounds/);
    expect(state.snapshot().candleCount).toBe(0);
    state.append(candles[0]!);
    expect(() =>
      state.append({ open: 100, high: 100, low: 100, close: 100, volume: 1 }),
    ).toThrow(/consistently/);
    expect(() => state.append({ ...candles[1]!, timestamp: NaN })).toThrow(
      /timestamp/,
    );
  });
});

describe("delayed replay and risk timing", () => {
  it("keeps delayed prefix fills identical to full replay", () => {
    const input = Array.from({ length: 80 }, (_, i) => {
      const close = 100 + 10 * Math.sin(i / 4);
      return {
        timestamp: i + 1,
        open: close,
        high: close + 1,
        low: close - 1,
        close,
        volume: 100,
      };
    });
    const execution = {
      quantity: 1,
      strategy: {
        fastPeriod: 2,
        slowPeriod: 5,
        rsiPeriod: 2,
        momentumPeriod: 2,
        atrPeriod: 2,
        volumePeriod: 2,
        entryThreshold: 0.4,
      },
      execution: {
        executionDelayBars: 3,
        slippagePct: 0.1,
        feePct: 0.1,
        liquidityMultiplier: 1,
        volatilityMultiplier: 1,
      },
    };
    const full = generateStrategyFills(input, execution);
    expect(full.length).toBeGreaterThan(2);
    const state = new PaperTradingState({
      initialCapital: 10000,
      execution,
      allowShort: true,
      riskLimits: { maxDrawdownPct: 100, maxPositionNotionalPct: 1000 },
    });
    for (let length = 1; length <= input.length; length++) {
      state.append(input[length - 1]!);
      expect(generateStrategyFills(input.slice(0, length), execution)).toEqual(
        full.filter((f) => f.executionIndex < length),
      );
      expect(state.getFills()).toEqual(
        full.filter((f) => f.executionIndex < length),
      );
    }
    expect(state.snapshot().accounting).toEqual(
      accountFills(input, full, 10000, { allowShort: true }),
    );
  });
  it("marks the execution close after opening rather than using it to reject the opening", () => {
    const execution = {
      quantity: 1,
      strategy: {
        fastPeriod: 2,
        slowPeriod: 3,
        rsiPeriod: 2,
        momentumPeriod: 2,
        atrPeriod: 2,
        volumePeriod: 2,
        entryThreshold: 0.4,
      },
      execution: {
        executionDelayBars: 1,
        slippagePct: 0,
        feePct: 0,
        liquidityMultiplier: 1,
        volatilityMultiplier: 1,
      },
    };
    const state = new PaperTradingState({
      initialCapital: 1000,
      execution,
      riskLimits: { maxDrawdownPct: 1, maxPositionNotionalPct: 100 },
    });
    state.append({
      timestamp: 1,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 100,
    });
    state.append({
      timestamp: 2,
      open: 101,
      high: 101,
      low: 101,
      close: 101,
      volume: 100,
    });
    const result = state.append({
      timestamp: 3,
      open: 102,
      high: 102,
      low: 50,
      close: 50,
      volume: 100,
    });
    expect(result.fillCount).toBe(1);
    expect(result.risk.halted).toBe(true);
    expect(result.accounting.finalEquity).toBe(948);
  });
});
it("reconciles a long-to-short reversal including allocated fees", () => {
  const result = accountFills(
    candles,
    [fill(0, "BUY", 100), { ...fill(1, "SELL", 90), quantity: 2 }],
    1000,
    { allowShort: true },
  );
  const last = result.equityCurve.at(-1)!;
  expect(last.positionQuantity).toBe(-1);
  expect(last.realizedPnl).toBeCloseTo(-11.5);
  expect(last.unrealizedPnl).toBeCloseTo(-0.5);
  expect(result.netProfit).toBeCloseTo(-12);
});
it("vetoes actual entry signals above the exposure ceiling and latches the halt", () => {
  const state = new PaperTradingState({
    initialCapital: 10000,
    execution: { quantity: 50 },
    riskLimits: { maxPositionNotionalPct: 0.01 },
  });
  for (let i = 0; i < 40; i++)
    state.append({
      timestamp: i + 1,
      open: 100 + i,
      high: 101 + i,
      low: 99 + i,
      close: 100 + i,
      volume: 100,
    });
  expect(state.getFills()).toHaveLength(0);
  expect(state.snapshot().risk.halted).toBe(true);
  expect(state.snapshot().risk.reasons.join(" ")).toContain(
    "position notional",
  );
});
it("a halted session permits a real closing fill but blocks its reversal leg and all later entries", () => {
  const state = new PaperTradingState({
    initialCapital: 10000,
    execution: { quantity: 1 },
    allowShort: true,
  });
  for (let i = 0; i < 10; i++)
    state.append({
      timestamp: i + 1,
      open: 100 + i,
      high: 101 + i,
      low: 99 + i,
      close: 100 + i,
      volume: 100,
    });
  expect(state.snapshot().accounting.equityCurve.at(-1)!.positionQuantity).toBe(
    1,
  );
  state.halt("operator kill switch");
  for (let i = 10; i < 40; i++) {
    const price = 110 - (i - 9);
    state.append({
      timestamp: i + 1,
      open: price,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 100,
    });
  }
  expect(state.snapshot().risk.halted).toBe(true);
  expect(state.snapshot().accounting.equityCurve.at(-1)!.positionQuantity).toBe(
    0,
  );
  expect(state.getFills()).toHaveLength(2);
  expect(state.getFills()[1]!.side).toBe("SELL");
});

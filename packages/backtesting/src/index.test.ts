import { describe, expect, it } from "vitest";
import { runBacktest, type BacktestBar } from "./index.js";

const bars: BacktestBar[] = [
  { timestamp: 1, symbol: "TEST", price: 100, signalApproved: true, stopPrice: 95 },
  { timestamp: 2, symbol: "TEST", price: 110, signalApproved: false, stopPrice: 95 },
  { timestamp: 3, symbol: "TEST", price: 110, signalApproved: false, stopPrice: 95 }
];

describe("backtest engine", () => {
  it("executes approved entries and exits on signal loss", () => {
    const result = runBacktest(bars, { initialCash: 1_000, positionSizePct: 50, feePct: 0, slippagePct: 0 });
    expect(result.trades).toHaveLength(1);
    expect(result.finalEquity).toBe(1_050);
    expect(result.totalReturnPct).toBe(5);
    expect(result.winRatePct).toBe(100);
    expect(result.profitFactor).toBe(Infinity);
  });

  it("includes fees and slippage in the result", () => {
    const result = runBacktest(bars, { initialCash: 1_000, positionSizePct: 50, feePct: 1, slippagePct: 1 });
    expect(result.finalEquity).toBeLessThan(1_050);
    expect(result.trades[0]?.fees).toBeGreaterThan(0);
  });

  it("reports zero-trade performance safely", () => {
    const result = runBacktest([{ timestamp: 1, symbol: "TEST", price: 100, signalApproved: false, stopPrice: 95 }], { initialCash: 1_000, positionSizePct: 50, feePct: 0.25, slippagePct: 0.25 });
    expect(result.trades).toHaveLength(0);
    expect(result.totalReturnPct).toBe(0);
    expect(result.profitFactor).toBe(0);
    expect(result.expectancy).toBe(0);
  });
});

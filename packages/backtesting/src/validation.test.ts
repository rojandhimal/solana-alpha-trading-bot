import { describe, expect, it } from "vitest";
import { validateBacktest } from "./validation.js";

const thresholds = { minTrades: 30, minProfitFactor: 1.2, minExpectancy: 0, maxDrawdownPct: 20, minWinRatePct: 45 };

const strong = { totalReturnPct: 25, maxDrawdownPct: 12, winRatePct: 55, profitFactor: 1.6, expectancy: 12, tradeCount: 100 };

describe("backtest validation", () => {
  it("passes a robust result", () => {
    expect(validateBacktest(strong, thresholds)).toEqual({ passed: true, failures: [] });
  });

  it("fails insufficient trades", () => {
    const result = validateBacktest({ ...strong, tradeCount: 10 }, thresholds);
    expect(result.failures).toContain("INSUFFICIENT_TRADES");
    expect(result.passed).toBe(false);
  });

  it("fails negative expectancy and excessive drawdown", () => {
    const result = validateBacktest({ ...strong, expectancy: -2, maxDrawdownPct: 25 }, thresholds);
    expect(result.failures).toContain("EXPECTANCY_NOT_POSITIVE");
    expect(result.failures).toContain("DRAWDOWN_TOO_HIGH");
  });

  it("fails weak profit factor and win rate", () => {
    const result = validateBacktest({ ...strong, profitFactor: 1.05, winRatePct: 40 }, thresholds);
    expect(result.failures).toContain("PROFIT_FACTOR_TOO_LOW");
    expect(result.failures).toContain("WIN_RATE_TOO_LOW");
  });
});

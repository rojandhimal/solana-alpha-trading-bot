import { describe, expect, it } from "vitest";
import { evaluatePortfolioGuard } from "./portfolio-guard.js";

const config = { maxDailyLossPct: 5, maxDrawdownPct: 10, maxOpenPositions: 3 };

describe("portfolio guard", () => {
  it("allows trading inside all limits", () => {
    expect(evaluatePortfolioGuard(9_800, { startingDayEquity: 10_000, peakEquity: 10_000, openPositions: 1 }, config).allowed).toBe(true);
  });

  it("halts at the daily loss limit", () => {
    const result = evaluatePortfolioGuard(9_500, { startingDayEquity: 10_000, peakEquity: 10_000, openPositions: 1 }, config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("DAILY_LOSS_LIMIT");
  });

  it("halts at maximum drawdown", () => {
    const result = evaluatePortfolioGuard(8_900, { startingDayEquity: 10_000, peakEquity: 10_000, openPositions: 1 }, config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("MAX_DRAWDOWN");
  });

  it("halts when the position count is full", () => {
    const result = evaluatePortfolioGuard(10_000, { startingDayEquity: 10_000, peakEquity: 10_000, openPositions: 3 }, config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("MAX_OPEN_POSITIONS");
  });
});

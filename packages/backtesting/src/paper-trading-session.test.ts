import { describe, expect, it } from "vitest";
import { runPaperTradingSession } from "./paper-trading-session.js";
import type { StrategyCandle } from "./alpha-strategy.js";

const candles: StrategyCandle[] = Array.from({ length: 40 }, (_, index) => ({
  open: 100 + index,
  high: 101 + index,
  low: 99 + index,
  close: 100 + index,
  volume: 1_000
}));

describe("runPaperTradingSession", () => {
  it("reuses the strategy pipeline and returns accounting plus risk telemetry", () => {
    const result = runPaperTradingSession(candles, {
      initialCapital: 10_000,
      execution: {
        quantity: 1,
        strategy: {
          fastPeriod: 5,
          slowPeriod: 10,
          rsiPeriod: 5,
          momentumPeriod: 5,
          atrPeriod: 5,
          volumePeriod: 5,
          entryThreshold: 0.5
        }
      }
    });

    expect(result.accounting.initialCapital).toBe(10_000);
    expect(result.accounting.equityCurve.length).toBe(candles.length);
    expect(result.risk.halted).toBe(false);
    expect(result.risk.maxObservedDrawdownPct).toBeGreaterThanOrEqual(0);
    expect(result.risk.maxObservedPositionNotionalPct).toBeGreaterThanOrEqual(0);
  });

  it("halts when observed drawdown exceeds the configured limit", () => {
    const result = runPaperTradingSession(candles, {
      initialCapital: 10_000,
      execution: {
        quantity: 1,
        strategy: {
          fastPeriod: 5,
          slowPeriod: 10,
          rsiPeriod: 5,
          momentumPeriod: 5,
          atrPeriod: 5,
          volumePeriod: 5,
          entryThreshold: 0.5
        }
      },
      riskLimits: { maxDrawdownPct: 0 }
    });

    expect(result.risk.halted).toBe(result.risk.maxObservedDrawdownPct > 0);
  });

  it("validates capital and risk limits", () => {
    expect(() => runPaperTradingSession(candles, {
      initialCapital: 0,
      execution: { quantity: 1 }
    })).toThrow("initialCapital must be positive");

    expect(() => runPaperTradingSession(candles, {
      initialCapital: 10_000,
      execution: { quantity: 1 },
      riskLimits: { maxDrawdownPct: 101 }
    })).toThrow("maxDrawdownPct must be between 0 and 100");
  });
});

import { describe, expect, it } from "vitest";
import { simulateExecutionStress } from "./execution-stress.js";

describe("execution stress", () => {
  const params = (overrides = {}) => ({
    slippageMultiplier: 1,
    feeMultiplier: 1,
    liquidityMultiplier: 1,
    executionDelayBars: 0,
    volatilityMultiplier: 1,
    ...overrides
  });

  it("reduces long-trade pnl when liquidity and slippage worsen", () => {
    const trades = [{ entryPrice: 100, exitPrice: 102, quantity: 1, side: "LONG" as const }];
    const base = simulateExecutionStress(trades, params());
    const stressed = simulateExecutionStress(trades, params({ slippageMultiplier: 3, liquidityMultiplier: 0.5 }));
    expect(stressed.metrics.totalReturnPct).toBeLessThan(base.metrics.totalReturnPct);
  });

  it("increases fee drag under fee stress", () => {
    const trades = [{ entryPrice: 100, exitPrice: 102, quantity: 1, side: "LONG" as const }];
    const base = simulateExecutionStress(trades, params());
    const stressed = simulateExecutionStress(trades, params({ feeMultiplier: 2 }));
    expect(stressed.metrics.totalReturnPct).toBeLessThan(base.metrics.totalReturnPct);
  });

  it("makes execution delay and volatility shocks increase adverse slippage", () => {
    const trades = [{ entryPrice: 100, exitPrice: 102, quantity: 1, side: "LONG" as const }];
    const base = simulateExecutionStress(trades, params());
    const delayed = simulateExecutionStress(trades, params({ executionDelayBars: 2 }));
    const volatile = simulateExecutionStress(trades, params({ volatilityMultiplier: 2 }));
    expect(delayed.metrics.totalReturnPct).toBeLessThan(base.metrics.totalReturnPct);
    expect(volatile.metrics.totalReturnPct).toBeLessThan(base.metrics.totalReturnPct);
  });

  it("rejects invalid liquidity, delay, and volatility parameters", () => {
    const trades = [{ entryPrice: 100, exitPrice: 102, quantity: 1, side: "LONG" as const }];
    expect(() => simulateExecutionStress(trades, params({ liquidityMultiplier: 0 }))).toThrow();
    expect(() => simulateExecutionStress(trades, params({ executionDelayBars: -1 }))).toThrow();
    expect(() => simulateExecutionStress(trades, params({ volatilityMultiplier: 0 }))).toThrow();
  });

  it("calculates drawdown from the stressed equity curve", () => {
    const trades = [
      { entryPrice: 100, exitPrice: 110, quantity: 1, side: "LONG" as const },
      { entryPrice: 110, exitPrice: 90, quantity: 1, side: "LONG" as const }
    ];
    const result = simulateExecutionStress(trades, params(), 0, 0, 100);
    expect(result.equityCurve).toEqual([100, 110, 90]);
    expect(result.metrics.maxDrawdownPct).toBeCloseTo(18.1818, 3);
  });
});

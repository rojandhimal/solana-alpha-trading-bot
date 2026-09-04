import { describe, expect, it } from "vitest";
import { simulateExecutionStress } from "./execution-stress.js";

describe("execution stress", () => {
  it("reduces long-trade pnl when slippage increases", () => {
    const trades = [{ entryPrice: 100, exitPrice: 102, quantity: 1, side: "LONG" as const }];
    const base = simulateExecutionStress(trades, { slippageMultiplier: 1, feeMultiplier: 1, liquidityMultiplier: 1, executionDelayBars: 0, volatilityMultiplier: 1 });
    const stressed = simulateExecutionStress(trades, { slippageMultiplier: 3, feeMultiplier: 1, liquidityMultiplier: 0.5, executionDelayBars: 0, volatilityMultiplier: 1 });
    expect(stressed.metrics.totalReturnPct).toBeLessThan(base.metrics.totalReturnPct);
  });

  it("increases fee drag under fee stress", () => {
    const trades = [{ entryPrice: 100, exitPrice: 102, quantity: 1, side: "LONG" as const }];
    const base = simulateExecutionStress(trades, { slippageMultiplier: 1, feeMultiplier: 1, liquidityMultiplier: 1, executionDelayBars: 0, volatilityMultiplier: 1 });
    const stressed = simulateExecutionStress(trades, { slippageMultiplier: 1, feeMultiplier: 2, liquidityMultiplier: 1, executionDelayBars: 0, volatilityMultiplier: 1 });
    expect(stressed.metrics.totalReturnPct).toBeLessThan(base.metrics.totalReturnPct);
  });
});

import { describe, expect, it } from "vitest";
import { runMonteCarloTradeRobustness } from "./monte-carlo-trade-robustness.js";
import type { CompletedTrade } from "./trade-attribution.js";

function trade(netPnl: number): CompletedTrade {
  return { entryIndex: 0, exitIndex: 1, side: "LONG", quantity: 1, entryReferencePrice: 100, exitReferencePrice: 100, entryPrice: 100, exitPrice: 100, entryFee: 0, exitFee: 0, grossPnl: netPnl, netPnl, returnPct: netPnl, holdingBars: 1 };
}

describe("Monte Carlo trade robustness", () => {
  it("is deterministic for a fixed seed", () => {
    const input = { trades: [trade(100), trade(-40), trade(60), trade(-10)], initialCapital: 1_000, simulations: 250, seed: 42 };
    expect(runMonteCarloTradeRobustness(input)).toEqual(runMonteCarloTradeRobustness(input));
  });

  it("preserves total PnL while measuring order-dependent drawdown", () => {
    const result = runMonteCarloTradeRobustness({ trades: [trade(100), trade(-80), trade(50)], initialCapital: 1_000, simulations: 100, seed: 7 });
    expect(result.medianFinalCapital).toBe(1_070);
    expect(result.percentile5FinalCapital).toBe(1_070);
    expect(result.percentile95FinalCapital).toBe(1_070);
    expect(result.medianMaxDrawdownPct).toBeGreaterThan(0);
    expect(result.percentile95MaxDrawdownPct).toBeGreaterThanOrEqual(result.medianMaxDrawdownPct);
  });

  it("reports loss probability when every trade loses", () => {
    const result = runMonteCarloTradeRobustness({ trades: [trade(-10), trade(-20)], initialCapital: 1_000, simulations: 25 });
    expect(result.probabilityOfLossPct).toBe(100);
    expect(result.percentile95FinalCapital).toBe(970);
  });

  it("rejects invalid inputs", () => {
    expect(() => runMonteCarloTradeRobustness({ trades: [], initialCapital: 1_000 })).toThrow("at least one completed trade is required");
    expect(() => runMonteCarloTradeRobustness({ trades: [trade(1)], initialCapital: 0 })).toThrow("initialCapital must be positive");
    expect(() => runMonteCarloTradeRobustness({ trades: [trade(1)], initialCapital: 1_000, simulations: 0 })).toThrow("simulations must be a positive integer");
  });
});

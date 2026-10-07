import { describe, expect, it } from "vitest";
import { bootstrapMeanConfidenceInterval, monteCarloTradeSequence } from "./statistical-robustness.js";

describe("statistical robustness", () => {
  it("produces deterministic bootstrap confidence intervals", () => {
    const input = [1, 2, 3, 4, 5];
    expect(bootstrapMeanConfidenceInterval(input, { samples: 500, seed: 7 })).toEqual(
      bootstrapMeanConfidenceInterval(input, { samples: 500, seed: 7 })
    );
  });

  it("rejects insufficient samples", () => {
    expect(() => bootstrapMeanConfidenceInterval([1])).toThrow("at least two returns");
  });

  it("produces deterministic Monte Carlo risk estimates", () => {
    const result = monteCarloTradeSequence([2, -1, 3, -2, 1], { simulations: 500, seed: 9 });
    expect(result.simulations).toBe(500);
    expect(result.probabilityOfLossPct).toBeGreaterThanOrEqual(0);
    expect(result.probabilityOfLossPct).toBeLessThanOrEqual(100);
    expect(result.upperMaxDrawdownPct).toBeGreaterThanOrEqual(result.medianMaxDrawdownPct);
    expect(result).toEqual(monteCarloTradeSequence([2, -1, 3, -2, 1], { simulations: 500, seed: 9 }));
  });
});

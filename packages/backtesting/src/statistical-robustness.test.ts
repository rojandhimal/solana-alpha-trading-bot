import { describe, expect, it } from "vitest";
import { bootstrapMeanConfidenceInterval, monteCarloTradeSequence } from "./statistical-robustness.js";

describe("statistical robustness", () => {
  it("produces deterministic bootstrap confidence intervals", () => {
    const input = [1, 2, 3, 4, 5];
    expect(bootstrapMeanConfidenceInterval(input, { samples: 500, seed: 7 })).toEqual(
      bootstrapMeanConfidenceInterval(input, { samples: 500, seed: 7 })
    );
  });

  it("rejects insufficient samples and impossible simple returns", () => {
    expect(() => bootstrapMeanConfidenceInterval([1])).toThrow("at least two returns");
    expect(() => bootstrapMeanConfidenceInterval([1, -100])).toThrow("greater than -100 percent");
    expect(() => monteCarloTradeSequence([1, -100])).toThrow("greater than -100 percent");
  });

  it("validates deterministic seeds", () => {
    expect(() => bootstrapMeanConfidenceInterval([1, 2], { seed: Number.NaN })).toThrow("seed must be a finite integer");
    expect(() => monteCarloTradeSequence([1, 2], { seed: 1.5 })).toThrow("seed must be a finite integer");
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

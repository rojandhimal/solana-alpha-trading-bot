import { describe, expect, it } from "vitest";
import { calculatePrecisionScore } from "./index.js";

describe("calculatePrecisionScore", () => {
  const strong = {
    safetyScore: 95,
    liquidityScore: 90,
    holderRiskScore: 85,
    exitabilityScore: 90,
    momentumScore: 85,
    flowScore: 88,
    volatilityScore: 75,
    marketRegimeScore: 80,
    dataQualityScore: 95,
    hardVeto: false
  };

  it("accepts a strong candidate", () => {
    const result = calculatePrecisionScore(strong);
    expect(result.signalScore).toBeGreaterThanOrEqual(80);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(70);
    expect(result.decision).toBe("BUY_CANDIDATE");
  });

  it("never allows a hard veto to become a buy", () => {
    const result = calculatePrecisionScore({ ...strong, hardVeto: true });
    expect(result.decision).toBe("REJECT");
    expect(result.reasons).toContain("HARD_SAFETY_VETO");
  });

  it("rejects critically weak liquidity", () => {
    const result = calculatePrecisionScore({ ...strong, liquidityScore: 10 });
    expect(result.decision).toBe("REJECT");
  });

  it("reduces confidence when data quality is poor", () => {
    const result = calculatePrecisionScore({ ...strong, dataQualityScore: 20 });
    expect(result.confidenceScore).toBeLessThan(70);
    expect(result.decision).not.toBe("BUY_CANDIDATE");
  });

  it("clamps out-of-range inputs", () => {
    const result = calculatePrecisionScore({
      ...strong,
      safetyScore: 1000,
      liquidityScore: -100,
      dataQualityScore: 1000
    });
    expect(result.signalScore).toBeGreaterThanOrEqual(0);
    expect(result.signalScore).toBeLessThanOrEqual(100);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(100);
  });
});

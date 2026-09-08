import { describe, expect, it } from "vitest";
import { SOLANA_EXPERIMENT_CONFIG } from "./solana-experiment-config.js";

describe("SOLANA_EXPERIMENT_CONFIG", () => {
  it("uses a deterministic SOL identity and historical query", () => {
    expect(SOLANA_EXPERIMENT_CONFIG.symbol).toBe("So11111111111111111111111111111111111111112");
    expect(SOLANA_EXPERIMENT_CONFIG.query.symbol).toBe(SOLANA_EXPERIMENT_CONFIG.symbol);
    expect(SOLANA_EXPERIMENT_CONFIG.query.interval).toBe("1H");
    expect(SOLANA_EXPERIMENT_CONFIG.query.startTime).toBe(1735689600000);
    expect(SOLANA_EXPERIMENT_CONFIG.query.endTime).toBe(1767225599000);
  });

  it("keeps research capital, walk-forward and stress settings deterministic", () => {
    expect(SOLANA_EXPERIMENT_CONFIG.initialCapital).toBe(10_000);
    expect(SOLANA_EXPERIMENT_CONFIG.walkForward).toEqual({
      trainingBars: 90 * 24,
      testingBars: 30 * 24,
      stepBars: 30 * 24
    });
    expect(SOLANA_EXPERIMENT_CONFIG.stressScenarios).toEqual([
      "BASE",
      "HIGH_SLIPPAGE",
      "HIGH_FEES",
      "LIQUIDITY_SHOCK",
      "EXECUTION_DELAY",
      "VOLATILITY_SHOCK"
    ]);
  });

  it("does not embed credentials", () => {
    const serialized = JSON.stringify(SOLANA_EXPERIMENT_CONFIG);
    expect(serialized).not.toMatch(/api[-_]?key|secret|token/i);
  });
});

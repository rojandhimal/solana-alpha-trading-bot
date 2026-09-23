import { describe, expect, it } from "vitest";
import {
  SOLANA_EXPERIMENT_CONFIG,
  SOL_BASELINE_STRATEGY,
  SOL_GECKOTERMINAL_POOL_ADDRESS,
  SOL_RESEARCH_EXPECTED_INTERVAL_MS
} from "./solana-experiment-config.js";

describe("SOLANA_EXPERIMENT_CONFIG", () => {
  it("uses a deterministic SOL identity and historical query", () => {
    expect(SOLANA_EXPERIMENT_CONFIG.symbol).toBe("So11111111111111111111111111111111111111112");
    expect(SOLANA_EXPERIMENT_CONFIG.query.symbol).toBe(SOLANA_EXPERIMENT_CONFIG.symbol);
    expect(SOLANA_EXPERIMENT_CONFIG.query.interval).toBe("1H");
    expect(SOLANA_EXPERIMENT_CONFIG.query.startTime).toBe(1735689600000);
    expect(SOLANA_EXPERIMENT_CONFIG.query.endTime).toBe(1767222000000);
  });

  it("pins the historical GeckoTerminal pool identity and complete-hour quality gate", () => {
    expect(SOL_GECKOTERMINAL_POOL_ADDRESS).toBe("58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2");
    expect(SOLANA_EXPERIMENT_CONFIG.dataQuality).toEqual({ expectedIntervalMs: SOL_RESEARCH_EXPECTED_INTERVAL_MS, maxGapCount: 0 });
  });

  it("keeps research capital, walk-forward, strategy and stress settings deterministic", () => {
    expect(SOLANA_EXPERIMENT_CONFIG.initialCapital).toBe(10_000);
    expect(SOLANA_EXPERIMENT_CONFIG.walkForward).toEqual({ trainingBars: 90 * 24, testingBars: 30 * 24, stepBars: 30 * 24 });
    expect(SOL_BASELINE_STRATEGY).toEqual({ fastPeriod: 10, slowPeriod: 30, rsiPeriod: 14, momentumPeriod: 10, atrPeriod: 14, volumePeriod: 20, entryThreshold: 0.5 });
    expect(SOLANA_EXPERIMENT_CONFIG.stressScenarios).toEqual(["BASE", "HIGH_SLIPPAGE", "HIGH_FEES", "LIQUIDITY_SHOCK", "EXECUTION_DELAY", "VOLATILITY_SHOCK"]);
  });

  it("does not embed credentials", () => {
    const serialized = JSON.stringify(SOLANA_EXPERIMENT_CONFIG);
    expect(serialized).not.toMatch(/api[-_]?key|secret|token/i);
  });
});

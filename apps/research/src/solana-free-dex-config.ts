import { createSolHistoricalExperimentConfig } from "../../../packages/backtesting/src/index.js";

export const SOL_FREE_DEX_EXPERIMENT_ID = "SOLANA_FREE_RECENT_DEX_2026_MAY_SEP";
export const SOL_FREE_DEX_START_MS = Date.parse("2026-05-01T00:00:00.000Z");
export const SOL_FREE_DEX_END_MS = Date.parse("2026-09-30T23:00:00.000Z");
export const SOL_FREE_DEX_DEFAULT_OUTPUT =
  "solana-free-recent-dex-experiment.json";

/** A separate fixed supplemental period; the required 2025 preset stays unchanged. */
export function createSolFreeRecentDexExperimentConfig() {
  const base = createSolHistoricalExperimentConfig();
  return {
    ...base,
    query: {
      ...base.query,
      startTime: SOL_FREE_DEX_START_MS,
      endTime: SOL_FREE_DEX_END_MS,
    },
  };
}

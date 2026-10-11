import { GeckoTerminalOhlcvSource } from "../../../packages/market-data/src/geckoterminal-ohlcv.js";
import type { HistoricalDataSource } from "../../../packages/market-data/src/historical-source.js";
import { SOL_GECKOTERMINAL_POOL_ADDRESS } from "../../../packages/backtesting/src/index.js";
import { writeResearchReport } from "./research-report.js";
import {
  createSolFreeRecentDexExperimentConfig,
  SOL_FREE_DEX_DEFAULT_OUTPUT,
  SOL_FREE_DEX_EXPERIMENT_ID,
} from "./solana-free-dex-config.js";

export interface SolFreeDexExperimentOptions {
  outputPath?: string;
  cachedDatasetPath?: string;
  source?: HistoricalDataSource;
}

export async function runSolFreeRecentDexExperiment(
  options: SolFreeDexExperimentOptions = {},
) {
  const config = createSolFreeRecentDexExperimentConfig();
  return writeResearchReport({
    source:
      options.source ??
      new GeckoTerminalOhlcvSource({
        poolAddress: SOL_GECKOTERMINAL_POOL_ADDRESS,
        tokenAddress: config.query.symbol,
        minRequestIntervalMs: 6500,
      }),
    config,
    outputPath: options.outputPath ?? SOL_FREE_DEX_DEFAULT_OUTPUT,
    ...(options.cachedDatasetPath
      ? { cachedDatasetPath: options.cachedDatasetPath }
      : {}),
    provider: "GeckoTerminal public API",
    marketKind: "SOLANA_DEX_POOL",
    identity: SOL_GECKOTERMINAL_POOL_ADDRESS,
    volumeSemantics: "USD volume",
    experiment: {
      id: SOL_FREE_DEX_EXPERIMENT_ID,
      purpose: "SUPPLEMENTAL_RECENT_DEX",
      required2025GateSatisfied: false,
    },
  });
}

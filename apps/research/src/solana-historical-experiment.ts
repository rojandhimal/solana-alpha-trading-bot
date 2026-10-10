import "dotenv/config";
import { GeckoTerminalOhlcvSource } from "../../../packages/market-data/src/geckoterminal-ohlcv.js";
import {
  createSolHistoricalExperimentConfig,
  SOL_GECKOTERMINAL_POOL_ADDRESS,
} from "../../../packages/backtesting/src/index.js";
import { writeResearchReport } from "./research-report.js";
const base = createSolHistoricalExperimentConfig();
const config = base;
const outputPath =
  process.env.SOL_EXPERIMENT_OUTPUT?.trim() ||
  "solana-historical-experiment.json";
const result = await writeResearchReport({
  ...(process.env.SOL_DATASET_FILE
    ? { cachedDatasetPath: process.env.SOL_DATASET_FILE }
    : {}),
  source: new GeckoTerminalOhlcvSource({
    poolAddress: SOL_GECKOTERMINAL_POOL_ADDRESS,
  }),
  config,
  outputPath,
  provider: "GeckoTerminal public API",
  marketKind: "SOLANA_DEX_POOL",
  identity: SOL_GECKOTERMINAL_POOL_ADDRESS,
  volumeSemantics: "USD volume",
});
console.log(
  `Research report written to ${outputPath}; validation exit code ${result.exitCode}`,
);
process.exitCode = result.exitCode;

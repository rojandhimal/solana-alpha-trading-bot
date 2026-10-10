import "dotenv/config";
import { CoinbaseOhlcvSource } from "../../../packages/market-data/src/coinbase-ohlcv.js";
import { createSolHistoricalExperimentConfig } from "../../../packages/backtesting/src/index.js";
import { writeResearchReport } from "./research-report.js";
const base = createSolHistoricalExperimentConfig();
const config = {
  ...base,
  symbol: "SOL-USD",
  query: { ...base.query, symbol: "SOL-USD" },
};
const outputPath =
  process.env.SOL_COINBASE_EXPERIMENT_OUTPUT?.trim() ||
  "solana-coinbase-historical-experiment.json";
const result = await writeResearchReport({
  ...(process.env.SOL_DATASET_FILE
    ? { cachedDatasetPath: process.env.SOL_DATASET_FILE }
    : {}),
  source: new CoinbaseOhlcvSource({ productId: "SOL-USD" }),
  config,
  outputPath,
  provider: "Coinbase Advanced Trade public candles",
  marketKind: "CEX_BENCHMARK",
  identity: "SOL-USD",
  volumeSemantics: "base volume SOL",
});
console.log(
  `Research report written to ${outputPath}; validation exit code ${result.exitCode}`,
);
process.exitCode = result.exitCode;

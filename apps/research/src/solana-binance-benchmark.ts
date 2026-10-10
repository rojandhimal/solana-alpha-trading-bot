import "dotenv/config";
import { BinanceOhlcvSource } from "../../../packages/market-data/src/binance-ohlcv.js";
import { createSolHistoricalExperimentConfig } from "../../../packages/backtesting/src/index.js";
import { writeResearchReport } from "./research-report.js";
const base = createSolHistoricalExperimentConfig();
const config = {
  ...base,
  symbol: "SOLUSDT",
  query: { ...base.query, symbol: "SOLUSDT" },
};
const outputPath =
  process.env.SOL_BINANCE_EXPERIMENT_OUTPUT?.trim() ||
  "solana-binance-historical-experiment.json";
const result = await writeResearchReport({
  ...(process.env.SOL_DATASET_FILE
    ? { cachedDatasetPath: process.env.SOL_DATASET_FILE }
    : {}),
  source: new BinanceOhlcvSource({ symbol: "SOLUSDT" }),
  config,
  outputPath,
  provider: "Binance public market data",
  marketKind: "CEX_BENCHMARK",
  identity: "SOLUSDT",
  volumeSemantics: "quote volume USDT",
});
console.log(
  `Research report written to ${outputPath}; validation exit code ${result.exitCode}`,
);
process.exitCode = result.exitCode;

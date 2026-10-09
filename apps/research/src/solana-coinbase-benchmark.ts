import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { CoinbaseOhlcvSource } from "../../../packages/market-data/src/coinbase-ohlcv.js";
import {
  createSolHistoricalExperimentConfig,
  runHistoricalExperiment,
  summarizeHistoricalExperiment,
  evaluatePreDashboardGates
} from "../../../packages/backtesting/src/index.js";

const config = createSolHistoricalExperimentConfig();
const productId = "SOL-USD";
const source = new CoinbaseOhlcvSource({ productId });
const result = await runHistoricalExperiment(source, {
  ...config,
  symbol: productId,
  query: { ...config.query, symbol: productId }
});
const summary = summarizeHistoricalExperiment(result);
const preDashboardGates = evaluatePreDashboardGates({ baseline: result.baseline, optimized: result.optimized });

const outputPath = process.env.SOL_COINBASE_EXPERIMENT_OUTPUT?.trim() || "solana-coinbase-historical-experiment.json";
await writeFile(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  dataSource: "Coinbase Exchange public candles",
  market: productId,
  quoteCurrency: "USD",
  volumeSemantics: "base-volume (SOL); not directly comparable to quote-denominated volume",
  summary,
  preDashboardGates,
  dataset: result.dataset,
  baseline: {
    outOfSample: result.baseline.outOfSample,
    consistency: result.baseline.consistency,
    robustness: result.baseline.robustness
  },
  optimized: {
    outOfSample: result.optimized.outOfSample,
    consistency: result.optimized.consistency,
    robustness: result.optimized.robustness
  }
}, null, 2) + "\n", "utf8");

console.log(JSON.stringify(summary, null, 2));
console.log(`Coinbase benchmark report written to ${outputPath}`);
if (!preDashboardGates.passed) {
  console.error(`Pre-dashboard research gates failed: ${preDashboardGates.reasons.join(", ")}`);
  process.exitCode = 1;
}

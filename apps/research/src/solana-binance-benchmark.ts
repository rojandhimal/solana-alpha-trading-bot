import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { BinanceOhlcvSource } from "../../../packages/market-data/src/binance-ohlcv.js";
import {
  createSolHistoricalExperimentConfig,
  runHistoricalExperiment,
  summarizeHistoricalExperiment
} from "../../../packages/backtesting/src/index.js";

const config = createSolHistoricalExperimentConfig();
const binanceSymbol = "SOLUSDT";
const source = new BinanceOhlcvSource({ symbol: binanceSymbol });
const result = await runHistoricalExperiment(source, {
  ...config,
  symbol: binanceSymbol,
  query: { ...config.query, symbol: binanceSymbol }
});
const summary = summarizeHistoricalExperiment(result);

const outputPath = process.env.SOL_BINANCE_EXPERIMENT_OUTPUT?.trim() || "solana-binance-historical-experiment.json";
await writeFile(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  dataSource: "Binance",
  market: binanceSymbol,
  quoteCurrency: "USDT",
  volumeSemantics: "quote-volume (USDT)",
  summary,
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
console.log(`Binance benchmark report written to ${outputPath}`);

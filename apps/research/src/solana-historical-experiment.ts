import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { BirdeyeOhlcvSource } from "../../../packages/market-data/src/birdeye-ohlcv.js";
import {
  createSolHistoricalExperimentConfig,
  runHistoricalExperiment,
  summarizeHistoricalExperiment
} from "../../../packages/backtesting/src/index.js";

const apiKey = process.env.BIRDEYE_API_KEY?.trim();
if (!apiKey) {
  throw new Error("BIRDEYE_API_KEY is required for the real-data experiment");
}

const config = createSolHistoricalExperimentConfig();
const source = new BirdeyeOhlcvSource({ apiKey });
const result = await runHistoricalExperiment(source, config);
const summary = summarizeHistoricalExperiment(result);

const outputPath = process.env.SOL_EXPERIMENT_OUTPUT?.trim() || "solana-historical-experiment.json";
await writeFile(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
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
console.log(`Experiment report written to ${outputPath}`);

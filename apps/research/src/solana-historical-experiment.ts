import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { GeckoTerminalOhlcvSource } from "../../../packages/market-data/src/geckoterminal-ohlcv.js";
import {
  createSolHistoricalExperimentConfig,
  runHistoricalExperiment,
  summarizeHistoricalExperiment,
  SOL_GECKOTERMINAL_POOL_ADDRESS
} from "../../../packages/backtesting/src/index.js";

const config = createSolHistoricalExperimentConfig();
const source = new GeckoTerminalOhlcvSource({ poolAddress: SOL_GECKOTERMINAL_POOL_ADDRESS });
const result = await runHistoricalExperiment(source, config);
const summary = summarizeHistoricalExperiment(result);

const outputPath = process.env.SOL_EXPERIMENT_OUTPUT?.trim() || "solana-historical-experiment.json";
await writeFile(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  dataSource: "GeckoTerminal",
  poolAddress: SOL_GECKOTERMINAL_POOL_ADDRESS,
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

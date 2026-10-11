import "dotenv/config";
import { runSolFreeRecentDexExperiment } from "./solana-free-dex-runner.js";
import {
  SOL_FREE_DEX_DEFAULT_OUTPUT,
  SOL_FREE_DEX_EXPERIMENT_ID,
} from "./solana-free-dex-config.js";

const outputPath =
  process.env.SOL_FREE_DEX_EXPERIMENT_OUTPUT?.trim() ||
  SOL_FREE_DEX_DEFAULT_OUTPUT;
const cachedDatasetPath = process.env.SOL_FREE_DEX_DATASET_FILE?.trim();
const result = await runSolFreeRecentDexExperiment({
  outputPath,
  ...(cachedDatasetPath ? { cachedDatasetPath } : {}),
});
console.log(
  `${SOL_FREE_DEX_EXPERIMENT_ID}: supplemental recent DEX report written to ${outputPath}; validation exit code ${result.exitCode}. Required 2025 DEX gate remains separate.`,
);
process.exitCode = result.exitCode;

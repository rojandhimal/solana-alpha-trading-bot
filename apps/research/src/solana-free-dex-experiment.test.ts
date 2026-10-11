import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOL_FREE_DEX_DEFAULT_OUTPUT } from "./solana-free-dex-config.js";

const { runExperiment } = vi.hoisted(() => ({
  runExperiment: vi.fn(async () => ({ exitCode: 1, report: {} })),
}));
vi.mock("./solana-free-dex-runner.js", () => ({
  runSolFreeRecentDexExperiment: runExperiment,
}));
vi.mock("dotenv/config", () => ({}));

const previousExitCode = process.exitCode;
beforeEach(() => {
  vi.resetModules();
  runExperiment.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  process.exitCode = previousExitCode;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("supplemental DEX CLI scope", () => {
  it("ignores the existing 2025 command's output and cache environment variables", async () => {
    vi.stubEnv("SOL_EXPERIMENT_OUTPUT", "required-2025-report.json");
    vi.stubEnv("SOL_DATASET_FILE", "required-2025-cache.json");
    vi.stubEnv("SOL_FREE_DEX_EXPERIMENT_OUTPUT", undefined);
    vi.stubEnv("SOL_FREE_DEX_DATASET_FILE", undefined);
    await import("./solana-free-dex-experiment.js");
    expect(runExperiment).toHaveBeenCalledWith({
      outputPath: SOL_FREE_DEX_DEFAULT_OUTPUT,
    });
    expect(process.exitCode).toBe(1);
  });

  it("uses only the explicit supplemental output and cache options", async () => {
    vi.stubEnv(
      "SOL_FREE_DEX_EXPERIMENT_OUTPUT",
      " artifacts/recent-dex/report.json ",
    );
    vi.stubEnv(
      "SOL_FREE_DEX_DATASET_FILE",
      " artifacts/recent-dex/report.json.dataset.json ",
    );
    await import("./solana-free-dex-experiment.js");
    expect(runExperiment).toHaveBeenCalledWith({
      outputPath: "artifacts/recent-dex/report.json",
      cachedDatasetPath: "artifacts/recent-dex/report.json.dataset.json",
    });
  });
});

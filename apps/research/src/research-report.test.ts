import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeResearchReport } from "./research-report.js";
import { createSolHistoricalExperimentConfig } from "../../../packages/backtesting/src/index.js";
describe("research failure reports", () => {
  it("writes a machine-readable provider failure into a new directory", async () => {
    const outputPath = join(
      await mkdtemp(join(tmpdir(), "research-report-")),
      "nested",
      "report.json",
    );
    const result = await writeResearchReport({
      source: {
        load: async () => {
          throw new Error("Provider HTTP 401: sensitive response body");
        },
      },
      config: createSolHistoricalExperimentConfig(),
      outputPath,
      provider: "test",
      identity: "test-pool",
      marketKind: "SOLANA_DEX_POOL",
      volumeSemantics: "USD",
    });
    expect(result.exitCode).toBe(1);
    const report = JSON.parse(await readFile(outputPath, "utf8"));
    expect(report.release.branch).not.toBe("UNKNOWN");
    expect(report.release.dependencyLockSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.readiness.dashboardMayBegin).toBe(false);
    expect(report.readiness.strategy).toBe("BLOCKED");
    expect(report.failure.message).toBe("Provider returned HTTP 401");
    expect(JSON.stringify(report)).not.toContain("sensitive response body");
  });
});
it("replays a hash-checked synthetic dataset offline with identical research calculations", async () => {
  const directory = await mkdtemp(join(tmpdir(), "research-replay-"));
  const bars = Array.from({ length: 160 }, (_, i) => {
    const price = 100 + 10 * Math.sin(i / 5);
    return {
      timestamp: 1700000000000 + i * 3600000,
      open: price,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 100,
    };
  });
  const base = createSolHistoricalExperimentConfig();
  const config = {
    ...base,
    symbol: "SYNTHETIC_TEST",
    query: {
      symbol: "SYNTHETIC_TEST",
      interval: "1H",
      startTime: bars[0]!.timestamp,
      endTime: bars.at(-1)!.timestamp,
    },
    walkForward: { trainingBars: 40, testingBars: 20 },
    optimization: {
      fastPeriods: [2],
      slowPeriods: [3],
      rsiPeriods: [2],
      momentumPeriods: [2],
      atrPeriods: [2],
      volumePeriods: [2],
      entryThresholds: [0.4],
      minTrades: 0,
    },
  };
  const common = {
    config,
    provider: "synthetic test fixture",
    marketKind: "CEX_BENCHMARK" as const,
    identity: "SYNTHETIC_TEST",
    volumeSemantics: "synthetic volume",
  };
  const first = await writeResearchReport({
    ...common,
    source: { load: async () => bars },
    outputPath: join(directory, "first.json"),
  });
  const second = await writeResearchReport({
    ...common,
    source: {
      load: async () => {
        throw new Error("offline replay must not request a provider");
      },
    },
    cachedDatasetPath: join(directory, "first.json.dataset.json"),
    outputPath: join(directory, "second.json"),
  });
  expect(first.report.result).toBeDefined();
  expect(second.report.result).toEqual(first.report.result);
  expect(second.report.summary).toEqual(first.report.summary);
  expect(second.report.datasetSha256).toEqual(first.report.datasetSha256);
  expect(
    (second.report.readiness as { dashboardMayBegin: boolean })
      .dashboardMayBegin,
  ).toBe(false);
});

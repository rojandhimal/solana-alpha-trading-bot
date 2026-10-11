import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSolHistoricalExperimentConfig,
  SOL_GECKOTERMINAL_POOL_ADDRESS,
  SOL_TOKEN_ADDRESS,
} from "../../../packages/backtesting/src/index.js";
import {
  createSolFreeRecentDexExperimentConfig,
  SOL_FREE_DEX_DEFAULT_OUTPUT,
  SOL_FREE_DEX_EXPERIMENT_ID,
  SOL_FREE_DEX_START_MS,
  SOL_FREE_DEX_END_MS,
} from "./solana-free-dex-config.js";
import { runSolFreeRecentDexExperiment } from "./solana-free-dex-runner.js";

describe("supplemental free recent DEX experiment", () => {
  it("changes only the fixed dataset range and retains the required 2025 preset", () => {
    const original = createSolHistoricalExperimentConfig();
    const config = createSolFreeRecentDexExperimentConfig();
    expect(config).toEqual({
      ...original,
      query: {
        ...original.query,
        startTime: SOL_FREE_DEX_START_MS,
        endTime: SOL_FREE_DEX_END_MS,
      },
    });
    expect(config.query.symbol).toBe(SOL_TOKEN_ADDRESS);
    expect(new Date(config.query.startTime).toISOString()).toBe(
      "2026-05-01T00:00:00.000Z",
    );
    expect(new Date(config.query.endTime).toISOString()).toBe(
      "2026-09-30T23:00:00.000Z",
    );
    expect((config.query.endTime - config.query.startTime) / 3600000 + 1).toBe(
      3672,
    );
    expect(createSolHistoricalExperimentConfig()).toEqual(original);
    expect(original.query.startTime).toBe(
      Date.parse("2025-01-01T00:00:00.000Z"),
    );
    expect(original.query.endTime).toBe(Date.parse("2025-12-31T23:00:00.000Z"));
  });

  it("provides a separate command and report filename while the existing command stays on 2025", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8"));
    expect(manifest.scripts["research:solana"]).toBe(
      "node dist/apps/research/src/solana-historical-experiment.js",
    );
    expect(manifest.scripts["research:solana:free-dex"]).toBe(
      "node dist/apps/research/src/solana-free-dex-experiment.js",
    );
    expect(SOL_FREE_DEX_DEFAULT_OUTPUT).not.toBe(
      "solana-historical-experiment.json",
    );
    expect(SOL_FREE_DEX_DEFAULT_OUTPUT).toBe(
      "solana-free-recent-dex-experiment.json",
    );
  });

  it("preserves supplemental scope and blocked readiness in a provider failure artifact", async () => {
    const outputPath = join(
      await mkdtemp(join(tmpdir(), "free-dex-failure-")),
      "report.json",
    );
    const queries: unknown[] = [];
    const result = await runSolFreeRecentDexExperiment({
      outputPath,
      source: {
        load: async (query) => {
          queries.push(query);
          throw new Error("Provider HTTP 401");
        },
      },
    });
    expect(queries).toEqual([createSolFreeRecentDexExperimentConfig().query]);
    expect(result.exitCode).toBe(1);
    const report = JSON.parse(await readFile(outputPath, "utf8"));
    expect(report.experiment).toEqual({
      id: SOL_FREE_DEX_EXPERIMENT_ID,
      purpose: "SUPPLEMENTAL_RECENT_DEX",
      required2025GateSatisfied: false,
    });
    expect(report.provenance.identity).toBe(SOL_GECKOTERMINAL_POOL_ADDRESS);
    expect(report.readiness.status).toBe("NOT_VALIDATED");
    expect(report.readiness.dashboardMayBegin).toBe(false);
    expect(report.readiness.strategy).toBe("BLOCKED");
    expect(report.readiness.blockers).toContain(
      "Supplemental recent DEX research does not satisfy the required 2025 DEX dataset gate",
    );
  });

  it("rejects a validly hashed 2025 cache instead of silently changing the recent period", async () => {
    const directory = await mkdtemp(join(tmpdir(), "free-dex-cache-"));
    const cachedDatasetPath = join(directory, "2025-cache.json");
    const bars: unknown[] = [];
    await writeFile(
      cachedDatasetPath,
      JSON.stringify({
        provenance: {
          provider: "GeckoTerminal public API",
          marketKind: "SOLANA_DEX_POOL",
          identity: SOL_GECKOTERMINAL_POOL_ADDRESS,
          volumeSemantics: "USD volume",
          timestampUnit: "milliseconds UTC",
          retrievedAt: "2026-10-11T00:00:00.000Z",
          requestedRange: createSolHistoricalExperimentConfig().query,
        },
        bars,
        sha256: createHash("sha256").update(JSON.stringify(bars)).digest("hex"),
      }),
    );
    const result = await runSolFreeRecentDexExperiment({
      cachedDatasetPath,
      outputPath: join(directory, "recent-report.json"),
      source: {
        load: async () => {
          throw new Error("must not request the provider for cached replay");
        },
      },
    });
    expect(result.exitCode).toBe(1);
    expect(result.report.failure).toEqual({
      stage: "CACHED_DATASET_VALIDATION",
      message: "cached dataset provenance or hash mismatch",
    });
    expect(result.report.configuration).toEqual(
      createSolFreeRecentDexExperimentConfig(),
    );
    expect(
      (result.report.readiness as { dashboardMayBegin: boolean })
        .dashboardMayBegin,
    ).toBe(false);
  });

  it("rejects another pool's cache even when the recent period and bar hash agree", async () => {
    const directory = await mkdtemp(join(tmpdir(), "free-dex-pool-cache-"));
    const cachedDatasetPath = join(directory, "other-pool.json");
    const bars: unknown[] = [];
    await writeFile(
      cachedDatasetPath,
      JSON.stringify({
        provenance: {
          provider: "GeckoTerminal public API",
          marketKind: "SOLANA_DEX_POOL",
          identity: "OTHER_POOL",
          volumeSemantics: "USD volume",
          timestampUnit: "milliseconds UTC",
          retrievedAt: "2026-10-11T00:00:00.000Z",
          requestedRange: createSolFreeRecentDexExperimentConfig().query,
        },
        bars,
        sha256: createHash("sha256").update(JSON.stringify(bars)).digest("hex"),
      }),
    );
    const result = await runSolFreeRecentDexExperiment({
      cachedDatasetPath,
      outputPath: join(directory, "recent-report.json"),
      source: {
        load: async () => {
          throw new Error("cached replay must stay offline");
        },
      },
    });
    expect(result.exitCode).toBe(1);
    expect(result.report.failure).toEqual({
      stage: "CACHED_DATASET_VALIDATION",
      message: "cached dataset provenance or hash mismatch",
    });
    expect(result.report.experiment).toEqual({
      id: SOL_FREE_DEX_EXPERIMENT_ID,
      purpose: "SUPPLEMENTAL_RECENT_DEX",
      required2025GateSatisfied: false,
    });
  });
});

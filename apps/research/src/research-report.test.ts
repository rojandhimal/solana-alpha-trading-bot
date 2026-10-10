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

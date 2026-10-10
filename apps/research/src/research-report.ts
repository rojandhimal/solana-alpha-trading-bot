import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import type {
  HistoricalDataSource,
  OhlcvBar,
} from "../../../packages/market-data/src/historical-source.js";
import { auditHistoricalData } from "../../../packages/market-data/src/historical-data-quality.js";
import {
  evaluatePreDashboardGates,
  runHistoricalExperiment,
  summarizeHistoricalExperiment,
  type HistoricalExperimentConfig,
} from "../../../packages/backtesting/src/index.js";

export interface ResearchReportInput {
  source: HistoricalDataSource;
  config: HistoricalExperimentConfig;
  outputPath: string;
  provider: string;
  marketKind: "CEX_BENCHMARK" | "SOLANA_DEX_POOL";
  identity: string;
  volumeSemantics: string;
  cachedDatasetPath?: string;
}
/** Always preserve an explicit failure artifact; never turn provider failure into validation. */
export async function writeResearchReport(
  input: ResearchReportInput,
): Promise<{ exitCode: number; report: Record<string, unknown> }> {
  const generatedAt = new Date().toISOString();
  let commitSha = "UNKNOWN";
  try {
    commitSha = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    /* Missing git is reported, never invented. */
  }
  let provenance = {
    provider: input.provider,
    marketKind: input.marketKind,
    identity: input.identity,
    volumeSemantics: input.volumeSemantics,
    timestampUnit: "milliseconds UTC",
    retrievedAt: generatedAt,
    requestedRange: input.config.query,
  };
  let bars: readonly OhlcvBar[] | undefined;
  let stage = "DATA_FETCH";
  const dirty =
    execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
      encoding: "utf8",
    }).trim().length > 0;
  let report: Record<string, unknown>;
  let exitCode = 1;
  try {
    if (input.cachedDatasetPath) {
      const cached = JSON.parse(
        await readFile(input.cachedDatasetPath, "utf8"),
      );
      if (
        cached.provenance?.provider !== input.provider ||
        cached.provenance?.marketKind !== input.marketKind ||
        cached.provenance?.identity !== input.identity ||
        JSON.stringify(cached.provenance?.requestedRange) !==
          JSON.stringify(input.config.query) ||
        !Array.isArray(cached.bars) ||
        cached.sha256 !==
          createHash("sha256").update(JSON.stringify(cached.bars)).digest("hex")
      )
        throw new Error("cached dataset provenance or hash mismatch");
      provenance = cached.provenance;
      bars = cached.bars;
    } else bars = await input.source.load(input.config.query);
    if (!bars) throw new Error("dataset candles missing");
    await mkdir(dirname(input.outputPath), { recursive: true });
    await writeFile(
      input.outputPath + ".dataset.json",
      JSON.stringify({
        provenance,
        sha256: createHash("sha256").update(JSON.stringify(bars)).digest("hex"),
        bars,
      }) + "\n",
      "utf8",
    );
    stage = "DATA_VALIDATION_OR_RESEARCH";
    const result = await runHistoricalExperiment(
      { load: async () => bars! },
      input.config,
    );
    const researchGates = evaluatePreDashboardGates({
      baseline: result.baseline,
      optimized: result.optimized,
    });
    if (
      result.optimizationSelections?.some(
        (selection) => !Number.isFinite(selection.validationScore),
      )
    )
      researchGates.reasons.push(
        "No candidate met inner validation criteria in one or more windows; baseline fallback is not optimized validation",
      );
    if (
      !result.trainingParameterStability?.length ||
      result.trainingParameterStability.some((value) => !value.stable)
    )
      researchGates.reasons.push(
        "Training parameter neighborhood stability failed",
      );
    if (
      result.optimized.windows.some(
        (window) =>
          !window.test.robustness.passed ||
          window.test.stressResults.length !==
            input.config.stressScenarios.length,
      )
    )
      researchGates.reasons.push(
        "One or more OOS stress windows failed acceptance",
      );
    researchGates.passed = researchGates.reasons.length === 0;
    const windowReturns = result.optimized.windows.map(
      (window) => window.test.metrics.totalReturnPct,
    );
    const positiveReturnSum = windowReturns.reduce(
      (sum, value) => sum + Math.max(0, value),
      0,
    );
    report = {
      schemaVersion: 1,
      generatedAt,
      commitSha,
      workingTreeDirty: dirty,
      provenance,
      datasetSha256: createHash("sha256")
        .update(JSON.stringify(bars))
        .digest("hex"),
      datasetFile: input.outputPath + ".dataset.json",
      configuration: input.config,
      summary: summarizeHistoricalExperiment(result),
      researchGates,
      result,
      benchmark: {
        kind: "BUY_AND_HOLD_GROSS",
        returnPct: (bars.at(-1)!.close / bars[0]!.open - 1) * 100,
        assumptions:
          "Full dataset passive return; excludes fees, differs from OOS-only period",
      },
      concentration: {
        largestPositiveWindowSharePct:
          positiveReturnSum > 0
            ? (Math.max(...windowReturns.map((value) => Math.max(0, value))) /
                positiveReturnSum) *
              100
            : 0,
        windowReturnsPct: windowReturns,
        regimeSensitivity:
          "Per-window results show temporal sensitivity; independent regime labels are not supplied",
      },
      readiness: {
        status: "NOT_VALIDATED",
        software: "NOT_RUN",
        strategy: researchGates.passed ? "PASS" : "FAIL",
        dashboardMayBegin: false,
        blockers: [
          "Exact candidate CI/security evidence must be evaluated separately",
          "Elapsed paper-trading acceptance is not supplied",
          ...(input.marketKind === "CEX_BENCHMARK"
            ? ["CEX benchmark does not validate Solana DEX execution"]
            : []),
        ],
      },
      assumptions: [
        "Completed candle signals execute at next available open plus modeled costs",
        "Independent OOS windows scale quantity with capital and liquidate at the final close with modeled costs; no cross-window pending orders",
        "No order book or pool depth data: liquidity shocks amplify modeled slippage, not measured market capacity",
        "Volatility shocks amplify execution slippage; they do not simulate a new market regime",
        "Bootstrap windows are assumed exchangeable; fixed-PnL trade permutations test ordering and have constant terminal PnL; serial dependence and multiple testing limit inference",
        "A robustness score or positive return is not evidence of future profitability",
        "Infinity metrics are serialized as labeled strings, never silently converted to null",
      ],
    };
    exitCode = researchGates.passed ? 0 : 1;
  } catch (error) {
    // Do not copy provider response bodies or credentials into artifacts/logs.
    const message =
      error instanceof Error ? error.message : "Unknown research failure";
    const httpStatus = message.match(/HTTP (\d{3})/)?.[1];
    const publicFailure =
      stage === "DATA_FETCH"
        ? httpStatus
          ? `Provider returned HTTP ${httpStatus}`
          : "Provider request or response validation failed"
        : message.slice(0, 500);
    report = {
      schemaVersion: 1,
      generatedAt,
      commitSha,
      workingTreeDirty: dirty,
      provenance,
      configuration: input.config,
      status: "NOT_VALIDATED",
      failure: { stage, message: publicFailure },
      ...(bars
        ? {
            dataset: auditHistoricalData(bars, input.config.query, {
              ...input.config.dataQuality,
              requireRangeCoverage: true,
            }),
            datasetSha256: createHash("sha256")
              .update(JSON.stringify(bars))
              .digest("hex"),
          }
        : {}),
      readiness: {
        status: "NOT_VALIDATED",
        dashboardMayBegin: false,
        strategy: stage === "DATA_FETCH" ? "BLOCKED" : "FAIL",
      },
    };
  }
  await mkdir(dirname(input.outputPath), { recursive: true });
  await writeFile(
    input.outputPath,
    JSON.stringify(
      report,
      (_key, value: unknown) =>
        typeof value === "number" && !Number.isFinite(value)
          ? String(value)
          : value,
      2,
    ) + "\n",
    "utf8",
  );
  return { exitCode, report };
}

import { bootstrapMeanConfidenceInterval, monteCarloTradeSequence, type BootstrapConfidenceInterval, type MonteCarloSummary } from "./statistical-robustness.js";
import type { WalkForwardPipelineResult } from "./walk-forward-pipeline.js";

export interface PreDashboardGateResult {
  passed: boolean;
  reasons: string[];
  statistical?: {
    oosWindowReturnCi: BootstrapConfidenceInterval;
    monteCarlo: MonteCarloSummary;
  };
}

export interface PreDashboardGateInput {
  baseline: WalkForwardPipelineResult;
  optimized: WalkForwardPipelineResult;
  minimumOosWindows?: number;
  minimumProfitableWindowRatePct?: number;
}

export function evaluatePreDashboardGates(input: PreDashboardGateInput): PreDashboardGateResult {
  const reasons: string[] = [];
  const baseline = input.baseline.outOfSample;
  const optimized = input.optimized.outOfSample;
  const minimumOosWindows = input.minimumOosWindows ?? 5;
  const minimumProfitableWindowRatePct = input.minimumProfitableWindowRatePct ?? 50;

  if (input.baseline.windows.length < minimumOosWindows || input.optimized.windows.length < minimumOosWindows) {
    reasons.push(`insufficient walk-forward windows: required at least ${minimumOosWindows}`);
  }
  if (optimized.tradeCount === 0) reasons.push("optimized out-of-sample produced no trades");
  if (!Number.isFinite(optimized.totalReturnPct) || !Number.isFinite(optimized.maxDrawdownPct) || !Number.isFinite(optimized.profitFactor) || !Number.isFinite(optimized.expectancy)) {
    reasons.push("optimized out-of-sample metrics are not finite");
  }
  if (optimized.maxDrawdownPct > 35) reasons.push(`optimized max drawdown ${optimized.maxDrawdownPct.toFixed(2)}% exceeds 35% gate`);
  if (optimized.profitFactor < 1.05) reasons.push(`optimized profit factor ${optimized.profitFactor.toFixed(2)} is below 1.05 gate`);
  if (optimized.expectancy <= 0) reasons.push("optimized expectancy is not positive");

  const windowReturns = input.optimized.windows.map((window) => window.outOfSample.totalReturnPct).filter(Number.isFinite);
  if (windowReturns.length >= 2) {
    const profitableRate = windowReturns.filter((value) => value > 0).length / windowReturns.length * 100;
    if (profitableRate < minimumProfitableWindowRatePct) reasons.push(`profitable OOS window rate ${profitableRate.toFixed(2)}% is below ${minimumProfitableWindowRatePct}% gate`);
    const ci = bootstrapMeanConfidenceInterval(windowReturns, { samples: 2000, confidencePct: 95, seed: 42 });
    const tradeReturns = input.optimized.windows.flatMap((window) => window.trades.map((trade) => trade.returnPct)).filter(Number.isFinite);
    const monteCarlo = tradeReturns.length >= 2 ? monteCarloTradeSequence(tradeReturns, { simulations: 5000, seed: 42 }) : undefined;
    if (ci.lowerPct <= 0) reasons.push(`95% bootstrap CI lower bound ${ci.lowerPct.toFixed(4)}% is not positive`);
    return { passed: reasons.length === 0, reasons, statistical: { oosWindowReturnCi: ci, monteCarlo: monteCarlo ?? monteCarloTradeSequence(windowReturns, { simulations: 5000, seed: 42 }) } };
  }
  return { passed: false, reasons: [...reasons, "insufficient finite OOS window returns for statistical validation"] };
}

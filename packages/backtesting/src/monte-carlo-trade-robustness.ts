import type { CompletedTrade } from "./trade-attribution.js";

export interface MonteCarloTradeRobustnessInput {
  trades: readonly CompletedTrade[];
  initialCapital: number;
  simulations?: number;
  seed?: number;
}

export interface MonteCarloTradeRobustnessResult {
  simulations: number;
  medianFinalCapital: number;
  percentile5FinalCapital: number;
  percentile95FinalCapital: number;
  probabilityOfLossPct: number;
  medianMaxDrawdownPct: number;
  percentile95MaxDrawdownPct: number;
}

function validate(input: MonteCarloTradeRobustnessInput): number {
  if (!Number.isFinite(input.initialCapital) || input.initialCapital <= 0) {
    throw new Error("initialCapital must be positive");
  }
  if (input.trades.length === 0) throw new Error("at least one completed trade is required");
  const simulations = input.simulations ?? 1_000;
  if (!Number.isInteger(simulations) || simulations < 1) throw new Error("simulations must be a positive integer");
  if (input.trades.some((trade) => !Number.isFinite(trade.netPnl))) throw new Error("trade netPnl must be finite");
  return simulations;
}

function percentile(values: readonly number[], probability: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (index - lower);
}

function maxDrawdownPct(initialCapital: number, pnl: readonly number[]): number {
  let equity = initialCapital;
  let peak = initialCapital;
  let maxDrawdown = 0;
  for (const value of pnl) {
    equity += value;
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / peak) * 100);
  }
  return maxDrawdown;
}

function nextRandom(state: { value: number }): number {
  state.value = (state.value * 1664525 + 1013904223) >>> 0;
  return state.value / 4294967296;
}

function shuffledPnl(trades: readonly CompletedTrade[], state: { value: number }): number[] {
  const pnl = trades.map((trade) => trade.netPnl);
  for (let index = pnl.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom(state) * (index + 1));
    [pnl[index], pnl[swapIndex]] = [pnl[swapIndex]!, pnl[index]!];
  }
  return pnl;
}

/** Measures how sensitive final capital and drawdown are to trade ordering. */
export function runMonteCarloTradeRobustness(input: MonteCarloTradeRobustnessInput): MonteCarloTradeRobustnessResult {
  const simulations = validate(input);
  const state = { value: (input.seed ?? 123456789) >>> 0 };
  const finalCapitals: number[] = [];
  const drawdowns: number[] = [];

  for (let simulation = 0; simulation < simulations; simulation += 1) {
    const pnl = shuffledPnl(input.trades, state);
    finalCapitals.push(input.initialCapital + pnl.reduce((sum, value) => sum + value, 0));
    drawdowns.push(maxDrawdownPct(input.initialCapital, pnl));
  }

  return {
    simulations,
    medianFinalCapital: percentile(finalCapitals, 0.5),
    percentile5FinalCapital: percentile(finalCapitals, 0.05),
    percentile95FinalCapital: percentile(finalCapitals, 0.95),
    probabilityOfLossPct: (finalCapitals.filter((capital) => capital < input.initialCapital).length / simulations) * 100,
    medianMaxDrawdownPct: percentile(drawdowns, 0.5),
    percentile95MaxDrawdownPct: percentile(drawdowns, 0.95)
  };
}

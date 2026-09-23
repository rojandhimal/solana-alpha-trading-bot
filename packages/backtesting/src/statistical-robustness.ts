export interface BootstrapConfidenceInterval {
  estimate: number;
  lowerPct: number;
  upperPct: number;
  confidencePct: number;
  samples: number;
}

export interface MonteCarloSummary {
  simulations: number;
  seed: number;
  medianReturnPct: number;
  lowerReturnPct: number;
  upperReturnPct: number;
  probabilityOfLossPct: number;
  medianMaxDrawdownPct: number;
  upperMaxDrawdownPct: number;
}

function validateReturns(returns: readonly number[]): void {
  if (returns.length < 2) throw new Error("at least two returns are required");
  if (returns.some((value) => !Number.isFinite(value))) throw new Error("returns must be finite");
}

function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function bootstrapMeanConfidenceInterval(
  values: readonly number[],
  options: { samples?: number; confidencePct?: number; seed?: number } = {}
): BootstrapConfidenceInterval {
  validateReturns(values);
  const samples = options.samples ?? 2000;
  const confidencePct = options.confidencePct ?? 95;
  const seed = options.seed ?? 42;
  if (!Number.isInteger(samples) || samples < 100) throw new Error("samples must be an integer >= 100");
  if (!Number.isFinite(confidencePct) || confidencePct <= 0 || confidencePct >= 100) throw new Error("confidencePct must be between 0 and 100");
  const random = mulberry32(seed);
  const estimates: number[] = [];
  for (let simulation = 0; simulation < samples; simulation += 1) {
    let sum = 0;
    for (let draw = 0; draw < values.length; draw += 1) sum += values[Math.floor(random() * values.length)]!;
    estimates.push(sum / values.length);
  }
  const alpha = (1 - confidencePct / 100) / 2;
  const estimate = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { estimate, lowerPct: quantile(estimates, alpha), upperPct: quantile(estimates, 1 - alpha), confidencePct, samples };
}

export function monteCarloTradeSequence(
  tradeReturnsPct: readonly number[],
  options: { simulations?: number; seed?: number } = {}
): MonteCarloSummary {
  validateReturns(tradeReturnsPct);
  const simulations = options.simulations ?? 5000;
  const seed = options.seed ?? 42;
  if (!Number.isInteger(simulations) || simulations < 100) throw new Error("simulations must be an integer >= 100");
  const random = mulberry32(seed);
  const finalReturns: number[] = [];
  const drawdowns: number[] = [];
  for (let simulation = 0; simulation < simulations; simulation += 1) {
    let equity = 1;
    let peak = 1;
    let maxDrawdown = 0;
    for (let trade = 0; trade < tradeReturnsPct.length; trade += 1) {
      const sample = tradeReturnsPct[Math.floor(random() * tradeReturnsPct.length)]!;
      equity *= 1 + sample / 100;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak === 0 ? 0 : ((peak - equity) / peak) * 100);
    }
    finalReturns.push((equity - 1) * 100);
    drawdowns.push(maxDrawdown);
  }
  return {
    simulations,
    seed,
    medianReturnPct: quantile(finalReturns, 0.5),
    lowerReturnPct: quantile(finalReturns, 0.05),
    upperReturnPct: quantile(finalReturns, 0.95),
    probabilityOfLossPct: finalReturns.filter((value) => value < 0).length / simulations * 100,
    medianMaxDrawdownPct: quantile(drawdowns, 0.5),
    upperMaxDrawdownPct: quantile(drawdowns, 0.95)
  };
}

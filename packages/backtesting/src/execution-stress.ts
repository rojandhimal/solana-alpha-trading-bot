import type { StressMetrics, StressParameters } from "./stress-testing.js";

export interface SimulatedTrade {
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: "LONG" | "SHORT";
}

export interface ExecutionStressResult {
  trades: SimulatedTrade[];
  metrics: StressMetrics;
  equityCurve: number[];
}

function adjustedEntry(price: number, side: SimulatedTrade["side"], slippage: number): number {
  return side === "LONG" ? price * (1 + slippage) : price * (1 - slippage);
}

function adjustedExit(price: number, side: SimulatedTrade["side"], slippage: number): number {
  return side === "LONG" ? price * (1 - slippage) : price * (1 + slippage);
}

function maxDrawdownPct(equityCurve: readonly number[]): number {
  let peak = equityCurve[0] ?? 0;
  let worst = 0;
  for (const equity of equityCurve) {
    peak = Math.max(peak, equity);
    if (peak > 0) worst = Math.max(worst, ((peak - equity) / peak) * 100);
  }
  return worst;
}

function effectiveSlippage(baseSlippagePct: number, parameters: StressParameters): number {
  if (parameters.liquidityMultiplier <= 0) throw new Error("liquidityMultiplier must be positive");
  if (parameters.executionDelayBars < 0) throw new Error("executionDelayBars must be non-negative");
  if (parameters.volatilityMultiplier <= 0) throw new Error("volatilityMultiplier must be positive");

  // Deterministic paper-trading proxy: thinner liquidity, execution delay, and
  // volatility each increase adverse execution cost without requiring future prices.
  const liquidityFactor = 1 / parameters.liquidityMultiplier;
  const delayFactor = 1 + parameters.executionDelayBars * 0.25;
  return baseSlippagePct * parameters.slippageMultiplier * liquidityFactor * delayFactor * parameters.volatilityMultiplier;
}

export function simulateExecutionStress(
  trades: readonly SimulatedTrade[],
  parameters: StressParameters,
  baseSlippagePct = 0.001,
  baseFeePct = 0.001,
  initialCapital = 1_000
): ExecutionStressResult {
  if (initialCapital <= 0) throw new Error("initialCapital must be positive");
  if (baseSlippagePct < 0 || baseFeePct < 0) throw new Error("base execution costs must be non-negative");

  const slippage = effectiveSlippage(baseSlippagePct, parameters);
  const stressedTrades = trades.map((trade) => ({
    ...trade,
    entryPrice: adjustedEntry(trade.entryPrice, trade.side, slippage),
    exitPrice: adjustedExit(trade.exitPrice, trade.side, slippage)
  }));

  let grossProfit = 0;
  let grossLoss = 0;
  let net = 0;
  let equity = initialCapital;
  const equityCurve = [equity];

  for (const trade of stressedTrades) {
    const direction = trade.side === "LONG" ? 1 : -1;
    const pnl = (trade.exitPrice - trade.entryPrice) * trade.quantity * direction;
    const fees = (trade.entryPrice + trade.exitPrice) * trade.quantity * baseFeePct * parameters.feeMultiplier;
    const value = pnl - fees;
    net += value;
    equity += value;
    equityCurve.push(equity);
    if (value > 0) grossProfit += value;
    else grossLoss += Math.abs(value);
  }

  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Number.POSITIVE_INFINITY : 0) : grossProfit / grossLoss;
  return {
    trades: stressedTrades,
    equityCurve,
    metrics: {
      totalReturnPct: (net / initialCapital) * 100,
      maxDrawdownPct: maxDrawdownPct(equityCurve),
      tradeCount: stressedTrades.length,
      profitFactor,
      expectancy: stressedTrades.length === 0 ? 0 : net / stressedTrades.length
    }
  };
}

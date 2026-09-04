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
}

function adjustedEntry(price: number, side: SimulatedTrade["side"], slippage: number): number {
  return side === "LONG" ? price * (1 + slippage) : price * (1 - slippage);
}

function adjustedExit(price: number, side: SimulatedTrade["side"], slippage: number): number {
  return side === "LONG" ? price * (1 - slippage) : price * (1 + slippage);
}

export function simulateExecutionStress(
  trades: readonly SimulatedTrade[],
  parameters: StressParameters,
  baseSlippagePct = 0.001,
  baseFeePct = 0.001
): ExecutionStressResult {
  const stressedTrades = trades.map((trade) => ({
    ...trade,
    entryPrice: adjustedEntry(trade.entryPrice, trade.side, baseSlippagePct * parameters.slippageMultiplier),
    exitPrice: adjustedExit(trade.exitPrice, trade.side, baseSlippagePct * parameters.slippageMultiplier)
  }));

  let grossProfit = 0;
  let grossLoss = 0;
  let net = 0;
  let wins = 0;
  for (const trade of stressedTrades) {
    const direction = trade.side === "LONG" ? 1 : -1;
    const pnl = (trade.exitPrice - trade.entryPrice) * trade.quantity * direction;
    const fees = (trade.entryPrice + trade.exitPrice) * trade.quantity * baseFeePct * parameters.feeMultiplier;
    const value = pnl - fees;
    net += value;
    if (value > 0) { grossProfit += value; wins += 1; }
    else grossLoss += Math.abs(value);
  }

  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Number.POSITIVE_INFINITY : 0) : grossProfit / grossLoss;
  return {
    trades: stressedTrades,
    metrics: {
      totalReturnPct: net,
      maxDrawdownPct: 0,
      tradeCount: stressedTrades.length,
      profitFactor,
      expectancy: stressedTrades.length === 0 ? 0 : net / stressedTrades.length
    }
  };
}

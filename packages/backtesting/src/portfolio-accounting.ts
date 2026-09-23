import type { Candle, ExecutionFill } from "./execution-model.js";

export interface EquityPoint { index: number; cash: number; positionQuantity: number; averageEntryPrice: number; positionValue: number; equity: number; realizedPnl: number; unrealizedPnl: number; feesPaid: number; drawdownPct: number; }
export interface PortfolioAccountingResult { equityCurve: EquityPoint[]; initialCapital: number; finalEquity: number; netProfit: number; realizedPnl: number; feesPaid: number; completedTrades: number; }
export interface PortfolioAccountingOptions { allowShort?: boolean; }

export function accountFills(candles: readonly Candle[], fills: readonly ExecutionFill[], initialCapital: number, options: PortfolioAccountingOptions = {}): PortfolioAccountingResult {
  if (!Number.isFinite(initialCapital) || initialCapital <= 0) throw new Error("initialCapital must be positive");
  const fillsByIndex = new Map<number, ExecutionFill[]>();
  for (const fill of fills) {
    if (!Number.isInteger(fill.executionIndex) || fill.executionIndex < 0) throw new Error("executionIndex must be a non-negative integer");
    if (!Number.isFinite(fill.fillPrice) || fill.fillPrice <= 0) throw new Error("fillPrice must be positive");
    if (!Number.isFinite(fill.quantity) || fill.quantity <= 0) throw new Error("quantity must be positive");
    const bucket = fillsByIndex.get(fill.executionIndex) ?? []; bucket.push(fill); fillsByIndex.set(fill.executionIndex, bucket);
  }
  let cash = initialCapital, positionQuantity = 0, averageEntryPrice = 0, costBasis = 0, realizedPnl = 0, feesPaid = 0, completedTrades = 0, peakEquity = initialCapital;
  const equityCurve: EquityPoint[] = [];
  for (let index = 0; index < candles.length; index += 1) {
    for (const fill of fillsByIndex.get(index) ?? []) {
      const notional = fill.fillPrice * fill.quantity; feesPaid += fill.fee;
      if (fill.side === "BUY") {
        if (positionQuantity < 0) {
          const coverQuantity = Math.min(fill.quantity, Math.abs(positionQuantity));
          const allocatedCost = Math.abs(positionQuantity) === 0 ? 0 : costBasis * (coverQuantity / Math.abs(positionQuantity));
          const allocatedFee = fill.fee * (coverQuantity / fill.quantity);
          cash -= fill.fillPrice * coverQuantity + allocatedFee;
          realizedPnl += allocatedCost - fill.fillPrice * coverQuantity - allocatedFee;
          costBasis -= allocatedCost; positionQuantity += coverQuantity;
          if (Math.abs(positionQuantity) <= 1e-9) { positionQuantity = 0; averageEntryPrice = 0; costBasis = 0; completedTrades += 1; }
          else averageEntryPrice = costBasis / Math.abs(positionQuantity);
          const remaining = fill.quantity - coverQuantity;
          if (remaining > 1e-9) {
            const remainingNotional = fill.fillPrice * remaining, remainingFee = fill.fee * (remaining / fill.quantity);
            cash -= remainingNotional + remainingFee; positionQuantity += remaining; costBasis = remainingNotional + remainingFee; averageEntryPrice = costBasis / positionQuantity;
          }
        } else {
          const totalCost = notional + fill.fee;
          if (totalCost > cash + 1e-9) throw new Error(`insufficient cash for BUY at execution index ${index}`);
          cash -= totalCost; const previousCostBasis = costBasis; positionQuantity += fill.quantity; costBasis += totalCost; averageEntryPrice = (previousCostBasis + totalCost) / positionQuantity;
        }
      } else if (positionQuantity > 0) {
        if (fill.quantity > positionQuantity + 1e-9) throw new Error(`SELL quantity exceeds position at execution index ${index}`);
        const allocatedCost = costBasis * (fill.quantity / positionQuantity);
        cash += notional - fill.fee; realizedPnl += notional - fill.fee - allocatedCost; costBasis -= allocatedCost; positionQuantity -= fill.quantity;
        if (positionQuantity <= 1e-9) { positionQuantity = 0; averageEntryPrice = 0; costBasis = 0; completedTrades += 1; } else averageEntryPrice = costBasis / positionQuantity;
      } else {
        if (!options.allowShort) throw new Error(`SELL quantity exceeds position at execution index ${index}`);
        cash += notional - fill.fee; positionQuantity -= fill.quantity; costBasis += notional + fill.fee; averageEntryPrice = costBasis / Math.abs(positionQuantity);
      }
    }
    const candle = candles[index]; if (!candle) continue;
    const positionValue = positionQuantity * candle.close, equity = cash + positionValue;
    const unrealizedPnl = positionQuantity >= 0 ? positionValue - costBasis : costBasis + positionValue;
    peakEquity = Math.max(peakEquity, equity); const drawdownPct = peakEquity === 0 ? 0 : ((peakEquity - equity) / peakEquity) * 100;
    equityCurve.push({ index, cash, positionQuantity, averageEntryPrice, positionValue, equity, realizedPnl, unrealizedPnl, feesPaid, drawdownPct });
  }
  const finalEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1]!.equity : initialCapital;
  return { equityCurve, initialCapital, finalEquity, netProfit: finalEquity - initialCapital, realizedPnl, feesPaid, completedTrades };
}

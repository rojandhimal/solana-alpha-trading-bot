import type { Candle, ExecutionFill } from "./execution-model.js";

export interface EquityPoint {
  index: number;
  cash: number;
  positionQuantity: number;
  averageEntryPrice: number;
  positionValue: number;
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  feesPaid: number;
  drawdownPct: number;
}

export interface PortfolioAccountingResult {
  equityCurve: EquityPoint[];
  initialCapital: number;
  finalEquity: number;
  netProfit: number;
  realizedPnl: number;
  feesPaid: number;
  completedTrades: number;
}

export function accountFills(
  candles: readonly Candle[],
  fills: readonly ExecutionFill[],
  initialCapital: number
): PortfolioAccountingResult {
  if (!Number.isFinite(initialCapital) || initialCapital <= 0) {
    throw new Error("initialCapital must be positive");
  }

  const fillsByIndex = new Map<number, ExecutionFill[]>();
  for (const fill of fills) {
    if (!Number.isInteger(fill.executionIndex) || fill.executionIndex < 0) throw new Error("executionIndex must be a non-negative integer");
    if (!Number.isFinite(fill.fillPrice) || fill.fillPrice <= 0) throw new Error("fillPrice must be positive");
    if (!Number.isFinite(fill.quantity) || fill.quantity <= 0) throw new Error("quantity must be positive");
    const bucket = fillsByIndex.get(fill.executionIndex) ?? [];
    bucket.push(fill);
    fillsByIndex.set(fill.executionIndex, bucket);
  }

  let cash = initialCapital;
  let positionQuantity = 0;
  let averageEntryPrice = 0;
  let costBasis = 0;
  let realizedPnl = 0;
  let feesPaid = 0;
  let completedTrades = 0;
  let peakEquity = initialCapital;
  const equityCurve: EquityPoint[] = [];

  for (let index = 0; index < candles.length; index += 1) {
    for (const fill of fillsByIndex.get(index) ?? []) {
      const notional = fill.fillPrice * fill.quantity;
      feesPaid += fill.fee;

      if (fill.side === "BUY") {
        const totalCost = notional + fill.fee;
        if (totalCost > cash + 1e-9) throw new Error(`insufficient cash for BUY at execution index ${index}`);
        cash -= totalCost;
        const previousCostBasis = costBasis;
        positionQuantity += fill.quantity;
        costBasis += totalCost;
        averageEntryPrice = positionQuantity === 0 ? 0 : (previousCostBasis + notional) / positionQuantity;
      } else {
        if (fill.quantity > positionQuantity + 1e-9) {
          throw new Error(`SELL quantity exceeds position at execution index ${index}`);
        }
        const allocatedCost = positionQuantity === 0 ? 0 : costBasis * (fill.quantity / positionQuantity);
        cash += notional - fill.fee;
        realizedPnl += notional - fill.fee - allocatedCost;
        costBasis -= allocatedCost;
        positionQuantity -= fill.quantity;
        if (positionQuantity <= 1e-9) {
          positionQuantity = 0;
          averageEntryPrice = 0;
          costBasis = 0;
          completedTrades += 1;
        } else {
          averageEntryPrice = costBasis / positionQuantity;
        }
      }
    }

    const positionValue = positionQuantity * candles[index].close;
    const equity = cash + positionValue;
    const unrealizedPnl = positionValue - costBasis;
    peakEquity = Math.max(peakEquity, equity);
    const drawdownPct = peakEquity === 0 ? 0 : ((peakEquity - equity) / peakEquity) * 100;

    equityCurve.push({
      index,
      cash,
      positionQuantity,
      averageEntryPrice,
      positionValue,
      equity,
      realizedPnl,
      unrealizedPnl,
      feesPaid,
      drawdownPct
    });
  }

  const finalEquity = equityCurve.at(-1)?.equity ?? initialCapital;
  return {
    equityCurve,
    initialCapital,
    finalEquity,
    netProfit: finalEquity - initialCapital,
    realizedPnl,
    feesPaid,
    completedTrades
  };
}

import type { Candle, ExecutionFill } from "./execution-model.js";
import { validateExecutionFills } from "./execution-model.js";

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
export interface PortfolioAccountingOptions {
  allowShort?: boolean;
}

function exceedsAvailableCash(cost: number, cash: number): boolean {
  // Allow arithmetic rounding relative to capital, never an absolute subsidy.
  const rounding =
    Number.EPSILON * 4 * Math.max(Math.abs(cost), Math.abs(cash));
  return cost > cash && cost - cash > rounding;
}

export function accountFills(
  candles: readonly Candle[],
  fills: readonly ExecutionFill[],
  initialCapital: number,
  options: PortfolioAccountingOptions = {},
): PortfolioAccountingResult {
  if (!Number.isFinite(initialCapital) || initialCapital <= 0)
    throw new Error("initialCapital must be positive");
  const fillsByIndex = new Map<number, ExecutionFill[]>();
  validateExecutionFills(fills);
  for (const fill of fills) {
    if (
      !Number.isInteger(fill.executionIndex) ||
      fill.executionIndex < 0 ||
      fill.executionIndex >= candles.length
    )
      throw new Error("executionIndex must be a non-negative integer");
    const bucket = fillsByIndex.get(fill.executionIndex) ?? [];
    bucket.push(fill);
    fillsByIndex.set(fill.executionIndex, bucket);
  }
  for (const candle of candles) {
    if (
      ![candle.open, candle.high, candle.low, candle.close].every(
        (p) => Number.isFinite(p) && p > 0,
      ) ||
      candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close) ||
      candle.low > candle.high
    )
      throw new Error("invalid candle bounds");
  }
  let cash = initialCapital,
    positionQuantity = 0,
    averageEntryPrice = 0,
    costBasis = 0,
    realizedPnl = 0,
    feesPaid = 0,
    completedTrades = 0,
    peakEquity = initialCapital;
  const equityCurve: EquityPoint[] = [];
  for (let index = 0; index < candles.length; index += 1) {
    for (const fill of fillsByIndex.get(index) ?? []) {
      const notional = fill.fillPrice * fill.quantity;
      feesPaid += fill.fee;
      if (fill.side === "BUY") {
        if (positionQuantity < 0) {
          const coverQuantity = Math.min(
            fill.quantity,
            Math.abs(positionQuantity),
          );
          const allocatedCost =
            Math.abs(positionQuantity) === 0
              ? 0
              : costBasis * (coverQuantity / Math.abs(positionQuantity));
          const allocatedFee = fill.fee * (coverQuantity / fill.quantity);
          cash -= fill.fillPrice * coverQuantity + allocatedFee;
          realizedPnl +=
            allocatedCost - fill.fillPrice * coverQuantity - allocatedFee;
          costBasis -= allocatedCost;
          positionQuantity += coverQuantity;
          if (positionQuantity === 0) {
            positionQuantity = 0;
            averageEntryPrice = 0;
            costBasis = 0;
            completedTrades += 1;
          } else averageEntryPrice = costBasis / Math.abs(positionQuantity);
          const remaining = fill.quantity - coverQuantity;
          if (remaining > 0) {
            const remainingNotional = fill.fillPrice * remaining,
              remainingFee = fill.fee * (remaining / fill.quantity);
            if (exceedsAvailableCash(remainingNotional + remainingFee, cash))
              throw new Error(
                `insufficient cash for BUY at execution index ${index}`,
              );
            cash -= remainingNotional + remainingFee;
            positionQuantity += remaining;
            costBasis = remainingNotional + remainingFee;
            averageEntryPrice = costBasis / positionQuantity;
          }
        } else {
          const totalCost = notional + fill.fee;
          if (exceedsAvailableCash(totalCost, cash))
            throw new Error(
              `insufficient cash for BUY at execution index ${index}`,
            );
          cash -= totalCost;
          const previousCostBasis = costBasis;
          positionQuantity += fill.quantity;
          costBasis += totalCost;
          averageEntryPrice =
            (previousCostBasis + totalCost) / positionQuantity;
        }
      } else if (positionQuantity > 0) {
        if (fill.quantity > positionQuantity && !options.allowShort)
          throw new Error(
            `SELL quantity exceeds position at execution index ${index}`,
          );
        const closingQuantity = Math.min(fill.quantity, positionQuantity);
        const allocatedCost = costBasis * (closingQuantity / positionQuantity);
        const closingFee = fill.fee * (closingQuantity / fill.quantity);
        cash += fill.fillPrice * closingQuantity - closingFee;
        realizedPnl +=
          fill.fillPrice * closingQuantity - closingFee - allocatedCost;
        costBasis -= allocatedCost;
        positionQuantity -= closingQuantity;
        if (positionQuantity === 0) {
          positionQuantity = 0;
          averageEntryPrice = 0;
          costBasis = 0;
          completedTrades += 1;
        } else averageEntryPrice = costBasis / positionQuantity;
        const remaining = fill.quantity - closingQuantity;
        if (remaining > 0) {
          const proceeds =
            fill.fillPrice * remaining - fill.fee * (remaining / fill.quantity);
          cash += proceeds;
          positionQuantity = -remaining;
          costBasis = proceeds;
          averageEntryPrice = costBasis / remaining;
        }
      } else {
        if (!options.allowShort)
          throw new Error(
            `SELL quantity exceeds position at execution index ${index}`,
          );
        cash += notional - fill.fee;
        positionQuantity -= fill.quantity;
        costBasis += notional - fill.fee;
        averageEntryPrice = costBasis / Math.abs(positionQuantity);
      }
      if (
        ![
          cash,
          positionQuantity,
          averageEntryPrice,
          costBasis,
          realizedPnl,
          feesPaid,
        ].every(Number.isFinite)
      )
        throw new Error(
          `portfolio arithmetic overflow at execution index ${index}`,
        );
    }
    const candle = candles[index];
    if (!candle) continue;
    const positionValue = positionQuantity * candle.close,
      equity = cash + positionValue;
    const unrealizedPnl =
      positionQuantity >= 0
        ? positionValue - costBasis
        : costBasis + positionValue;
    peakEquity = Math.max(peakEquity, equity);
    const drawdownPct =
      peakEquity === 0 ? 0 : ((peakEquity - equity) / peakEquity) * 100;
    if (
      ![positionValue, equity, unrealizedPnl, drawdownPct].every(
        Number.isFinite,
      )
    )
      throw new Error(
        `portfolio mark-to-market overflow at candle index ${index}`,
      );
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
      drawdownPct,
    });
  }
  const finalEquity =
    equityCurve.length > 0
      ? equityCurve[equityCurve.length - 1]!.equity
      : initialCapital;
  return {
    equityCurve,
    initialCapital,
    finalEquity,
    netProfit: finalEquity - initialCapital,
    realizedPnl,
    feesPaid,
    completedTrades,
  };
}

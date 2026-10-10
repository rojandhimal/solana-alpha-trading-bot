import type { ExecutionFill } from "./execution-model.js";
import { validateExecutionFills } from "./execution-model.js";

export interface CompletedTrade {
  entryIndex: number;
  exitIndex: number;
  side: "LONG" | "SHORT";
  quantity: number;
  entryReferencePrice: number;
  exitReferencePrice: number;
  entryPrice: number;
  exitPrice: number;
  entryFee: number;
  exitFee: number;
  grossPnl: number;
  netPnl: number;
  returnPct: number;
  holdingBars: number;
}

interface OpenLot {
  entryIndex: number;
  quantity: number;
  entryReferencePrice: number;
  entryPrice: number;
  entryFee: number;
  side: "LONG" | "SHORT";
}

export function attributeTrades(
  fills: readonly ExecutionFill[],
): CompletedTrade[] {
  const lots: OpenLot[] = [];
  const trades: CompletedTrade[] = [];
  validateExecutionFills(fills);

  for (const fill of fills) {
    const opensLong = fill.side === "BUY";
    const closingSide: "LONG" | "SHORT" = opensLong ? "SHORT" : "LONG";
    let remaining = fill.quantity;

    while (remaining > 0 && lots[0]?.side === closingSide) {
      const lot = lots[0];
      const quantity = Math.min(remaining, lot.quantity);
      const entryFee = lot.entryFee * (quantity / lot.quantity);
      const exitFee = fill.fee * (quantity / fill.quantity);
      const direction = lot.side === "LONG" ? 1 : -1;
      const grossPnl = (fill.fillPrice - lot.entryPrice) * quantity * direction;
      const netPnl = grossPnl - entryFee - exitFee;
      const invested = lot.entryPrice * quantity + entryFee;
      const returnPct = (netPnl / invested) * 100;
      if (
        invested <= 0 ||
        ![entryFee, exitFee, grossPnl, netPnl, invested, returnPct].every(
          Number.isFinite,
        )
      )
        throw new Error("trade attribution arithmetic overflow or underflow");

      trades.push({
        entryIndex: lot.entryIndex,
        exitIndex: fill.executionIndex,
        side: lot.side,
        quantity,
        entryReferencePrice: lot.entryReferencePrice,
        exitReferencePrice: fill.referencePrice,
        entryPrice: lot.entryPrice,
        exitPrice: fill.fillPrice,
        entryFee,
        exitFee,
        grossPnl,
        netPnl,
        returnPct,
        holdingBars: fill.executionIndex - lot.entryIndex,
      });
      lot.quantity -= quantity;
      lot.entryFee -= entryFee;
      remaining -= quantity;
      if (lot.quantity === 0) lots.shift();
    }

    if (remaining === 0) continue;
    if (lots.length > 0 && lots[0]?.side !== (opensLong ? "LONG" : "SHORT")) {
      throw new Error(
        `fill quantity exceeds open ${lots[0]?.side.toLowerCase()} at execution index ${fill.executionIndex}`,
      );
    }

    lots.push({
      entryIndex: fill.executionIndex,
      quantity: remaining,
      entryReferencePrice: fill.referencePrice,
      entryPrice: fill.fillPrice,
      entryFee: fill.fee * (remaining / fill.quantity),
      side: opensLong ? "LONG" : "SHORT",
    });
  }

  return trades;
}

export function attributeLongTrades(
  fills: readonly ExecutionFill[],
): CompletedTrade[] {
  let openLongQuantity = 0;
  validateExecutionFills(fills);
  for (const fill of fills) {
    if (fill.side === "BUY") {
      openLongQuantity += fill.quantity;
      if (!Number.isFinite(openLongQuantity))
        throw new Error("open long quantity overflow");
    } else {
      if (fill.quantity > openLongQuantity) {
        throw new Error(
          `fill quantity exceeds open long at execution index ${fill.executionIndex}`,
        );
      }
      openLongQuantity -= fill.quantity;
    }
  }
  return attributeTrades(fills).filter((trade) => trade.side === "LONG");
}

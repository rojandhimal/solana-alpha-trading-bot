import type { ExecutionFill } from "./execution-model.js";

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
  entryFeePerUnit: number;
  side: "LONG" | "SHORT";
}

export function attributeTrades(fills: readonly ExecutionFill[]): CompletedTrade[] {
  const lots: OpenLot[] = [];
  const trades: CompletedTrade[] = [];

  for (const fill of fills) {
    if (fill.quantity <= 0) throw new Error("fill quantity must be positive");
    const opensLong = fill.side === "BUY";
    const closingSide: "LONG" | "SHORT" = opensLong ? "SHORT" : "LONG";
    let remaining = fill.quantity;

    while (remaining > 1e-9 && lots[0]?.side === closingSide) {
      const lot = lots[0];
      const quantity = Math.min(remaining, lot.quantity);
      const entryFee = lot.entryFeePerUnit * quantity;
      const exitFee = fill.fee * (quantity / fill.quantity);
      const direction = lot.side === "LONG" ? 1 : -1;
      const grossPnl = (fill.fillPrice - lot.entryPrice) * quantity * direction;
      const netPnl = grossPnl - entryFee - exitFee;
      const invested = lot.entryPrice * quantity + entryFee;

      trades.push({ entryIndex: lot.entryIndex, exitIndex: fill.executionIndex, side: lot.side, quantity, entryReferencePrice: lot.entryReferencePrice, exitReferencePrice: fill.referencePrice, entryPrice: lot.entryPrice, exitPrice: fill.fillPrice, entryFee, exitFee, grossPnl, netPnl, returnPct: invested === 0 ? 0 : (netPnl / invested) * 100, holdingBars: fill.executionIndex - lot.entryIndex });
      lot.quantity -= quantity;
      remaining -= quantity;
      if (lot.quantity <= 1e-9) lots.shift();
    }

    if (remaining <= 1e-9) continue;
    if (lots.length > 0) {
      throw new Error(`fill quantity exceeds open ${lots[0]?.side.toLowerCase()} at execution index ${fill.executionIndex}`);
    }

    lots.push({ entryIndex: fill.executionIndex, quantity: remaining, entryReferencePrice: fill.referencePrice, entryPrice: fill.fillPrice, entryFeePerUnit: fill.fee / fill.quantity, side: opensLong ? "LONG" : "SHORT" });
  }

  return trades;
}

export function attributeLongTrades(fills: readonly ExecutionFill[]): CompletedTrade[] {
  let openLongQuantity = 0;
  for (const fill of fills) {
    if (fill.quantity <= 0) throw new Error("fill quantity must be positive");
    if (fill.side === "BUY") {
      openLongQuantity += fill.quantity;
    } else {
      if (fill.quantity > openLongQuantity + 1e-9) {
        throw new Error(`fill quantity exceeds open long at execution index ${fill.executionIndex}`);
      }
      openLongQuantity -= fill.quantity;
    }
  }
  return attributeTrades(fills).filter((trade) => trade.side === "LONG");
}

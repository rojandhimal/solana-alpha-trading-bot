import type { ExecutionFill } from "./execution-model.js";

export interface CompletedTrade {
  entryIndex: number;
  exitIndex: number;
  side: "LONG";
  quantity: number;
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
  entryPrice: number;
  entryFeePerUnit: number;
}

export function attributeLongTrades(fills: readonly ExecutionFill[]): CompletedTrade[] {
  const lots: OpenLot[] = [];
  const trades: CompletedTrade[] = [];

  for (const fill of fills) {
    if (fill.side === "BUY") {
      lots.push({ entryIndex: fill.executionIndex, quantity: fill.quantity, entryPrice: fill.fillPrice, entryFeePerUnit: fill.fee / fill.quantity });
      continue;
    }

    let remaining = fill.quantity;
    while (remaining > 1e-9) {
      const lot = lots[0];
      if (!lot) throw new Error(`SELL quantity exceeds open long at execution index ${fill.executionIndex}`);
      const quantity = Math.min(remaining, lot.quantity);
      const entryFee = lot.entryFeePerUnit * quantity;
      const exitFee = fill.fee * (quantity / fill.quantity);
      const grossPnl = (fill.fillPrice - lot.entryPrice) * quantity;
      const netPnl = grossPnl - entryFee - exitFee;
      const invested = lot.entryPrice * quantity + entryFee;
      trades.push({ entryIndex: lot.entryIndex, exitIndex: fill.executionIndex, side: "LONG", quantity, entryPrice: lot.entryPrice, exitPrice: fill.fillPrice, entryFee, exitFee, grossPnl, netPnl, returnPct: invested === 0 ? 0 : (netPnl / invested) * 100, holdingBars: fill.executionIndex - lot.entryIndex });
      lot.quantity -= quantity;
      remaining -= quantity;
      if (lot.quantity <= 1e-9) lots.shift();
    }
  }

  return trades;
}

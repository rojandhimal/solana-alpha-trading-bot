import type { PaperTradingSnapshot } from "./paper-trading-state.js";
import type { PaperTradingRepository } from "./paper-trading-persistence.js";

export interface PaperTradingReconciliationResult {
  reconciled: boolean;
  persistedFillCount: number;
  persistedEquityCount: number;
  errors: readonly string[];
}

export async function reconcilePaperTradingState(
  repository: PaperTradingRepository,
  sessionId: string,
  snapshot: PaperTradingSnapshot
): Promise<PaperTradingReconciliationResult> {
  if (!sessionId.trim()) throw new Error("sessionId must not be empty");
  const [trades, equity] = await Promise.all([repository.listTrades(sessionId), repository.listEquity(sessionId)]);
  const errors: string[] = [];
  if (trades.length > snapshot.fillCount) errors.push(`persisted fill count ${trades.length} exceeds state fill count ${snapshot.fillCount}`);
  const latest = snapshot.accounting.equityCurve.at(-1);
  const persistedLatest = equity.at(-1);
  if (persistedLatest && latest) {
    if (persistedLatest.equity !== latest.equity || persistedLatest.cash !== latest.cash || persistedLatest.positionQuantity !== latest.positionQuantity || persistedLatest.drawdownPct !== latest.drawdownPct) {
      errors.push("latest persisted equity does not match deterministic state");
    }
  }
  return { reconciled: errors.length === 0, persistedFillCount: trades.length, persistedEquityCount: equity.length, errors };
}

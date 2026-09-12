import type { ExecutionFill } from "./execution-model.js";
import type { PaperTradingSnapshot } from "./paper-trading-state.js";

export interface PaperTradeRecord { sessionId: string; sequence: number; fill: ExecutionFill; recordedAtMs: number; }
export interface PaperEquitySnapshot { sessionId: string; sequence: number; timestampMs: number; equity: number; cash: number; positionQuantity: number; drawdownPct: number; }
export interface PaperTradingRepository {
  saveTrade(record: PaperTradeRecord): Promise<void>;
  saveEquity(snapshot: PaperEquitySnapshot): Promise<void>;
  listTrades(sessionId: string): Promise<readonly PaperTradeRecord[]>;
  listEquity(sessionId: string): Promise<readonly PaperEquitySnapshot[]>;
}

/** In-memory persistence for tests and local paper trading. No secrets or broker credentials are stored. */
export class InMemoryPaperTradingRepository implements PaperTradingRepository {
  private readonly trades: PaperTradeRecord[] = [];
  private readonly equity: PaperEquitySnapshot[] = [];
  async saveTrade(record: PaperTradeRecord): Promise<void> { this.trades.push({ ...record, fill: { ...record.fill } }); }
  async saveEquity(snapshot: PaperEquitySnapshot): Promise<void> { this.equity.push({ ...snapshot }); }
  async listTrades(sessionId: string): Promise<readonly PaperTradeRecord[]> { return this.trades.filter((r) => r.sessionId === sessionId).map((r) => ({ ...r, fill: { ...r.fill } })); }
  async listEquity(sessionId: string): Promise<readonly PaperEquitySnapshot[]> { return this.equity.filter((r) => r.sessionId === sessionId).map((r) => ({ ...r })); }
}

export async function persistPaperSnapshot(
  repository: PaperTradingRepository,
  sessionId: string,
  sequence: number,
  snapshot: PaperTradingSnapshot,
  timestampMs: number
): Promise<void> {
  if (!sessionId.trim()) throw new Error("sessionId must not be empty");
  if (!Number.isInteger(sequence) || sequence < 0) throw new Error("sequence must be a non-negative integer");
  if (!Number.isFinite(timestampMs) || timestampMs < 0) throw new Error("timestampMs must be a non-negative number");
  const fill = snapshot.accounting.equityCurve.length > 0 ? undefined : undefined;
  void fill;
  const latest = snapshot.accounting.equityCurve.at(-1);
  if (!latest) return;
  await repository.saveEquity({ sessionId, sequence, timestampMs, equity: latest.equity, cash: latest.cash, positionQuantity: latest.positionQuantity, drawdownPct: latest.drawdownPct });
}

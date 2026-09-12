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
  private readonly trades = new Map<string, PaperTradeRecord>();
  private readonly equity = new Map<string, PaperEquitySnapshot>();
  async saveTrade(record: PaperTradeRecord): Promise<void> {
    const key = `${record.sessionId}:${record.sequence}`;
    const existing = this.trades.get(key);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) throw new Error(`conflicting paper trade sequence ${record.sequence}`);
      return;
    }
    this.trades.set(key, { ...record, fill: { ...record.fill } });
  }
  async saveEquity(snapshot: PaperEquitySnapshot): Promise<void> {
    const key = `${snapshot.sessionId}:${snapshot.sequence}`;
    const existing = this.equity.get(key);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(snapshot)) throw new Error(`conflicting paper equity sequence ${snapshot.sequence}`);
      return;
    }
    this.equity.set(key, { ...snapshot });
  }
  async listTrades(sessionId: string): Promise<readonly PaperTradeRecord[]> {
    return [...this.trades.values()].filter((r) => r.sessionId === sessionId).sort((a, b) => a.sequence - b.sequence).map((r) => ({ ...r, fill: { ...r.fill } }));
  }
  async listEquity(sessionId: string): Promise<readonly PaperEquitySnapshot[]> {
    return [...this.equity.values()].filter((r) => r.sessionId === sessionId).sort((a, b) => a.sequence - b.sequence).map((r) => ({ ...r }));
  }
}

export async function persistPaperSnapshot(repository: PaperTradingRepository, sessionId: string, sequence: number, snapshot: PaperTradingSnapshot, timestampMs: number): Promise<void> {
  if (!sessionId.trim()) throw new Error("sessionId must not be empty");
  if (!Number.isInteger(sequence) || sequence < 0) throw new Error("sequence must be a non-negative integer");
  if (!Number.isFinite(timestampMs) || timestampMs < 0) throw new Error("timestampMs must be a non-negative number");
  const latest = snapshot.accounting.equityCurve.at(-1);
  if (!latest) return;
  await repository.saveEquity({ sessionId, sequence, timestampMs, equity: latest.equity, cash: latest.cash, positionQuantity: latest.positionQuantity, drawdownPct: latest.drawdownPct });
}

import { describe, expect, it } from "vitest";
import { InMemoryPaperTradingRepository, persistPaperSnapshot } from "./paper-trading-persistence.js";
import { PaperTradingState } from "./paper-trading-state.js";

const candle = (i: number) => ({ timestamp: i * 60_000, open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i, volume: 1_000 });

describe("paper-trading persistence", () => {
  it("is idempotent for identical trade and equity records", async () => {
    const repo = new InMemoryPaperTradingRepository();
    const trade = { sessionId: "s1", sequence: 0, recordedAtMs: 1, fill: { signalIndex: 0, executionIndex: 0, side: "BUY" as const, quantity: 1, referencePrice: 100, fillPrice: 100.1, fee: 0.1 } };
    await repo.saveTrade(trade);
    await repo.saveTrade(trade);
    expect(await repo.listTrades("s1")).toHaveLength(1);
    const equity = { sessionId: "s1", sequence: 0, timestampMs: 1, equity: 10_000, cash: 9_900, positionQuantity: 1, drawdownPct: 0 };
    await repo.saveEquity(equity);
    await repo.saveEquity(equity);
    expect(await repo.listEquity("s1")).toHaveLength(1);
    await expect(repo.saveTrade({ ...trade, fill: { ...trade.fill, fillPrice: 101 } })).rejects.toThrow("conflicting paper trade sequence");
  });

  it("persists the latest deterministic equity snapshot", async () => {
    const state = new PaperTradingState({ initialCapital: 10_000, execution: { quantity: 1 } });
    state.append(candle(0));
    const snapshot = state.append(candle(1));
    const repo = new InMemoryPaperTradingRepository();
    await persistPaperSnapshot(repo, "s1", 1, snapshot, candle(1).timestamp!);
    const stored = await repo.listEquity("s1");
    expect(stored).toHaveLength(1);
    expect(stored[0]?.equity).toBe(snapshot.accounting.equityCurve.at(-1)?.equity);
  });
});

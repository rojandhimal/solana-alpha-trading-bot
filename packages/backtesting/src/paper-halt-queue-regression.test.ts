import { describe, expect, it } from "vitest";
import {
  InMemoryPaperEventJournal,
  PersistedPaperTradingSession,
} from "./paper-event-journal.js";
import { generateStrategyFills } from "./strategy-execution-adapter.js";

const config = {
  initialCapital: 1000,
  execution: { quantity: 1 },
  allowShort: true,
};
const candle = (timestamp: number, price = 100) => ({
  timestamp,
  open: price,
  high: price + 1,
  low: price - 1,
  close: price,
  volume: 100,
});

describe("operator halt while persistence is queued", () => {
  it("immediately reports a halt and rejects unstarted candles until it is durable", async () => {
    const memory = new InMemoryPaperEventJournal();
    let release!: () => void;
    let started!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const session = await PersistedPaperTradingSession.restore(
      {
        load: () => memory.load(),
        append: async (record) => {
          if (record.eventId === "in-flight") {
            started();
            await blocked;
          }
          await memory.append(record);
        },
      },
      "halted",
      config,
    );
    await session.append("warmup", candle(1, 100));
    const inFlight = session.append("in-flight", candle(2, 101));
    await entered;
    // This third bar would execute the preceding long-entry signal.
    const queued = session.append("queued", candle(3, 102));
    expect(
      generateStrategyFills(
        [candle(1, 100), candle(2, 101), candle(3, 102)],
        config.execution,
      ).some((fill) => fill.side === "BUY" && fill.executionIndex === 2),
    ).toBe(true);
    const rejected = expect(queued).rejects.toThrow(/halt pending persistence/);
    const halt = session.halt("kill", "operator kill switch");
    const immediate = session.snapshot();
    release();
    await inFlight;
    await halt;
    await rejected;
    expect(immediate.risk.halted).toBe(true);
    expect(immediate.risk.reasons).toContain("operator kill switch");
    expect((await memory.load()).map((record) => record.event.kind)).toEqual([
      "CANDLE",
      "CANDLE",
      "HALT",
    ]);
    expect(session.snapshot().fillCount).toBe(0);
    expect(
      (
        await PersistedPaperTradingSession.restore(memory, "halted", config)
      ).snapshot(),
    ).toEqual(session.snapshot());
    const after = await session.append("retry", candle(3, 102));
    expect(after.candleCount).toBe(3);
    expect(after.fillCount).toBe(0);
    expect(after.risk.halted).toBe(true);
  });

  it("does not latch a halt for an event ID conflicting with an in-flight candle", async () => {
    const journal = new InMemoryPaperEventJournal();
    const session = await PersistedPaperTradingSession.restore(
      journal,
      "conflict",
      config,
    );
    const candlePromise = session.append("same", candle(1));
    await expect(session.halt("same", "operator stop")).rejects.toThrow(
      /conflicting/,
    );
    await candlePromise;
    expect(session.snapshot().risk.halted).toBe(false);
    expect(await journal.load()).toHaveLength(1);
  });

  it("retains simultaneous halt reasons and persists each once", async () => {
    const journal = new InMemoryPaperEventJournal();
    const session = await PersistedPaperTradingSession.restore(
      journal,
      "reasons",
      config,
    );
    const first = session.halt("first", "first reason");
    const second = session.halt("second", "second reason");
    const pending = session.snapshot();
    await Promise.all([first, second]);
    expect(pending.risk.halted).toBe(true);
    expect(pending.risk.reasons).toEqual(["first reason", "second reason"]);
    expect(session.snapshot().risk.reasons).toEqual([
      "first reason",
      "second reason",
    ]);
    await session.halt("second", "second reason");
    expect(await journal.load()).toHaveLength(2);
  });

  it("rejects an empty reason without changing accepted state", async () => {
    const session = await PersistedPaperTradingSession.restore(
      new InMemoryPaperEventJournal(),
      "invalid",
      config,
    );
    const before = session.snapshot();
    await expect(session.halt("empty", " ")).rejects.toThrow(/reason/);
    expect(session.snapshot()).toEqual(before);
  });
});

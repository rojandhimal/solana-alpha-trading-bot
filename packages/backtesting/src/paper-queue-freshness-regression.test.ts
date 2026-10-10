import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FilePaperEventJournal,
  InMemoryPaperEventJournal,
  PersistedPaperTradingSession,
} from "./paper-event-journal.js";

const HOUR = 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 11, 12);
const config = {
  initialCapital: 1000,
  execution: { quantity: 1 },
  allowShort: true,
};
const candle = (timestamp: number) => ({
  timestamp,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 100,
});
afterEach(() => vi.useRealTimers());

describe("paper queue ownership and completed realtime bars", () => {
  it("copies a file-journal record before it waits in the write queue", async () => {
    const memory = new InMemoryPaperEventJournal();
    const source = await PersistedPaperTradingSession.restore(
      memory,
      "ownership",
      config,
    );
    await source.append("bar", candle(now - HOUR));
    const record = structuredClone((await memory.load())[0]!);
    const expected = structuredClone(record);
    const directory = await mkdtemp(join(tmpdir(), "paper-ownership-"));
    try {
      const journal = new FilePaperEventJournal(join(directory, "events.json"));
      const pending = journal.append(record);
      if (record.event.kind === "CANDLE") record.event.candle.close = 101;
      record.snapshot.accounting.finalEquity = 42;
      await pending;
      expect(await journal.load()).toEqual([expected]);
      expect(
        (
          await PersistedPaperTradingSession.restore(
            journal,
            "ownership",
            config,
          )
        ).snapshot(),
      ).toEqual(source.snapshot());
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([
    ["incomplete", now],
    ["unaligned", now - HOUR + 1],
    ["future", now + HOUR],
    ["stale", now - 3 * HOUR],
  ])(
    "rejects a %s hourly bar without mutating or persisting state",
    async (_label, timestamp) => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      const journal = new InMemoryPaperEventJournal();
      const session = await PersistedPaperTradingSession.restore(
        journal,
        "freshness",
        config,
      );
      const before = session.snapshot();
      await expect(
        session.appendRealtime("invalid", candle(timestamp as number)),
      ).rejects.toThrow();
      expect(session.snapshot()).toEqual(before);
      expect(await journal.load()).toEqual([]);
    },
  );

  it("accepts a complete UTC hourly bar and preserves its submitted values", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const journal = new InMemoryPaperEventJournal();
    const session = await PersistedPaperTradingSession.restore(
      journal,
      "valid",
      config,
    );
    const submitted = candle(now - HOUR);
    const pending = session.appendRealtime("valid", submitted);
    submitted.close = 101;
    await pending;
    expect((await journal.load())[0]?.event).toEqual({
      kind: "CANDLE",
      candle: candle(now - HOUR),
    });
  });

  it("checks realtime freshness when the queued operation starts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
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
          started();
          await blocked;
          await memory.append(record);
        },
      },
      "queued",
      config,
    );
    const first = session.append("historical", candle(now - 2 * HOUR));
    await entered;
    const queued = session.appendRealtime("realtime", candle(now - HOUR));
    // Attach the rejection assertion before releasing the queued operation.
    const rejection = expect(queued).rejects.toThrow(/stale/);
    vi.setSystemTime(now + 3 * HOUR);
    release();
    await first;
    await rejection;
    expect(session.snapshot().candleCount).toBe(1);
    expect(await memory.load()).toHaveLength(1);
    expect(session.snapshot().risk.halted).toBe(false);
  });

  it("allows an exact durable realtime retry after the bar becomes stale", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const journal = new InMemoryPaperEventJournal();
    const session = await PersistedPaperTradingSession.restore(
      journal,
      "retry",
      config,
    );
    const input = candle(now - HOUR);
    const original = await session.appendRealtime("retry", input);
    vi.setSystemTime(now + 3 * HOUR);
    expect(await session.appendRealtime("retry", input)).toEqual(original);
    await expect(
      session.appendRealtime("retry", { ...input, close: 101 }),
    ).rejects.toThrow(/conflicting/);
    expect(await journal.load()).toHaveLength(1);
  });
});

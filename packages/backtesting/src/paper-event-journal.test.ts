import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FilePaperEventJournal,
  InMemoryPaperEventJournal,
  PersistedPaperTradingSession,
} from "./paper-event-journal.js";
const config = {
  initialCapital: 1000,
  execution: { quantity: 1 },
  allowShort: true,
};
const candle = (i: number) => ({
  timestamp: i + 1,
  open: 100 + i,
  high: 101 + i,
  low: 99 + i,
  close: 100 + i,
  volume: 100,
});
describe("atomic paper journal", () => {
  it("restarts deterministically, is idempotent and rejects event conflicts", async () => {
    const journal = new InMemoryPaperEventJournal();
    const session = await PersistedPaperTradingSession.restore(
      journal,
      "test",
      config,
    );
    for (let i = 0; i < 15; i++) await session.append(String(i), candle(i));
    const before = session.snapshot();
    await session.append("14", candle(14));
    expect(session.snapshot()).toEqual(before);
    await expect(session.append("14", candle(15))).rejects.toThrow(
      /conflicting/,
    );
    const recovered = await PersistedPaperTradingSession.restore(
      journal,
      "test",
      config,
    );
    expect(recovered.snapshot()).toEqual(before);
    await recovered.halt("kill", "operator kill switch");
    const halted = await PersistedPaperTradingSession.restore(
      journal,
      "test",
      config,
    );
    expect(halted.snapshot().risk.halted).toBe(true);
    await expect(
      PersistedPaperTradingSession.restore(journal, "test", {
        ...config,
        initialCapital: 2000,
      }),
    ).rejects.toThrow(/config mismatch/);
  });
  it("does not commit state or report success when storage fails", async () => {
    const session = await PersistedPaperTradingSession.restore(
      {
        load: async () => [],
        append: async () => {
          throw new Error("disk unavailable");
        },
      },
      "test",
      config,
    );
    await expect(session.append("0", candle(0))).rejects.toThrow(
      /disk unavailable/,
    );
    expect(session.snapshot().candleCount).toBe(0);
  });
  it("serializes concurrent appends and recovers an on-disk journal", async () => {
    const path = join(
      await mkdtemp(join(tmpdir(), "paper-journal-")),
      "nested",
      "events.json",
    );
    const session = await PersistedPaperTradingSession.restore(
      new FilePaperEventJournal(path),
      "test",
      config,
    );
    await Promise.all(
      Array.from({ length: 5 }, (_, i) => session.append(String(i), candle(i))),
    );
    expect(
      (
        await PersistedPaperTradingSession.restore(
          new FilePaperEventJournal(path),
          "test",
          config,
        )
      ).snapshot(),
    ).toEqual(session.snapshot());
    const records = JSON.parse(await readFile(path, "utf8"));
    records[0].snapshot.accounting.finalEquity = 42;
    await writeFile(path, JSON.stringify(records));
    await expect(
      PersistedPaperTradingSession.restore(
        new FilePaperEventJournal(path),
        "test",
        config,
      ),
    ).rejects.toThrow(/replay mismatch/);
  });
});
it("rejects stale realtime candles before persistence", async () => {
  const journal = new InMemoryPaperEventJournal();
  const session = await PersistedPaperTradingSession.restore(
    journal,
    "fresh",
    config,
  );
  await expect(session.appendRealtime("old", candle(0))).rejects.toThrow(
    /stale/,
  );
  expect(await journal.load()).toHaveLength(0);
});

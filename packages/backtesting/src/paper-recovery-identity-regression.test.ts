import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FilePaperEventJournal,
  InMemoryPaperEventJournal,
  PersistedPaperTradingSession,
  type PaperJournalRecord,
} from "./paper-event-journal.js";

const config = {
  initialCapital: 1000,
  execution: { quantity: 1 },
  allowShort: true,
};
const candle = {
  timestamp: 1,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 100,
};
const reorderedConfig = {
  allowShort: true,
  execution: { quantity: 1 },
  initialCapital: 1000,
};

function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, child]) => [key, reverseKeys(child)]),
    );
  return value;
}

describe("paper recovery identity", () => {
  it("restores equivalent config keys and retries reordered candle keys exactly once", async () => {
    const journal = new InMemoryPaperEventJournal();
    const session = await PersistedPaperTradingSession.restore(
      journal,
      "identity",
      config,
    );
    const snapshot = await session.append("candle", candle);
    const restored = await PersistedPaperTradingSession.restore(
      journal,
      "identity",
      reorderedConfig,
    );
    expect(restored.snapshot()).toEqual(snapshot);
    expect(
      await restored.append("candle", {
        volume: 100,
        close: 100,
        low: 99,
        high: 101,
        open: 100,
        timestamp: 1,
      }),
    ).toEqual(snapshot);
    expect(await journal.load()).toHaveLength(1);
    await expect(
      restored.append("candle", { ...candle, volume: 101 }),
    ).rejects.toThrow(/conflicting/);
    await expect(
      PersistedPaperTradingSession.restore(journal, "identity", {
        ...config,
        allowShort: false,
      }),
    ).rejects.toThrow(/config mismatch/);
  });

  it("reconciles reordered JSON record and snapshot fields without changing array order", async () => {
    const path = join(
      await mkdtemp(join(tmpdir(), "paper-identity-")),
      "events.json",
    );
    const journal = new FilePaperEventJournal(path);
    const session = await PersistedPaperTradingSession.restore(
      journal,
      "identity",
      config,
    );
    await session.append("candle", candle);
    await session.halt("halt", "operator halt");
    const records = JSON.parse(await readFile(path, "utf8"));
    await writeFile(path, JSON.stringify(reverseKeys(records)));
    const restored = await PersistedPaperTradingSession.restore(
      journal,
      "identity",
      reorderedConfig,
    );
    expect(restored.snapshot()).toEqual(session.snapshot());
    await journal.append(reverseKeys(records[1]) as PaperJournalRecord);
    expect(await journal.load()).toHaveLength(2);
  });

  it("replays legacy hash records and rejects unknown hash versions", async () => {
    const journal = new InMemoryPaperEventJournal();
    const session = await PersistedPaperTradingSession.restore(
      journal,
      "legacy",
      config,
    );
    await session.append("candle", candle);
    const records = structuredClone(
      await journal.load(),
    ) as (PaperJournalRecord & { configHashVersion?: number })[];
    delete records[0]!.configHashVersion;
    records[0]!.configHash = createHash("sha256")
      .update(JSON.stringify(config))
      .digest("hex");
    const legacyJournal = {
      load: async () => records,
      append: async (record: PaperJournalRecord) => {
        records.push(structuredClone(record));
      },
    };
    expect(
      (
        await PersistedPaperTradingSession.restore(
          legacyJournal,
          "legacy",
          config,
        )
      ).snapshot(),
    ).toEqual(session.snapshot());
    const mixed = await PersistedPaperTradingSession.restore(
      legacyJournal,
      "legacy",
      config,
    );
    await mixed.append("second", { ...candle, timestamp: 2 });
    expect(records[1]!.configHashVersion).toBe(2);
    expect(
      (
        await PersistedPaperTradingSession.restore(
          legacyJournal,
          "legacy",
          config,
        )
      ).snapshot(),
    ).toEqual(mixed.snapshot());
    await expect(
      PersistedPaperTradingSession.restore(
        legacyJournal,
        "legacy",
        reorderedConfig,
      ),
    ).rejects.toThrow(/config mismatch/);
    (records[0] as unknown as Record<string, unknown>).configHashVersion = 999;
    await expect(
      PersistedPaperTradingSession.restore(legacyJournal, "legacy", config),
    ).rejects.toThrow(/hash version/);
  });

  it("rejects malformed unrelated history before restoring or appending another session", async () => {
    const path = join(
      await mkdtemp(join(tmpdir(), "paper-invalid-")),
      "events.json",
    );
    await writeFile(
      path,
      JSON.stringify([{ sessionId: "other", sequence: 0, eventId: "bad" }]),
    );
    const journal = new FilePaperEventJournal(path);
    await expect(
      PersistedPaperTradingSession.restore(journal, "identity", config),
    ).rejects.toThrow(/invalid paper journal/);
    expect(JSON.parse(await readFile(path, "utf8"))).toHaveLength(1);
  });

  it.each(["candle", "snapshot", "fills"])(
    "validates unrelated record %s content before selecting a session",
    async (field) => {
      const journal = new InMemoryPaperEventJournal();
      const session = await PersistedPaperTradingSession.restore(
        journal,
        "other",
        config,
      );
      await session.append("first", candle);
      const records = structuredClone(
        await journal.load(),
      ) as PaperJournalRecord[];
      const record = records[0]!;
      if (field === "candle")
        record.event = { kind: "CANDLE", candle: {} as typeof candle };
      if (field === "snapshot") record.snapshot = {} as typeof record.snapshot;
      if (field === "fills") {
        record.snapshot.fillCount = 1;
        record.fills = [{} as PaperJournalRecord["fills"][number]];
      }
      await expect(
        PersistedPaperTradingSession.restore(
          { load: async () => records, append: async () => {} },
          "active",
          config,
        ),
      ).rejects.toThrow(/invalid paper journal/);
    },
  );
});

describe("durably halted recovery", () => {
  it("waits for the recovery halt write before returning an owner", async () => {
    const storage = new InMemoryPaperEventJournal();
    let startWrite!: () => void;
    const started = new Promise<void>((resolve) => {
      startWrite = resolve;
    });
    let releaseWrite!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const journal = {
      load: () => storage.load(),
      append: async (record: PaperJournalRecord) => {
        startWrite();
        await held;
        await storage.append(record);
      },
    };
    let resolved = false;
    const pending = PersistedPaperTradingSession.restoreHalted(
      journal,
      "recover",
      config,
      "halt",
      "storage recovery",
    ).then((session) => {
      resolved = true;
      return session;
    });
    await started;
    expect(resolved).toBe(false);
    expect(await storage.load()).toHaveLength(0);
    releaseWrite();
    expect((await pending).snapshot().risk.halted).toBe(true);
    expect(await storage.load()).toHaveLength(1);
  });

  it.each([false, true])(
    "halts before returning when the failed write reached storage: %s",
    async (persistBeforeFailure) => {
      const storage = new InMemoryPaperEventJournal();
      let fail = false;
      const journal = {
        load: () => storage.load(),
        append: async (record: PaperJournalRecord) => {
          if (!fail || persistBeforeFailure) await storage.append(record);
          if (fail) throw new Error("uncertain storage write");
        },
      };
      const session = await PersistedPaperTradingSession.restore(
        journal,
        "recover",
        config,
      );
      await session.append("first", candle);
      fail = true;
      await expect(
        session.append("uncertain", { ...candle, timestamp: 2 }),
      ).rejects.toThrow(/uncertain storage/);
      fail = false;
      const restored = await PersistedPaperTradingSession.restoreHalted(
        journal,
        "recover",
        config,
        "recovery-halt",
        "storage recovery",
      );
      expect(restored.snapshot().risk.halted).toBe(true);
      expect(restored.snapshot().candleCount).toBe(
        persistBeforeFailure ? 2 : 1,
      );
      expect((await storage.load()).at(-1)?.event).toEqual({
        kind: "HALT",
        reason: "storage recovery",
      });
      expect(
        (
          await PersistedPaperTradingSession.restore(storage, "recover", config)
        ).snapshot(),
      ).toEqual(restored.snapshot());
      await expect(
        session.append("old-owner", { ...candle, timestamp: 3 }),
      ).rejects.toThrow(/explicit journal recovery/);
    },
  );

  it("does not return a recovered owner when its halt fails persistence", async () => {
    const journal = {
      load: async () => [],
      append: async () => {
        throw new Error("disk unavailable");
      },
    };
    await expect(
      PersistedPaperTradingSession.restoreHalted(
        journal,
        "recover",
        config,
        "recovery-halt",
        "storage recovery",
      ),
    ).rejects.toThrow(/disk unavailable/);
  });

  it("rejects a conflicting recovery identity and invalid halt reason without persisting", async () => {
    const journal = new InMemoryPaperEventJournal();
    const session = await PersistedPaperTradingSession.restore(
      journal,
      "recover",
      config,
    );
    await session.append("first", candle);
    await expect(
      PersistedPaperTradingSession.restoreHalted(
        journal,
        "recover",
        config,
        "first",
        "storage recovery",
      ),
    ).rejects.toThrow(/conflicting/);
    await expect(
      PersistedPaperTradingSession.restoreHalted(
        journal,
        "recover",
        config,
        "halt",
        " ",
      ),
    ).rejects.toThrow(/reason/);
    expect(await journal.load()).toHaveLength(1);
  });
});

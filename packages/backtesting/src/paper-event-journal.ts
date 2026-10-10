import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import {
  PaperTradingState,
  type PaperTradingStateConfig,
  type PaperTradingSnapshot,
} from "./paper-trading-state.js";
import type { StrategyCandle } from "./alpha-strategy.js";
import type { ExecutionFill } from "./execution-model.js";
export type PaperEvent =
  { kind: "CANDLE"; candle: StrategyCandle } | { kind: "HALT"; reason: string };
export interface PaperJournalRecord {
  sessionId: string;
  sequence: number;
  eventId: string;
  configHash: string;
  event: PaperEvent;
  snapshot: PaperTradingSnapshot;
  fills: readonly ExecutionFill[];
}
/** append must atomically persist an entire event, including its fills and snapshot. */
export interface PaperEventJournal {
  load(): Promise<readonly PaperJournalRecord[]>;
  append(record: PaperJournalRecord): Promise<void>;
}
function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function checkAppend(
  records: readonly PaperJournalRecord[],
  record: PaperJournalRecord,
): boolean {
  if (
    !record.sessionId.trim() ||
    !record.eventId.trim() ||
    !Number.isSafeInteger(record.sequence) ||
    record.sequence < 0
  )
    throw new Error("invalid journal identity");
  const existing = records.find(
    (r) =>
      r.sessionId === record.sessionId &&
      (r.sequence === record.sequence || r.eventId === record.eventId),
  );
  if (existing) {
    if (fingerprint(existing) !== fingerprint(record))
      throw new Error("conflicting journal event");
    return false;
  }
  const session = records.filter((r) => r.sessionId === record.sessionId);
  if (record.sequence !== session.length)
    throw new Error("journal sequence must be contiguous");
  return true;
}
export class InMemoryPaperEventJournal implements PaperEventJournal {
  private records: PaperJournalRecord[] = [];
  async load(): Promise<readonly PaperJournalRecord[]> {
    return structuredClone(this.records);
  }
  async append(record: PaperJournalRecord): Promise<void> {
    if (checkAppend(this.records, record))
      this.records.push(structuredClone(record));
  }
}
/** One file per session/owner. Atomic replacement; no multi-process writer support. */
export class FilePaperEventJournal implements PaperEventJournal {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly path: string) {}
  async load(): Promise<readonly PaperJournalRecord[]> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.path, "utf8"));
      if (!Array.isArray(parsed)) throw new Error("invalid paper journal");
      return parsed as PaperJournalRecord[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  append(record: PaperJournalRecord): Promise<void> {
    const operation = this.queue.then(async () => {
      const records = await this.load();
      if (!checkAppend(records, record)) return;
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      try {
        const file = await open(temporary, "wx", 0o600);
        try {
          await file.writeFile(
            JSON.stringify([...records, record]) + "\n",
            "utf8",
          );
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, this.path);
        const directory = await open(dirname(this.path), "r");
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      } finally {
        await unlink(temporary).catch((error) => {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        });
      }
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
export class PersistedPaperTradingSession {
  private state: PaperTradingState;
  private records: PaperJournalRecord[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private readonly config: PaperTradingStateConfig;
  private storageFailed = false;
  private constructor(
    private readonly journal: PaperEventJournal,
    private readonly sessionId: string,
    config: PaperTradingStateConfig,
  ) {
    this.config = structuredClone(config);
    this.state = new PaperTradingState(this.config);
  }
  static async restore(
    journal: PaperEventJournal,
    sessionId: string,
    config: PaperTradingStateConfig,
  ): Promise<PersistedPaperTradingSession> {
    if (!sessionId.trim()) throw new Error("sessionId required");
    const session = new PersistedPaperTradingSession(
      journal,
      sessionId,
      config,
    );
    const all = await journal.load();
    for (const record of all.filter((r) => r.sessionId === sessionId)) {
      if (record.configHash !== fingerprint(session.config))
        throw new Error("paper journal config mismatch");
      if (!checkAppend(session.records, record))
        throw new Error("duplicate persisted journal event");
      session.apply(session.state, record.event);
      if (
        fingerprint(session.state.snapshot()) !==
          fingerprint(record.snapshot) ||
        fingerprint(session.state.getFills()) !== fingerprint(record.fills)
      )
        throw new Error("paper journal replay mismatch");
      session.records.push(structuredClone(record));
    }
    return session;
  }
  private apply(state: PaperTradingState, event: PaperEvent): void {
    if (event.kind === "CANDLE") state.append(event.candle);
    else if (event.kind === "HALT") state.halt(event.reason);
    else throw new Error("invalid paper event kind");
  }
  appendRealtime(
    eventId: string,
    candle: StrategyCandle,
  ): Promise<PaperTradingSnapshot> {
    const now = Date.now();
    if (
      candle.timestamp === undefined ||
      !Number.isSafeInteger(candle.timestamp) ||
      candle.timestamp > now ||
      now - candle.timestamp > 2 * 60 * 60 * 1000
    )
      return Promise.reject(new Error("stale or future realtime candle"));
    return this.append(eventId, candle);
  }
  append(
    eventId: string,
    candle: StrategyCandle,
  ): Promise<PaperTradingSnapshot> {
    return this.commit(eventId, { kind: "CANDLE", candle: { ...candle } });
  }
  halt(eventId: string, reason: string): Promise<PaperTradingSnapshot> {
    return this.commit(eventId, { kind: "HALT", reason });
  }
  private commit(
    eventId: string,
    event: PaperEvent,
  ): Promise<PaperTradingSnapshot> {
    const operation = this.queue.then(async () => {
      if (this.storageFailed)
        throw new Error(
          "paper storage failed; explicit journal recovery is required",
        );
      if (!eventId.trim()) throw new Error("eventId required");
      const existing = this.records.find((r) => r.eventId === eventId);
      if (existing) {
        if (fingerprint(existing.event) !== fingerprint(event))
          throw new Error("conflicting eventId");
        return structuredClone(existing.snapshot);
      }
      const trial = new PaperTradingState(this.config);
      for (const record of this.records) this.apply(trial, record.event);
      this.apply(trial, event);
      const snapshot = trial.snapshot();
      const record: PaperJournalRecord = {
        sessionId: this.sessionId,
        sequence: this.records.length,
        eventId,
        configHash: fingerprint(this.config),
        event,
        snapshot,
        fills: trial.getFills(),
      };
      try {
        await this.journal.append(record);
      } catch (error) {
        this.storageFailed = true;
        this.state.halt(
          "persistence failure: session halted pending explicit recovery",
        );
        throw error;
      }
      this.state = trial;
      this.records.push(structuredClone(record));
      return structuredClone(snapshot);
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  snapshot(): PaperTradingSnapshot {
    return this.state.snapshot();
  }
}

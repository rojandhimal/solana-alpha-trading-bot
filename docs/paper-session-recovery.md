# Paper session ingestion, halt and recovery contract

Updated 11 October 2026 (Australia/Melbourne). These are research simulation APIs, not a deployed paper service or evidence of elapsed operation. Live execution is disabled.

## Realtime hourly candles

`PersistedPaperTradingSession.appendRealtime(eventId, candle)` expects `candle.timestamp` to be the **UTC opening timestamp in milliseconds** of an hourly candle. It must be a non-negative safe integer aligned to a UTC hour. The candle must have completed (`timestamp + one hour <= current time`) and its opening timestamp must be no more than two hours old. Timestamp, OHLC and volume validation must all pass.

Freshness is checked when a new event reaches the session queue and again immediately before journal submission. A candle that expires while waiting is rejected without advancing accepted state or latching a storage failure. Rejected input must be fetched/validated again before retry; it must not be relabeled with a newer timestamp.

`append` deliberately permits validated historical candles for replay and tests. Historical ingestion cannot satisfy elapsed realtime paper acceptance. Neither method is an unattended runner: arrival times, missing observations, duration/regime requirements and the frozen strategy policy still need a separately declared acceptance process.

## Event ownership and retries

Session events and file-journal records are copied before waiting in their queues. Changing the caller's object after submission cannot alter the accepted candle, snapshot or persisted record. The journal callback receives a separate copy of the session's record.

Reuse an event ID only for an exact retry of the same event. A conflicting queued or durable event is rejected. A successful exact retry returns that event's historical snapshot and does not add another record or fill; a persisted realtime event may be retried after its bar becomes stale. Use `session.snapshot()` for the current risk state, especially when a halt has been requested since the original event.

## Operator halt during persistence

Calling `session.halt(eventId, reason)` immediately makes `session.snapshot().risk.halted` true for a valid new halt. An empty reason or conflicting event ID is rejected without creating a halt request. Await the returned promise to confirm that the HALT record is durable.

Candles whose processing has not begun are rejected while a halt awaits persistence, including candles queued before the request. After the HALT promise succeeds, explicitly retry any required observation. The durable halt prevents new exposure while allowing strategy-generated risk-reducing exits. Simultaneous halt reasons remain visible and are persisted individually.

A journal write already in progress may finish: it represents an event accepted before the halt request. The halt does not erase committed history or cancel filesystem writes. This is a simulation queue guarantee, not an intrabar or broker-side cancellation mechanism.

## Storage failure and explicit recovery

Use one process owner for each file journal. Multiple writers/processes are unsupported. Keep the exact session identity and configuration used to create its records.

1. Stop feeding the failed session. A storage failure latches risk and refuses later commits until explicit recovery; an unresolved HALT promise is not proof of durable persistence.
2. Restore storage and inspect the retained file. Atomic replacement can leave either the prior valid prefix or the just-written event if failure occurred after rename. Do not delete, rewrite or assume absence of that event.
3. Restore through `PersistedPaperTradingSession.restore` using the same identity and configuration. Sequence, event identity, snapshot and fill replay must reconcile. Corrupt or conflicting history must fail recovery.
4. After a known storage failure, persist and await a new recovery HALT **before submitting any new candles**. The restored prefix may omit the in-memory failure/requested halt if storage was unavailable; restoration alone cannot recover that missing intent. Keep a unique event ID and an explanatory reason.
5. Continue observation and permitted reducing exits only after the recovery halt is durable. Never clear a halt automatically to reopen risk. Preserve the failure and recovery evidence for review.

The tests verify mutation isolation, completed-hour freshness, delayed queue expiry, exact retries, immediate halt visibility, rejection of a queued real entry signal, durable replay and storage-failure refusal. The current pre-dashboard gate still lacks an accepted strategy and an elapsed paper record; see the [current audit](pre-dashboard-audit-2026-10-10.md) and [journal](research-journal.md).

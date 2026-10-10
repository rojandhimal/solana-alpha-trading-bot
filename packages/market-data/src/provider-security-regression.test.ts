import { describe, expect, it, vi } from "vitest";
import {
  requestProvider,
  validateProviderQuery,
  storeProviderBar,
} from "./provider-request.js";
import { auditHistoricalData } from "./historical-data-quality.js";
describe("provider safety regressions", () => {
  it("bounds network failures and rate-limit waiting", async () => {
    const sleepImpl = vi.fn(async () => {});
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("credential-containing failure"))
      .mockResolvedValueOnce(
        new Response("", {
          status: 429,
          headers: { "retry-after": "99999999" },
        }),
      )
      .mockResolvedValue(new Response("[]"));
    await requestProvider(
      new URL("https://test.invalid"),
      {},
      {
        provider: "test",
        fetchImpl,
        maxRetries: 2,
        retryBaseDelayMs: 1,
        sleepImpl,
      },
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleepImpl.mock.calls).toEqual([[1], [30000]]);
    await expect(
      requestProvider(
        new URL("https://test.invalid"),
        {},
        {
          provider: "test",
          fetchImpl: vi.fn().mockRejectedValue(new Error("secret")),
          maxRetries: 0,
          retryBaseDelayMs: 1,
          sleepImpl,
        },
      ),
    ).rejects.toThrow("bounded retries");
  });
  it("rejects invalid ranges and conflicting duplicates", () => {
    expect(() =>
      validateProviderQuery({ symbol: "SOL", interval: "1H", startTime: NaN }),
    ).toThrow();
    const bar = {
      timestamp: 3600000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1,
    };
    const bars = new Map();
    storeProviderBar(bars, bar);
    storeProviderBar(bars, { ...bar });
    expect(() => storeProviderBar(bars, { ...bar, volume: 2 })).toThrow(
      /conflicting/,
    );
  });
  it("rejects empty datasets and sub-interval spacing", () => {
    expect(auditHistoricalData([]).valid).toBe(false);
    const bar = {
      timestamp: 3600000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1,
    };
    expect(
      auditHistoricalData([bar, { ...bar, timestamp: 3600001 }], undefined, {
        expectedIntervalMs: 3600000,
      }).valid,
    ).toBe(false);
  });
});

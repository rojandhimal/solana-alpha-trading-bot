export interface ProviderRequestOptions {
  provider: string;
  fetchImpl: typeof fetch;
  maxRetries: number;
  retryBaseDelayMs: number;
  sleepImpl: (delayMs: number) => Promise<void>;
}
export function validateProviderQuery(query: {
  symbol: string;
  interval: string;
  startTime?: number;
  endTime?: number;
}): void {
  if (!query.symbol.trim() || !query.interval.trim())
    throw new Error("symbol and interval are required");
  for (const value of [query.startTime, query.endTime])
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0))
      throw new Error(
        "timestamps must be non-negative integer milliseconds UTC",
      );
  if (
    query.startTime !== undefined &&
    query.endTime !== undefined &&
    query.startTime > query.endTime
  )
    throw new Error("startTime must be less than or equal to endTime");
}
export function storeProviderBar(
  bars: Map<number, import("./historical-source.js").OhlcvBar>,
  bar: import("./historical-source.js").OhlcvBar,
): void {
  const previous = bars.get(bar.timestamp);
  if (previous && JSON.stringify(previous) !== JSON.stringify(bar))
    throw new Error("conflicting provider candle timestamp");
  bars.set(bar.timestamp, bar);
}
export async function requestProvider(
  url: URL,
  init: RequestInit,
  options: ProviderRequestOptions,
): Promise<Response> {
  if (
    !Number.isInteger(options.maxRetries) ||
    options.maxRetries < 0 ||
    options.maxRetries > 10
  )
    throw new Error("maxRetries must be between 0 and 10");
  if (
    !Number.isFinite(options.retryBaseDelayMs) ||
    options.retryBaseDelayMs < 0 ||
    options.retryBaseDelayMs > 30_000
  )
    throw new Error("retryBaseDelayMs must be between 0 and 30000");
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await options.fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      if (attempt >= options.maxRetries)
        throw new Error(
          `${options.provider} OHLCV network request failed after bounded retries`,
        );
      await options.sleepImpl(
        Math.min(30_000, options.retryBaseDelayMs * 2 ** attempt),
      );
      continue;
    }
    if (response.ok) return response;
    if (
      (response.status !== 429 && response.status < 500) ||
      attempt >= options.maxRetries
    )
      throw new Error(
        `${options.provider} OHLCV returned HTTP ${response.status}`,
      );
    const raw = response.headers.get("retry-after");
    const seconds = raw === null ? NaN : Number(raw);
    const dateDelay = raw === null ? NaN : Date.parse(raw) - Date.now();
    const requestedDelay =
      Number.isFinite(seconds) && seconds >= 0
        ? seconds * 1000
        : Number.isFinite(dateDelay) && dateDelay >= 0
          ? dateDelay
          : options.retryBaseDelayMs * 2 ** attempt;
    await response.body?.cancel();
    await options.sleepImpl(Math.min(30_000, requestedDelay));
  }
}

import { createWalkForwardWindows, type WalkForwardConfig } from "./walk-forward.js";

export interface WindowResult<M> {
  index: number;
  trainObservations: number;
  testObservations: number;
  metrics: M;
}

export interface WalkForwardRunResult<M> {
  windows: Array<WindowResult<M>>;
  aggregate: M | null;
}

export function runWalkForward<T, M>(
  data: readonly T[],
  config: WalkForwardConfig,
  runTestWindow: (train: readonly T[], test: readonly T[], index: number) => M,
  aggregate?: (metrics: readonly M[]) => M
): WalkForwardRunResult<M> {
  const windows = createWalkForwardWindows(data, config).windows;
  const results = windows.map((window, index) => ({
    index,
    trainObservations: window.train.length,
    testObservations: window.test.length,
    metrics: runTestWindow(window.train, window.test, index)
  }));

  return {
    windows: results,
    aggregate: aggregate && results.length > 0 ? aggregate(results.map((result) => result.metrics)) : null
  };
}

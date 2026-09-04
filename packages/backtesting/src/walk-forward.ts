export interface Window<T> {
  train: T[];
  test: T[];
}

export interface WalkForwardConfig {
  trainSize: number;
  testSize: number;
  stepSize?: number;
}

export interface WalkForwardResult<T> {
  windows: Array<Window<T>>;
  observations: number;
}

export function createWalkForwardWindows<T>(data: readonly T[], config: WalkForwardConfig): WalkForwardResult<T> {
  const trainSize = Math.floor(config.trainSize);
  const testSize = Math.floor(config.testSize);
  const stepSize = Math.floor(config.stepSize ?? testSize);
  if (trainSize <= 0 || testSize <= 0 || stepSize <= 0) throw new Error("INVALID_WINDOW_CONFIG");

  const windows: Array<Window<T>> = [];
  for (let start = 0; start + trainSize + testSize <= data.length; start += stepSize) {
    windows.push({
      train: Array.from(data.slice(start, start + trainSize)),
      test: Array.from(data.slice(start + trainSize, start + trainSize + testSize))
    });
  }
  return { windows, observations: data.length };
}

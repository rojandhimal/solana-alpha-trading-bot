export interface WalkForwardWindow {
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
}

export interface WalkForwardOptions {
  trainingBars: number;
  testingBars: number;
  stepBars?: number;
}

export function createWalkForwardWindows(length: number, options: WalkForwardOptions): WalkForwardWindow[] {
  const { trainingBars, testingBars, stepBars = testingBars } = options;
  if (!Number.isInteger(length) || length < 0) throw new Error("length must be a non-negative integer");
  if (!Number.isInteger(trainingBars) || trainingBars <= 0) throw new Error("trainingBars must be positive");
  if (!Number.isInteger(testingBars) || testingBars <= 0) throw new Error("testingBars must be positive");
  if (!Number.isInteger(stepBars) || stepBars <= 0) throw new Error("stepBars must be positive");

  const windows: WalkForwardWindow[] = [];
  for (let testStart = trainingBars; testStart + testingBars <= length; testStart += stepBars) {
    windows.push({
      trainStart: testStart - trainingBars,
      trainEnd: testStart,
      testStart,
      testEnd: testStart + testingBars
    });
  }
  return windows;
}

export function splitWalkForward<T>(items: readonly T[], window: WalkForwardWindow): { train: T[]; test: T[] } {
  return {
    train: items.slice(window.trainStart, window.trainEnd),
    test: items.slice(window.testStart, window.testEnd)
  };
}

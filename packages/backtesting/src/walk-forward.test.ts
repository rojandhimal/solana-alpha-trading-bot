import { describe, expect, it } from "vitest";
import { createWalkForwardWindows, splitWalkForward } from "./walk-forward.js";

describe("walk-forward windows", () => {
  it("creates non-overlapping test periods after each training period", () => {
    expect(createWalkForwardWindows(100, { trainingBars: 60, testingBars: 20 })).toEqual([
      { trainStart: 0, trainEnd: 60, testStart: 60, testEnd: 80 },
      { trainStart: 20, trainEnd: 80, testStart: 80, testEnd: 100 }
    ]);
  });

  it("supports an explicit step size", () => {
    expect(createWalkForwardWindows(30, { trainingBars: 10, testingBars: 5, stepBars: 10 })).toEqual([
      { trainStart: 0, trainEnd: 10, testStart: 10, testEnd: 15 },
      { trainStart: 10, trainEnd: 20, testStart: 20, testEnd: 25 }
    ]);
  });

  it("splits data according to a generated window", () => {
    const items = [0, 1, 2, 3, 4, 5];
    const window = { trainStart: 0, trainEnd: 4, testStart: 4, testEnd: 6 };
    expect(splitWalkForward(items, window)).toEqual({ train: [0, 1, 2, 3], test: [4, 5] });
  });

  it("rejects invalid window parameters", () => {
    expect(() => createWalkForwardWindows(10, { trainingBars: 0, testingBars: 2 })).toThrow(/trainingBars/);
    expect(() => createWalkForwardWindows(10, { trainingBars: 2, testingBars: 0 })).toThrow(/testingBars/);
    expect(() => createWalkForwardWindows(10, { trainingBars: 2, testingBars: 2, stepBars: 0 })).toThrow(/stepBars/);
  });
});

import { describe, expect, it } from "vitest";
import { runWalkForward } from "./walk-forward-runner.js";

describe("walk-forward runner", () => {
  it("runs each test window using its preceding training window", () => {
    const result = runWalkForward([1, 2, 3, 4, 5, 6], { trainSize: 2, testSize: 2 }, (train, test, index) => ({
      index,
      trainLast: train.at(-1),
      testFirst: test[0]
    }));

    expect(result.windows).toEqual([
      { index: 0, trainObservations: 2, testObservations: 2, metrics: { index: 0, trainLast: 2, testFirst: 3 } },
      { index: 1, trainObservations: 2, testObservations: 2, metrics: { index: 1, trainLast: 4, testFirst: 5 } }
    ]);
    expect(result.aggregate).toBeNull();
  });

  it("aggregates out-of-sample metrics when requested", () => {
    const result = runWalkForward([1, 2, 3, 4, 5, 6], { trainSize: 2, testSize: 2 }, (_train, test) => test.length, (metrics) => metrics.reduce((sum, value) => sum + value, 0));
    expect(result.aggregate).toBe(4);
  });
});

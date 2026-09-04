import { describe, expect, it } from "vitest";
import { createWalkForwardWindows } from "./walk-forward.js";

describe("walk-forward windows", () => {
  it("creates sequential train/test windows without overlap inside each window", () => {
    const result = createWalkForwardWindows([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { trainSize: 4, testSize: 2 });
    expect(result.windows).toEqual([
      { train: [1, 2, 3, 4], test: [5, 6] },
      { train: [3, 4, 5, 6], test: [7, 8] },
      { train: [5, 6, 7, 8], test: [9, 10] }
    ]);
  });

  it("supports a custom step", () => {
    const result = createWalkForwardWindows([1, 2, 3, 4, 5, 6, 7], { trainSize: 3, testSize: 2, stepSize: 1 });
    expect(result.windows).toHaveLength(3);
    expect(result.windows[1]).toEqual({ train: [2, 3, 4], test: [5, 6] });
  });

  it("rejects invalid configuration", () => {
    expect(() => createWalkForwardWindows([1, 2, 3], { trainSize: 0, testSize: 1 })).toThrow("INVALID_WINDOW_CONFIG");
  });
});

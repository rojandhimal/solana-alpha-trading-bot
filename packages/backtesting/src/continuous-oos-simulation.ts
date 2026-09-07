import type { Candle } from "./execution-model.js";
import { accountFills, type PortfolioAccountingResult } from "./portfolio-accounting.js";
import { attributeTrades, type CompletedTrade } from "./trade-attribution.js";
import { calculatePerformanceMetrics, type PerformanceMetrics } from "./performance-metrics.js";
import { generateStrategyFillsWithState, type StrategyExecutionConfig, type StrategyPosition } from "./strategy-execution-adapter.js";
import type { WalkForwardParameterSelectionWindow } from "./walk-forward-parameter-selection.js";
import type { StrategyCandle } from "./alpha-strategy.js";

export interface ContinuousOosSimulationInput {
  candles: readonly Candle[];
  windows: readonly WalkForwardParameterSelectionWindow[];
  initialCapital: number;
  quantity: number;
  execution?: StrategyExecutionConfig["execution"];
}

export interface ContinuousOosSimulationResult {
  accounting: PortfolioAccountingResult;
  fills: ReturnType<typeof generateStrategyFillsWithState>["fills"];
  trades: CompletedTrade[];
  metrics: PerformanceMetrics;
  finalPosition: StrategyPosition;
}

function strategyCandles(candles: readonly Candle[]): StrategyCandle[] {
  return candles.map((candle) => ({ ...candle, volume: "volume" in candle && typeof candle.volume === "number" ? candle.volume : 0 }));
}

function offsetFills(
  fills: readonly ReturnType<typeof generateStrategyFillsWithState>["fills"],
  offset: number
) {
  return fills.map((fill) => ({
    ...fill,
    signalIndex: fill.signalIndex + offset,
    executionIndex: fill.executionIndex + offset
  }));
}

/**
 * Replays selected walk-forward test strategies through one portfolio account.
 * The selected strategy may change at each test-window boundary, but the
 * portfolio position is carried across those boundaries instead of resetting
 * to FLAT. This makes equity and drawdown continuous across OOS windows.
 *
 * Strategy indicator history is intentionally window-local; changing that
 * behavior requires an explicit strategy-state contract and is outside this
 * simulator's portfolio-continuity responsibility.
 */
export function runContinuousOosSimulation(input: ContinuousOosSimulationInput): ContinuousOosSimulationResult {
  if (input.windows.length === 0) throw new Error("at least one walk-forward window is required");

  const orderedWindows = [...input.windows].sort((a, b) => a.testStart - b.testStart);
  const fills: ReturnType<typeof generateStrategyFillsWithState>["fills"] = [];
  let position: StrategyPosition = "FLAT";
  let offset = 0;
  let previousEnd = -1;

  for (const window of orderedWindows) {
    if (window.testStart < 0 || window.testEnd > input.candles.length || window.testStart >= window.testEnd) {
      throw new Error("walk-forward test window is outside candle range");
    }
    if (window.testStart < previousEnd) throw new Error("walk-forward test windows overlap");

    const testCandles = input.candles.slice(window.testStart, window.testEnd);
    const config: StrategyExecutionConfig = input.execution === undefined
      ? { quantity: input.quantity, strategy: window.selection.best!.candidate.strategy }
      : { quantity: input.quantity, strategy: window.selection.best!.candidate.strategy, execution: input.execution };
    const result = generateStrategyFillsWithState(strategyCandles(testCandles), config, position);
    fills.push(...offsetFills(result.fills, offset));
    position = result.finalPosition;
    offset += testCandles.length;
    previousEnd = window.testEnd;
  }

  const oosCandles = orderedWindows.flatMap((window) => input.candles.slice(window.testStart, window.testEnd));
  const accounting = accountFills(oosCandles, fills, input.initialCapital, { allowShort: true });
  const trades = attributeTrades(fills);
  const metrics = calculatePerformanceMetrics(accounting, trades);

  return { accounting, fills, trades, metrics, finalPosition: position };
}

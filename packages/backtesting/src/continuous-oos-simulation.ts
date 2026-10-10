import type { Candle } from "./execution-model.js";
import {
  accountFills,
  type PortfolioAccountingResult,
} from "./portfolio-accounting.js";
import { attributeTrades, type CompletedTrade } from "./trade-attribution.js";
import {
  calculatePerformanceMetrics,
  type PerformanceMetrics,
} from "./performance-metrics.js";
import {
  generateStrategyFillsWithState,
  type StrategyExecutionConfig,
  type StrategyPosition,
} from "./strategy-execution-adapter.js";
import type { WalkForwardParameterSelectionWindow } from "./walk-forward-parameter-selection.js";
import type { AlphaStrategyConfig, StrategyCandle } from "./alpha-strategy.js";

type StrategyFills = ReturnType<typeof generateStrategyFillsWithState>["fills"];
type ExecutionModelParameters = NonNullable<
  StrategyExecutionConfig["execution"]
>;

export interface ContinuousOosSimulationInput {
  candles: readonly Candle[];
  windows: readonly WalkForwardParameterSelectionWindow[];
  initialCapital: number;
  quantity: number;
  execution?: ExecutionModelParameters;
}
export interface ContinuousOosSimulationResult {
  accounting: PortfolioAccountingResult;
  fills: StrategyFills;
  trades: CompletedTrade[];
  metrics: PerformanceMetrics;
  finalPosition: StrategyPosition;
}

function strategyCandles(candles: readonly Candle[]): StrategyCandle[] {
  return candles.map((candle) => ({
    ...candle,
    volume:
      "volume" in candle && typeof candle.volume === "number"
        ? candle.volume
        : 0,
  }));
}

export function runContinuousOosSimulation(
  input: ContinuousOosSimulationInput,
): ContinuousOosSimulationResult {
  if (input.windows.length === 0)
    throw new Error("at least one walk-forward window is required");
  const orderedWindows = [...input.windows].sort(
    (a, b) => a.testStart - b.testStart,
  );
  const strategySchedule: AlphaStrategyConfig[] = [];
  let previousEnd = -1;
  for (const window of orderedWindows) {
    if (![window.testStart, window.testEnd].every(Number.isSafeInteger))
      throw new Error("walk-forward test indices must be safe integers");
    if (
      window.testStart < 0 ||
      window.testEnd > input.candles.length ||
      window.testStart >= window.testEnd
    )
      throw new Error("walk-forward test window is outside candle range");
    if (window.testStart < previousEnd)
      throw new Error("walk-forward test windows overlap");
    if (previousEnd >= 0 && window.testStart !== previousEnd)
      throw new Error("continuous OOS windows must be contiguous");
    if (window.selection.best === undefined)
      throw new Error("walk-forward window has no selected strategy");
    for (let index = window.testStart; index < window.testEnd; index += 1)
      strategySchedule.push(window.selection.best.candidate.strategy);
    previousEnd = window.testEnd;
  }
  const oosCandles = orderedWindows.flatMap((window) =>
    input.candles.slice(window.testStart, window.testEnd),
  );
  const config: StrategyExecutionConfig =
    input.execution === undefined
      ? { quantity: input.quantity }
      : { quantity: input.quantity, execution: input.execution };
  // A single stream preserves pending orders and completed OOS candle history.
  // Training candles are excluded; positions are not liquidated at boundaries.
  const { fills, finalPosition } = generateStrategyFillsWithState(
    strategyCandles(oosCandles),
    config,
    "FLAT",
    strategySchedule,
  );
  const accounting = accountFills(oosCandles, fills, input.initialCapital, {
    allowShort: true,
  });
  const trades = attributeTrades(fills);
  const metrics = calculatePerformanceMetrics(accounting, trades);
  return { accounting, fills, trades, metrics, finalPosition };
}

import {
  executeRequest,
  type Candle,
  type ExecutionFill,
} from "./execution-model.js";
import { attributeTrades, type CompletedTrade } from "./trade-attribution.js";
import {
  calculatePerformanceMetrics,
  type PerformanceMetrics,
} from "./performance-metrics.js";
import {
  accountFills,
  type PortfolioAccountingResult,
} from "./portfolio-accounting.js";
import {
  evaluateRobustness,
  type RobustnessReport,
  type RobustnessThresholds,
} from "./robustness.js";
import {
  runStressScenarios,
  type StressScenario,
  type StressScenarioResult,
  type StressParameters,
} from "./stress-testing.js";
import {
  simulateExecutionStress,
  type SimulatedTrade,
} from "./execution-stress.js";
import {
  generateStrategyFills,
  type StrategyExecutionConfig,
} from "./strategy-execution-adapter.js";
import type { StrategyCandle } from "./alpha-strategy.js";

export interface BacktestPipelineInput {
  candles: readonly Candle[];
  fills?: readonly ExecutionFill[];
  strategy?: StrategyExecutionConfig;
  initialCapital: number;
  liquidateAtEnd?: boolean;
  stressScenarios: readonly StressScenario[];
  robustnessThresholds: RobustnessThresholds;
  runScenario?: (
    fills: readonly ExecutionFill[],
    parameters: StressParameters,
    scenario: StressScenario,
  ) => ExecutionFill[];
}

export interface BacktestPipelineResult {
  baseline: PortfolioAccountingResult;
  fills: ExecutionFill[];
  trades: CompletedTrade[];
  metrics: PerformanceMetrics;
  stressResults: StressScenarioResult[];
  robustness: RobustnessReport;
}

function tradesForExecutionStress(
  trades: readonly CompletedTrade[],
): SimulatedTrade[] {
  return trades.map((trade) => ({
    entryReferencePrice: trade.entryReferencePrice,
    exitReferencePrice: trade.exitReferencePrice,
    quantity: trade.quantity,
    side: trade.side,
  }));
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

export function runBacktestPipeline(
  input: BacktestPipelineInput,
): BacktestPipelineResult {
  if (!input.fills && !input.strategy)
    throw new Error("either fills or strategy must be provided");

  let fills = input.strategy
    ? generateStrategyFills(strategyCandles(input.candles), input.strategy)
    : [...(input.fills ?? [])];
  function liquidate(
    fills: ExecutionFill[],
    execution = input.strategy?.execution,
  ): ExecutionFill[] {
    if (!input.liquidateAtEnd || input.candles.length === 0) return fills;
    const quantity = fills.reduce(
      (sum, fill) =>
        sum + (fill.side === "BUY" ? fill.quantity : -fill.quantity),
      0,
    );
    if (quantity === 0) return fills;
    const finalIndex = input.candles.length - 1;
    const finalCandle = input.candles[finalIndex]!;
    const close = executeRequest(
      [
        ...input.candles.slice(0, -1),
        { ...finalCandle, open: finalCandle.close },
      ],
      {
        signalIndex: finalIndex,
        side: quantity > 0 ? "SELL" : "BUY",
        quantity: Math.abs(quantity),
      },
      {
        ...{
          executionDelayBars: 0,
          slippagePct: 0.1,
          feePct: 0.1,
          liquidityMultiplier: 1,
          volatilityMultiplier: 1,
        },
        ...execution,
        executionDelayBars: 0,
      },
    );
    return close ? [...fills, close] : fills;
  }
  fills = liquidate(fills);
  const allowShort = Boolean(input.strategy);
  const baseline = accountFills(input.candles, fills, input.initialCapital, {
    allowShort,
  });
  const trades = attributeTrades(fills);
  const metrics = calculatePerformanceMetrics(baseline, trades);

  const stressResults = runStressScenarios(
    input.stressScenarios,
    (parameters, scenario) => {
      if (!input.runScenario && input.strategy) {
        const base = {
          executionDelayBars: 1,
          slippagePct: 0.1,
          feePct: 0.1,
          liquidityMultiplier: 1,
          volatilityMultiplier: 1,
          ...input.strategy.execution,
        };
        const stressExecution = {
          executionDelayBars:
            Math.max(1, base.executionDelayBars) +
            parameters.executionDelayBars,
          slippagePct: base.slippagePct * parameters.slippageMultiplier,
          feePct: base.feePct * parameters.feeMultiplier,
          liquidityMultiplier:
            base.liquidityMultiplier * parameters.liquidityMultiplier,
          volatilityMultiplier:
            base.volatilityMultiplier * parameters.volatilityMultiplier,
        };
        const stressedFills = liquidate(
          generateStrategyFills(strategyCandles(input.candles), {
            ...input.strategy,
            execution: {
              executionDelayBars:
                Math.max(1, base.executionDelayBars) +
                parameters.executionDelayBars,
              slippagePct: base.slippagePct * parameters.slippageMultiplier,
              feePct: base.feePct * parameters.feeMultiplier,
              liquidityMultiplier:
                base.liquidityMultiplier * parameters.liquidityMultiplier,
              volatilityMultiplier:
                base.volatilityMultiplier * parameters.volatilityMultiplier,
            },
          }),
          stressExecution,
        );
        const accounting = accountFills(
          input.candles,
          stressedFills,
          input.initialCapital,
          { allowShort },
        );
        return calculatePerformanceMetrics(
          accounting,
          attributeTrades(stressedFills),
        );
      }
      if (!input.runScenario) {
        return simulateExecutionStress(
          tradesForExecutionStress(trades),
          parameters,
          undefined,
          undefined,
          input.initialCapital,
        ).metrics;
      }

      const stressedFills = input.runScenario(fills, parameters, scenario);
      const accounting = accountFills(
        input.candles,
        stressedFills,
        input.initialCapital,
        { allowShort },
      );
      const stressedTrades = attributeTrades(stressedFills);
      const stressedMetrics = calculatePerformanceMetrics(
        accounting,
        stressedTrades,
      );
      return {
        totalReturnPct: stressedMetrics.totalReturnPct,
        maxDrawdownPct: stressedMetrics.maxDrawdownPct,
        tradeCount: stressedMetrics.tradeCount,
        profitFactor: stressedMetrics.profitFactor,
        expectancy: stressedMetrics.expectancy,
      };
    },
  );

  return {
    baseline,
    fills,
    trades,
    metrics,
    stressResults,
    robustness: evaluateRobustness(stressResults, input.robustnessThresholds),
  };
}

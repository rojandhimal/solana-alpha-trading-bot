import type { OhlcvBar } from "../../market-data/src/historical-source.js";

export type Side = "long" | "short";
export type Signal = "long" | "short" | "flat";

export interface BacktestStrategy {
  onBar(bar: OhlcvBar, index: number): Signal;
}

export interface BacktestConfig {
  initialCapital: number;
  feeRate?: number;
  slippageBps?: number;
  positionFraction?: number;
}

export interface Trade {
  side: Side;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnl: number;
  fees: number;
  netPnl: number;
}

export interface BacktestResult {
  initialCapital: number;
  finalCapital: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  trades: readonly Trade[];
  equityCurve: readonly { timestamp: number; equity: number }[];
}

const applySlippage = (price: number, side: Side, bps: number, entry: boolean): number => {
  const rate = bps / 10_000;
  if (side === "long") return price * (entry ? 1 + rate : 1 - rate);
  return price * (entry ? 1 - rate : 1 + rate);
};

export function runBacktest(
  bars: readonly OhlcvBar[],
  strategy: BacktestStrategy,
  config: BacktestConfig,
): BacktestResult {
  if (config.initialCapital <= 0) throw new Error("initialCapital must be positive");
  if (bars.length === 0) return {
    initialCapital: config.initialCapital,
    finalCapital: config.initialCapital,
    totalReturnPct: 0,
    maxDrawdownPct: 0,
    winRatePct: 0,
    trades: [],
    equityCurve: [],
  };

  const feeRate = config.feeRate ?? 0.001;
  const slippageBps = config.slippageBps ?? 5;
  const fraction = config.positionFraction ?? 1;
  let capital = config.initialCapital;
  let position: { side: Side; entryPrice: number; quantity: number; entryTime: number } | undefined;
  const trades: Trade[] = [];
  const equityCurve: { timestamp: number; equity: number }[] = [];
  let peak = capital;
  let maxDrawdown = 0;

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];
    const signal = strategy.onBar(bar, i);

    if (!position && signal !== "flat") {
      const side = signal;
      const price = applySlippage(bar.close, side, slippageBps, true);
      const notional = capital * Math.min(Math.max(fraction, 0), 1);
      const quantity = notional / price;
      const fee = notional * feeRate;
      capital -= fee;
      position = { side, entryPrice: price, quantity, entryTime: bar.timestamp };
    } else if (position && (signal === "flat" || signal !== position.side)) {
      const exitPrice = applySlippage(bar.close, position.side, slippageBps, false);
      const grossPnl = position.side === "long"
        ? (exitPrice - position.entryPrice) * position.quantity
        : (position.entryPrice - exitPrice) * position.quantity;
      const exitNotional = exitPrice * position.quantity;
      const fees = exitNotional * feeRate;
      const netPnl = grossPnl - fees;
      capital += netPnl;
      trades.push({
        side: position.side,
        entryTime: position.entryTime,
        exitTime: bar.timestamp,
        entryPrice: position.entryPrice,
        exitPrice,
        quantity: position.quantity,
        grossPnl,
        fees,
        netPnl,
      });
      position = undefined;
    }

    let equity = capital;
    if (position) {
      equity += position.side === "long"
        ? (bar.close - position.entryPrice) * position.quantity
        : (position.entryPrice - bar.close) * position.quantity;
    }
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak > 0 ? ((peak - equity) / peak) * 100 : 0);
    equityCurve.push({ timestamp: bar.timestamp, equity });
  }

  if (position) {
    const bar = bars[bars.length - 1];
    const exitPrice = applySlippage(bar.close, position.side, slippageBps, false);
    const grossPnl = position.side === "long"
      ? (exitPrice - position.entryPrice) * position.quantity
      : (position.entryPrice - exitPrice) * position.quantity;
    const exitNotional = exitPrice * position.quantity;
    const fees = exitNotional * feeRate;
    const netPnl = grossPnl - fees;
    capital += netPnl;
    trades.push({
      side: position.side,
      entryTime: position.entryTime,
      exitTime: bar.timestamp,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      grossPnl,
      fees,
      netPnl,
    });
  }

  const wins = trades.filter((trade) => trade.netPnl > 0).length;
  return {
    initialCapital: config.initialCapital,
    finalCapital: capital,
    totalReturnPct: ((capital - config.initialCapital) / config.initialCapital) * 100,
    maxDrawdownPct: maxDrawdown,
    winRatePct: trades.length ? (wins / trades.length) * 100 : 0,
    trades,
    equityCurve,
  };
}

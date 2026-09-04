export interface BacktestBar {
  timestamp: number;
  symbol: string;
  price: number;
  signalApproved: boolean;
  stopPrice: number;
}

export interface BacktestConfig {
  initialCash: number;
  positionSizePct: number;
  feePct: number;
  slippagePct: number;
}

export interface BacktestTrade {
  symbol: string;
  entryTimestamp: number;
  exitTimestamp: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  fees: number;
  pnl: number;
  returnPct: number;
}

export interface BacktestResult {
  initialCash: number;
  finalEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  profitFactor: number;
  expectancy: number;
  trades: BacktestTrade[];
  equityCurve: number[];
}

const positive = (value: number): number => Number.isFinite(value) && value > 0 ? value : 0;

export function runBacktest(bars: BacktestBar[], config: BacktestConfig): BacktestResult {
  const initialCash = positive(config.initialCash);
  let cash = initialCash;
  let position: { symbol: string; entryTimestamp: number; entryPrice: number; quantity: number; fees: number; stopPrice: number } | undefined;
  const trades: BacktestTrade[] = [];
  const equityCurve: number[] = [initialCash];

  for (const bar of bars) {
    if (!Number.isFinite(bar.price) || bar.price <= 0) continue;
    const slippage = positive(config.slippagePct) / 100;
    const fee = positive(config.feePct) / 100;

    if (position) {
      const stopHit = bar.price <= position.stopPrice;
      const exitSignal = !bar.signalApproved;
      if (stopHit || exitSignal) {
        const exitPrice = bar.price * (1 - slippage);
        const notional = position.quantity * exitPrice;
        const exitFee = notional * fee;
        const pnl = notional - exitFee - position.entryPrice * position.quantity - position.fees;
        const invested = position.entryPrice * position.quantity + position.fees;
        trades.push({
          symbol: position.symbol,
          entryTimestamp: position.entryTimestamp,
          exitTimestamp: bar.timestamp,
          entryPrice: position.entryPrice,
          exitPrice,
          quantity: position.quantity,
          fees: position.fees + exitFee,
          pnl,
          returnPct: invested > 0 ? pnl / invested * 100 : 0
        });
        cash += notional - exitFee;
        position = undefined;
      }
    }

    if (!position && bar.signalApproved) {
      const budget = cash * Math.min(100, positive(config.positionSizePct)) / 100;
      const entryPrice = bar.price * (1 + slippage);
      const quantity = budget / Math.max(entryPrice, Number.EPSILON);
      const notional = quantity * entryPrice;
      const entryFee = notional * fee;
      if (quantity > 0 && cash >= notional + entryFee) {
        cash -= notional + entryFee;
        position = { symbol: bar.symbol, entryTimestamp: bar.timestamp, entryPrice, quantity, fees: entryFee, stopPrice: bar.stopPrice };
      }
    }

    const marked = position ? cash + position.quantity * bar.price : cash;
    equityCurve.push(marked);
  }

  if (position && bars.length > 0) {
    const bar = bars[bars.length - 1];
    if (bar && Number.isFinite(bar.price) && bar.price > 0) {
      const exitPrice = bar.price * (1 - slippage);
      const notional = position.quantity * exitPrice;
      const exitFee = notional * fee;
      const pnl = notional - exitFee - position.entryPrice * position.quantity - position.fees;
      const invested = position.entryPrice * position.quantity + position.fees;
      trades.push({ symbol: position.symbol, entryTimestamp: position.entryTimestamp, exitTimestamp: bar.timestamp, entryPrice: position.entryPrice, exitPrice, quantity: position.quantity, fees: position.fees + exitFee, pnl, returnPct: invested > 0 ? pnl / invested * 100 : 0 });
      cash += notional - exitFee;
      equityCurve.push(cash);
    }
  }

  const finalEquity = cash;
  let peak = initialCash;
  let maxDrawdownPct = 0;
  for (const equity of equityCurve) {
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, (peak - equity) / peak * 100);
  }
  const wins = trades.filter(t => t.pnl > 0);
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  return {
    initialCash,
    finalEquity,
    totalReturnPct: initialCash > 0 ? (finalEquity - initialCash) / initialCash * 100 : 0,
    maxDrawdownPct,
    winRatePct: trades.length > 0 ? wins.length / trades.length * 100 : 0,
    profitFactor,
    expectancy: trades.length > 0 ? trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length : 0,
    trades,
    equityCurve
  };
}

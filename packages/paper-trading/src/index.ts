export type OrderSide = "BUY" | "SELL";
export type PositionSide = "LONG";

export interface PaperOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  requestedPrice: number;
  executedPrice: number;
  notional: number;
  fees: number;
  slippage: number;
  timestamp: number;
}

export interface PaperPosition {
  symbol: string;
  side: PositionSide;
  quantity: number;
  averageEntryPrice: number;
  investedNotional: number;
  feesPaid: number;
  realizedPnl: number;
}

export interface PaperPortfolio {
  cash: number;
  realizedPnl: number;
  orders: PaperOrder[];
  positions: Record<string, PaperPosition>;
}

export interface PaperFillConfig {
  feePct: number;
  slippagePct: number;
}

const nonNegative = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0);

export function createPaperPortfolio(initialCash: number): PaperPortfolio {
  return {
    cash: nonNegative(initialCash),
    realizedPnl: 0,
    orders: [],
    positions: {}
  };
}

export function executePaperOrder(
  portfolio: PaperPortfolio,
  order: Omit<PaperOrder, "executedPrice" | "notional" | "fees" | "slippage" | "timestamp">,
  config: PaperFillConfig,
  timestamp = Date.now()
): PaperPortfolio {
  if (!Number.isFinite(order.quantity) || order.quantity <= 0) throw new Error("INVALID_ORDER_QUANTITY");
  if (!Number.isFinite(order.requestedPrice) || order.requestedPrice <= 0) throw new Error("INVALID_ORDER_PRICE");

  const feePct = nonNegative(config.feePct);
  const slippagePct = nonNegative(config.slippagePct);
  const direction = order.side === "BUY" ? 1 : -1;
  const executedPrice = order.requestedPrice * (1 + direction * slippagePct / 100);
  const notional = order.quantity * executedPrice;
  const fees = notional * feePct / 100;
  const totalCost = notional + fees;
  const existing = portfolio.positions[order.symbol];

  if (order.side === "BUY") {
    if (portfolio.cash < totalCost) throw new Error("INSUFFICIENT_CASH");
    const nextQuantity = (existing?.quantity ?? 0) + order.quantity;
    const previousNotional = existing?.investedNotional ?? 0;
    const averageEntryPrice = (previousNotional + notional) / nextQuantity;
    const nextPosition: PaperPosition = {
      symbol: order.symbol,
      side: "LONG",
      quantity: nextQuantity,
      averageEntryPrice,
      investedNotional: previousNotional + notional,
      feesPaid: (existing?.feesPaid ?? 0) + fees,
      realizedPnl: existing?.realizedPnl ?? 0
    };
    portfolio.cash -= totalCost;
    portfolio.positions[order.symbol] = nextPosition;
  } else {
    if (!existing || existing.quantity < order.quantity) throw new Error("INSUFFICIENT_POSITION");
    const costBasis = existing.averageEntryPrice * order.quantity;
    const realizedPnl = notional - costBasis - fees;
    const remaining = existing.quantity - order.quantity;
    portfolio.cash += notional - fees;
    portfolio.realizedPnl += realizedPnl;
    if (remaining === 0) delete portfolio.positions[order.symbol];
    else {
      portfolio.positions[order.symbol] = {
        ...existing,
        quantity: remaining,
        investedNotional: existing.averageEntryPrice * remaining,
        feesPaid: existing.feesPaid + fees,
        realizedPnl: existing.realizedPnl + realizedPnl
      };
    }
  }

  portfolio.orders.push({
    ...order,
    executedPrice,
    notional,
    fees,
    slippage: Math.abs(executedPrice - order.requestedPrice) * order.quantity,
    timestamp
  });
  return portfolio;
}

export function markToMarket(portfolio: PaperPortfolio, prices: Record<string, number>): number {
  return Object.values(portfolio.positions).reduce((total, position) => {
    const price = prices[position.symbol];
    if (!Number.isFinite(price) || price <= 0) return total;
    return total + (price - position.averageEntryPrice) * position.quantity;
  }, portfolio.realizedPnl);
}

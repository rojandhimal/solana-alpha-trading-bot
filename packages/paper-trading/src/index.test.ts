import { describe, expect, it } from "vitest";
import { createPaperPortfolio, executePaperOrder, markToMarket } from "./index.js";

describe("paper execution", () => {
  it("fills a buy with fee and slippage and records the position", () => {
    const portfolio = createPaperPortfolio(1_000);
    executePaperOrder(
      portfolio,
      { id: "1", symbol: "TEST", side: "BUY", quantity: 2, requestedPrice: 100 },
      { feePct: 0.25, slippagePct: 0.25 },
      1
    );
    expect(portfolio.cash).toBeLessThan(800);
    expect(portfolio.positions.TEST.quantity).toBe(2);
    expect(portfolio.orders).toHaveLength(1);
    expect(portfolio.orders[0].executedPrice).toBeGreaterThan(100);
  });

  it("rejects a buy when cash is insufficient", () => {
    const portfolio = createPaperPortfolio(100);
    expect(() => executePaperOrder(
      portfolio,
      { id: "1", symbol: "TEST", side: "BUY", quantity: 2, requestedPrice: 100 },
      { feePct: 0.25, slippagePct: 0.25 }
    )).toThrow("INSUFFICIENT_CASH");
  });

  it("realizes P&L after selling a position", () => {
    const portfolio = createPaperPortfolio(1_000);
    executePaperOrder(portfolio, { id: "1", symbol: "TEST", side: "BUY", quantity: 2, requestedPrice: 100 }, { feePct: 0, slippagePct: 0 });
    executePaperOrder(portfolio, { id: "2", symbol: "TEST", side: "SELL", quantity: 2, requestedPrice: 120 }, { feePct: 0, slippagePct: 0 });
    expect(portfolio.realizedPnl).toBe(40);
    expect(portfolio.positions.TEST).toBeUndefined();
  });

  it("calculates unrealized P&L without mutating the ledger", () => {
    const portfolio = createPaperPortfolio(1_000);
    executePaperOrder(portfolio, { id: "1", symbol: "TEST", side: "BUY", quantity: 2, requestedPrice: 100 }, { feePct: 0, slippagePct: 0 });
    expect(markToMarket(portfolio, { TEST: 110 })).toBe(20);
    expect(portfolio.orders).toHaveLength(1);
  });
});

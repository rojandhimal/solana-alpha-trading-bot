import type { LargestTokenAccount, TokenAmount } from "./rpc.js";

export interface ConcentrationMetrics {
  top1Percent: number;
  top5Percent: number;
  top10Percent: number;
  top20Percent: number;
  accountCount: number;
}

function percent(amount: bigint, supply: bigint): number {
  if (supply <= 0n) return 100;
  return Number((amount * 10_000n) / supply) / 100;
}

function toRawAmount(account: LargestTokenAccount): bigint {
  return BigInt(account.amount);
}

export function calculateConcentration(
  supply: TokenAmount,
  accounts: LargestTokenAccount[],
): ConcentrationMetrics {
  const total = BigInt(supply.amount);
  const sorted = [...accounts].sort((a, b) => {
    const aa = toRawAmount(a);
    const bb = toRawAmount(b);
    return aa === bb ? 0 : aa > bb ? -1 : 1;
  });

  const sum = (limit: number): bigint =>
    sorted.slice(0, limit).reduce((acc, account) => acc + toRawAmount(account), 0n);

  return {
    top1Percent: percent(sum(1), total),
    top5Percent: percent(sum(5), total),
    top10Percent: percent(sum(10), total),
    top20Percent: percent(sum(20), total),
    accountCount: sorted.length,
  };
}

import type { LargestTokenAccount, TokenSupply } from "./rpc.js";

export interface HolderConcentration {
  top1Percent: number;
  top5Percent: number;
  top10Percent: number;
  top20Percent: number;
  sampleAccounts: number;
  supplyAmount: string;
}

function sum(accounts: LargestTokenAccount[], count: number): bigint {
  return accounts.slice(0, count).reduce((total, account) => total + BigInt(account.amount), 0n);
}

function percentage(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Number((part * 10_000n) / total) / 100;
}

export function calculateHolderConcentration(
  supply: TokenSupply,
  accounts: LargestTokenAccount[],
): HolderConcentration {
  const total = BigInt(supply.amount);
  return {
    top1Percent: percentage(sum(accounts, 1), total),
    top5Percent: percentage(sum(accounts, 5), total),
    top10Percent: percentage(sum(accounts, 10), total),
    top20Percent: percentage(sum(accounts, 20), total),
    sampleAccounts: accounts.length,
    supplyAmount: supply.amount,
  };
}

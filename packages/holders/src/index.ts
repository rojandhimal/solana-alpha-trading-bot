export interface Holder {
  address: string;
  balance: bigint;
  percentage: number;
  isProgram: boolean;
  isKnownBurnAddress: boolean;
}

export interface HolderAnalysis {
  totalSupply: bigint;
  holderCount: number;
  top1Percentage: number;
  top5Percentage: number;
  top10Percentage: number;
  top20Percentage: number;
  concentrationRisk: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  findings: string[];
}

export function analyzeHolders(
  holders: readonly Holder[],
  totalSupply: bigint
): HolderAnalysis {
  if (totalSupply <= 0n || holders.length === 0) {
    return {
      totalSupply,
      holderCount: holders.length,
      top1Percentage: 0,
      top5Percentage: 0,
      top10Percentage: 0,
      top20Percentage: 0,
      concentrationRisk: "UNKNOWN",
      findings: ["INSUFFICIENT_HOLDER_DATA"]
    };
  }

  const sorted = [...holders].sort((a, b) =>
    a.balance > b.balance ? -1 : a.balance < b.balance ? 1 : 0
  );

  const percentage = (index: number): number =>
    Number((sorted.slice(0, index).reduce((sum, h) => sum + h.balance, 0n) * 10000n) / totalSupply) / 100;

  const top1 = percentage(1);
  const top5 = percentage(5);
  const top10 = percentage(10);
  const top20 = percentage(20);

  let concentrationRisk: HolderAnalysis["concentrationRisk"] = "LOW";
  if (top10 >= 60 || top1 >= 35) concentrationRisk = "HIGH";
  else if (top10 >= 40 || top1 >= 20) concentrationRisk = "MEDIUM";

  const findings: string[] = [];
  if (top1 >= 35) findings.push("TOP1_EXTREME_CONCENTRATION");
  if (top10 >= 60) findings.push("TOP10_HIGH_CONCENTRATION");

  return {
    totalSupply,
    holderCount: holders.length,
    top1Percentage: top1,
    top5Percentage: top5,
    top10Percentage: top10,
    top20Percentage: top20,
    concentrationRisk,
    findings
  };
}

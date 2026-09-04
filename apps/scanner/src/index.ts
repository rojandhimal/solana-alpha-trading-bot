import { config } from "@alpha/config";
import { logger } from "@alpha/logger";
import { DexScreenerClient, evaluateEligibility } from "@alpha/market-data";

const client = new DexScreenerClient();

async function scanToken(tokenAddress: string): Promise<void> {
  const pairs = await client.getTokenPairs(tokenAddress);

  if (pairs.length === 0) {
    logger.warn({ tokenAddress }, "No pairs found");
    return;
  }

  for (const pair of pairs) {
    const eligibility = evaluateEligibility(pair);
    logger.info({
      token: pair.baseToken.symbol,
      pairAddress: pair.pairAddress,
      liquidityUsd: pair.liquidityUsd,
      volume24hUsd: pair.volume24hUsd,
      buys24h: pair.buys24h,
      sells24h: pair.sells24h,
      eligible: eligibility.eligible,
      reasons: eligibility.reasons
    }, eligibility.eligible ? "TOKEN PASSED ELIGIBILITY" : "TOKEN REJECTED");
  }
}

async function main(): Promise<void> {
  logger.info({ mode: config.TRADING_MODE }, "Solana Alpha Scanner started");

  // Temporary smoke-test address. Automated discovery will replace this in Phase B.
  await scanToken("So11111111111111111111111111111111111111112");
}

main().catch((error: unknown) => {
  logger.fatal({ error }, "Scanner terminated unexpectedly");
  process.exit(1);
});

import { config } from "@alpha/config";
import { logger } from "@alpha/logger";
import type { TokenPair } from "./types.js";

interface DexPairResponse {
  chainId?: unknown;
  dexId?: unknown;
  pairAddress?: unknown;
  baseToken?: { address?: unknown; name?: unknown; symbol?: unknown };
  quoteToken?: { address?: unknown; name?: unknown; symbol?: unknown };
  priceUsd?: unknown;
  liquidity?: { usd?: unknown };
  marketCap?: unknown;
  fdv?: unknown;
  volume?: { h24?: unknown; h1?: unknown };
  txns?: { h24?: { buys?: unknown; sells?: unknown } };
  pairCreatedAt?: unknown;
  url?: unknown;
}

interface DexResponse { pairs?: DexPairResponse[] | null }

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parsePair(pair: DexPairResponse): TokenPair | null {
  const chainId = stringOrNull(pair.chainId);
  const dexId = stringOrNull(pair.dexId);
  const pairAddress = stringOrNull(pair.pairAddress);
  const baseAddress = stringOrNull(pair.baseToken?.address);
  const baseName = stringOrNull(pair.baseToken?.name);
  const baseSymbol = stringOrNull(pair.baseToken?.symbol);
  const quoteAddress = stringOrNull(pair.quoteToken?.address);
  const quoteName = stringOrNull(pair.quoteToken?.name);
  const quoteSymbol = stringOrNull(pair.quoteToken?.symbol);

  if (!chainId || !dexId || !pairAddress || !baseAddress || !baseName || !baseSymbol || !quoteAddress || !quoteName || !quoteSymbol) {
    return null;
  }

  const created = numberOrNull(pair.pairCreatedAt);

  return {
    chainId,
    dexId,
    pairAddress,
    baseToken: { address: baseAddress, name: baseName, symbol: baseSymbol },
    quoteToken: { address: quoteAddress, name: quoteName, symbol: quoteSymbol },
    priceUsd: numberOrNull(pair.priceUsd),
    liquidityUsd: numberOrNull(pair.liquidity?.usd),
    marketCapUsd: numberOrNull(pair.marketCap),
    fdvUsd: numberOrNull(pair.fdv),
    volume24hUsd: numberOrNull(pair.volume?.h24) ?? 0,
    volume1hUsd: numberOrNull(pair.volume?.h1) ?? 0,
    buys24h: numberOrNull(pair.txns?.h24?.buys) ?? 0,
    sells24h: numberOrNull(pair.txns?.h24?.sells) ?? 0,
    pairCreatedAt: created !== null && Number.isFinite(created) ? new Date(created) : null,
    url: stringOrNull(pair.url)
  };
}

export class DexScreenerClient {
  async getTokenPairs(tokenAddress: string): Promise<TokenPair[]> {
    const url = `${config.DEXSCREENER_BASE_URL}/token-pairs/v1/solana/${tokenAddress}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`DEX Screener returned HTTP ${response.status}`);
    const data = (await response.json()) as DexResponse;
    if (!Array.isArray(data.pairs)) return [];

    const pairs = data.pairs.map(parsePair).filter((pair): pair is TokenPair => pair !== null);
    logger.debug({ tokenAddress, pairCount: pairs.length }, "Fetched token pairs");
    return pairs;
  }
}

export interface TokenPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  volume24hUsd: number;
  volume1hUsd: number;
  buys24h: number;
  sells24h: number;
  pairCreatedAt: Date | null;
  url: string | null;
}

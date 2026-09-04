import { config } from "@alpha/config";
import { logger } from "@alpha/logger";

export interface RpcContext {
  commitment: "finalized";
}

export interface TokenAmount {
  amount: string;
  decimals: number;
  uiAmount: number | null;
  uiAmountString: string;
}

export interface LargestTokenAccount {
  address: string;
  amount: string;
  decimals: number;
  uiAmount: number | null;
  uiAmountString: string;
}

interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`Invalid RPC field: ${field}`);
  return value;
}

function parseTokenAmount(value: unknown): TokenAmount {
  if (!value || typeof value !== "object") throw new Error("Invalid token amount");
  const v = value as Record<string, unknown>;
  const decimals = v.decimals;
  const uiAmount = v.uiAmount;
  if (typeof decimals !== "number" || !Number.isInteger(decimals)) throw new Error("Invalid token decimals");
  if (uiAmount !== null && typeof uiAmount !== "number") throw new Error("Invalid uiAmount");
  return {
    amount: assertString(v.amount, "amount"),
    decimals,
    uiAmount,
    uiAmountString: assertString(v.uiAmountString, "uiAmountString"),
  };
}

export class SolanaRpcClient {
  private readonly endpoint = config.SOLANA_RPC_URL;
  private readonly context: RpcContext = { commitment: "finalized" };

  private async request<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) throw new Error(`Solana RPC HTTP ${response.status}`);
    const payload = (await response.json()) as RpcResponse<T>;
    if (payload.error) throw new Error(`Solana RPC ${payload.error.code}: ${payload.error.message}`);
    if (payload.result === undefined) throw new Error("Solana RPC returned no result");
    return payload.result;
  }

  async getTokenSupply(mint: string): Promise<TokenAmount> {
    const result = await this.request<{ value: unknown }>("getTokenSupply", [mint, this.context]);
    return parseTokenAmount(result.value);
  }

  async getLargestTokenAccounts(mint: string): Promise<LargestTokenAccount[]> {
    const result = await this.request<{ value: unknown }>("getTokenLargestAccounts", [mint, this.context]);
    if (!Array.isArray(result.value)) throw new Error("Invalid largest-account response");
    return result.value.map((entry) => {
      if (!entry || typeof entry !== "object") throw new Error("Invalid largest-account entry");
      const v = entry as Record<string, unknown>;
      const amount = parseTokenAmount(v);
      return { address: assertString(v.address, "address"), ...amount };
    });
  }

  async getTokenConcentration(mint: string): Promise<{ supply: TokenAmount; accounts: LargestTokenAccount[] }> {
    try {
      const [supply, accounts] = await Promise.all([
        this.getTokenSupply(mint),
        this.getLargestTokenAccounts(mint),
      ]);
      return { supply, accounts };
    } catch (error) {
      logger.warn({ mint, error }, "Failed to fetch Solana token concentration data");
      throw error;
    }
  }
}

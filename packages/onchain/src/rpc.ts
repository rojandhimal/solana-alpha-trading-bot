import { config } from "@alpha/config";
import { logger } from "@alpha/logger";

export interface RpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export interface TokenSupply {
  amount: string;
  decimals: number;
  uiAmountString: string;
}

export interface LargestTokenAccount {
  address: string;
  amount: string;
  decimals: number;
  uiAmountString: string;
}

export class SolanaRpcClient {
  private id = 0;

  async call<T>(method: string, params: unknown[]): Promise<T> {
    const id = ++this.id;
    const response = await fetch(config.SOLANA_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Solana RPC HTTP ${response.status}`);
    }

    const payload = (await response.json()) as RpcResponse<T>;
    if (payload.error) {
      throw new Error(`Solana RPC ${payload.error.code}: ${payload.error.message}`);
    }
    if (payload.result === undefined) {
      throw new Error(`Solana RPC returned no result for ${method}`);
    }

    logger.debug({ method }, "Solana RPC request completed");
    return payload.result;
  }

  async getTokenSupply(mint: string): Promise<TokenSupply> {
    const result = await this.call<{ value: TokenSupply }>("getTokenSupply", [
      mint,
      { commitment: "finalized" },
    ]);
    return result.value;
  }

  async getLargestTokenAccounts(mint: string): Promise<LargestTokenAccount[]> {
    const result = await this.call<{ value: LargestTokenAccount[] }>(
      "getTokenLargestAccounts",
      [mint, { commitment: "finalized" }],
    );
    return result.value;
  }
}

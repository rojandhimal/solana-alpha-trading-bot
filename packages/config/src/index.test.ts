import { describe, expect, it } from "vitest";

const loadConfig = async (env: Record<string, string | undefined>) => {
  const previous = { ...process.env };
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  try {
    return await import(`./index.js?test=${Date.now()}-${Math.random()}`);
  } finally {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, previous);
  }
};

const base = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci",
  REDIS_URL: "redis://localhost:6379",
  SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  DEXSCREENER_BASE_URL: "https://api.dexscreener.com",
  TRADING_MODE: "PAPER",
  ENABLE_LIVE_TRADING: "false"
};

describe("security configuration", () => {
  it("defaults to PAPER and rejects a signing key in PAPER mode", async () => {
    const config = await loadConfig(base);
    expect(config.config.TRADING_MODE).toBe("PAPER");
    await expect(loadConfig({ ...base, SOLANA_PRIVATE_KEY: "secret" })).rejects.toThrow();
  });

  it("rejects live mode without explicit enablement and a key", async () => {
    await expect(loadConfig({ ...base, TRADING_MODE: "LIVE" })).rejects.toThrow();
    await expect(loadConfig({ ...base, TRADING_MODE: "LIVE", ENABLE_LIVE_TRADING: "true" })).rejects.toThrow();
  });
});

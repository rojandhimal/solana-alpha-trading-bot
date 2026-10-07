import { describe, expect, it } from "vitest";
import { config, loadConfig } from "./index.js";

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
  it("defaults to PAPER and rejects a signing key in PAPER mode", () => {
    expect(config.TRADING_MODE).toBe("PAPER");
    expect(loadConfig(base).TRADING_MODE).toBe("PAPER");
    expect(() => loadConfig({ ...base, SOLANA_PRIVATE_KEY: "secret" })).toThrow("Do not load signing keys in PAPER mode");
  });

  it("rejects live mode without explicit enablement and a key", () => {
    expect(() => loadConfig({ ...base, TRADING_MODE: "LIVE" })).toThrow("LIVE trading requires explicit ENABLE_LIVE_TRADING=true");
    expect(() => loadConfig({ ...base, TRADING_MODE: "LIVE", ENABLE_LIVE_TRADING: "true" })).toThrow("LIVE trading requires a signing key");
  });
});

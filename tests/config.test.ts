import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function setRequiredEnv(): void {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.DEXSCREENER_BASE_URL = "https://api.dexscreener.com";
  process.env.RPC_ENDPOINT = "https://api.mainnet-beta.solana.com";
}

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe("config", () => {
  it("defaults LIVE_TRADING to false when not set", async () => {
    setRequiredEnv();
    delete process.env.LIVE_TRADING;

    const { config } = await import("../packages/config/src/index.js");

    expect(config.LIVE_TRADING).toBe(false);
  });
});

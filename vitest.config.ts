import { defineConfig, configDefaults } from "vitest/config";
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "dist/**", "apps/dashboard/**"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test.invalid/test",
      REDIS_URL: "redis://test.invalid:6379",
      SOLANA_RPC_URL: "https://rpc.invalid",
      DEXSCREENER_BASE_URL: "https://dex.invalid",
      TRADING_MODE: "PAPER",
      ENABLE_LIVE_TRADING: "false"
    }
  }
});

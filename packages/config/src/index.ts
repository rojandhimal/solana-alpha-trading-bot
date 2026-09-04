import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().min(1).default("solana-alpha-bot"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  SOLANA_RPC_URL: z.string().url(),
  SOLANA_WS_URL: z.string().optional(),
  DEXSCREENER_BASE_URL: z.string().url(),
  SCAN_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  MIN_LIQUIDITY_USD: z.coerce.number().nonnegative().default(100000),
  MIN_VOLUME_24H_USD: z.coerce.number().nonnegative().default(500000),
  MIN_PAIR_AGE_MINUTES: z.coerce.number().nonnegative().default(30),
  MAX_HOLDER_CONCENTRATION_PERCENT: z.coerce.number().min(0).max(100).default(30),
  MAX_EXPECTED_SLIPPAGE_PERCENT: z.coerce.number().min(0).max(100).default(1),
  MIN_SIGNAL_SCORE: z.coerce.number().min(0).max(100).default(80),
  TRADING_MODE: z.enum(["PAPER", "LIVE"]).default("PAPER"),
  SOLANA_PRIVATE_KEY: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

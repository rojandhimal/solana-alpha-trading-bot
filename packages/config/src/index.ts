import "dotenv/config";
import { z } from "zod";

const liveTradingSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().min(1).default("solana-alpha-bot"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  RPC_ENDPOINT: z.string().url().optional(),
  SOLANA_RPC_URL: z.string().url().optional(),
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
  LIVE_TRADING: liveTradingSchema.default("false"),
  SOLANA_PRIVATE_KEY: z.string().optional(),
  PRIVATE_KEY: z.string().optional(),
  MNEMONIC: z.string().optional(),
}).superRefine((value, context) => {
  if (!value.RPC_ENDPOINT && !value.SOLANA_RPC_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "RPC_ENDPOINT or SOLANA_RPC_URL is required",
      path: ["RPC_ENDPOINT"],
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.format());
  process.exit(1);
}

const parsedConfig = parsed.data;

export const config = {
  ...parsedConfig,
  SOLANA_RPC_URL: parsedConfig.RPC_ENDPOINT ?? parsedConfig.SOLANA_RPC_URL!,
} as const;

export function CHECK_LIVE_TRADING(): void {
  if (!config.LIVE_TRADING) {
    throw new Error(
      "LIVE_TRADING is disabled. Refusing to continue. Set LIVE_TRADING=true to explicitly enable live trading."
    );
  }
}

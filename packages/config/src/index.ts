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
  ENABLE_LIVE_TRADING: z.preprocess((value) => {
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
    return value;
  }, z.boolean()).default(false),
  SOLANA_PRIVATE_KEY: z.string().min(1).optional()
}).superRefine((value, ctx) => {
  if (value.TRADING_MODE === "LIVE" && !value.ENABLE_LIVE_TRADING) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ENABLE_LIVE_TRADING"], message: "LIVE trading requires explicit ENABLE_LIVE_TRADING=true" });
  if (value.TRADING_MODE === "LIVE" && !value.SOLANA_PRIVATE_KEY) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SOLANA_PRIVATE_KEY"], message: "LIVE trading requires a signing key supplied through the secret manager/environment" });
  if (value.TRADING_MODE === "PAPER" && value.SOLANA_PRIVATE_KEY) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SOLANA_PRIVATE_KEY"], message: "Do not load signing keys in PAPER mode" });
  if (value.ENABLE_LIVE_TRADING && value.TRADING_MODE !== "LIVE") ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ENABLE_LIVE_TRADING"], message: "ENABLE_LIVE_TRADING=true is only valid with TRADING_MODE=LIVE" });
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  return parsed.data;
}

let loadedConfig: AppConfig;
try {
  loadedConfig = loadConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid environment configuration");
  process.exit(1);
}

export const config = loadedConfig;

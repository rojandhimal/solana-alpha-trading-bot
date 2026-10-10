import pinoModule from "pino";
import { config } from "@alpha/config";

const pino =
  (pinoModule as typeof pinoModule & { default?: typeof pinoModule }).default ??
  pinoModule;

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: [
      "SOLANA_PRIVATE_KEY",
      "privateKey",
      "apiKey",
      "password",
      "authorization",
      "DATABASE_URL",
      "REDIS_URL",
      "headers.authorization",
      "headers.X-API-KEY",
      "*.SOLANA_PRIVATE_KEY",
      "*.privateKey",
      "*.apiKey",
      "*.password",
      "*.authorization",
    ],
    censor: "[REDACTED]",
  },
  base: { service: config.APP_NAME },
  timestamp: pino.stdTimeFunctions.isoTime,
});

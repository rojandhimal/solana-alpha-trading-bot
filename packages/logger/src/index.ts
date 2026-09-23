import pinoModule from "pino";
import { config } from "@alpha/config";

const pino = (pinoModule as typeof pinoModule & { default?: typeof pinoModule }).default ?? pinoModule;

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: config.APP_NAME },
  timestamp: pino.stdTimeFunctions.isoTime
});

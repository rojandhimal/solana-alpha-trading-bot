import pino from "pino";
import { config } from "@alpha/config";

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: config.APP_NAME },
  timestamp: pino.stdTimeFunctions.isoTime
});

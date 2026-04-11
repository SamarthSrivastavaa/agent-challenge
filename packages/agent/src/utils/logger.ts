import pino from "pino";

/**
 * Structured logger for the SovereignSelf agent.
 * Uses pino with pretty-printing in development and JSON in production.
 * All agent subsystems import this singleton for consistent log output.
 */
export const logger = pino({
  name: "sovereign-self",
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export default logger;

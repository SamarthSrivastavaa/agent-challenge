import type { Request, Response, NextFunction } from "express";
import pino from "pino";

const log = pino({ name: "sovereign-api" });

/**
 * Global error handler — catches unhandled errors in route handlers
 * and returns a structured JSON error response.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  log.error({ error: err.message, stack: err.stack }, "Unhandled route error");

  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV !== "production" ? err.message : undefined,
  });
}

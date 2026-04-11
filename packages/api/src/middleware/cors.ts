import type { Request, Response, NextFunction } from "express";
import cors from "cors";

/**
 * CORS middleware — allows the Vite dev server and the
 * production dashboard to access the API.
 */
export const corsMiddleware = cors({
  origin: [
    "http://localhost:5173",  // Vite dev server
    "http://localhost:8080",  // Docker dashboard
    "http://localhost:3000",  // alternate dev port
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});

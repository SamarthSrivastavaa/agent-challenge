import { Router } from "express";
import type pg from "pg";

/**
 * /api/reputation routes — reputation score queries.
 *
 * GET /api/reputation/current
 *   Returns latest reputation_scores row + 7-day trend delta.
 *
 * GET /api/reputation/history?days=30
 *   Returns array of reputation_scores for the last N days.
 */
export function reputationRouter(pool: pg.Pool): Router {
  const router = Router();

  /** GET /api/reputation/current — latest score with trend delta. */
  router.get("/current", async (_req, res) => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM reputation_scores ORDER BY created_at DESC LIMIT 2`,
      );

      if (result.rows.length === 0) {
        res.json({ reputation: null, delta: 0 });
        return;
      }

      const current = result.rows[0];
      const previous = result.rows[1] ?? null;
      const delta = previous
        ? +(current.score - previous.score).toFixed(2)
        : 0;

      res.json({ reputation: current, delta });
    } finally {
      client.release();
    }
  });

  /** GET /api/reputation/history?days=30 — historical scores. */
  router.get("/history", async (req, res) => {
    const days = Math.min(parseInt(String(req.query.days ?? "30"), 10), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM reputation_scores
         WHERE created_at >= $1
         ORDER BY created_at ASC`,
        [since.toISOString()],
      );

      res.json({ history: result.rows, days });
    } finally {
      client.release();
    }
  });

  return router;
}

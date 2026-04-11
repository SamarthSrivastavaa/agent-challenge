import { Router } from "express";
import type pg from "pg";

/**
 * /api/node routes — Nosana GPU node status.
 *
 * GET /api/node/status
 *   Returns latest node_metrics row + last 24 historical snapshots.
 *
 * GET /api/mentions?limit=20&filter=crisis
 *   Returns recent mentions with optional crisis filter.
 */
export function nodeStatusRouter(pool: pg.Pool): Router {
  const router = Router();

  /** GET /api/node/status — latest metrics + recent history. */
  router.get("/status", async (_req, res) => {
    const client = await pool.connect();
    try {
      const latestResult = await client.query(
        `SELECT * FROM node_metrics ORDER BY recorded_at DESC LIMIT 1`,
      );

      const historyResult = await client.query(
        `SELECT * FROM node_metrics ORDER BY recorded_at DESC LIMIT 24`,
      );

      res.json({
        metrics: latestResult.rows[0] ?? null,
        history: historyResult.rows,
      });
    } finally {
      client.release();
    }
  });

  return router;
}

/**
 * /api/mentions routes — Twitter mention queries.
 *
 * GET /api/mentions?limit=20&filter=crisis
 *   - limit: max rows (default 20, max 200)
 *   - filter: 'crisis' to show only crisis-flagged mentions
 */
export function mentionsRouter(pool: pg.Pool): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 200);
    const filter = req.query.filter as string | undefined;

    const client = await pool.connect();
    try {
      let query = "SELECT * FROM mentions";
      const params: unknown[] = [];

      if (filter === "crisis") {
        query += " WHERE is_crisis = TRUE";
      }

      query += " ORDER BY created_at DESC";
      params.push(limit);
      query += ` LIMIT $${params.length}`;

      const result = await client.query(query, params);

      // Compute mention stats
      const statsResult = await client.query(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE sentiment_label = 'positive') as positive,
           COUNT(*) FILTER (WHERE sentiment_label = 'negative') as negative,
           COUNT(*) FILTER (WHERE sentiment_label = 'neutral') as neutral,
           COUNT(*) FILTER (WHERE is_crisis = TRUE) as crisis,
           COALESCE(AVG(sentiment), 0) as avg_sentiment
         FROM mentions
         WHERE created_at >= NOW() - INTERVAL '7 days'`,
      );

      res.json({
        mentions: result.rows,
        stats: statsResult.rows[0] ?? {
          total: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
          crisis: 0,
          avg_sentiment: 0,
        },
      });
    } finally {
      client.release();
    }
  });

  return router;
}

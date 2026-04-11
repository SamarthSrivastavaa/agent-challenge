import { Router } from "express";
import type pg from "pg";

/**
 * /api/events routes — query agent_events table.
 *
 * GET /api/events?limit=50&type=ACTION
 *   - limit: max rows (default 50, max 200)
 *   - type: optional filter by event_type (ACTION|THOUGHT|ALERT|BRIEF|ERROR)
 *
 * Returns: { events: AgentEvent[], total: number }
 */
export function eventsRouter(pool: pg.Pool): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 200);
    const eventType = req.query.type as string | undefined;

    const client = await pool.connect();
    try {
      let query = "SELECT * FROM agent_events";
      const params: unknown[] = [];

      if (eventType) {
        query += " WHERE event_type = $1";
        params.push(eventType.toUpperCase());
      }

      query += " ORDER BY created_at DESC";

      // Get total count
      const countQuery = eventType
        ? "SELECT COUNT(*) FROM agent_events WHERE event_type = $1"
        : "SELECT COUNT(*) FROM agent_events";
      const countResult = await client.query(countQuery, eventType ? [eventType.toUpperCase()] : []);
      const total = parseInt(countResult.rows[0].count, 10);

      // Get paginated results
      params.push(limit);
      query += ` LIMIT $${params.length}`;

      const result = await client.query(query, params);

      res.json({ events: result.rows, total });
    } finally {
      client.release();
    }
  });

  return router;
}

import type { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import pg from "pg";
import { eventBus, type NodeMetrics } from "../../../utils/eventBus.js";
import { logger } from "../../../utils/logger.js";

const log = logger.child({ component: "nosanaStatus" });

/** Polling interval for Nosana node metrics (30 seconds). */
const POLL_INTERVAL_MS = 30_000;

/** Tracks the interval timer so it can be cleared on shutdown. */
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background polling loop for Nosana job metrics.
 *
 * Called once during agent startup. Polls the Nosana dashboard API
 * every 30 seconds, parses the response for GPU/CPU/memory/uptime,
 * stores the snapshot in node_metrics, and emits a 'node:metrics'
 * event for the WebSocket broadcaster.
 */
export function startNosanaPolling(): void {
  const jobId = process.env.NOSANA_JOB_ID;
  const dbUrl = process.env.DATABASE_URL;

  if (!jobId) {
    log.warn("NOSANA_JOB_ID not set — node monitoring disabled");
    return;
  }

  log.info({ jobId, intervalMs: POLL_INTERVAL_MS }, "Starting Nosana node polling");

  // Run immediately on startup, then on interval
  void pollNosanaMetrics(jobId, dbUrl);
  pollTimer = setInterval(() => {
    void pollNosanaMetrics(jobId, dbUrl);
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the Nosana polling loop. Called during graceful shutdown.
 */
export function stopNosanaPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    log.info("Nosana polling stopped");
  }
}

/**
 * Poll the Nosana dashboard API for job metrics and store them.
 *
 * @param jobId - The Nosana job identifier.
 * @param dbUrl - PostgreSQL connection string (optional).
 */
async function pollNosanaMetrics(
  jobId: string,
  dbUrl: string | undefined,
): Promise<void> {
  const apiUrl = `https://dashboard.nosana.com/api/jobs/${jobId}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      log.warn(
        { status: response.status, jobId },
        "Nosana API returned non-OK status",
      );
      return;
    }

    const data = (await response.json()) as Record<string, unknown>;

    // ── Parse metrics from the Nosana response ──
    // The exact shape depends on the Nosana API — we extract what's available
    // and fall back to defaults for missing fields.
    const metrics: NodeMetrics = {
      cpu_usage: parseFloat(String(data.cpuUsage ?? data.cpu_usage ?? 0)),
      gpu_usage: parseFloat(String(data.gpuUsage ?? data.gpu_usage ?? 0)),
      memory_used_gb: parseFloat(String(data.memoryUsed ?? data.memory_used_gb ?? 0)),
      memory_total_gb: parseFloat(String(data.memoryTotal ?? data.memory_total_gb ?? 0)),
      uptime_seconds: parseInt(String(data.uptime ?? data.uptime_seconds ?? 0), 10),
      job_id: jobId,
      status: String(data.status ?? "unknown"),
      recorded_at: new Date(),
    };

    log.debug(
      { gpu: metrics.gpu_usage, cpu: metrics.cpu_usage, status: metrics.status },
      "Nosana metrics polled",
    );

    // ── Store in node_metrics table ──
    if (dbUrl) {
      const client = new pg.Client({ connectionString: dbUrl });
      try {
        await client.connect();
        await client.query(
          `INSERT INTO node_metrics
             (cpu_usage, gpu_usage, memory_used_gb, memory_total_gb,
              uptime_seconds, job_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            metrics.cpu_usage,
            metrics.gpu_usage,
            metrics.memory_used_gb,
            metrics.memory_total_gb,
            metrics.uptime_seconds,
            metrics.job_id,
            metrics.status,
          ],
        );
      } finally {
        await client.end();
      }
    }

    // ── Emit event for WebSocket broadcast ──
    eventBus.emit("node:metrics", { metrics });
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      log.warn({ jobId }, "Nosana API request timed out");
    } else {
      log.warn({ error: String(error), jobId }, "Failed to poll Nosana metrics");
    }
  }
}

/**
 * NOSANA_STATUS provider — injects the latest node health data
 * into the ElizaOS context window before every model call.
 *
 * ElizaOS Providers supply ambient context. This one ensures the
 * agent always knows the current state of its Nosana GPU node,
 * allowing it to reference compute health in conversations and
 * weekly briefs.
 */
export const nosanaStatusProvider: Provider = {
  /**
   * Get handler — fetches the most recent node_metrics row from
   * PostgreSQL and formats it as a human-readable status string.
   */
  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ): Promise<string> => {
    const dbUrl = process.env.DATABASE_URL;
    const jobId = process.env.NOSANA_JOB_ID ?? "unknown";

    if (!dbUrl) {
      return `Nosana node ${jobId}: status unavailable (database not configured).`;
    }

    const client = new pg.Client({ connectionString: dbUrl });

    try {
      await client.connect();

      const result = await client.query<{
        cpu_usage: number;
        gpu_usage: number;
        memory_used_gb: number;
        memory_total_gb: number;
        uptime_seconds: number;
        job_id: string;
        status: string;
        recorded_at: Date;
      }>(
        `SELECT * FROM node_metrics
         ORDER BY recorded_at DESC
         LIMIT 1`,
      );

      if (result.rows.length === 0) {
        return `Nosana node ${jobId}: no metrics recorded yet. Polling will start shortly.`;
      }

      const m = result.rows[0];
      const uptime = formatUptime(m.uptime_seconds);

      return [
        `=== NOSANA NODE STATUS ===`,
        `Node ID: ${m.job_id.slice(0, 8)}...`,
        `Status:  ${m.status.toUpperCase()}`,
        `GPU:     ${m.gpu_usage.toFixed(1)}%`,
        `CPU:     ${m.cpu_usage.toFixed(1)}%`,
        `Memory:  ${m.memory_used_gb.toFixed(1)} GB / ${m.memory_total_gb.toFixed(1)} GB`,
        `Uptime:  ${uptime}`,
        `Last checked: ${new Date(m.recorded_at).toISOString()}`,
      ].join("\n");
    } catch (error) {
      log.error({ error: String(error) }, "Failed to fetch Nosana status");
      return `Nosana node ${jobId}: status unavailable (database error).`;
    } finally {
      await client.end();
    }
  },
};

/**
 * Format seconds into a human-readable uptime string (e.g. "4d 12h 33m").
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(" ");
}

export default nosanaStatusProvider;

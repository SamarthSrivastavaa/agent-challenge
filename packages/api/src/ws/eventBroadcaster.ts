import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "node:http";
import type pg from "pg";
import pino from "pino";

const log = pino({ name: "sovereign-ws" });

/** Heartbeat interval — ping every 25 seconds to keep connections alive. */
const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * Augmented WebSocket with liveness tracking.
 * Used to detect and prune stale connections.
 */
interface AugmentedWebSocket extends WebSocket {
  isAlive: boolean;
}

/**
 * Create and configure the WebSocket server for real-time event broadcasting.
 * Attaches to an existing HTTP server so WS and REST share the same port.
 *
 * On connection:
 *   - Sends the last 20 agent_events as initial state
 *   - Subscribes to the event bus and broadcasts to all connected clients
 *   - Implements heartbeat ping every 25s
 *
 * @param server - Existing HTTP server to attach the WebSocket server to.
 * @param pool   - PostgreSQL connection pool for fetching initial state.
 * @returns The configured WebSocketServer instance.
 */
export function createEventBroadcaster(
  server: HttpServer,
  pool: pg.Pool,
): WebSocketServer {
  const wss = new WebSocketServer({ server });

  log.info("WebSocket server attached to HTTP server");

  // ── Heartbeat: ping all clients every 25s, prune dead connections ──
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const augmented = ws as AugmentedWebSocket;
      if (!augmented.isAlive) {
        augmented.terminate();
        return;
      }
      augmented.isAlive = false;
      augmented.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  // ── Connection handler ──
  wss.on("connection", async (ws: WebSocket) => {
    const augmented = ws as AugmentedWebSocket;
    augmented.isAlive = true;

    augmented.on("pong", () => {
      augmented.isAlive = true;
    });

    log.info(
      { clientCount: wss.clients.size },
      "WebSocket client connected",
    );

    // Send last 20 events as initial state on connect
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT * FROM agent_events ORDER BY created_at DESC LIMIT 20`,
        );

        const initPayload = JSON.stringify({
          type: "INIT",
          payload: { events: result.rows },
        });

        if (augmented.readyState === WebSocket.OPEN) {
          augmented.send(initPayload);
        }
      } finally {
        client.release();
      }
    } catch (error) {
      log.warn({ error: String(error) }, "Failed to send initial state");
    }

    augmented.on("close", () => {
      log.debug(
        { clientCount: wss.clients.size - 1 },
        "WebSocket client disconnected",
      );
    });
  });

  return wss;
}

/**
 * Broadcast a typed event to all connected WebSocket clients.
 *
 * @param wss  - The WebSocketServer instance.
 * @param type - Event type string (MENTION, CRISIS, DRAFT, BRIEF, NODE, THOUGHT).
 * @param payload - The event payload to broadcast.
 */
export function broadcast(
  wss: WebSocketServer,
  type: string,
  payload: unknown,
): void {
  const message = JSON.stringify({ type, payload });
  let sentCount = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  });

  if (sentCount > 0) {
    log.debug({ type, clientCount: sentCount }, "Event broadcast");
  }
}

import "dotenv/config";
import express from "express";
import pino from "pino";
import { createDbPool } from "./db/client.js";
import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { eventsRouter } from "./routes/events.js";
import { reputationRouter } from "./routes/reputation.js";
import { nodeStatusRouter, mentionsRouter } from "./routes/nodeStatus.js";
import { createEventBroadcaster, broadcast } from "./ws/eventBroadcaster.js";

// ─────────────────────────────────────────────────────────────
// SovereignSelf API Server — Express 5 + WebSocket
//
// Exposes REST endpoints for the dashboard and a WebSocket
// server for real-time event streaming. In production (hackathon),
// this runs in the same Node.js process as the agent for zero-
// latency event forwarding via the shared event bus.
// ─────────────────────────────────────────────────────────────

const log = pino({ name: "sovereign-api" });

const API_PORT = parseInt(process.env.API_PORT ?? "3001", 10);
const WS_PORT = parseInt(process.env.API_WS_PORT ?? "3002", 10);

async function main(): Promise<void> {
  // ── Database pool ──
  const pool = createDbPool();
  log.info("Database pool created");

  // ── Express app ──
  const app = express();

  app.use(corsMiddleware);
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "sovereign-self-api",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // REST routes
  app.use("/api/events", eventsRouter(pool));
  app.use("/api/reputation", reputationRouter(pool));
  app.use("/api/node", nodeStatusRouter(pool));
  app.use("/api/mentions", mentionsRouter(pool));

  // POST /api/agent/trigger-brief — demo trigger for weekly brief
  app.post("/api/agent/trigger-brief", async (_req, res) => {
    try {
      // Dynamically import the event bus to emit a thought
      // (The actual brief generation is handled by the agent process)
      const { eventBus } = await import(
        "../../agent/src/utils/eventBus.js"
      );

      eventBus.emit("agent:thought", {
        source: "api",
        thought: "Manual brief generation triggered via API",
      });

      const jobId = `brief_${Date.now()}`;

      // Try to invoke the brief action directly
      try {
        const { generateWeeklyBriefAction } = await import(
          "../../agent/src/plugins/reputation/actions/generateWeeklyBrief.js"
        );

        // Fire and forget — don't block the response
        void generateWeeklyBriefAction.handler(
          {} as any,
          { content: { text: "Generate weekly brief (manual trigger)" } } as any,
          undefined,
          undefined,
          ((response: { text: string }) => {
            log.info({ briefLength: response.text.length }, "Brief generated via API trigger");
          }) as any,
        );
      } catch {
        log.warn("Could not invoke brief action directly — agent may handle it");
      }

      res.json({ status: "triggered", jobId });
    } catch (error) {
      log.error({ error: String(error) }, "Failed to trigger brief");
      res.status(500).json({ error: "Failed to trigger brief generation" });
    }
  });

  // Error handler (must be last middleware)
  app.use(errorHandler);

  // ── Start Express server ──
  app.listen(API_PORT, () => {
    log.info({ port: API_PORT }, "API server listening");
  });

  // ── WebSocket server ──
  const wss = createEventBroadcaster(WS_PORT, pool);

  // ── Subscribe event bus → WebSocket broadcast ──
  // Import the shared event bus from the agent package.
  // In the hackathon setup, agent + API run in the same process,
  // so this import shares the same EventEmitter instance.
  try {
    const { eventBus } = await import("../../agent/src/utils/eventBus.js");

    eventBus.on("mention:ingested", (payload) => {
      broadcast(wss, "MENTION", payload);
    });

    eventBus.on("crisis:detected", (payload) => {
      broadcast(wss, "CRISIS", payload);
    });

    eventBus.on("reply:drafted", (payload) => {
      broadcast(wss, "DRAFT", payload);
    });

    eventBus.on("brief:generated", (payload) => {
      broadcast(wss, "BRIEF", payload);
    });

    eventBus.on("node:metrics", (payload) => {
      broadcast(wss, "NODE", payload);
    });

    eventBus.on("agent:thought", (payload) => {
      broadcast(wss, "THOUGHT", payload);
    });

    log.info("Event bus → WebSocket bridge active");
  } catch (error) {
    log.warn(
      { error: String(error) },
      "Could not connect to event bus — WebSocket will only serve REST-seeded data",
    );
  }

  log.info("═══════════════════════════════════════════════════════");
  log.info(`  SovereignSelf API Server`);
  log.info(`  REST: http://localhost:${API_PORT}`);
  log.info(`  WS:   ws://localhost:${WS_PORT}`);
  log.info("═══════════════════════════════════════════════════════");
}

main().catch((error) => {
  log.fatal({ error: String(error) }, "Fatal API server error");
  process.exit(1);
});

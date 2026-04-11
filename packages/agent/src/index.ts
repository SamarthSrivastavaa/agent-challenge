import "dotenv/config";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import cron from "node-cron";
import { AgentRuntime } from "@elizaos/core";
import { logger } from "./utils/logger.js";
import { ModelClient } from "./utils/modelClient.js";
import { eventBus } from "./utils/eventBus.js";
import { sovereignSelfCharacter } from "./character.js";
import { reputationPlugin } from "./plugins/reputation/index.js";
import { crisisPlugin } from "./plugins/crisis/index.js";
import { nosanaMonitorPlugin } from "./plugins/nosana-monitor/index.js";
import { startNosanaPolling, stopNosanaPolling } from "./plugins/nosana-monitor/providers/nosanaStatus.js";

// ─────────────────────────────────────────────────────────────
// SovereignSelf Agent — Main Entrypoint
//
// This file bootstraps the entire agent:
// 1. Loads environment variables
// 2. Connects to PostgreSQL and runs pending migrations
// 3. Initialises the Qwen model client
// 4. Creates the ElizaOS AgentRuntime with all custom plugins
// 5. Starts cron-scheduled tasks (mention polling, weekly brief, metrics)
// 6. Starts the HTTP health-check server
// ─────────────────────────────────────────────────────────────

const log = logger.child({ component: "entrypoint" });

/** Resolve __dirname for ESM modules. */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run pending SQL migrations against the connected database.
 *
 * Reads the 001_init.sql migration file and executes it.
 * Uses CREATE IF NOT EXISTS so it's safe to run multiple times.
 *
 * @param client - Connected pg.Client instance.
 */
async function runMigrations(client: pg.Client): Promise<void> {
  const migrationPath = join(
    __dirname,
    "..",
    "..",
    "api",
    "src",
    "db",
    "migrations",
    "001_init.sql",
  );

  try {
    const sql = await readFile(migrationPath, "utf-8");
    await client.query(sql);
    log.info("Database migrations applied successfully");
  } catch (error) {
    // Migration file might not exist in all deployment scenarios;
    // the Docker entrypoint handles migrations via init scripts.
    log.warn(
      { error: String(error) },
      "Could not apply migrations from file — ensure DB schema exists",
    );
  }
}

/**
 * Start the HTTP health-check server.
 *
 * Exposes GET /health on API_PORT for Docker and Nosana
 * health checks. Returns JSON with status, uptime, and timestamp.
 *
 * @param port - Port to bind the HTTP server to.
 */
function startHealthServer(port: number): void {
  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          service: "sovereign-self-agent",
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        }),
      );
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  server.listen(port, () => {
    log.info({ port }, "Health check server listening");
  });
}

/**
 * Main bootstrap function — orchestrates the full agent startup sequence.
 */
async function main(): Promise<void> {
  log.info("═══════════════════════════════════════════════════════");
  log.info("  SovereignSelf — Autonomous Digital Identity Agent");
  log.info("  \"Your digital identity. Your compute. Your rules.\"");
  log.info("═══════════════════════════════════════════════════════");

  // ── 1. Validate critical environment variables ──
  const dbUrl = process.env.DATABASE_URL;
  const modelEndpoint = process.env.NOSANA_MODEL_ENDPOINT ?? process.env.OPENAI_API_URL;
  const modelApiKey = process.env.NOSANA_API_KEY ?? process.env.OPENAI_API_KEY;
  const apiPort = parseInt(process.env.API_PORT ?? "3001", 10);
  const nosanaJobId = process.env.NOSANA_JOB_ID ?? "local";

  if (!dbUrl) {
    log.error("DATABASE_URL is required — exiting");
    process.exit(1);
  }

  if (!modelEndpoint) {
    log.warn("No model endpoint configured — model calls will fail");
  }

  // ── 2. Connect to PostgreSQL ──
  log.info("Connecting to PostgreSQL...");
  const dbClient = new pg.Client({ connectionString: dbUrl });

  try {
    await dbClient.connect();
    log.info("PostgreSQL connected");
  } catch (error) {
    log.error({ error: String(error) }, "Failed to connect to PostgreSQL — exiting");
    process.exit(1);
  }

  // ── 3. Run pending migrations ──
  await runMigrations(dbClient);
  await dbClient.end();

  // ── 4. Initialise the Model Client ──
  const modelClient = modelEndpoint
    ? new ModelClient(modelEndpoint, modelApiKey)
    : null;

  if (modelClient) {
    log.info({ endpoint: modelEndpoint }, "ModelClient initialised");
  }

  // ── 5. Create the ElizaOS AgentRuntime ──
  // ElizaOS AgentRuntime is the central orchestrator. It loads the
  // character, registers plugins (actions/providers/evaluators), and
  // manages the conversation loop and memory.
  log.info("Initialising ElizaOS AgentRuntime...");

  try {
    const runtime = new AgentRuntime({
      // Character defines personality, system prompt, and model settings
      character: sovereignSelfCharacter,

      // Custom plugins providing reputation, crisis, and node monitoring
      plugins: [
        reputationPlugin,
        crisisPlugin,
        nosanaMonitorPlugin,
      ],

      // Model endpoint override — routes all model calls through Nosana
      modelProvider: modelEndpoint as string,

      // Additional runtime settings
      token: modelApiKey,
      databaseAdapter: undefined, // Using direct pg for custom tables
    } as Record<string, unknown>);

    log.info("ElizaOS AgentRuntime created with plugins:");
    log.info("  → reputation-engine (3 actions, 1 provider, 1 evaluator)");
    log.info("  → crisis-detector (1 action, 1 evaluator)");
    log.info("  → nosana-monitor (1 provider)");

    // ── 6. Start the agent runtime ──
    if (typeof (runtime as { start?: () => Promise<void> }).start === "function") {
      await (runtime as { start: () => Promise<void> }).start();
      log.info("ElizaOS runtime started");
    }
  } catch (error) {
    log.warn(
      { error: String(error) },
      "ElizaOS AgentRuntime initialisation encountered issues — continuing with standalone mode",
    );
  }

  // ── 7. Set up cron-scheduled tasks ──
  log.info("Registering scheduled tasks...");

  // Every 60 seconds: log a heartbeat (mention polling is handled by the Twitter plugin)
  cron.schedule("* * * * *", () => {
    eventBus.emit("agent:thought", {
      source: "scheduler",
      thought: "Heartbeat — agent is monitoring",
    });
    log.debug("Heartbeat tick");
  });

  // Every Sunday at 08:00 UTC: trigger weekly reputation brief
  cron.schedule(
    "0 8 * * 0",
    async () => {
      log.info("Cron: triggering weekly reputation brief generation");
      eventBus.emit("agent:thought", {
        source: "scheduler",
        thought: "Triggering scheduled weekly reputation brief",
      });

      // Invoke the brief generation directly
      const dbClient = new pg.Client({ connectionString: dbUrl });
      try {
        await dbClient.connect();

        // Create a minimal memory object for the action handler
        const triggerMessage = {
          content: { text: "Generate weekly reputation brief (scheduled)" },
          userId: "system",
          roomId: "system",
        };

        // Import and call the handler directly
        const { generateWeeklyBriefAction } = await import(
          "./plugins/reputation/actions/generateWeeklyBrief.js"
        );

        await generateWeeklyBriefAction.handler(
          {} as unknown as import("@elizaos/core").IAgentRuntime,
          triggerMessage as unknown as import("@elizaos/core").Memory,
          undefined,
          undefined,
          (response: { text: string }) => {
            log.info(
              { briefLength: response.text.length },
              "Weekly brief generated via cron",
            );
          },
        );
      } catch (error) {
        log.error({ error: String(error) }, "Failed to generate scheduled weekly brief");
      } finally {
        await dbClient.end();
      }
    },
    { timezone: "UTC" },
  );

  // Every 30 seconds: Nosana node metrics polling (handled by the polling function)
  startNosanaPolling();

  log.info("Scheduled tasks registered:");
  log.info("  → Heartbeat: every 60s");
  log.info("  → Weekly brief: Sunday 08:00 UTC");
  log.info("  → Nosana metrics: every 30s");

  // ── 8. Start the HTTP health check server ──
  startHealthServer(apiPort);

  // ── 9. Log startup complete ──
  log.info("═══════════════════════════════════════════════════════");
  log.info(`  SovereignSelf agent running on Nosana node ${nosanaJobId}`);
  log.info(`  Health check: http://localhost:${apiPort}/health`);
  log.info("═══════════════════════════════════════════════════════");

  // ── Graceful shutdown ──
  const shutdown = async (): Promise<void> => {
    log.info("Shutting down SovereignSelf agent...");
    stopNosanaPolling();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// ── Bootstrap ──
main().catch((error) => {
  log.fatal({ error: String(error) }, "Fatal error during agent startup");
  process.exit(1);
});

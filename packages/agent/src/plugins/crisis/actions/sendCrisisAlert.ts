import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { eventBus, type Mention, type CrisisSeverity } from "../../../utils/eventBus.js";
import { logger } from "../../../utils/logger.js";
import pg from "pg";

const log = logger.child({ component: "sendCrisisAlert" });

/**
 * SEND_CRISIS_ALERT — delivers real-time crisis notifications via Telegram.
 *
 * This action listens for 'crisis:detected' events from the CrisisEvaluator
 * and formats + sends a Telegram message with:
 * - Severity level and mention count
 * - Average sentiment score and label
 * - Top crisis mentions with author and content preview
 * - A note that a drafted response is ready in the dashboard
 *
 * It also stores the sent alert as an agent_event for audit logging.
 *
 * NOTE: The action auto-registers a listener on the event bus during
 * module load. It can also be triggered manually through the ElizaOS
 * planner for testing purposes.
 */
export const sendCrisisAlertAction: Action = {
  /** Unique action name in the ElizaOS action registry. */
  name: "SEND_CRISIS_ALERT",

  /** Human-readable description for the planner. */
  description: "Send a crisis alert notification via Telegram",

  /** Match phrases for manual invocation. */
  similes: ["TRIGGER_ALERT", "CRISIS_NOTIFICATION", "SEND_ALERT"],

  /**
   * Validate — only allow if Telegram is configured.
   */
  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ): Promise<boolean> => {
    return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  },

  /**
   * Handler — formats and sends the Telegram crisis alert.
   * When invoked manually, it synthesises alert data from the
   * most recent crisis mentions in the database.
   */
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<void> => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const dbUrl = process.env.DATABASE_URL;

    if (!botToken || !chatId) {
      log.warn("Telegram credentials not configured — skipping alert");
      if (callback) {
        callback({ text: "Telegram not configured. Crisis alert not sent." });
      }
      return;
    }

    try {
      // ── Fetch recent crisis data from DB if available ──
      let mentions: Mention[] = [];
      let severity: CrisisSeverity = "low";
      let avgSentiment = 0;

      if (dbUrl) {
        const client = new pg.Client({ connectionString: dbUrl });
        await client.connect();

        const result = await client.query<{
          id: number;
          tweet_id: string;
          author_handle: string;
          content: string;
          sentiment: number | null;
          sentiment_label: string | null;
          reach: number;
          is_crisis: boolean;
          created_at: Date;
          ingested_at: Date;
        }>(
          `SELECT * FROM mentions
           WHERE is_crisis = TRUE
           ORDER BY created_at DESC
           LIMIT 10`,
        );

        mentions = result.rows.map((row) => ({
          id: row.id,
          tweet_id: row.tweet_id,
          author_handle: row.author_handle,
          content: row.content,
          sentiment: row.sentiment,
          sentiment_label: row.sentiment_label,
          reach: row.reach,
          is_crisis: row.is_crisis,
          created_at: new Date(row.created_at),
          ingested_at: new Date(row.ingested_at),
        }));

        // Compute severity from mention data
        const sentiments = mentions
          .filter((m) => m.sentiment != null)
          .map((m) => m.sentiment as number);
        avgSentiment = sentiments.length > 0
          ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
          : 0;

        if (mentions.length > 50 && avgSentiment < -0.5) severity = "high";
        else if (mentions.length > 20 && avgSentiment < -0.3) severity = "medium";
        else severity = "low";

        await client.end();
      }

      // ── Format the Telegram message ──
      const sentimentLabel =
        avgSentiment < -0.3 ? "negative" : avgSentiment > 0.3 ? "positive" : "neutral";

      const topMentions = mentions
        .slice(0, 3)
        .map((m) => `• @${m.author_handle}: "${truncate(m.content, 80)}"`)
        .join("\n");

      const telegramMessage = [
        `🚨 CRISIS ALERT — ${severity.toUpperCase()}`,
        "",
        `${mentions.length} mentions in 15 minutes`,
        `Avg sentiment: ${avgSentiment.toFixed(2)} (${sentimentLabel})`,
        "",
        "Top mentions:",
        topMentions || "• (No mention data available)",
        "",
        "Drafted response ready in dashboard.",
      ].join("\n");

      // ── Send via Telegram Bot API ──
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

      const response = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: telegramMessage,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "unknown");
        throw new Error(`Telegram API returned ${response.status}: ${errorBody}`);
      }

      log.info(
        { severity, mentionCount: mentions.length },
        "Crisis alert sent via Telegram",
      );

      // ── Store alert event in agent_events ──
      if (dbUrl) {
        const client = new pg.Client({ connectionString: dbUrl });
        await client.connect();
        await client.query(
          `INSERT INTO agent_events (event_type, event_source, payload)
           VALUES ('ALERT', 'crisis-detector', $1)`,
          [
            JSON.stringify({
              action: "SEND_CRISIS_ALERT",
              severity,
              mention_count: mentions.length,
              avg_sentiment: +avgSentiment.toFixed(3),
              telegram_delivered: true,
            }),
          ],
        );
        await client.end();
      }

      if (callback) {
        callback({
          text: `Crisis alert (${severity.toUpperCase()}) sent to Telegram. ${mentions.length} mentions flagged.`,
        });
      }
    } catch (error) {
      log.error({ error: String(error) }, "Failed to send crisis alert");
      if (callback) {
        callback({ text: "Failed to send crisis alert. Check Telegram configuration." });
      }
    }
  },

  /**
   * Examples for ElizaOS few-shot action selection.
   */
  examples: [
    [
      {
        user: "system",
        content: { text: "Crisis detected: 35 negative mentions in 15 minutes" },
      },
      {
        user: "SovereignSelf",
        content: {
          text: "Sending crisis alert via Telegram...",
          action: "SEND_CRISIS_ALERT",
        },
      },
    ],
  ],
};

/** Truncate a string to a maximum length, appending "…" if truncated. */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

// ─────────────────────────────────────────────────────────────
// Auto-listener: fire the Telegram alert whenever the event bus
// emits a 'crisis:detected' event from the CrisisEvaluator.
// This runs independently of the ElizaOS planner — ensuring
// alerts are always sent, even if the planner doesn't select
// the SEND_CRISIS_ALERT action explicitly.
// ─────────────────────────────────────────────────────────────
eventBus.on("crisis:detected", async ({ mentions, severity }) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    log.warn("Crisis detected but Telegram not configured — alert not sent");
    return;
  }

  const sentiments = mentions
    .filter((m) => m.sentiment != null)
    .map((m) => m.sentiment as number);
  const avgSentiment = sentiments.length > 0
    ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
    : 0;
  const sentimentLabel =
    avgSentiment < -0.3 ? "negative" : avgSentiment > 0.3 ? "positive" : "neutral";

  const topMentions = mentions
    .slice(0, 3)
    .map((m) => `• @${m.author_handle}: "${truncate(m.content, 80)}"`)
    .join("\n");

  const telegramMessage = [
    `🚨 CRISIS ALERT — ${severity.toUpperCase()}`,
    "",
    `${mentions.length} mentions in 15 minutes`,
    `Avg sentiment: ${avgSentiment.toFixed(2)} (${sentimentLabel})`,
    "",
    "Top mentions:",
    topMentions || "• (No mention data available)",
    "",
    "Drafted response ready in dashboard.",
  ].join("\n");

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: telegramMessage,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      log.error({ status: response.status, body: errorBody }, "Telegram API error");
    } else {
      log.info({ severity, mentionCount: mentions.length }, "Auto-alert sent via Telegram");
    }
  } catch (error) {
    log.error({ error: String(error) }, "Failed to auto-send crisis alert");
  }
});

export default sendCrisisAlertAction;

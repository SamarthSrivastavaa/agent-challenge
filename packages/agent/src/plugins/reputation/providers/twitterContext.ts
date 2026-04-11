import type { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import pg from "pg";
import { logger } from "../../../utils/logger.js";

const log = logger.child({ component: "twitterContext" });

/**
 * TWITTER_CONTEXT provider — supplies the agent with a formatted summary
 * of the most recent 100 Twitter/X mentions.
 *
 * ElizaOS Providers are injected into the context window before every model
 * call. This provider ensures the agent always has fresh mention data
 * available for decision-making, crisis detection, and reply drafting
 * without needing to re-query on every action.
 *
 * Format per mention:
 *   [@author_handle] (sentiment_label, reach: N) "content" — YYYY-MM-DD HH:MM
 */
export const twitterContextProvider: Provider = {
  /**
   * Get handler — called by ElizaOS before each model invocation.
   * Fetches the last 100 mentions from PostgreSQL and formats them
   * as a dense context string the agent can reason over.
   *
   * @returns Formatted mention context string, or a "no mentions" message.
   */
  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ): Promise<string> => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      log.warn("DATABASE_URL not set — returning empty context");
      return "No Twitter context available (database not configured).";
    }

    const client = new pg.Client({ connectionString: dbUrl });

    try {
      await client.connect();

      const result = await client.query<{
        author_handle: string;
        content: string;
        sentiment: number | null;
        sentiment_label: string | null;
        reach: number;
        created_at: Date;
      }>(
        `SELECT author_handle, content, sentiment, sentiment_label,
                reach, created_at
         FROM mentions
         ORDER BY created_at DESC
         LIMIT 100`,
      );

      if (result.rows.length === 0) {
        return "No Twitter mentions ingested yet. Monitoring has not started.";
      }

      const header = `=== TWITTER CONTEXT: Last ${result.rows.length} Mentions ===\n`;

      const mentionLines = result.rows.map((row) => {
        const timestamp = new Date(row.created_at).toISOString().slice(0, 16).replace("T", " ");
        const sentiment = row.sentiment_label ?? "unscored";
        const sentimentScore = row.sentiment != null ? ` ${row.sentiment.toFixed(2)}` : "";
        return `[@${row.author_handle}] (${sentiment}${sentimentScore}, reach: ${row.reach}) "${row.content}" — ${timestamp}`;
      });

      log.debug(
        { mentionCount: result.rows.length },
        "Twitter context provider fetched mentions",
      );

      return header + mentionLines.join("\n");
    } catch (error) {
      log.error({ error: String(error) }, "Failed to fetch Twitter context");
      return "Twitter context unavailable (database error).";
    } finally {
      await client.end();
    }
  },
};

export default twitterContextProvider;

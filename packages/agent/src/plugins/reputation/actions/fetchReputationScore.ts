import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import pg from "pg";
import { eventBus } from "../../../utils/eventBus.js";
import { logger } from "../../../utils/logger.js";

const log = logger.child({ component: "fetchReputationScore" });

/**
 * FETCH_REPUTATION_SCORE — retrieves the latest reputation score and
 * computes a 7-day trend delta from the previous week's snapshot.
 *
 * This is an ElizaOS Action: the runtime invokes it when a user asks about
 * their current reputation standing. The handler queries the reputation_scores
 * table directly via pg, computes the week-over-week delta, emits an
 * 'agent:thought' event, and returns a formatted summary string.
 */
export const fetchReputationScoreAction: Action = {
  /** Unique action identifier registered in the ElizaOS action registry. */
  name: "FETCH_REPUTATION_SCORE",

  /** Human-readable description used by the planner to decide when to invoke. */
  description: "Fetch the current reputation score and recent metrics",

  /** Alternative phrasings the ElizaOS planner matches against user intent. */
  similes: ["CHECK_REPUTATION", "GET_SCORE", "REPUTATION_STATUS"],

  /**
   * Validate whether this action can run for the given message.
   * Always returns true — reputation score is available on demand.
   */
  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ): Promise<boolean> => {
    return true;
  },

  /**
   * Handler — fetches the latest and previous reputation scores,
   * computes the trend, and returns a formatted summary.
   */
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<void> => {
    const dbUrl =
      process.env.DATABASE_URL ??
      "postgres://sovereign:sovereign@localhost:5432/sovereign";

    const client = new pg.Client({ connectionString: dbUrl });

    try {
      await client.connect();

      // ── Fetch the two most recent reputation snapshots ──
      const result = await client.query<{
        score: number;
        mention_count: number;
        positive_pct: number;
        negative_pct: number;
        neutral_pct: number;
        total_reach: number;
        brief_text: string | null;
        period_start: Date;
        period_end: Date;
        created_at: Date;
      }>(
        `SELECT score, mention_count, positive_pct, negative_pct, neutral_pct,
                total_reach, brief_text, period_start, period_end, created_at
         FROM reputation_scores
         ORDER BY created_at DESC
         LIMIT 2`,
      );

      if (result.rows.length === 0) {
        const noDataMsg =
          "No reputation data available yet. The first brief will be generated Sunday 08:00 UTC.";

        eventBus.emit("agent:thought", {
          source: "reputation-engine",
          thought: "No reputation scores found in database",
        });

        if (callback) {
          callback({ text: noDataMsg });
        }
        return;
      }

      const current = result.rows[0];
      const previous = result.rows[1] ?? null;

      // ── Compute 7-day trend delta ──
      const scoreDelta = previous
        ? +(current.score - previous.score).toFixed(2)
        : 0;
      const deltaSymbol = scoreDelta >= 0 ? "+" : "";

      const summary = [
        `**Score: ${current.score.toFixed(1)}/10** (${deltaSymbol}${scoreDelta} from last week)`,
        "",
        `- Mentions: ${current.mention_count ?? 0}`,
        `- Positive: ${(current.positive_pct ?? 0).toFixed(1)}%`,
        `- Neutral: ${(current.neutral_pct ?? 0).toFixed(1)}%`,
        `- Negative: ${(current.negative_pct ?? 0).toFixed(1)}%`,
        `- Estimated reach: ${formatReach(current.total_reach ?? 0)}`,
        "",
        `Period: ${formatDate(current.period_start)} — ${formatDate(current.period_end)}`,
      ].join("\n");

      log.info(
        { score: current.score, delta: scoreDelta },
        "Reputation score fetched",
      );

      // ── Emit thought event for the activity feed and WebSocket ──
      eventBus.emit("agent:thought", {
        source: "reputation-engine",
        thought: `Current reputation score: ${current.score.toFixed(1)}/10 (${deltaSymbol}${scoreDelta})`,
      });

      if (callback) {
        callback({ text: summary });
      }
    } catch (error) {
      log.error({ error: String(error) }, "Failed to fetch reputation score");
      if (callback) {
        callback({
          text: "Failed to retrieve reputation score. Check database connectivity.",
        });
      }
    } finally {
      await client.end();
    }
  },

  /**
   * Examples — ElizaOS uses these for few-shot action selection.
   * Each entry shows a user message that should trigger this action.
   */
  examples: [
    [
      {
        user: "user",
        content: { text: "What's my reputation score?" },
      },
      {
        user: "SovereignSelf",
        content: {
          text: "Fetching your current reputation metrics...",
          action: "FETCH_REPUTATION_SCORE",
        },
      },
    ],
  ],
};

/** Format a number into a human-readable reach string (e.g. 124.3K). */
function formatReach(reach: number): string {
  if (reach >= 1_000_000) return `${(reach / 1_000_000).toFixed(1)}M`;
  if (reach >= 1_000) return `${(reach / 1_000).toFixed(1)}K`;
  return String(reach);
}

/** Format a Date into a short locale string. */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default fetchReputationScoreAction;

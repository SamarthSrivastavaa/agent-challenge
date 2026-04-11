import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import pg from "pg";
import { ModelClient } from "../../../utils/modelClient.js";
import { eventBus, type ReputationBrief } from "../../../utils/eventBus.js";
import { logger } from "../../../utils/logger.js";

const log = logger.child({ component: "generateWeeklyBrief" });

/**
 * GENERATE_WEEKLY_BRIEF — produces the weekly reputation intelligence briefing.
 *
 * This is the flagship scheduled action. It runs every Sunday at 08:00 UTC
 * via node-cron, but can also be triggered manually from the dashboard
 * (POST /api/agent/trigger-brief) for demo purposes.
 *
 * Pipeline:
 * 1. Fetch all mentions from the last 7 days
 * 2. Compute aggregate metrics (count, sentiment breakdown, reach, score)
 * 3. Send up to 40K tokens of raw mention context to the model
 * 4. Store the result in reputation_scores
 * 5. Emit 'brief:generated' event for WebSocket broadcast
 */
export const generateWeeklyBriefAction: Action = {
  /** Unique action identifier in the ElizaOS action registry. */
  name: "GENERATE_WEEKLY_BRIEF",

  /** Human-readable description for the planner. */
  description: "Generate the weekly reputation intelligence briefing",

  /** Alternative match phrases for planner intent detection. */
  similes: ["WEEKLY_REPORT", "REPUTATION_BRIEF", "GENERATE_BRIEF"],

  /**
   * Validate — always available; the handler gracefully handles sparse data.
   */
  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ): Promise<boolean> => {
    return true;
  },

  /**
   * Handler — the weekly brief generation pipeline.
   */
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<void> => {
    const dbUrl = process.env.DATABASE_URL;
    const endpoint = process.env.NOSANA_MODEL_ENDPOINT ?? process.env.OPENAI_API_URL;
    const apiKey = process.env.NOSANA_API_KEY ?? process.env.OPENAI_API_KEY;
    const nodeId = process.env.NOSANA_JOB_ID ?? "local";

    if (!dbUrl || !endpoint) {
      log.error("DATABASE_URL or model endpoint not configured");
      return;
    }

    const modelClient = new ModelClient(endpoint, apiKey);
    const client = new pg.Client({ connectionString: dbUrl });

    try {
      await client.connect();

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      eventBus.emit("agent:thought", {
        source: "reputation-engine",
        thought: "Starting weekly reputation brief generation",
      });

      // ── 1. Fetch all mentions from the last 7 days ──
      const mentionsResult = await client.query<{
        author_handle: string;
        content: string;
        sentiment: number | null;
        sentiment_label: string | null;
        reach: number;
        is_crisis: boolean;
        created_at: Date;
      }>(
        `SELECT author_handle, content, sentiment, sentiment_label,
                reach, is_crisis, created_at
         FROM mentions
         WHERE created_at >= $1
         ORDER BY created_at DESC`,
        [oneWeekAgo.toISOString()],
      );

      const mentions = mentionsResult.rows;
      const totalMentions = mentions.length;

      // ── 2. Compute aggregate metrics ──
      const positiveMentions = mentions.filter((m) => m.sentiment_label === "positive");
      const negativeMentions = mentions.filter((m) => m.sentiment_label === "negative");
      const neutralMentions = mentions.filter((m) => m.sentiment_label === "neutral");

      const positivePct = totalMentions > 0
        ? +((positiveMentions.length / totalMentions) * 100).toFixed(1)
        : 0;
      const negativePct = totalMentions > 0
        ? +((negativeMentions.length / totalMentions) * 100).toFixed(1)
        : 0;
      const neutralPct = totalMentions > 0
        ? +((neutralMentions.length / totalMentions) * 100).toFixed(1)
        : 0;

      const totalReach = mentions.reduce((sum, m) => sum + (m.reach || 0), 0);

      // Weighted reputation score formula:
      //   base = 5.0
      //   + (positive_pct / 100) * 3    (max +3 for all-positive)
      //   - (negative_pct / 100) * 4    (max -4 for all-negative)
      //   + min(totalMentions / 100, 1) * 1  (volume bonus, max +1)
      //   + min(totalReach / 10000, 1) * 1   (reach bonus, max +1)
      const score = Math.max(
        0,
        Math.min(
          10,
          +(
            5.0 +
            (positivePct / 100) * 3 -
            (negativePct / 100) * 4 +
            Math.min(totalMentions / 100, 1) * 1 +
            Math.min(totalReach / 10000, 1) * 1
          ).toFixed(1),
        ),
      );

      // ── 3. Fetch previous week's score for delta calculation ──
      const prevResult = await client.query<{ score: number }>(
        `SELECT score FROM reputation_scores
         ORDER BY created_at DESC LIMIT 1`,
      );
      const prevScore = prevResult.rows[0]?.score ?? score;
      const scoreDelta = +(score - prevScore).toFixed(1);
      const deltaSymbol = scoreDelta >= 0 ? "+" : "";

      // ── 4. Format mention context for the model (budget: ~40K tokens ≈ 160K chars) ──
      const mentionContext = mentions
        .slice(0, 500) // cap to avoid exceeding context window
        .map(
          (m, i) =>
            `[${i + 1}] @${m.author_handle} (${m.sentiment_label ?? "unscored"}, reach: ${m.reach}): "${m.content}"`,
        )
        .join("\n");

      const dateStr = now.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      // ── 5. Build the brief generation prompt from the spec ──
      const systemPrompt = `You are an intelligence analyst generating a weekly reputation brief.
Be executive-summary style: data-driven, specific, actionable.
Format exactly as:

## REPUTATION BRIEF — Week of ${dateStr}

**Score: ${score}/10** (${deltaSymbol}${scoreDelta} from last week)

### Key Metrics
- Total mentions: ${totalMentions} (${deltaSymbol}${scoreDelta > 0 ? "up" : scoreDelta < 0 ? "down" : "flat"})
- Positive: ${positivePct}% | Neutral: ${neutralPct}% | Negative: ${negativePct}%
- Estimated reach: ${formatReach(totalReach)}

### Top Positive Signal
[2-3 sentences about the highest-impact positive mention]

### Risk Assessment
[1-2 sentences about any concerning patterns. 'None detected' if clean.]

### Recommended Actions
1. [Specific action]
2. [Specific action]

---
*Generated by SovereignSelf on ${nodeId} — your compute, your data.*`;

      log.info(
        { totalMentions, score, positivePct, negativePct },
        "Generating weekly brief",
      );

      const briefText = await modelClient.complete(
        [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Here are this week's ${totalMentions} mentions:\n\n${mentionContext || "(No mentions this week.)"}`,
          },
        ],
        { temperature: 0.3, max_tokens: 1500 },
      );

      // ── 6. Store result in reputation_scores ──
      const insertResult = await client.query<{ id: number; created_at: Date }>(
        `INSERT INTO reputation_scores
           (period_start, period_end, score, mention_count, positive_pct,
            negative_pct, neutral_pct, total_reach, brief_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, created_at`,
        [
          oneWeekAgo.toISOString(),
          now.toISOString(),
          score,
          totalMentions,
          positivePct,
          negativePct,
          neutralPct,
          totalReach,
          briefText,
        ],
      );

      const row = insertResult.rows[0];

      // ── 7. Emit 'brief:generated' event for WebSocket broadcast ──
      const brief: ReputationBrief = {
        id: row.id,
        period_start: oneWeekAgo,
        period_end: now,
        score,
        mention_count: totalMentions,
        positive_pct: positivePct,
        negative_pct: negativePct,
        neutral_pct: neutralPct,
        total_reach: totalReach,
        brief_text: briefText,
        created_at: row.created_at,
      };

      eventBus.emit("brief:generated", { brief });

      // Also store an agent_event for the activity feed
      await client.query(
        `INSERT INTO agent_events (event_type, event_source, payload)
         VALUES ('BRIEF', 'reputation-engine', $1)`,
        [
          JSON.stringify({
            action: "GENERATE_WEEKLY_BRIEF",
            score,
            mention_count: totalMentions,
            brief_preview: briefText.slice(0, 200),
          }),
        ],
      );

      log.info(
        { briefId: row.id, score },
        "Weekly brief generated and stored",
      );

      eventBus.emit("agent:thought", {
        source: "reputation-engine",
        thought: `Weekly brief generated — score: ${score}/10, ${totalMentions} mentions analysed`,
      });

      if (callback) {
        callback({ text: briefText });
      }
    } catch (error) {
      log.error({ error: String(error) }, "Failed to generate weekly brief");
      if (callback) {
        callback({
          text: "Failed to generate weekly brief. Check model and database connectivity.",
        });
      }
    } finally {
      await client.end();
    }
  },

  /**
   * Examples for ElizaOS few-shot action selection.
   */
  examples: [
    [
      {
        user: "user",
        content: { text: "Generate my weekly reputation brief" },
      },
      {
        user: "SovereignSelf",
        content: {
          text: "Compiling this week's reputation intelligence...",
          action: "GENERATE_WEEKLY_BRIEF",
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

export default generateWeeklyBriefAction;

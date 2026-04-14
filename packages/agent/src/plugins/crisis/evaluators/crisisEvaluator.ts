import type { Evaluator, IAgentRuntime, Memory, State } from "@elizaos/core";
import pg from "pg";
import { eventBus, type Mention, type CrisisSeverity } from "../../../utils/eventBus.js";
import { logger } from "../../../utils/logger.js";

const log = logger.child({ component: "crisisEvaluator" });

/**
 * Cooldown tracker — prevents duplicate crisis alerts from firing
 * within a 30-minute window of a previous detection.
 */
let lastCrisisFiredAt: Date | null = null;

/** Minimum milliseconds between crisis detections (30 minutes). */
const CRISIS_COOLDOWN_MS = 30 * 60 * 1000;

/**
 * CRISIS_EVALUATOR — the real-time threat detection engine.
 *
 * This ElizaOS Evaluator runs after every message cycle (alwaysRun = true)
 * and checks whether the current mention velocity and sentiment trend
 * have crossed crisis thresholds.
 *
 * Thresholds (from the spec):
 * - HIGH:   >50 mentions in 15 min AND avg sentiment < -0.5
 * - MEDIUM: >20 mentions in 15 min AND avg sentiment < -0.3
 * - LOW:    >10 mentions in 15 min AND avg sentiment < -0.1
 *
 * When a threshold is breached and the cooldown has elapsed:
 * 1. Marks offending mentions as is_crisis = true
 * 2. Emits 'crisis:detected' event with severity
 * 3. Stores the detection in agent_events
 */
export const crisisEvaluator: Evaluator = {
  /** Unique evaluator name in the ElizaOS evaluator registry. */
  name: "CRISIS_EVALUATOR",

  /** Description for logging and registry introspection. */
  description: "Detect crisis conditions based on mention velocity and sentiment",

  /**
   * alwaysRun = true — this evaluator must fire on every message cycle
   * to ensure no crisis window is missed. ElizaOS skips the planner
   * selection step for alwaysRun evaluators.
   */
  alwaysRun: true,

  /**
   * Validate — always return true; the handler performs its own
   * database-level checks to determine if crisis conditions exist.
   */
  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ): Promise<boolean> => {
    return true;
  },

  /**
   * Handler — the crisis detection pipeline.
   *
   * Queries the database for mention velocity (count in last 15 min)
   * and average sentiment (last 20 mentions), then evaluates against
   * the three-tier threshold system.
   */
  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ): Promise<void> => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return;

    // ── Check cooldown — skip if a crisis was fired within 30 min ──
    if (lastCrisisFiredAt) {
      const elapsed = Date.now() - lastCrisisFiredAt.getTime();
      if (elapsed < CRISIS_COOLDOWN_MS) {
        log.debug(
          { elapsedMin: Math.round(elapsed / 60000) },
          "Crisis cooldown active — skipping evaluation",
        );
        return;
      }
    }

    const client = new pg.Client({ connectionString: dbUrl });

    try {
      await client.connect();

      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

      // ── 1. Count mentions in the last 15 minutes ──
      const countResult = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM mentions
         WHERE created_at >= $1`,
        [fifteenMinAgo.toISOString()],
      );
      const mentionCount = parseInt(countResult.rows[0].count, 10);

      // ── 2. Get average sentiment of the last 20 mentions ──
      const sentimentResult = await client.query<{ avg_sentiment: number | null }>(
        `SELECT AVG(sentiment) as avg_sentiment FROM (
           SELECT sentiment FROM mentions
           WHERE sentiment IS NOT NULL
           ORDER BY created_at DESC
           LIMIT 20
         ) sub`,
      );
      const avgSentiment = sentimentResult.rows[0].avg_sentiment ?? 0;

      // ── 3. Evaluate against crisis thresholds ──
      let severity: CrisisSeverity | null = null;

      if (mentionCount > 50 && avgSentiment < -0.5) {
        severity = "high";
      } else if (mentionCount > 20 && avgSentiment < -0.3) {
        severity = "medium";
      } else if (mentionCount > 10 && avgSentiment < -0.1) {
        severity = "low";
      }

      if (!severity) {
        log.debug(
          { mentionCount, avgSentiment: avgSentiment.toFixed(3) },
          "No crisis threshold reached",
        );
        return;
      }

      log.warn(
        { severity, mentionCount, avgSentiment: avgSentiment.toFixed(3) },
        "⚠ CRISIS THRESHOLD BREACHED",
      );

      // ── 4. Mark offending mentions as crisis mentions ──
      await client.query(
        `UPDATE mentions
         SET is_crisis = TRUE
         WHERE created_at >= $1 AND is_crisis = FALSE
           AND (sentiment_label = 'negative' OR sentiment < -0.1)`,
        [fifteenMinAgo.toISOString()],
      );

      // ── 5. Fetch the crisis mentions for the event payload ──
      const crisisMentionsResult = await client.query<{
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
         WHERE created_at >= $1 AND is_crisis = TRUE
         ORDER BY created_at DESC
         LIMIT 50`,
        [fifteenMinAgo.toISOString()],
      );

      const crisisMentions: Mention[] = crisisMentionsResult.rows.map((row) => ({
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

      // ── 6. Emit crisis:detected event ──
      eventBus.emit("crisis:detected", {
        mentions: crisisMentions,
        severity,
      });

      // ── 7. Store the crisis detection event in agent_events ──
      await client.query(
        `INSERT INTO agent_events (event_type, event_source, payload)
         VALUES ('ALERT', 'crisis-detector', $1)`,
        [
          JSON.stringify({
            evaluator: "CRISIS_EVALUATOR",
            severity,
            mention_count: mentionCount,
            avg_sentiment: +avgSentiment.toFixed(3),
            crisis_mention_ids: crisisMentions.slice(0, 10).map((m) => m.tweet_id),
          }),
        ],
      );

      // ── 8. Update cooldown timestamp ──
      lastCrisisFiredAt = new Date();

      eventBus.emit("agent:thought", {
        source: "crisis-detector",
        thought: `Crisis detected: ${severity.toUpperCase()} — ${mentionCount} mentions in 15 min, avg sentiment ${avgSentiment.toFixed(2)}`,
      });
    } catch (error) {
      log.error({ error: String(error) }, "Crisis evaluator failed");
    } finally {
      await client.end();
    }
  },

  /**
   * Examples for ElizaOS evaluator calibration.
   */
  examples: [
    {
      context: "Multiple negative mentions flooding in rapidly",
      messages: [
        {
          user: "system",
          content: { text: "25 negative mentions detected in the last 15 minutes" },
        },
      ],
      outcome: "Crisis evaluator detects MEDIUM severity crisis and emits alert",
    },
  ],
};

export default crisisEvaluator;

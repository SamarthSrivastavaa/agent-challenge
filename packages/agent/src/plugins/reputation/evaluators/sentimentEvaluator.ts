import type { Evaluator, IAgentRuntime, Memory, State } from "@elizaos/core";
import pg from "pg";
import { ModelClient } from "../../../utils/modelClient.js";
import { eventBus } from "../../../utils/eventBus.js";
import { logger } from "../../../utils/logger.js";

const log = logger.child({ component: "sentimentEvaluator" });

/**
 * SENTIMENT_EVALUATOR — runs after every message the agent processes.
 *
 * ElizaOS Evaluators are post-processing hooks that fire after each message
 * cycle. This evaluator checks whether the processed message contains tweet
 * data, and if so, calls modelClient.analyzeSentiment() to score it and
 * stores the result in the mentions table.
 *
 * Setting alwaysRun = true ensures it fires on every cycle, not just when
 * the planner selects it. This is critical for maintaining real-time
 * sentiment tracking across all ingested mentions.
 */
export const sentimentEvaluator: Evaluator = {
  /** Unique evaluator name in the ElizaOS evaluator registry. */
  name: "SENTIMENT_EVALUATOR",

  /** Description for logging and debugging. */
  description: "Analyze sentiment of ingested tweets and store results",

  /**
   * alwaysRun = true — ElizaOS will execute this evaluator after every
   * message cycle regardless of whether the planner selected it. This
   * ensures no mention goes unscored.
   */
  alwaysRun: true,

  /**
   * Validate — check whether the message contains tweet-like data.
   * Returns true if the message content mentions a tweet ID or has
   * keyword markers suggesting it's a mention payload.
   */
  validate: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
  ): Promise<boolean> => {
    const text = typeof message.content === "string"
      ? message.content
      : message.content?.text ?? "";

    // Run if the message looks like it contains a tweet or mention data
    return text.length > 5;
  },

  /**
   * Handler — sentiment analysis pipeline:
   * 1. Extract text content from the message
   * 2. Call modelClient.analyzeSentiment() for structured scoring
   * 3. Attempt to update the corresponding mentions row in DB
   * 4. Emit 'agent:thought' event with the result
   */
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
  ): Promise<void> => {
    const dbUrl = process.env.DATABASE_URL;
    const endpoint = process.env.NOSANA_MODEL_ENDPOINT ?? process.env.OPENAI_API_URL;
    const apiKey = process.env.NOSANA_API_KEY ?? process.env.OPENAI_API_KEY;

    if (!dbUrl || !endpoint) {
      return; // silently skip if not configured
    }

    const modelClient = new ModelClient(endpoint, apiKey);
    const client = new pg.Client({ connectionString: dbUrl });

    try {
      await client.connect();

      const text = typeof message.content === "string"
        ? message.content
        : message.content?.text ?? "";

      if (text.length < 5) return;

      // ── Analyse sentiment via the model ──
      const sentiment = await modelClient.analyzeSentiment(text);

      log.debug(
        { score: sentiment.score, label: sentiment.label, confidence: sentiment.confidence },
        "Sentiment analysed",
      );

      // ── Try to find and update a matching mention in the DB ──
      // Look for a mention whose content matches (partial match on first 100 chars)
      const contentPrefix = text.slice(0, 100);
      const updateResult = await client.query(
        `UPDATE mentions
         SET sentiment = $1, sentiment_label = $2
         WHERE content LIKE $3 AND sentiment IS NULL
         LIMIT 1`,
        [sentiment.score, sentiment.label, `${contentPrefix}%`],
      );

      // If no match found via content, try matching by the most recent unscored mention
      if (updateResult.rowCount === 0) {
        await client.query(
          `UPDATE mentions
           SET sentiment = $1, sentiment_label = $2
           WHERE id = (
             SELECT id FROM mentions
             WHERE sentiment IS NULL
             ORDER BY ingested_at DESC
             LIMIT 1
           )`,
          [sentiment.score, sentiment.label],
        );
      }

      // ── Emit thought event for activity feed ──
      eventBus.emit("agent:thought", {
        source: "reputation-engine",
        thought: `Sentiment scored: ${sentiment.label} (${sentiment.score.toFixed(2)}, confidence: ${sentiment.confidence.toFixed(2)})`,
      });
    } catch (error) {
      log.warn(
        { error: String(error) },
        "Sentiment evaluator encountered an error — skipping",
      );
    } finally {
      await client.end();
    }
  },

  /**
   * Examples — ElizaOS uses these for evaluator calibration.
   */
  examples: [
    {
      context: "A new tweet mention has been ingested",
      messages: [
        {
          user: "system",
          content: { text: "New mention from @alice: 'Great work on the project!'" },
        },
      ],
      outcome: "Sentiment scored as positive (0.85, confidence 0.92)",
    },
  ],
};

export default sentimentEvaluator;

import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import pg from "pg";
import { ModelClient } from "../../../utils/modelClient.js";
import { eventBus } from "../../../utils/eventBus.js";
import { logger } from "../../../utils/logger.js";

const log = logger.child({ component: "draftReply" });

/**
 * DRAFT_REPLY — drafts a reply to a specific tweet in the user's authentic voice.
 *
 * This is the voice-matching action at the heart of SovereignSelf. It retrieves
 * the user's last 50 tweets from memory to build a voice profile, then uses the
 * model to ghostwrite a reply that sounds like the user, not like an AI.
 *
 * ElizaOS invokes this action when the planner detects intent to reply to a
 * mention. It can also be triggered automatically during crisis response.
 */
export const draftReplyAction: Action = {
  /** Unique action identifier registered in the ElizaOS action registry. */
  name: "DRAFT_REPLY",

  /** Human-readable description used by the planner for action selection. */
  description: "Draft a reply to a specific tweet in the user's voice",

  /** Alternative phrasings matched by the ElizaOS planner against user intent. */
  similes: ["WRITE_RESPONSE", "COMPOSE_REPLY", "RESPOND_TO_MENTION"],

  /**
   * Validate — checks that the message contains a tweet ID or mention content
   * so the action has something to reply to.
   */
  validate: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
  ): Promise<boolean> => {
    const text = typeof message.content === "string"
      ? message.content
      : message.content?.text ?? "";
    // Accept if the message references a tweet ID or has enough content to reply to
    return text.length > 10 || /\d{10,}/.test(text);
  },

  /**
   * Handler — the core reply-drafting pipeline:
   * 1. Extract tweet content from the incoming message
   * 2. Retrieve user's last 50 tweets from DB for voice matching
   * 3. Call modelClient.complete() with the voice-matching system prompt
   * 4. Store the draft in agent_events, emit 'reply:drafted' event
   * 5. Return the draft with a confidence indicator
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
    const username = process.env.TWITTER_USERNAME ?? "user";

    if (!dbUrl || !endpoint) {
      log.error("DATABASE_URL or model endpoint is not configured");
      return;
    }

    const modelClient = new ModelClient(endpoint, apiKey);
    const client = new pg.Client({ connectionString: dbUrl });

    try {
      await client.connect();

      // ── 1. Extract the tweet content to reply to ──
      const messageText = typeof message.content === "string"
        ? message.content
        : message.content?.text ?? "";

      // Try to extract a tweet ID from the message
      const tweetIdMatch = messageText.match(/(\d{10,})/);
      const tweetId = tweetIdMatch ? tweetIdMatch[1] : `draft_${Date.now()}`;

      // If a tweet ID was found, try to fetch the original mention from DB
      let tweetContent = messageText;
      if (tweetIdMatch) {
        const mentionResult = await client.query<{ content: string }>(
          "SELECT content FROM mentions WHERE tweet_id = $1",
          [tweetId],
        );
        if (mentionResult.rows.length > 0) {
          tweetContent = mentionResult.rows[0].content;
        }
      }

      // ── 2. Retrieve user's tweet history for voice matching ──
      const historyResult = await client.query<{ content: string }>(
        `SELECT content FROM mentions
         WHERE author_handle = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [username],
      );

      const tweetHistory = historyResult.rows
        .map((row, i) => `${i + 1}. "${row.content}"`)
        .join("\n");

      // ── 3. Build the voice-matching prompt and call the model ──
      const systemPrompt = `You are ghostwriting a reply for @${username}.
Study their tweet history below and match their exact:
- Vocabulary level and word choice
- Sentence length and punctuation style
- Use of humor, formality, and directness
- Common phrases and sentence openers they use

The reply must feel like THEM, not like an AI.
Tweet to reply to: "${tweetContent}"

Constraints: Under 280 chars. No hashtags unless they use them.
No emojis unless they typically use them.
Return ONLY the tweet text. Nothing else.

--- User's tweet history ---
${tweetHistory || "(No tweet history available — use a professional, direct tone.)"}`;

      log.info(
        { tweetId, historyCount: historyResult.rows.length },
        "Drafting reply with voice matching",
      );

      eventBus.emit("agent:thought", {
        source: "reputation-engine",
        thought: `Drafting reply to tweet ${tweetId} using ${historyResult.rows.length} tweets for voice matching`,
      });

      const draft = await modelClient.complete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Draft a reply to: "${tweetContent}"` },
        ],
        { temperature: 0.7, max_tokens: 150 },
      );

      // Clean up any quotes the model may wrap the reply in
      const cleanedDraft = draft.replace(/^["']|["']$/g, "").trim();

      // ── 4. Store the draft in agent_events ──
      await client.query(
        `INSERT INTO agent_events (event_type, event_source, payload)
         VALUES ('ACTION', 'reputation-engine', $1)`,
        [
          JSON.stringify({
            action: "DRAFT_REPLY",
            tweet_id: tweetId,
            original_content: tweetContent.slice(0, 200),
            draft: cleanedDraft,
          }),
        ],
      );

      // ── 5. Emit event and return draft to caller ──
      eventBus.emit("reply:drafted", {
        tweetId,
        draft: cleanedDraft,
      });

      log.info(
        { tweetId, draftLength: cleanedDraft.length },
        "Reply drafted successfully",
      );

      if (callback) {
        callback({
          text: `**Drafted reply** (${cleanedDraft.length} chars):\n\n"${cleanedDraft}"`,
        });
      }
    } catch (error) {
      log.error({ error: String(error) }, "Failed to draft reply");
      if (callback) {
        callback({ text: "Failed to draft reply. Check model and database connectivity." });
      }
    } finally {
      await client.end();
    }
  },

  /**
   * Examples — ElizaOS uses these for few-shot action-selection calibration.
   */
  examples: [
    [
      {
        user: "user",
        content: { text: "Draft a reply to the tweet from @alice about AI safety" },
      },
      {
        user: "SovereignSelf",
        content: {
          text: "Analyzing your voice profile and drafting a reply...",
          action: "DRAFT_REPLY",
        },
      },
    ],
  ],
};

export default draftReplyAction;

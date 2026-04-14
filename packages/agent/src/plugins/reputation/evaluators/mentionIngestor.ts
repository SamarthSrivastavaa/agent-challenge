import type { Evaluator, IAgentRuntime, Memory, State } from "@elizaos/core";
import pg from "pg";
import { eventBus } from "../../../utils/eventBus.js";
import { logger } from "../../../utils/logger.js";

const log = logger.child({ component: "mentionIngestor" });

// ─────────────────────────────────────────────────────────────
// MENTION_INGESTOR — bridges ElizaOS Twitter plugin → mentions table
//
// The ElizaOS Twitter plugin polls for mentions and feeds them into
// the runtime as Memory objects. This evaluator intercepts those
// messages and writes them into our PostgreSQL `mentions` table so
// that the crisis detector, sentiment evaluator, and weekly brief
// all operate on live Twitter data rather than demo seeds.
//
// Detection: checks message.content.source === "twitter"
// Tweet ID:  extracted from content.url (twitter.com/status/<id>)
//            or derived from the message UUID as a stable fallback
// Author:    content.username → userId (stripped of prefix)
// Reach:     content.followerCount if the plugin provides it, else 0
// ─────────────────────────────────────────────────────────────

/** Regex to pull the tweet ID out of a twitter.com status URL. */
const TWEET_URL_RE = /twitter\.com\/\w+\/status\/(\d+)/;

/**
 * MENTION_INGESTOR evaluator.
 *
 * alwaysRun = true so it fires on every message cycle, including
 * messages injected by the Twitter plugin client. Non-Twitter messages
 * are filtered out in the validate() step.
 */
export const mentionIngestorEvaluator: Evaluator = {
  name: "MENTION_INGESTOR",

  description:
    "Captures incoming Twitter mentions from the ElizaOS Twitter plugin and persists them to the mentions table",

  /** Must run on every cycle to catch all incoming tweets. */
  alwaysRun: true,

  /**
   * Validate — only process messages that originate from the Twitter client.
   * ElizaOS sets content.source = "twitter" on messages from the twitter plugin.
   */
  validate: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
  ): Promise<boolean> => {
    const content = message.content as Record<string, unknown>;
    const source = String(content?.source ?? "");
    const text = String(content?.text ?? "");

    // Accept messages from the Twitter plugin source
    return (
      (source === "twitter" || source.startsWith("twitter")) &&
      text.length > 0
    );
  },

  /**
   * Handler — extract tweet metadata and upsert into mentions table.
   *
   * Uses ON CONFLICT (tweet_id) DO NOTHING so replaying the same
   * tweet (e.g. on agent restart) is idempotent.
   */
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
  ): Promise<void> => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return;

    const client = new pg.Client({ connectionString: dbUrl });

    try {
      await client.connect();

      const content = message.content as Record<string, unknown>;
      const text = String(content?.text ?? "").slice(0, 1000);
      if (!text) return;

      // ── Extract tweet ID ──
      // Priority order:
      //   1. content.tweetId  — set by some ElizaOS twitter plugin versions
      //   2. URL match        — twitter.com/username/status/<id>
      //   3. Message UUID     — strip dashes and take first 19 digits as stable ID
      let tweetId: string;

      if (content.tweetId && String(content.tweetId).length >= 10) {
        tweetId = String(content.tweetId);
      } else {
        const urlStr = String(content.url ?? "");
        const urlMatch = TWEET_URL_RE.exec(urlStr);
        if (urlMatch) {
          tweetId = urlMatch[1];
        } else {
          // Derive a stable ID from the message UUID — not a real tweet ID,
          // but keeps the row unique across restarts
          tweetId = `ss_${String(message.id ?? Date.now()).replace(/-/g, "").slice(0, 16)}`;
        }
      }

      // ── Extract author handle ──
      // The twitter plugin typically sets content.username to the tweeter's handle
      // and userId to a UUID derived from their Twitter user ID.
      const authorHandle = String(
        content.username ??
        content.authorUsername ??
        content.author_handle ??
        message.userId ??
        "unknown",
      ).replace(/^twitter_/, "").replace(/^@/, "");

      // ── Extract reach (follower count of the tweeting account) ──
      const reach = Number(
        content.followerCount ??
        content.follower_count ??
        content.reach ??
        0,
      );

      // ── Determine tweet timestamp ──
      const createdAt = message.createdAt
        ? new Date(message.createdAt)
        : new Date();

      // ── Upsert into mentions table ──
      const result = await client.query<{ id: number }>(
        `INSERT INTO mentions (tweet_id, author_handle, content, reach, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tweet_id) DO NOTHING
         RETURNING id`,
        [tweetId, authorHandle, text, reach, createdAt],
      );

      if (result.rowCount === 0) {
        // Already exists — skip event emission
        return;
      }

      log.info(
        { tweetId, authorHandle, reach },
        "Mention ingested from Twitter plugin",
      );

      // ── Emit mention:ingested for WebSocket broadcast ──
      // The full Mention shape requires fields that will be filled in
      // by the sentiment evaluator later; emit a partial-safe version.
      eventBus.emit("mention:ingested", {
        mention: {
          id: result.rows[0].id,
          tweet_id: tweetId,
          author_handle: authorHandle,
          content: text,
          sentiment: null,
          sentiment_label: null,
          reach,
          is_crisis: false,
          created_at: createdAt,
          ingested_at: new Date(),
        },
      });
    } catch (error) {
      log.warn({ error: String(error) }, "Failed to ingest Twitter mention");
    } finally {
      await client.end();
    }
  },

  examples: [
    {
      context: "ElizaOS Twitter plugin receives a mention from @alice",
      messages: [
        {
          user: "alice",
          content: {
            text: "@sovereignself loved the thread on decentralised compute!",
            source: "twitter",
            username: "alice",
            url: "https://twitter.com/alice/status/1234567890123456789",
          },
        },
      ],
      outcome:
        "Row inserted into mentions table with tweet_id=1234567890123456789, mention:ingested event emitted",
    },
  ],
};

export default mentionIngestorEvaluator;

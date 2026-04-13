import { Scraper, SearchMode } from "agent-twitter-client";
import pg from "pg";
import { eventBus } from "../utils/eventBus.js";
import { logger } from "../utils/logger.js";
import { ModelClient } from "../utils/modelClient.js";

// ─────────────────────────────────────────────────────────────
// twitterPoller.ts — Direct Twitter mention scraper
//
// Replaces the broken @elizaos/plugin-twitter mention polling.
// Uses agent-twitter-client (the same library ElizaOS uses under
// the hood) to log in and search for mentions every 2 minutes.
//
// Pipeline per poll cycle:
//   1. searchTweets("@<username>", 20, SearchMode.Latest)
//   2. Filter out tweets already in DB (by tweet_id)
//   3. Run sentiment analysis via ModelClient
//   4. Upsert into mentions table
//   5. Emit mention:ingested for WebSocket broadcast
// ─────────────────────────────────────────────────────────────

const log = logger.child({ component: "twitterPoller" });

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

let scraper: Scraper | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let isLoggedIn = false;

/** Initialize the scraper — prefers cookie auth, falls back to username/password. */
async function initScraper(): Promise<boolean> {
  const username = process.env.TWITTER_USERNAME;
  const password = process.env.TWITTER_PASSWORD;
  const email = process.env.TWITTER_EMAIL;
  const cookies = process.env.TWITTER_COOKIES; // "auth_token=xxx; ct0=yyy"

  if (!username) {
    log.warn("TWITTER_USERNAME not set — Twitter polling disabled");
    return false;
  }

  scraper = new Scraper();

  // ── Method 1: Cookie auth (preferred — avoids login blocks) ──
  if (cookies) {
    try {
      log.info("Using cookie-based Twitter auth...");

      // Parse "auth_token=xxx; ct0=yyy" into individual cookies
      const cookieParts = cookies.split(";").map((c) => c.trim());
      const authToken = cookieParts.find((c) => c.startsWith("auth_token="))?.split("=")[1];
      const ct0 = cookieParts.find((c) => c.startsWith("ct0="))?.split("=")[1];

      if (!authToken || !ct0) {
        log.warn("TWITTER_COOKIES must contain both auth_token and ct0 — falling back to password login");
      } else {
        // Build cookie string that agent-twitter-client expects
        const cookieString = `auth_token=${authToken}; ct0=${ct0}`;
        scraper = scraper.withCookie(cookieString).withXCsrfToken(ct0);

        // Verify session is valid by checking login status
        const loggedIn = await scraper.isLoggedIn();
        if (loggedIn) {
          isLoggedIn = true;
          log.info({ username }, "Twitter cookie auth successful");
          return true;
        } else {
          log.warn("Cookie auth failed (expired?) — falling back to password login");
        }
      }
    } catch (error) {
      log.warn({ error: String(error) }, "Cookie auth error — falling back to password login");
    }
  }

  // ── Method 2: Username/password login ──
  if (!password) {
    log.warn("No TWITTER_COOKIES and no TWITTER_PASSWORD — Twitter polling disabled");
    return false;
  }

  try {
    log.info({ username }, "Logging in to Twitter with username/password...");
    scraper = new Scraper();
    await scraper.login(username, password, email);
    isLoggedIn = true;
    log.info({ username }, "Twitter login successful");
    return true;
  } catch (error) {
    log.error({ error: String(error) }, "Twitter login failed");
    scraper = null;
    isLoggedIn = false;
    return false;
  }
}

/** Run one mention poll cycle. */
async function pollMentions(): Promise<void> {
  if (!scraper || !isLoggedIn) return;

  const username = process.env.TWITTER_USERNAME;
  const dbUrl = process.env.DATABASE_URL ?? "postgres://sovereign:sovereign@localhost:5432/sovereign";
  const modelEndpoint = process.env.NOSANA_MODEL_ENDPOINT ?? "http://127.0.0.1:11434/v1";
  const modelApiKey = process.env.NOSANA_API_KEY ?? "ollama";

  if (!username) return;

  const query = `@${username} -from:${username}`;

  log.info({ query }, "Polling Twitter mentions...");

  try {
    const tweets = scraper.searchTweets(query, 20, SearchMode.Latest);
    const modelClient = new ModelClient(modelEndpoint, modelApiKey);
    const dbClient = new pg.Client({ connectionString: dbUrl });
    await dbClient.connect();

    let newCount = 0;

    for await (const tweet of tweets) {
      if (!tweet.id || !tweet.text) continue;

      // Skip retweets
      if (tweet.isRetweet) continue;

      // Check if already ingested
      const exists = await dbClient.query(
        "SELECT id FROM mentions WHERE tweet_id = $1",
        [tweet.id],
      );
      if (exists.rowCount && exists.rowCount > 0) continue;

      // Run sentiment analysis
      let sentiment = 0;
      let sentimentLabel: "positive" | "neutral" | "negative" = "neutral";

      try {
        const result = await modelClient.analyzeSentiment(tweet.text);
        sentiment = result.score;
        sentimentLabel = result.label;
      } catch {
        log.warn({ tweetId: tweet.id }, "Sentiment analysis failed — using neutral");
      }

      const reach = tweet.views ?? 0;
      const authorHandle = tweet.username ?? tweet.name ?? "unknown";
      const createdAt = tweet.timeParsed ?? new Date();

      // Detect crisis: sentiment < -0.6
      const isCrisis = sentiment < -0.6;

      // Insert into mentions
      const insertResult = await dbClient.query<{ id: number }>(
        `INSERT INTO mentions
           (tweet_id, author_handle, content, sentiment, sentiment_label, reach, is_crisis, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (tweet_id) DO NOTHING
         RETURNING id`,
        [tweet.id, authorHandle, tweet.text, sentiment, sentimentLabel, reach, isCrisis, createdAt],
      );

      if (!insertResult.rowCount || insertResult.rowCount === 0) continue;

      newCount++;

      const mention = {
        id: insertResult.rows[0].id,
        tweet_id: tweet.id,
        author_handle: authorHandle,
        content: tweet.text,
        sentiment,
        sentiment_label: sentimentLabel,
        reach,
        is_crisis: isCrisis,
        created_at: createdAt,
        ingested_at: new Date(),
      };

      log.info(
        { tweetId: tweet.id, author: authorHandle, sentiment: sentimentLabel, isCrisis },
        "Mention ingested",
      );

      // Emit for WebSocket broadcast
      eventBus.emit("mention:ingested", { mention });

      // If crisis, emit crisis event
      if (isCrisis) {
        log.warn({ tweetId: tweet.id, sentiment }, "Crisis mention detected");
        eventBus.emit("crisis:detected", {
          mentions: [mention],
          severity: sentiment < -0.8 ? "high" : "medium",
        });

        // Log crisis to agent_events
        await dbClient.query(
          `INSERT INTO agent_events (event_type, event_source, payload)
           VALUES ('ALERT', 'crisis-detector', $1)`,
          [JSON.stringify({
            alert: `Crisis mention detected from @${authorHandle}`,
            sentiment,
            tweet_id: tweet.id,
          })],
        );
      }

      // Log to agent_events
      await dbClient.query(
        `INSERT INTO agent_events (event_type, event_source, payload)
         VALUES ('MENTION', 'twitter-poller', $1)`,
        [JSON.stringify({
          tweet_id: tweet.id,
          author: authorHandle,
          sentiment: sentimentLabel,
          reach,
        })],
      );
    }

    await dbClient.end();

    if (newCount > 0) {
      log.info({ newCount }, "Mentions ingested from Twitter");
      eventBus.emit("agent:thought", {
        source: "twitter-poller",
        thought: `Polling Twitter mentions — ${newCount} new mention${newCount === 1 ? "" : "s"} ingested`,
      });
    } else {
      log.debug("No new mentions found");
    }
  } catch (error) {
    log.error({ error: String(error) }, "Twitter poll cycle failed");

    // If session expired, try to re-login on next cycle
    if (String(error).includes("Auth") || String(error).includes("403") || String(error).includes("login")) {
      log.warn("Session may have expired — will retry login on next cycle");
      isLoggedIn = false;
    }
  }
}

/** Start the Twitter polling loop. */
export async function startTwitterPolling(): Promise<void> {
  const success = await initScraper();
  if (!success) return;

  // Run immediately, then on interval
  await pollMentions();

  pollTimer = setInterval(async () => {
    // Re-login if session expired
    if (!isLoggedIn) {
      await initScraper();
    }
    await pollMentions();
  }, POLL_INTERVAL_MS);

  log.info({ intervalMs: POLL_INTERVAL_MS }, "Twitter polling started");
}

/** Stop the Twitter polling loop. */
export function stopTwitterPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    log.info("Twitter polling stopped");
  }
}

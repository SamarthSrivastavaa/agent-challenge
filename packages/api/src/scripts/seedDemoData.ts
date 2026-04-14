import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dotenvDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dotenvDir, "../../../../.env") }); // scripts/ is one level deeper

import pg from "pg";

// ─────────────────────────────────────────────────────────────
// seedDemoData.ts — Populates the database with realistic demo
// data so the dashboard has something to display without needing
// live Twitter data or a running agent.
// ─────────────────────────────────────────────────────────────

const DB_URL =
  process.env.DATABASE_URL ??
  "postgres://sovereign:sovereign@localhost:5432/sovereign";

const client = new pg.Client({ connectionString: DB_URL });

// ── Helpers ──────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 3_600_000);
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Demo data ─────────────────────────────────────────────────

const HANDLES = [
  "alice_web3", "bob_builder", "crypto_luna", "devrel_dan",
  "vc_hawk", "tech_skeptic", "nosana_fan", "open_source_olivia",
  "defi_diana", "layer2_liam", "nft_hater", "gpu_geek",
  "anon_critic", "decentralize_it", "sovereign_supporter",
];

const POSITIVE_TWEETS = [
  "Just tried @SendX_AI and honestly blown away. This is what Web3 agents should feel like.",
  "The new reputation dashboard from @SendX_AI is incredible. Real-time sentiment analysis on my mentions? Yes please.",
  "@SendX_AI running on @nosana_ci decentralized GPUs is a power move. Fully sovereign AI.",
  "Been using @SendX_AI for a week. Crisis detection caught a pile-on before it escalated. Genuinely useful.",
  "The weekly brief from @SendX_AI saved me 2 hours of manual monitoring. Absolute game changer.",
  "Decentralized AI for personal brand management? @SendX_AI nailed it. No corporate cloud, just your compute.",
  "@SendX_AI draft replies match my voice perfectly. It's like having a ghostwriter who actually reads my tweets.",
  "If you're a creator worried about coordinated attacks on your brand, @SendX_AI is the tool you need.",
];

const NEUTRAL_TWEETS = [
  "Has anyone tried @SendX_AI? Curious about the privacy claims.",
  "Interesting concept from @SendX_AI — autonomous reputation management. Worth watching.",
  "@SendX_AI is built on ElizaOS apparently. Would be curious to see a comparison with other AI agents.",
  "What's the tokenomics on @SendX_AI? Or is it purely infra?",
  "Saw a demo of @SendX_AI. The dashboard looks solid. Waiting to see real-world performance.",
  "@SendX_AI runs on Nosana GPU nodes. Makes sense from a decentralization angle.",
];

const NEGATIVE_TWEETS = [
  "Not sure I trust @SendX_AI with my brand data. Who audited this thing?",
  "@SendX_AI is just another overhyped AI wrapper. Wake me up when it actually works.",
  "Crisis detection that cries wolf every 5 minutes isn't useful. Seen this with @SendX_AI already.",
  "The whole 'sovereign AI' narrative from @SendX_AI feels like marketing fluff.",
];

const CRISIS_TWEETS = [
  "@SendX_AI is a SCAM. Do NOT trust this project with your data. Spreading the word. 🚨",
  "AVOID @SendX_AI — multiple reports of the agent posting without permission. This is dangerous.",
  "I warned everyone about @SendX_AI. Now we have receipts. Thread incoming 🧵",
];

async function seedMentions(): Promise<void> {
  console.log("Seeding mentions...");

  const mentions = [
    // Last 7 days — mostly positive with a few neutral
    ...Array.from({ length: 12 }, (_, i) => ({
      tweet_id: `demo_pos_${i}_${Date.now()}`,
      author_handle: pick(HANDLES),
      content: pick(POSITIVE_TWEETS),
      sentiment: rand(0.4, 0.95),
      sentiment_label: "positive",
      reach: randInt(500, 15000),
      is_crisis: false,
      created_at: hoursAgo(randInt(1, 160)),
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      tweet_id: `demo_neu_${i}_${Date.now()}`,
      author_handle: pick(HANDLES),
      content: pick(NEUTRAL_TWEETS),
      sentiment: rand(-0.1, 0.2),
      sentiment_label: "neutral",
      reach: randInt(100, 5000),
      is_crisis: false,
      created_at: hoursAgo(randInt(2, 150)),
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      tweet_id: `demo_neg_${i}_${Date.now()}`,
      author_handle: pick(HANDLES),
      content: pick(NEGATIVE_TWEETS),
      sentiment: rand(-0.8, -0.2),
      sentiment_label: "negative",
      reach: randInt(200, 8000),
      is_crisis: false,
      created_at: hoursAgo(randInt(5, 140)),
    })),
    // Crisis cluster — 3 hours ago
    ...Array.from({ length: 3 }, (_, i) => ({
      tweet_id: `demo_crisis_${i}_${Date.now()}`,
      author_handle: pick(HANDLES),
      content: pick(CRISIS_TWEETS),
      sentiment: rand(-0.95, -0.7),
      sentiment_label: "negative",
      reach: randInt(2000, 20000),
      is_crisis: true,
      created_at: hoursAgo(randInt(2, 4)),
    })),
  ];

  for (const m of mentions) {
    await client.query(
      `INSERT INTO mentions
         (tweet_id, author_handle, content, sentiment, sentiment_label, reach, is_crisis, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tweet_id) DO NOTHING`,
      [m.tweet_id, m.author_handle, m.content, m.sentiment,
       m.sentiment_label, m.reach, m.is_crisis, m.created_at],
    );
  }

  console.log(`  ✓ ${mentions.length} mentions inserted`);
}

async function seedReputationScores(): Promise<void> {
  console.log("Seeding reputation scores...");

  const scores = [
    { score: 7.1, mention_count: 38, positive_pct: 0.61, negative_pct: 0.18, neutral_pct: 0.21, total_reach: 142000, days_ago: 28 },
    { score: 7.4, mention_count: 52, positive_pct: 0.65, negative_pct: 0.15, neutral_pct: 0.20, total_reach: 198000, days_ago: 21 },
    { score: 7.9, mention_count: 61, positive_pct: 0.70, negative_pct: 0.12, neutral_pct: 0.18, total_reach: 231000, days_ago: 14 },
    { score: 6.8, mention_count: 74, positive_pct: 0.55, negative_pct: 0.28, neutral_pct: 0.17, total_reach: 280000, days_ago: 7 },
    { score: 8.2, mention_count: 89, positive_pct: 0.76, negative_pct: 0.08, neutral_pct: 0.16, total_reach: 342000, days_ago: 0 },
  ];

  for (const s of scores) {
    const periodEnd = daysAgo(s.days_ago);
    const periodStart = daysAgo(s.days_ago + 7);

    await client.query(
      `INSERT INTO reputation_scores
         (period_start, period_end, score, mention_count, positive_pct,
          negative_pct, neutral_pct, total_reach, brief_text, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        periodStart, periodEnd, s.score, s.mention_count,
        s.positive_pct, s.negative_pct, s.neutral_pct, s.total_reach,
        `Weekly brief: Score ${s.score}/10. ${s.mention_count} mentions, ` +
        `${Math.round(s.positive_pct * 100)}% positive. ` +
        `Total reach: ${(s.total_reach / 1000).toFixed(0)}K impressions.`,
        periodEnd,
      ],
    );
  }

  console.log(`  ✓ ${scores.length} reputation scores inserted`);
}

async function seedAgentEvents(): Promise<void> {
  console.log("Seeding agent events...");

  const events = [
    { type: "THOUGHT", source: "scheduler", payload: { thought: "Heartbeat — agent is monitoring" }, hours: 0.1 },
    { type: "ACTION", source: "reputation-engine", payload: { action: "SCORE_REPUTATION", result: "Score: 8.2/10, up 0.3 from last week" }, hours: 0.5 },
    { type: "ALERT", source: "crisis-detector", payload: { alert: "Crisis detected: coordinated negative cluster across 3 accounts", severity: "high" }, hours: 2.5 },
    { type: "ACTION", source: "crisis-detector", payload: { action: "SEND_CRISIS_ALERT", result: "Telegram alert dispatched" }, hours: 2.4 },
    { type: "THOUGHT", source: "reputation-engine", payload: { thought: "Sentiment dip detected — monitoring for escalation" }, hours: 2.3 },
    { type: "ACTION", source: "reputation-engine", payload: { action: "DRAFT_REPLY", result: "Draft ready for review in dashboard" }, hours: 2.0 },
    { type: "BRIEF", source: "reputation-engine", payload: { brief: "Weekly brief: Score 8.2/10. 89 mentions. Reach up 22%. Zero critical threats." }, hours: 24 },
    { type: "THOUGHT", source: "scheduler", payload: { thought: "Polling Twitter mentions — 4 new mentions ingested" }, hours: 3 },
    { type: "ACTION", source: "reputation-engine", payload: { action: "INGEST_MENTIONS", result: "4 mentions processed, sentiment scored" }, hours: 4 },
    { type: "THOUGHT", source: "scheduler", payload: { thought: "Heartbeat — agent is monitoring" }, hours: 5 },
    { type: "ACTION", source: "reputation-engine", payload: { action: "SCORE_REPUTATION", result: "Score stable at 8.1/10" }, hours: 6 },
    { type: "THOUGHT", source: "nosana-monitor", payload: { thought: "Node metrics: running on local" }, hours: 7 },
  ];

  for (const e of events) {
    await client.query(
      `INSERT INTO agent_events (event_type, event_source, payload, created_at)
       VALUES ($1,$2,$3,$4)`,
      [e.type, e.source, JSON.stringify(e.payload), hoursAgo(e.hours)],
    );
  }

  console.log(`  ✓ ${events.length} agent events inserted`);
}

async function seedNodeMetrics(): Promise<void> {
  console.log("Seeding node metrics...");

  for (let i = 23; i >= 0; i--) {
    await client.query(
      `INSERT INTO node_metrics
         (cpu_usage, gpu_usage, memory_used_gb, memory_total_gb, uptime_seconds, job_id, status, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        rand(15, 45),
        rand(60, 95),
        rand(4, 7),
        8,
        (86400 * 3) + i * 3600,
        "local",
        "running",
        hoursAgo(i),
      ],
    );
  }

  console.log("  ✓ 24 node metric snapshots inserted");
}

// ── Main ──────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Connecting to database...");
  await client.connect();
  console.log("Connected.\n");

  await seedMentions();
  await seedReputationScores();
  await seedAgentEvents();
  await seedNodeMetrics();

  console.log("\n✓ Demo data seeded successfully.");
  console.log("  Open http://localhost:5173 to see the dashboard.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => client.end());

import type { Plugin } from "@elizaos/core";
import { fetchReputationScoreAction } from "./actions/fetchReputationScore.js";
import { draftReplyAction } from "./actions/draftReply.js";
import { generateWeeklyBriefAction } from "./actions/generateWeeklyBrief.js";
import { twitterContextProvider } from "./providers/twitterContext.js";
import { sentimentEvaluator } from "./evaluators/sentimentEvaluator.js";
import { mentionIngestorEvaluator } from "./evaluators/mentionIngestor.js";

// ─────────────────────────────────────────────────────────────
// Reputation Engine Plugin — ElizaOS custom plugin
//
// This plugin is the core intelligence layer of SovereignSelf.
// It registers three actions (fetch score, draft reply, generate
// weekly brief), one context provider (Twitter mentions), and
// one evaluator (sentiment analysis) into the ElizaOS runtime.
//
// ElizaOS loads plugins during AgentRuntime initialization.
// Each registered component becomes available to the planner
// for autonomous decision-making.
// ─────────────────────────────────────────────────────────────

/**
 * The ReputationEngine plugin — manages reputation scoring, voice-matched
 * reply drafting, weekly intelligence briefs, and continuous sentiment analysis.
 *
 * Registered components:
 * - **Actions**: FETCH_REPUTATION_SCORE, DRAFT_REPLY, GENERATE_WEEKLY_BRIEF
 * - **Providers**: TWITTER_CONTEXT (injected into every model context window)
 * - **Evaluators**: SENTIMENT_EVALUATOR (runs after every message cycle)
 */
export const reputationPlugin: Plugin = {
  /** Plugin name — used in logs and the ElizaOS plugin registry. */
  name: "reputation-engine",

  /** Human-readable description for the plugin registry. */
  description:
    "Reputation intelligence engine: sentiment analysis, voice-matched reply drafting, and weekly briefings",

  /**
   * Actions registered with the ElizaOS planner.
   * The planner selects actions based on user intent matching
   * against name, description, and similes.
   */
  actions: [
    fetchReputationScoreAction,
    draftReplyAction,
    generateWeeklyBriefAction,
  ],

  /**
   * Providers inject data into the context window before every model call.
   * TWITTER_CONTEXT ensures the agent always has fresh mention data
   * available without explicit retrieval steps.
   */
  providers: [twitterContextProvider],

  /**
   * Evaluators are post-processing hooks that run after each message cycle.
   * MENTION_INGESTOR captures Twitter plugin messages → mentions table.
   * SENTIMENT_EVALUATOR scores every processed message for sentiment
   * and updates the database, keeping the reputation scores current.
   *
   * Order matters: ingestor runs first so the row exists before scoring.
   */
  evaluators: [mentionIngestorEvaluator, sentimentEvaluator],
};

export default reputationPlugin;

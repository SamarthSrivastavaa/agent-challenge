import type { Plugin } from "@elizaos/core";
import { crisisEvaluator } from "./evaluators/crisisEvaluator.js";
import { sendCrisisAlertAction } from "./actions/sendCrisisAlert.js";

// ─────────────────────────────────────────────────────────────
// Crisis Detector Plugin — ElizaOS custom plugin
//
// Real-time threat detection for the SovereignSelf agent.
// Continuously evaluates mention velocity and sentiment trends
// against three-tier crisis thresholds and delivers instant
// Telegram alerts when breached.
//
// Components:
// - CRISIS_EVALUATOR: alwaysRun evaluator checking thresholds
// - SEND_CRISIS_ALERT: action for Telegram notification delivery
// ─────────────────────────────────────────────────────────────

/**
 * The CrisisDetector plugin — detects reputation crises in real time
 * and sends Telegram alerts for immediate user awareness.
 *
 * Threshold system (15-minute sliding window):
 * - **HIGH**: >50 mentions AND avg sentiment < -0.5
 * - **MEDIUM**: >20 mentions AND avg sentiment < -0.3
 * - **LOW**: >10 mentions AND avg sentiment < -0.1
 *
 * Cooldown: 30 minutes between crisis detections to avoid alert fatigue.
 */
export const crisisPlugin: Plugin = {
  /** Plugin name — used in logs and the ElizaOS plugin registry. */
  name: "crisis-detector",

  /** Human-readable description for the plugin registry. */
  description:
    "Real-time crisis detection with Telegram alerting — monitors mention velocity and sentiment trends",

  /**
   * Actions — SEND_CRISIS_ALERT can be triggered by the planner
   * for manual testing, and auto-fires via the event bus listener
   * when CRISIS_EVALUATOR detects a threshold breach.
   */
  actions: [sendCrisisAlertAction],

  /**
   * No context providers — crisis detection is event-driven,
   * not context-injected.
   */
  providers: [],

  /**
   * Evaluators — CRISIS_EVALUATOR runs after every message cycle
   * (alwaysRun = true) to check mention velocity and sentiment
   * against the three-tier threshold system.
   */
  evaluators: [crisisEvaluator],
};

export default crisisPlugin;

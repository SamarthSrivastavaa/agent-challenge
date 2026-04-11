import type { Plugin } from "@elizaos/core";
import { nosanaStatusProvider } from "./providers/nosanaStatus.js";

// ─────────────────────────────────────────────────────────────
// Nosana Monitor Plugin — ElizaOS custom plugin
//
// Provides real-time visibility into the Nosana GPU node that
// hosts the SovereignSelf agent. The background polling loop
// (started via startNosanaPolling() in the agent entrypoint)
// pushes metrics to the database and event bus every 30 seconds.
//
// The NOSANA_STATUS provider injects the latest node health
// into the context window so the agent can reference compute
// status in conversations and weekly briefs.
// ─────────────────────────────────────────────────────────────

/**
 * The NosanaMonitor plugin — tracks GPU node health, resource usage,
 * and uptime for the Nosana decentralised compute layer.
 *
 * Registered components:
 * - **Providers**: NOSANA_STATUS (node health injected into context)
 *
 * Note: The background polling loop is started separately via
 * `startNosanaPolling()` from the agent entrypoint, not during
 * plugin registration. This keeps the plugin stateless and
 * compatible with ElizaOS's synchronous plugin loading.
 */
export const nosanaMonitorPlugin: Plugin = {
  /** Plugin name — used in logs and the ElizaOS plugin registry. */
  name: "nosana-monitor",

  /** Human-readable description for the plugin registry. */
  description:
    "Nosana GPU node health monitoring — polls metrics every 30s and injects status into agent context",

  /** No actions — monitoring is passive and event-driven. */
  actions: [],

  /**
   * Providers inject ambient context. NOSANA_STATUS makes node health
   * available to the agent's reasoning in every conversation turn.
   */
  providers: [nosanaStatusProvider],

  /** No evaluators — node health doesn't need per-message evaluation. */
  evaluators: [],
};

export default nosanaMonitorPlugin;

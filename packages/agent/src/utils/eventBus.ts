import { EventEmitter } from "node:events";

// ─────────────────────────────────────────────────────────────
// Typed event bus — singleton EventEmitter shared between the
// ElizaOS agent plugins and the Express/WebSocket API server.
// All inter-subsystem communication flows through here.
// ─────────────────────────────────────────────────────────────

/** A Twitter/X mention stored in the mentions table. */
export interface Mention {
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
}

/** Weekly reputation intelligence snapshot. */
export interface ReputationBrief {
  id: number;
  period_start: Date;
  period_end: Date;
  score: number;
  mention_count: number;
  positive_pct: number;
  negative_pct: number;
  neutral_pct: number;
  total_reach: number;
  brief_text: string;
  created_at: Date;
}

/** Nosana GPU node health metrics. */
export interface NodeMetrics {
  cpu_usage: number;
  gpu_usage: number;
  memory_used_gb: number;
  memory_total_gb: number;
  uptime_seconds: number;
  job_id: string;
  status: string;
  recorded_at: Date;
}

/** Crisis severity levels used by the CrisisDetector. */
export type CrisisSeverity = "low" | "medium" | "high";

/**
 * Map of event names to their typed payloads.
 * Every emit and listener is validated against this contract.
 */
export interface EventMap {
  /** Fired when a new Twitter mention is ingested and stored. */
  "mention:ingested": { mention: Mention };
  /** Fired when the CrisisEvaluator detects a crisis threshold breach. */
  "crisis:detected": { mentions: Mention[]; severity: CrisisSeverity };
  /** Fired when the DRAFT_REPLY action produces a reply draft. */
  "reply:drafted": { tweetId: string; draft: string };
  /** Fired when the weekly reputation brief is generated. */
  "brief:generated": { brief: ReputationBrief };
  /** Fired when fresh Nosana node metrics are collected. */
  "node:metrics": { metrics: NodeMetrics };
  /** Fired when the agent records an internal reasoning step. */
  "agent:thought": { source: string; thought: string };
}

/**
 * Strongly-typed EventEmitter for SovereignSelf.
 *
 * Wraps Node's built-in EventEmitter with type-safe `emit`, `on`,
 * and `once` signatures derived from {@link EventMap}. This is the
 * single communication backbone between agent plugins, the API
 * server, and the WebSocket broadcaster.
 */
class TypedEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Allow many listeners — plugins + API + WS all subscribe
    this.emitter.setMaxListeners(50);
  }

  /**
   * Emit a typed event to all registered listeners.
   *
   * @param event   - The event name from {@link EventMap}.
   * @param payload - The typed payload for this event.
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.emitter.emit(event, payload);
  }

  /**
   * Subscribe to a typed event.
   *
   * @param event    - The event name from {@link EventMap}.
   * @param listener - Callback receiving the typed payload.
   */
  on<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void,
  ): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Subscribe to a typed event for a single invocation.
   *
   * @param event    - The event name from {@link EventMap}.
   * @param listener - Callback receiving the typed payload (fires once).
   */
  once<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void,
  ): void {
    this.emitter.once(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Remove a previously registered listener.
   *
   * @param event    - The event name from {@link EventMap}.
   * @param listener - The exact function reference to remove.
   */
  off<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void,
  ): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }
}

/**
 * Singleton event bus instance.
 *
 * Imported by agent plugins to emit events and by the API/WebSocket
 * layer to subscribe and broadcast them to connected dashboard clients.
 */
export const eventBus = new TypedEventBus();

export default eventBus;

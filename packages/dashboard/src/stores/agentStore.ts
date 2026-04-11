import { create } from "zustand";

// ─────────────────────────────────────────────────────────────
// Shared types (duplicated from agent eventBus for frontend use)
// ─────────────────────────────────────────────────────────────

export interface AgentEvent {
  id?: number;
  event_type: string;
  event_source: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Mention {
  id: number;
  tweet_id: string;
  author_handle: string;
  content: string;
  sentiment: number | null;
  sentiment_label: string | null;
  reach: number;
  is_crisis: boolean;
  created_at: string;
  ingested_at: string;
}

export interface ReputationScore {
  id: number;
  period_start: string;
  period_end: string;
  score: number;
  mention_count: number;
  positive_pct: number;
  negative_pct: number;
  neutral_pct: number;
  total_reach: number;
  brief_text: string | null;
  created_at: string;
}

export interface NodeMetrics {
  cpu_usage: number;
  gpu_usage: number;
  memory_used_gb: number;
  memory_total_gb: number;
  uptime_seconds: number;
  job_id: string;
  status: string;
  recorded_at: string;
}

export interface CrisisEvent {
  mentions: Mention[];
  severity: "low" | "medium" | "high";
  detected_at: string;
}

export interface TickerData {
  username: string;
  mentionCountToday: number;
  avgSentimentLabel: string;
  nodeStatus: string;
}

// ─────────────────────────────────────────────────────────────
// Zustand Store
// ─────────────────────────────────────────────────────────────

interface AgentState {
  /** Last 100 agent events (newest first). */
  events: AgentEvent[];
  /** Last 50 mentions (newest first). */
  mentions: Mention[];
  /** Current reputation score. */
  reputation: ReputationScore | null;
  /** 30-day reputation history for charts. */
  reputationHistory: ReputationScore[];
  /** Latest Nosana node metrics. */
  nodeStatus: NodeMetrics | null;
  /** Active crisis event (shown in modal). */
  activeCrisis: CrisisEvent | null;
  /** Current agent status. */
  agentStatus: "monitoring" | "processing" | "alert" | "offline";
  /** Ticker bar data. */
  tickerData: TickerData;

  // ── Actions ──
  /** Prepend an event, trim to 100 max. */
  addEvent: (event: AgentEvent) => void;
  /** Add a mention, trim to 50 max. */
  addMention: (mention: Mention) => void;
  /** Set active crisis and switch status to alert. */
  setCrisis: (crisis: CrisisEvent) => void;
  /** Dismiss active crisis and restore monitoring status. */
  dismissCrisis: () => void;
  /** Update latest node metrics. */
  updateNodeStatus: (metrics: NodeMetrics) => void;
  /** Update reputation + append to history. */
  setReputation: (score: ReputationScore) => void;
  /** Bulk-set reputation history (for initial load / mock seeder). */
  setReputationHistory: (history: ReputationScore[]) => void;
  /** Bulk-set events (for initial load / mock seeder). */
  setEvents: (events: AgentEvent[]) => void;
  /** Bulk-set mentions (for initial load / mock seeder). */
  setMentions: (mentions: Mention[]) => void;
  /** Update ticker data. */
  setTickerData: (data: Partial<TickerData>) => void;
  /** Set agent status. */
  setAgentStatus: (status: AgentState["agentStatus"]) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  events: [],
  mentions: [],
  reputation: null,
  reputationHistory: [],
  nodeStatus: null,
  activeCrisis: null,
  agentStatus: "monitoring",
  tickerData: {
    username: "user",
    mentionCountToday: 0,
    avgSentimentLabel: "neutral",
    nodeStatus: "monitoring",
  },

  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, 100),
    })),

  addMention: (mention) =>
    set((state) => ({
      mentions: [mention, ...state.mentions].slice(0, 50),
    })),

  setCrisis: (crisis) =>
    set({
      activeCrisis: crisis,
      agentStatus: "alert",
    }),

  dismissCrisis: () =>
    set({
      activeCrisis: null,
      agentStatus: "monitoring",
    }),

  updateNodeStatus: (metrics) =>
    set({ nodeStatus: metrics }),

  setReputation: (score) =>
    set((state) => ({
      reputation: score,
      reputationHistory: [...state.reputationHistory, score].slice(-90),
    })),

  setReputationHistory: (history) =>
    set({ reputationHistory: history }),

  setEvents: (events) =>
    set({ events: events.slice(0, 100) }),

  setMentions: (mentions) =>
    set({ mentions: mentions.slice(0, 50) }),

  setTickerData: (data) =>
    set((state) => ({
      tickerData: { ...state.tickerData, ...data },
    })),

  setAgentStatus: (status) =>
    set({ agentStatus: status }),
}));

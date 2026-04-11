import { useAgentStore } from "../../stores/agentStore";
import { Badge } from "../ui/Badge";

const EVENT_BADGE_MAP: Record<string, { label: string; variant: "purple" | "cyan" | "red" | "amber" | "gray" }> = {
  ACTION: { label: "ACT", variant: "purple" },
  THOUGHT: { label: "THK", variant: "cyan" },
  ALERT: { label: "⚠ ALT", variant: "red" },
  BRIEF: { label: "BRF", variant: "amber" },
  MENTION: { label: "MNT", variant: "gray" },
  ERROR: { label: "ERR", variant: "red" },
};

/**
 * ActivityFeed — the CENTERPIECE component.
 *
 * Scrolling feed of agent events from the WebSocket.
 * Terminal aesthetic: monospace font, 12px, muted timestamps.
 *
 * Features:
 * - Status ticker at top with live agent monitoring info
 * - Each event: [timestamp] [type badge] [message]
 * - 32px height per item
 * - Max 100 items in DOM
 * - New items animate in with 200ms fade+slide
 * - Auto-scroll to top (newest first)
 */
export function ActivityFeed() {
  const events = useAgentStore((s) => s.events);
  const tickerData = useAgentStore((s) => s.tickerData);
  const agentStatus = useAgentStore((s) => s.agentStatus);

  return (
    <div className="flex h-full flex-col">
      {/* Ticker bar */}
      <div className="flex items-center gap-2 border-b border-sovereign-border px-3 py-2 bg-sovereign-surface rounded-t-lg">
        <span className={`h-1.5 w-1.5 rounded-full ${agentStatus === "alert" ? "bg-sovereign-danger" : "bg-sovereign-success"} animate-pulse-opacity`} />
        <span className="font-mono text-[11px] text-sovereign-muted">
          MONITORING @{tickerData.username} · {tickerData.mentionCountToday} mentions today · sentiment{" "}
          <span className={
            tickerData.avgSentimentLabel === "positive" ? "text-sovereign-success" :
            tickerData.avgSentimentLabel === "negative" ? "text-sovereign-danger" :
            "text-sovereign-muted"
          }>
            {tickerData.avgSentimentLabel}
          </span>
          {" "}· node {tickerData.nodeStatus}
        </span>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sovereign-muted font-mono text-xs">
            Waiting for agent events...
          </div>
        ) : (
          events.map((event, index) => {
            const badge = EVENT_BADGE_MAP[event.event_type] ?? EVENT_BADGE_MAP.THOUGHT;
            const message = extractMessage(event);
            const time = formatTimestamp(event.created_at);

            return (
              <div
                key={`${event.created_at}-${index}`}
                className={`flex items-center gap-2 h-8 px-3 border-b border-sovereign-border/30 hover:bg-sovereign-bg/50 transition-colors ${index === 0 ? "animate-slide-in" : ""}`}
              >
                {/* Timestamp */}
                <span className="font-mono text-[10px] text-sovereign-muted/60 w-16 flex-shrink-0">
                  {time}
                </span>

                {/* Event type badge */}
                <Badge variant={badge.variant}>{badge.label}</Badge>

                {/* Message */}
                <span className="font-mono text-xs text-sovereign-text truncate">
                  {message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Extract a human-readable message from an event payload. */
function extractMessage(event: { event_type: string; event_source: string; payload: Record<string, unknown> }): string {
  const p = event.payload;

  if (typeof p.thought === "string") return p.thought;
  if (typeof p.action === "string") return `${p.action}: ${String(p.draft ?? p.brief_preview ?? "").slice(0, 120)}`;
  if (typeof p.message === "string") return p.message;
  if (typeof p.severity === "string") return `Crisis ${String(p.severity).toUpperCase()}: ${p.mention_count ?? "?"} mentions`;

  // Fallback: show source + type
  return `[${event.event_source}] ${event.event_type}`;
}

/** Format an ISO timestamp to a short time string. */
function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "—:—:—";
  }
}

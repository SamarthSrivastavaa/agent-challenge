import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAgentStore } from "../../stores/agentStore";
import { Badge } from "../ui/Badge";
import { Copy, X, ArrowRight } from "lucide-react";

/**
 * CrisisAlertModal — full-screen overlay triggered by WebSocket 'CRISIS' events.
 *
 * Design per spec:
 * - Full-screen overlay: rgba(0,0,0,0.85) backdrop
 * - Modal: #111118, 1px red border (#EF4444), 480px wide
 * - Header: "⚠ CRISIS DETECTED" in red, monospace, blinking cursor
 * - Severity badge: HIGH/MEDIUM/LOW with color
 * - Stats: mention count, avg sentiment, time window
 * - Top 3 crisis mentions with author + content preview
 * - Drafted response in code-like box with copy button
 * - Buttons: "View All" + "Dismiss"
 * - Slides up from bottom (Framer Motion)
 * - Auto-dismiss after 60s
 */
export function CrisisAlertModal() {
  const activeCrisis = useAgentStore((s) => s.activeCrisis);
  const dismissCrisis = useAgentStore((s) => s.dismissCrisis);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss after 60 seconds
  useEffect(() => {
    if (activeCrisis) {
      timerRef.current = setTimeout(() => {
        dismissCrisis();
      }, 60_000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeCrisis, dismissCrisis]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable
    }
  };

  if (!activeCrisis) return null;

  const { mentions, severity } = activeCrisis;

  const sentiments = mentions
    .filter((m) => m.sentiment != null)
    .map((m) => m.sentiment as number);
  const avgSentiment =
    sentiments.length > 0
      ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
      : 0;
  const sentimentLabel =
    avgSentiment < -0.3 ? "negative" : avgSentiment > 0.3 ? "positive" : "neutral";

  const severityColor: Record<string, string> = {
    high: "red",
    medium: "amber",
    low: "gray",
  };

  const topMentions = mentions.slice(0, 3);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85">
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-[480px] rounded-lg border border-sovereign-danger bg-sovereign-surface"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-sovereign-danger/30 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-sovereign-danger font-medium">
                ⚠ CRISIS DETECTED
              </span>
              <span className="text-sovereign-danger animate-blink">▊</span>
            </div>
            <button
              onClick={dismissCrisis}
              className="text-sovereign-muted hover:text-sovereign-text transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            {/* Severity + Stats */}
            <div className="flex items-center gap-3">
              <Badge variant={severityColor[severity] as "red" | "amber" | "gray"}>
                {severity.toUpperCase()}
              </Badge>
              <span className="font-mono text-xs text-sovereign-muted">
                {mentions.length} mentions · avg sentiment{" "}
                <span
                  className={
                    sentimentLabel === "negative"
                      ? "text-sovereign-danger"
                      : "text-sovereign-muted"
                  }
                >
                  {avgSentiment.toFixed(2)} ({sentimentLabel})
                </span>
              </span>
            </div>

            {/* Top crisis mentions */}
            <div className="space-y-2">
              <span className="font-mono text-[10px] text-sovereign-muted uppercase tracking-wider">
                Top Mentions
              </span>
              {topMentions.map((mention, i) => (
                <div
                  key={mention.tweet_id ?? i}
                  className="rounded border border-sovereign-border bg-sovereign-bg p-2"
                >
                  <span className="font-mono text-[10px] text-sovereign-accent2">
                    @{mention.author_handle}
                  </span>
                  <p className="font-mono text-xs text-sovereign-text mt-0.5 line-clamp-2">
                    "{mention.content}"
                  </p>
                </div>
              ))}
            </div>

            {/* Drafted response placeholder */}
            <div className="space-y-1">
              <span className="font-mono text-[10px] text-sovereign-muted uppercase tracking-wider">
                Drafted Response
              </span>
              <div className="relative rounded border border-sovereign-border bg-sovereign-bg p-3">
                <p className="font-mono text-xs text-sovereign-text/80">
                  Response draft will appear here when ready...
                </p>
                <button
                  onClick={() => handleCopy("draft response placeholder")}
                  className="absolute top-2 right-2 text-sovereign-muted hover:text-sovereign-text transition-colors"
                >
                  {copied ? (
                    <span className="font-mono text-[10px] text-sovereign-success">
                      copied!
                    </span>
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={dismissCrisis}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded border border-sovereign-border font-mono text-xs text-sovereign-muted hover:text-sovereign-text hover:border-sovereign-muted transition-colors"
              >
                <ArrowRight size={12} />
                View All
              </button>
              <button
                onClick={dismissCrisis}
                className="flex-1 px-3 py-2 rounded bg-sovereign-danger/20 font-mono text-xs text-sovereign-danger hover:bg-sovereign-danger/30 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

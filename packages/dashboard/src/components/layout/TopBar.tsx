import { Wifi, WifiOff } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { useEffect, useState } from "react";

interface TopBarProps {
  connected: boolean;
}

/**
 * TopBar — 48px fixed header bar.
 *
 * Left: page title in caps, muted color.
 * Right: reputation score pill, agent status badge,
 *        connection indicator, live clock.
 */
export function TopBar({ connected }: TopBarProps) {
  const reputation = useAgentStore((s) => s.reputation);
  const agentStatus = useAgentStore((s) => s.agentStatus);
  const [clock, setClock] = useState(formatTime());

  useEffect(() => {
    const timer = setInterval(() => setClock(formatTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const score = reputation?.score ?? 0;
  const scoreColor =
    score >= 8 ? "text-sovereign-success" :
    score >= 5 ? "text-sovereign-warning" :
    "text-sovereign-danger";

  const statusConfig: Record<string, { label: string; color: string }> = {
    monitoring: { label: "MONITORING", color: "bg-sovereign-success/20 text-sovereign-success" },
    processing: { label: "PROCESSING", color: "bg-sovereign-accent/20 text-sovereign-accent" },
    alert: { label: "ALERT", color: "bg-sovereign-danger/20 text-sovereign-danger" },
    offline: { label: "OFFLINE", color: "bg-sovereign-muted/20 text-sovereign-muted" },
  };

  const status = statusConfig[agentStatus] ?? statusConfig.offline;

  return (
    <div className="flex h-full items-center justify-between px-5">
      {/* Left: page title */}
      <h1 className="font-mono text-xs tracking-widest text-sovereign-muted uppercase">
        Intelligence Dashboard
      </h1>

      {/* Right: indicators */}
      <div className="flex items-center gap-4">
        {/* Reputation score pill */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-sovereign-muted">SCORE</span>
          <span className={`font-mono text-lg font-medium ${scoreColor}`}>
            {score > 0 ? score.toFixed(1) : "—"}
          </span>
        </div>

        {/* Agent status badge */}
        <span className={`px-2 py-0.5 rounded font-mono text-[10px] tracking-wider ${status.color}`}>
          {status.label}
        </span>

        {/* WebSocket connection indicator */}
        <div className="flex items-center gap-1">
          {connected ? (
            <Wifi size={12} className="text-sovereign-success" />
          ) : (
            <WifiOff size={12} className="text-sovereign-danger" />
          )}
        </div>

        {/* Live clock */}
        <span className="font-mono text-xs text-sovereign-muted">
          {clock}
        </span>
      </div>
    </div>
  );
}

function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

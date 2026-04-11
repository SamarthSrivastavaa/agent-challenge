import { Activity, AtSign, BarChart3, Cpu, Settings } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { StatusDot } from "../ui/StatusDot";

const NAV_ITEMS = [
  { label: "Dashboard", icon: Activity, id: "dashboard" },
  { label: "Mentions", icon: AtSign, id: "mentions" },
  { label: "Reputation", icon: BarChart3, id: "reputation" },
  { label: "Node", icon: Cpu, id: "node" },
  { label: "Settings", icon: Settings, id: "settings" },
] as const;

/**
 * Sidebar — left navigation panel.
 *
 * - Logo: "⬡ SOVEREIGN" in JetBrains Mono, purple
 * - Nav links with icons
 * - Bottom: Nosana node status indicator with pulsing dot
 * - Solid #111118 background, no gradients
 */
export function Sidebar() {
  const nodeStatus = useAgentStore((s) => s.nodeStatus);
  const agentStatus = useAgentStore((s) => s.agentStatus);

  const nodeStatusText = nodeStatus
    ? nodeStatus.status.toUpperCase()
    : "CONNECTING";

  const dotStatus = agentStatus === "alert"
    ? "alert"
    : nodeStatus
      ? "online"
      : "offline";

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-sovereign-border">
        <span className="text-sovereign-accent text-xl">⬡</span>
        <span className="font-mono font-medium text-sm tracking-widest text-sovereign-accent">
          SOVEREIGN
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sovereign-muted hover:text-sovereign-text hover:bg-sovereign-bg transition-colors"
          >
            <item.icon size={16} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Node status indicator */}
      <div className="border-t border-sovereign-border px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusDot status={dotStatus} />
          <span className="font-mono text-xs tracking-wider text-sovereign-muted">
            NODE {nodeStatusText}
          </span>
        </div>
        {nodeStatus && (
          <div className="mt-1 font-mono text-[10px] text-sovereign-muted/60">
            GPU {nodeStatus.gpu_usage.toFixed(0)}% · CPU{" "}
            {nodeStatus.cpu_usage.toFixed(0)}%
          </div>
        )}
      </div>
    </div>
  );
}

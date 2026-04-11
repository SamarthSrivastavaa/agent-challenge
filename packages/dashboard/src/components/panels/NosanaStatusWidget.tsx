import { useAgentStore } from "../../stores/agentStore";
import { StatusDot } from "../ui/StatusDot";

/**
 * NosanaStatusWidget — real-time Nosana GPU node health display.
 *
 * Shows:
 * - NODE ID (first 8 chars, monospace)
 * - STATUS with pulsing StatusDot
 * - GPU USAGE progress bar (cyan fill)
 * - CPU USAGE progress bar
 * - MEMORY: X.X GB / Y.Y GB
 * - UPTIME: formatted duration
 *
 * Updates in real time from WebSocket 'NODE' events.
 * If unreachable: "NODE UNREACHABLE" in red with last seen time.
 */
export function NosanaStatusWidget() {
  const nodeStatus = useAgentStore((s) => s.nodeStatus);

  if (!nodeStatus) {
    return (
      <div className="space-y-3 p-4">
        <h3 className="font-mono text-[10px] tracking-wider text-sovereign-muted uppercase">
          Nosana Node
        </h3>
        <div className="flex items-center gap-2">
          <StatusDot status="offline" />
          <span className="font-mono text-xs text-sovereign-danger">
            NODE UNREACHABLE
          </span>
        </div>
        <p className="font-mono text-[10px] text-sovereign-muted">
          Waiting for metrics...
        </p>
      </div>
    );
  }

  const statusType: "online" | "processing" | "alert" | "offline" =
    nodeStatus.status === "running" || nodeStatus.status === "active"
      ? "online"
      : nodeStatus.status === "error"
        ? "alert"
        : "processing";

  return (
    <div className="space-y-3 p-4">
      <h3 className="font-mono text-[10px] tracking-wider text-sovereign-muted uppercase">
        Nosana Node
      </h3>

      {/* Node ID */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-sovereign-muted">NODE ID</span>
        <span className="font-mono text-xs text-sovereign-text">
          {nodeStatus.job_id.slice(0, 8)}...
        </span>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-sovereign-muted">STATUS</span>
        <div className="flex items-center gap-1.5">
          <StatusDot status={statusType} />
          <span className="font-mono text-xs text-sovereign-text">
            {nodeStatus.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* GPU Usage */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[10px] text-sovereign-muted">GPU</span>
          <span className="font-mono text-[10px] text-sovereign-accent2">
            {nodeStatus.gpu_usage.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-sovereign-border">
          <div
            className="h-full rounded-full bg-sovereign-accent2 transition-all duration-500"
            style={{ width: `${Math.min(100, nodeStatus.gpu_usage)}%` }}
          />
        </div>
      </div>

      {/* CPU Usage */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[10px] text-sovereign-muted">CPU</span>
          <span className="font-mono text-[10px] text-sovereign-accent">
            {nodeStatus.cpu_usage.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-sovereign-border">
          <div
            className="h-full rounded-full bg-sovereign-accent transition-all duration-500"
            style={{ width: `${Math.min(100, nodeStatus.cpu_usage)}%` }}
          />
        </div>
      </div>

      {/* Memory */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-sovereign-muted">MEMORY</span>
        <span className="font-mono text-xs text-sovereign-text">
          {nodeStatus.memory_used_gb.toFixed(1)} GB / {nodeStatus.memory_total_gb.toFixed(1)} GB
        </span>
      </div>

      {/* Uptime */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-sovereign-muted">UPTIME</span>
        <span className="font-mono text-xs text-sovereign-text">
          {formatUptime(nodeStatus.uptime_seconds)}
        </span>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(" ");
}

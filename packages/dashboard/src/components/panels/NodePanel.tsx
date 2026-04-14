import { useAgentStore } from "../../stores/agentStore";
import { Card } from "../ui/Card";
import { MetricCard } from "../ui/MetricCard";
import { Cpu, Zap, MemoryStick, Clock } from "lucide-react";

export function NodePanel() {
  const nodeStatus = useAgentStore((s) => s.nodeStatus);

  if (!nodeStatus) {
    return (
      <div className="space-y-4">
        <h2 className="font-mono text-xs tracking-widest text-sovereign-muted uppercase">
          Node Status
        </h2>
        <Card className="p-6 text-center">
          <p className="font-mono text-xs text-sovereign-muted">
            No Nosana node connected — running in local mode
          </p>
          <p className="font-mono text-[10px] text-sovereign-muted/60 mt-2">
            Set NOSANA_JOB_ID in .env to monitor a live GPU node
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs tracking-widest text-sovereign-muted uppercase">
          Node Status
        </h2>
        <span className={`font-mono text-[10px] px-2 py-0.5 rounded ${
          nodeStatus.status === "running"
            ? "bg-green-500/20 text-green-400"
            : "bg-sovereign-muted/20 text-sovereign-muted"
        }`}>
          {nodeStatus.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="GPU Usage"
          value={`${nodeStatus.gpu_usage.toFixed(1)}%`}
          icon={<Zap size={14} />}
        />
        <MetricCard
          title="CPU Usage"
          value={`${nodeStatus.cpu_usage.toFixed(1)}%`}
          icon={<Cpu size={14} />}
        />
        <MetricCard
          title="Memory"
          value={`${nodeStatus.memory_used_gb.toFixed(1)} / ${nodeStatus.memory_total_gb.toFixed(1)} GB`}
          icon={<MemoryStick size={14} />}
        />
        <MetricCard
          title="Uptime"
          value={formatUptime(nodeStatus.uptime_seconds)}
          icon={<Clock size={14} />}
        />
      </div>

      <Card className="p-4">
        <h3 className="font-mono text-[10px] tracking-wider text-sovereign-muted uppercase mb-3">
          Node Details
        </h3>
        <div className="space-y-2">
          <Row label="Job ID" value={nodeStatus.job_id} />
          <Row label="Last updated" value={new Date(nodeStatus.recorded_at).toLocaleString()} />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-mono text-[10px] text-sovereign-muted">{label}</span>
      <span className="font-mono text-[10px] text-sovereign-text">{value}</span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

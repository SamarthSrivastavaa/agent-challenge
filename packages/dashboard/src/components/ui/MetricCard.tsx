import type { ReactNode } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  delta?: number;
  deltaPositive?: boolean;
  icon?: ReactNode;
}

/**
 * MetricCard — data display card for the reputation panel.
 *
 * Design per spec:
 * - #111118 background, 1px #1E1E2E border, no shadow
 * - Value: large (text-3xl), monospace font
 * - Delta: small colored arrow + percentage below value
 * - Never use gradients. Flat surface only.
 */
export function MetricCard({
  title,
  value,
  unit,
  delta,
  deltaPositive,
  icon,
}: MetricCardProps) {
  const isPositive = deltaPositive ?? (delta != null && delta >= 0);
  const deltaColor = isPositive ? "text-sovereign-success" : "text-sovereign-danger";

  return (
    <div className="rounded-lg border border-sovereign-border bg-sovereign-surface p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] tracking-wider text-sovereign-muted uppercase">
          {title}
        </span>
        {icon && (
          <span className="text-sovereign-muted">{icon}</span>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-3xl font-medium text-sovereign-text">
          {value}
        </span>
        {unit && (
          <span className="font-mono text-sm text-sovereign-muted">{unit}</span>
        )}
      </div>

      {/* Delta */}
      {delta != null && (
        <div className={`flex items-center gap-1 mt-1 ${deltaColor}`}>
          {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          <span className="font-mono text-xs">
            {isPositive ? "+" : ""}
            {typeof delta === "number" ? delta.toFixed(1) : delta}%
          </span>
        </div>
      )}
    </div>
  );
}

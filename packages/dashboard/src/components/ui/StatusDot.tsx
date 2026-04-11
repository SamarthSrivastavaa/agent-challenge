interface StatusDotProps {
  status: "online" | "processing" | "alert" | "offline";
}

const STATUS_COLORS: Record<StatusDotProps["status"], string> = {
  online: "bg-sovereign-success",
  processing: "bg-sovereign-accent",
  alert: "bg-sovereign-danger",
  offline: "bg-sovereign-muted",
};

/**
 * StatusDot — pulsing status indicator circle.
 *
 * Uses opacity oscillation (never scale) per spec.
 * Colors: green=online, purple=processing, red=alert, gray=offline.
 */
export function StatusDot({ status }: StatusDotProps) {
  const color = STATUS_COLORS[status];
  const shouldPulse = status !== "offline";

  return (
    <span className="relative flex h-2 w-2">
      {shouldPulse && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${color} animate-pulse-opacity`}
        />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

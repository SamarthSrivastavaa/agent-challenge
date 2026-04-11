import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "purple" | "cyan" | "red" | "amber" | "gray" | "green";
}

const VARIANT_STYLES: Record<NonNullable<BadgeProps["variant"]>, string> = {
  purple: "bg-sovereign-accent/20 text-sovereign-accent",
  cyan: "bg-sovereign-accent2/20 text-sovereign-accent2",
  red: "bg-sovereign-danger/20 text-sovereign-danger",
  amber: "bg-sovereign-warning/20 text-sovereign-warning",
  gray: "bg-sovereign-muted/20 text-sovereign-muted",
  green: "bg-sovereign-success/20 text-sovereign-success",
};

/**
 * Badge — small pill label for event types and status indicators.
 */
export function Badge({ children, variant = "gray" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] tracking-wider leading-none ${VARIANT_STYLES[variant]}`}
    >
      {children}
    </span>
  );
}

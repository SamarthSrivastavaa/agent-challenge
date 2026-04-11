import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Card — base container with sovereign surface styling.
 *
 * #111118 background, 1px #1E1E2E border, 8px radius.
 * No gradients, no box shadows.
 */
export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-sovereign-border bg-sovereign-surface ${className}`}
    >
      {children}
    </div>
  );
}

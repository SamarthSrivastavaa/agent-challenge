import React from "react";

interface ShellProps {
  sidebar: React.ReactNode;
  topBar: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shell — the full-screen dark layout container.
 *
 * Structure:
 * - Left: 240px fixed sidebar
 * - Top: 48px fixed top bar
 * - Main: flex-1, scrollable content area
 *
 * No rounded corners on the outer chrome — sharp lines per spec.
 */
export function Shell({ sidebar, topBar, children }: ShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-sovereign-bg">
      {/* Sidebar — 240px fixed */}
      <aside className="w-60 flex-shrink-0 border-r border-sovereign-border bg-sovereign-surface flex flex-col">
        {sidebar}
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar — 48px fixed */}
        <header className="h-12 flex-shrink-0 border-b border-sovereign-border bg-sovereign-surface">
          {topBar}
        </header>

        {/* Content area — scrollable */}
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
}

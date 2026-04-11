import { useEffect, useRef } from "react";
import { Shell } from "./components/layout/Shell";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { ActivityFeed } from "./components/panels/ActivityFeed";
import { ReputationPanel } from "./components/panels/ReputationPanel";
import { CrisisAlertModal } from "./components/panels/CrisisAlertModal";
import { NosanaStatusWidget } from "./components/panels/NosanaStatusWidget";
import { useWebSocket } from "./hooks/useWebSocket";
import { seedMockData } from "./lib/mockSeeder";
import { useAgentStore } from "./stores/agentStore";
import { Card } from "./components/ui/Card";

/**
 * App — root component of the SovereignSelf dashboard.
 *
 * Connects to the WebSocket server, seeds mock data if no real
 * data arrives within 3 seconds, and assembles the full layout.
 */
export default function App() {
  const { connected } = useWebSocket();
  const events = useAgentStore((s) => s.events);
  const seeded = useRef(false);

  // Seed mock data if no WebSocket data within 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!seeded.current && events.length === 0) {
        seedMockData();
        seeded.current = true;
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [events.length]);

  // Also seed immediately in development if no data
  useEffect(() => {
    if (import.meta.env.DEV && !seeded.current && events.length === 0) {
      const timer = setTimeout(() => {
        if (!seeded.current && events.length === 0) {
          seedMockData();
          seeded.current = true;
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [events.length]);

  return (
    <>
      <Shell
        sidebar={
          <>
            <Sidebar />
            {/* Nosana widget in sidebar bottom */}
            <div className="border-t border-sovereign-border mt-auto">
              <NosanaStatusWidget />
            </div>
          </>
        }
        topBar={<TopBar connected={connected} />}
      >
        {/* Main content: ActivityFeed (40%) + ReputationPanel (60%) */}
        <div className="flex gap-4 h-full">
          {/* Left: Activity Feed — 40% */}
          <Card className="w-[40%] flex-shrink-0 overflow-hidden">
            <ActivityFeed />
          </Card>

          {/* Right: Reputation Panel — 60% */}
          <div className="flex-1 overflow-y-auto">
            <ReputationPanel />
          </div>
        </div>
      </Shell>

      {/* Crisis Alert Modal — renders above everything */}
      <CrisisAlertModal />
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { Shell } from "./components/layout/Shell";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { ActivityFeed } from "./components/panels/ActivityFeed";
import { ReputationPanel } from "./components/panels/ReputationPanel";
import { MentionsPanel } from "./components/panels/MentionsPanel";
import { NodePanel } from "./components/panels/NodePanel";
import { SettingsPanel } from "./components/panels/SettingsPanel";
import { CrisisAlertModal } from "./components/panels/CrisisAlertModal";
import { NosanaStatusWidget } from "./components/panels/NosanaStatusWidget";
import { useWebSocket } from "./hooks/useWebSocket";
import { useReputation } from "./hooks/useReputation";
import { useNodeStatus } from "./hooks/useNodeStatus";
import { seedMockData } from "./lib/mockSeeder";
import { useAgentStore } from "./stores/agentStore";
import { Card } from "./components/ui/Card";

type ViewId = "dashboard" | "mentions" | "reputation" | "node" | "settings";

/**
 * App — root component of the SovereignSelf dashboard.
 *
 * Connects to the WebSocket server, seeds mock data if no real
 * data arrives within 3 seconds, and assembles the full layout.
 */
export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const { connected } = useWebSocket();
  useReputation();
  useNodeStatus();
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
            <Sidebar activeView={activeView} onNavigate={setActiveView} />
            {/* Nosana widget in sidebar bottom */}
            <div className="border-t border-sovereign-border mt-auto">
              <NosanaStatusWidget />
            </div>
          </>
        }
        topBar={<TopBar connected={connected} />}
      >
        {/* Main content — switches based on activeView */}
        {activeView === "dashboard" && (
          <div className="flex gap-4 h-full">
            <Card className="w-[40%] flex-shrink-0 overflow-hidden">
              <ActivityFeed />
            </Card>
            <div className="flex-1 overflow-y-auto">
              <ReputationPanel />
            </div>
          </div>
        )}
        {activeView === "mentions" && (
          <div className="overflow-y-auto h-full">
            <MentionsPanel />
          </div>
        )}
        {activeView === "reputation" && (
          <div className="overflow-y-auto h-full">
            <ReputationPanel />
          </div>
        )}
        {activeView === "node" && (
          <div className="overflow-y-auto h-full">
            <NodePanel />
          </div>
        )}
        {activeView === "settings" && (
          <div className="overflow-y-auto h-full">
            <SettingsPanel />
          </div>
        )}
      </Shell>

      {/* Crisis Alert Modal — renders above everything */}
      <CrisisAlertModal />
    </>
  );
}

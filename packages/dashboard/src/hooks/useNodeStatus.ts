import { useEffect } from "react";
import { useAgentStore } from "../stores/agentStore";
import { fetchNodeStatus } from "../lib/api";

/**
 * useNodeStatus — fetches Nosana node metrics from the REST API
 * on mount. WebSocket 'NODE' events keep it updated in real time.
 */
export function useNodeStatus() {
  const updateNodeStatus = useAgentStore((s) => s.updateNodeStatus);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchNodeStatus();
        if (data?.metrics) {
          updateNodeStatus(data.metrics);
        }
      } catch {
        // API may not be available — mock seeder will handle it
      }
    }

    void load();
  }, [updateNodeStatus]);
}

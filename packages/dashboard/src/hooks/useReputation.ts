import { useEffect } from "react";
import { useAgentStore } from "../stores/agentStore";
import { fetchReputationCurrent, fetchReputationHistory } from "../lib/api";

/**
 * useReputation — fetches reputation data from the REST API on mount
 * and populates the Zustand store. WebSocket updates keep it current
 * after the initial load.
 */
export function useReputation() {
  const setReputation = useAgentStore((s) => s.setReputation);
  const setReputationHistory = useAgentStore((s) => s.setReputationHistory);

  useEffect(() => {
    async function load() {
      try {
        const [current, history] = await Promise.all([
          fetchReputationCurrent(),
          fetchReputationHistory(30),
        ]);

        if (current?.reputation) {
          setReputation(current.reputation);
        }
        // Only replace history if the DB actually has records — don't
        // wipe mock/seed data with an empty array on a fresh deployment.
        if (history?.history?.length > 0) {
          setReputationHistory(history.history);
        }
      } catch {
        // API may not be available yet — mock seeder will handle it
      }
    }

    void load();
  }, [setReputation, setReputationHistory]);
}

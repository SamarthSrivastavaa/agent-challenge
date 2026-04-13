import { useEffect, useRef, useState } from "react";
import { useAgentStore } from "../stores/agentStore";
import { fetchEvents, fetchMentions, fetchNodeStatus } from "../lib/api";

/** Connection status exposed to the TopBar — mirrors the old WS interface. */
export interface WsStatus {
  connected: boolean;
  lastPing: Date | null;
}

const POLL_EVENTS_MS   = 5_000;
const POLL_NODE_MS     = 10_000;
const POLL_MENTIONS_MS = 10_000;

/**
 * useWebSocket — replaced with REST polling.
 * Nosana's reverse proxy does not support WebSocket upgrades, so we poll
 * the existing REST endpoints instead. Reputation data is handled separately
 * by useReputation. Returns the same WsStatus shape so the TopBar indicator
 * works (green = last poll succeeded).
 */
export function useWebSocket(): WsStatus {
  const [connected, setConnected] = useState(false);
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const { setEvents, setMentions, updateNodeStatus, setAgentStatus } = useAgentStore();

  useEffect(() => {
    mountedRef.current = true;

    // ── Initial load ──────────────────────────────────────────
    async function initialLoad() {
      try {
        const [events, mentions, node] = await Promise.all([
          fetchEvents(50),
          fetchMentions(20),
          fetchNodeStatus(),
        ]);

        if (!mountedRef.current) return;

        if (Array.isArray(events))   setEvents(events);
        if (Array.isArray(mentions)) setMentions(mentions);
        if (node?.status)            updateNodeStatus(node);

        setConnected(true);
        setLastPing(new Date());
        setAgentStatus("monitoring");
      } catch {
        if (mountedRef.current) setConnected(false);
      }
    }

    void initialLoad();

    // ── Poll events ───────────────────────────────────────────
    const eventsTimer = setInterval(async () => {
      try {
        const events = await fetchEvents(50);
        if (!mountedRef.current) return;
        if (Array.isArray(events)) setEvents(events);
        setConnected(true);
        setLastPing(new Date());
      } catch {
        if (mountedRef.current) setConnected(false);
      }
    }, POLL_EVENTS_MS);

    // ── Poll mentions ─────────────────────────────────────────
    const mentionsTimer = setInterval(async () => {
      try {
        const mentions = await fetchMentions(20);
        if (mountedRef.current && Array.isArray(mentions)) setMentions(mentions);
      } catch { /* ignore */ }
    }, POLL_MENTIONS_MS);

    // ── Poll node status ──────────────────────────────────────
    const nodeTimer = setInterval(async () => {
      try {
        const node = await fetchNodeStatus();
        if (mountedRef.current && node?.status) updateNodeStatus(node);
      } catch { /* ignore */ }
    }, POLL_NODE_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(eventsTimer);
      clearInterval(mentionsTimer);
      clearInterval(nodeTimer);
    };
  }, [setEvents, setMentions, updateNodeStatus, setAgentStatus]);

  return { connected, lastPing };
}

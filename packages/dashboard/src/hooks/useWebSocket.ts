import { useEffect, useRef, useState, useCallback } from "react";
import { useAgentStore } from "../stores/agentStore";

/** WebSocket connection status exposed to the TopBar. */
export interface WsStatus {
  connected: boolean;
  lastPing: Date | null;
}

/**
 * useWebSocket — connects to the SovereignSelf WebSocket server,
 * implements exponential backoff reconnection (1s → 2s → 4s → 8s → max 30s),
 * and dispatches received messages to the Zustand store.
 */
export function useWebSocket(): WsStatus {
  const [connected, setConnected] = useState(false);
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1000);

  const {
    addEvent,
    addMention,
    setCrisis,
    updateNodeStatus,
    setReputation,
    setEvents,
    setTickerData,
    setAgentStatus,
  } = useAgentStore();

  const connect = useCallback(() => {
    const wsUrl = import.meta.env.VITE_WS_URL ?? "ws://localhost:3002";

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectDelay.current = 1000; // reset backoff on successful connect
        setAgentStatus("monitoring");
      };

      ws.onmessage = (event) => {
        setLastPing(new Date());

        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            payload: Record<string, unknown>;
          };

          switch (msg.type) {
            case "INIT":
              // Initial state: array of recent events
              if (Array.isArray((msg.payload as { events?: unknown[] }).events)) {
                setEvents(
                  (msg.payload as { events: Array<Record<string, unknown>> }).events as never[],
                );
              }
              break;

            case "MENTION":
              addMention((msg.payload as { mention: never }).mention);
              addEvent({
                event_type: "MENTION",
                event_source: "twitter",
                payload: msg.payload,
                created_at: new Date().toISOString(),
              });
              break;

            case "CRISIS":
              setCrisis({
                mentions: (msg.payload as { mentions: never[] }).mentions,
                severity: (msg.payload as { severity: "low" | "medium" | "high" }).severity,
                detected_at: new Date().toISOString(),
              });
              addEvent({
                event_type: "ALERT",
                event_source: "crisis-detector",
                payload: msg.payload,
                created_at: new Date().toISOString(),
              });
              break;

            case "DRAFT":
              addEvent({
                event_type: "ACTION",
                event_source: "reputation-engine",
                payload: msg.payload,
                created_at: new Date().toISOString(),
              });
              break;

            case "BRIEF":
              setReputation(
                (msg.payload as { brief: never }).brief,
              );
              addEvent({
                event_type: "BRIEF",
                event_source: "reputation-engine",
                payload: msg.payload,
                created_at: new Date().toISOString(),
              });
              break;

            case "NODE":
              updateNodeStatus(
                (msg.payload as { metrics: never }).metrics,
              );
              break;

            case "THOUGHT":
              addEvent({
                event_type: "THOUGHT",
                event_source: (msg.payload as { source: string }).source ?? "agent",
                payload: msg.payload,
                created_at: new Date().toISOString(),
              });
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        // Exponential backoff: 1s, 2s, 4s, 8s, ... max 30s
        const delay = reconnectDelay.current;
        reconnectDelay.current = Math.min(delay * 2, 30_000);

        setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket constructor can throw if URL is invalid
      setTimeout(connect, reconnectDelay.current);
    }
  }, [addEvent, addMention, setCrisis, updateNodeStatus, setReputation, setEvents, setTickerData, setAgentStatus]);

  useEffect(() => {
    connect();

    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, lastPing };
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/**
 * REST API client for the SovereignSelf dashboard.
 * All functions hit the Express API and return typed JSON.
 */

/** Fetch recent agent events. */
export async function fetchEvents(limit = 50, type?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (type) params.set("type", type);
  const res = await fetch(`${API_BASE}/api/events?${params}`);
  return res.json();
}

/** Fetch current reputation score with delta. */
export async function fetchReputationCurrent() {
  const res = await fetch(`${API_BASE}/api/reputation/current`);
  return res.json();
}

/** Fetch reputation history for the last N days. */
export async function fetchReputationHistory(days = 30) {
  const res = await fetch(`${API_BASE}/api/reputation/history?days=${days}`);
  return res.json();
}

/** Fetch recent mentions with optional crisis filter. */
export async function fetchMentions(limit = 20, filter?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (filter) params.set("filter", filter);
  const res = await fetch(`${API_BASE}/api/mentions?${params}`);
  return res.json();
}

/** Fetch Nosana node status. */
export async function fetchNodeStatus() {
  const res = await fetch(`${API_BASE}/api/node/status`);
  return res.json();
}

/** Trigger an immediate weekly brief generation. */
export async function triggerBrief() {
  const res = await fetch(`${API_BASE}/api/agent/trigger-brief`, {
    method: "POST",
  });
  return res.json();
}

import { Card } from "../ui/Card";

const SETTINGS = [
  {
    group: "Agent",
    items: [
      { label: "Twitter Username", value: "SendX_AI", type: "text" },
      { label: "Poll Interval", value: "Every 2 minutes", type: "info" },
      { label: "Auto-Reply", value: "Disabled (draft only)", type: "info" },
    ],
  },
  {
    group: "Model",
    items: [
      { label: "Endpoint", value: import.meta.env.VITE_API_URL ? "Connected" : "Local", type: "info" },
      { label: "Model", value: "deepseek-r1:8b (Ollama)", type: "info" },
      { label: "Temperature", value: "0.7", type: "info" },
      { label: "Max Context", value: "60,000 tokens", type: "info" },
    ],
  },
  {
    group: "Alerts",
    items: [
      { label: "Telegram Bot", value: "Not configured", type: "warning" },
      { label: "Crisis Threshold", value: "Sentiment < -0.6", type: "info" },
      { label: "Weekly Brief", value: "Sunday 08:00 UTC", type: "info" },
    ],
  },
  {
    group: "Infrastructure",
    items: [
      { label: "API Server", value: `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}`, type: "info" },
      { label: "WebSocket", value: `${import.meta.env.VITE_WS_URL ?? "ws://localhost:3002"}`, type: "info" },
      { label: "Database", value: "PostgreSQL 16", type: "info" },
      { label: "Nosana Node", value: "Local (no job ID)", type: "warning" },
    ],
  },
];

export function SettingsPanel() {
  return (
    <div className="space-y-4">
      <h2 className="font-mono text-xs tracking-widest text-sovereign-muted uppercase">
        Configuration
      </h2>
      <p className="font-mono text-[10px] text-sovereign-muted/60">
        Read-only view. Edit values in your <code className="text-sovereign-accent">.env</code> file and restart the agent.
      </p>

      {SETTINGS.map((section) => (
        <Card key={section.group} className="p-4">
          <h3 className="font-mono text-[10px] tracking-wider text-sovereign-muted uppercase mb-3">
            {section.group}
          </h3>
          <div className="space-y-2">
            {section.items.map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-sovereign-muted">{item.label}</span>
                <span className={`font-mono text-[10px] ${
                  item.type === "warning" ? "text-yellow-400" : "text-sovereign-text"
                }`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

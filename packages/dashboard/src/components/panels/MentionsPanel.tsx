import { useAgentStore } from "../../stores/agentStore";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

export function MentionsPanel() {
  const mentions = useAgentStore((s) => s.mentions);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs tracking-widest text-sovereign-muted uppercase">
          Mentions Feed
        </h2>
        <span className="font-mono text-[10px] text-sovereign-muted">
          {mentions.length} loaded
        </span>
      </div>

      {mentions.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="font-mono text-xs text-sovereign-muted">No mentions yet — waiting for data</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {mentions.map((m, i) => (
            <Card key={m.tweet_id ?? i} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-sovereign-accent">@{m.author_handle}</span>
                    {m.is_crisis && (
                      <Badge variant="danger">CRISIS</Badge>
                    )}
                    <span className={`font-mono text-[10px] ${
                      m.sentiment_label === "positive" ? "text-green-400" :
                      m.sentiment_label === "negative" ? "text-red-400" :
                      "text-sovereign-muted"
                    }`}>
                      {m.sentiment_label?.toUpperCase() ?? "UNSCORED"}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-sovereign-text/80 leading-relaxed">
                    {m.content}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-[10px] text-sovereign-muted">
                    {m.reach > 0 ? formatReach(m.reach) : "—"}
                  </div>
                  <div className="font-mono text-[10px] text-sovereign-muted/60">
                    reach
                  </div>
                </div>
              </div>
              <div className="mt-1 font-mono text-[10px] text-sovereign-muted/50">
                {new Date(m.created_at).toLocaleString()}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function formatReach(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

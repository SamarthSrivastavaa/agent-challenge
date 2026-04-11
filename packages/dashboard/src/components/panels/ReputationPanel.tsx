import { Target, AtSign, Eye, TrendingUp } from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { MetricCard } from "../ui/MetricCard";
import { Card } from "../ui/Card";
import { ReputationTimeline } from "../charts/ReputationTimeline";
import { SentimentBar } from "../charts/SentimentBar";
import { triggerBrief } from "../../lib/api";
import { useState } from "react";

/**
 * ReputationPanel — right 60% of the main area.
 *
 * Layout:
 * - TOP ROW: 4 MetricCards (Score, Mentions, Reach, Sentiment)
 * - MIDDLE ROW: ReputationTimeline + SentimentBar charts
 * - BOTTOM ROW: Latest Weekly Brief with "Generate Now" button
 */
export function ReputationPanel() {
  const reputation = useAgentStore((s) => s.reputation);
  const reputationHistory = useAgentStore((s) => s.reputationHistory);
  const [briefLoading, setBriefLoading] = useState(false);

  const score = reputation?.score ?? 0;
  const mentions = reputation?.mention_count ?? 0;
  const reach = reputation?.total_reach ?? 0;
  const positivePct = reputation?.positive_pct ?? 0;

  // Compute deltas from history
  const prevScore = reputationHistory.length >= 2
    ? reputationHistory[reputationHistory.length - 2]?.score ?? score
    : score;
  const scoreDelta = score - prevScore;

  // Format reputation timeline data for chart
  const timelineData = reputationHistory.map((r) => ({
    date: formatShortDate(r.period_end),
    score: r.score,
  }));

  // Generate 7-day sentiment data from history
  const sentimentData = reputationHistory.slice(-7).map((r) => ({
    day: formatDayName(r.period_end),
    positive: Math.round(r.positive_pct ?? 0),
    neutral: Math.round(r.neutral_pct ?? 0),
    negative: Math.round(r.negative_pct ?? 0),
  }));

  const handleTriggerBrief = async () => {
    setBriefLoading(true);
    try {
      await triggerBrief();
    } catch {
      // silent fail
    } finally {
      setBriefLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* TOP ROW — 4 MetricCards */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          title="Score"
          value={score > 0 ? score.toFixed(1) : "—"}
          unit="/10"
          delta={scoreDelta}
          deltaPositive={scoreDelta >= 0}
          icon={<Target size={14} />}
        />
        <MetricCard
          title="Mentions"
          value={mentions > 0 ? String(mentions) : "—"}
          delta={undefined}
          icon={<AtSign size={14} />}
        />
        <MetricCard
          title="Reach"
          value={formatReach(reach)}
          icon={<Eye size={14} />}
        />
        <MetricCard
          title="Sentiment"
          value={positivePct > 0 ? `${positivePct.toFixed(0)}%` : "—"}
          unit="positive"
          deltaPositive={positivePct >= 50}
          icon={<TrendingUp size={14} />}
        />
      </div>

      {/* MIDDLE ROW — Charts */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <h3 className="font-mono text-[10px] tracking-wider text-sovereign-muted uppercase mb-2">
            Reputation Trend (30d)
          </h3>
          {timelineData.length > 0 ? (
            <ReputationTimeline data={timelineData} />
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sovereign-muted font-mono text-xs">
              No history data yet
            </div>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="font-mono text-[10px] tracking-wider text-sovereign-muted uppercase mb-2">
            Sentiment Distribution (7d)
          </h3>
          {sentimentData.length > 0 ? (
            <SentimentBar data={sentimentData} />
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sovereign-muted font-mono text-xs">
              No sentiment data yet
            </div>
          )}
        </Card>
      </div>

      {/* BOTTOM ROW — Weekly Brief */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-[10px] tracking-wider text-sovereign-muted uppercase">
            Weekly Intelligence Brief
          </h3>
          {reputation?.created_at && (
            <span className="font-mono text-[10px] text-sovereign-muted">
              {new Date(reputation.created_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {reputation?.brief_text ? (
          <div className="prose prose-invert prose-sm max-w-none font-mono text-xs text-sovereign-text/90 leading-relaxed whitespace-pre-wrap">
            {reputation.brief_text}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="font-mono text-xs text-sovereign-muted">
              Brief will be generated Sunday 08:00 UTC
            </p>
            <button
              onClick={handleTriggerBrief}
              disabled={briefLoading}
              className="px-4 py-1.5 rounded bg-sovereign-accent/20 text-sovereign-accent font-mono text-xs tracking-wider hover:bg-sovereign-accent/30 transition-colors disabled:opacity-50"
            >
              {briefLoading ? "GENERATING..." : "GENERATE NOW"}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

function formatReach(reach: number): string {
  if (reach >= 1_000_000) return `${(reach / 1_000_000).toFixed(1)}M`;
  if (reach >= 1_000) return `${(reach / 1_000).toFixed(1)}K`;
  return String(reach || "—");
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function formatDayName(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short" });
  } catch {
    return "—";
  }
}

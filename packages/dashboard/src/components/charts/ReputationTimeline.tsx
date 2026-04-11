import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

interface DataPoint {
  date: string;
  score: number;
}

interface ReputationTimelineProps {
  data: DataPoint[];
}

/**
 * ReputationTimeline — 30-day reputation score trend (Recharts LineChart).
 *
 * - Line color: purple (#7C3AED)
 * - No grid lines, minimal axes
 * - Tooltip shows date + score
 */
export function ReputationTimeline({ data }: ReputationTimelineProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="date"
          stroke="#64748B"
          fontSize={10}
          fontFamily="JetBrains Mono"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 10]}
          stroke="#64748B"
          fontSize={10}
          fontFamily="JetBrains Mono"
          tickLine={false}
          axisLine={false}
          tickCount={5}
        />
        <Tooltip
          contentStyle={{
            background: "#111118",
            border: "1px solid #1E1E2E",
            borderRadius: 8,
            fontFamily: "JetBrains Mono",
            fontSize: 12,
            color: "#E2E8F0",
          }}
          labelStyle={{ color: "#64748B" }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#7C3AED"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#7C3AED" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

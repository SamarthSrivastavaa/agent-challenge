import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

interface DataPoint {
  time: string;
  count: number;
}

interface MentionVelocityChartProps {
  data: DataPoint[];
}

/**
 * MentionVelocityChart — shows mention volume over time.
 *
 * Cyan area fill with minimal axes. Used in the dashboard
 * to visualize mention spikes that may indicate crisis events.
 */
export function MentionVelocityChart({ data }: MentionVelocityChartProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="time"
          stroke="#64748B"
          fontSize={10}
          fontFamily="JetBrains Mono"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#64748B"
          fontSize={10}
          fontFamily="JetBrains Mono"
          tickLine={false}
          axisLine={false}
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
        <Area
          type="monotone"
          dataKey="count"
          stroke="#06B6D4"
          fill="#06B6D4"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

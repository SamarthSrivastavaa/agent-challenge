import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

interface DataPoint {
  day: string;
  positive: number;
  neutral: number;
  negative: number;
}

interface SentimentBarProps {
  data: DataPoint[];
}

/**
 * SentimentBar — 7-day stacked bar chart of sentiment distribution.
 *
 * Colors: green (#10B981) / gray (#64748B) / red (#EF4444)
 * for positive / neutral / negative respectively.
 */
export function SentimentBar({ data }: SentimentBarProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="day"
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
        <Bar dataKey="positive" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
        <Bar dataKey="neutral" stackId="a" fill="#64748B" />
        <Bar dataKey="negative" stackId="a" fill="#EF4444" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

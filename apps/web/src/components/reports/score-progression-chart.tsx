'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ProgressionPoint {
  /** Display label on x-axis — usually "Q{half} {mm:ss}" or raid number. */
  t: string;
  home: number;
  away: number;
}

// Score progression over a single match. The chart shows two lines —
// home and away — as the match clock ticks forward and points accumulate.
export function ScoreProgressionChart({
  data,
  homeName,
  awayName,
  homeColor,
  awayColor,
}: {
  data: ProgressionPoint[];
  homeName: string;
  awayName: string;
  homeColor?: string | null;
  awayColor?: string | null;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No score events
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.4} />
        <XAxis
          dataKey="t"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="line" />
        <Line
          type="monotone"
          dataKey="home"
          name={homeName}
          stroke={homeColor ?? 'hsl(var(--primary))'}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="away"
          name={awayName}
          stroke={awayColor ?? '#0ea5e9'}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

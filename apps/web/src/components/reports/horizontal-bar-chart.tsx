'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface BarRow {
  label: string;
  value: number;
  color?: string;
}

// Generic horizontal bar chart used for "top scorers", standings, etc.
// Server-rendered pages pass already-sorted rows; we just visualise them.
export function HorizontalBarChart({
  data,
  height = 320,
  valueFormatter,
  accentColor = 'hsl(var(--primary))',
}: {
  data: BarRow[];
  height?: number;
  valueFormatter?: (n: number) => string;
  accentColor?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
        <XAxis type="number" hide />
        <YAxis
          dataKey="label"
          type="category"
          width={140}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--accent))', opacity: 0.3 }}
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(value: number) => [valueFormatter ? valueFormatter(value) : value, 'Points']}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((row, i) => (
            <Cell key={i} fill={row.color ?? accentColor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

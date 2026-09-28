'use client';

import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area,
} from 'recharts';

/** Brand-derived series palette — reads acceptably in both light and dark. */
export const CHART_COLORS = ['#00A7B5', '#182B6D', '#FFB23F', '#10b981', '#8b5cf6', '#ef4444', '#0B7890'];

const axisProps = {
  stroke: 'var(--text-muted)',
  tick: { fill: 'var(--text-muted)', fontSize: 12 },
  tickLine: false,
};

const tooltipStyle = {
  contentStyle: {
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 12,
    color: 'var(--text-primary)',
    fontSize: 12,
    boxShadow: 'var(--shadow-2)',
  },
  labelStyle: { color: 'var(--text-secondary)' },
  itemStyle: { color: 'var(--text-primary)' },
};

export function KpiBar({ data, xKey, bars, height = 260, stacked }: {
  data: any[];
  xKey: string;
  bars: { key: string; name?: string; color?: string }[];
  height?: number;
  stacked?: boolean;
}) {
  const safeData = Array.isArray(data) ? data : [];
  const safeBars = Array.isArray(bars) ? bars : [];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={safeData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--hover-overlay)' }} />
        {safeBars.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />}
        {safeBars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.name || b.key} stackId={stacked ? 'a' : undefined} fill={b.color || CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function KpiLine({ data, xKey, lines, height = 260, area }: {
  data: any[];
  xKey: string;
  lines: { key: string; name?: string; color?: string }[];
  height?: number;
  area?: boolean;
}) {
  const safeData = Array.isArray(data) ? data : [];
  const safeLines = Array.isArray(lines) ? lines : [];
  if (area) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={safeData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip {...tooltipStyle} />
          {safeLines.map((l, i) => {
            const color = l.color || CHART_COLORS[i % CHART_COLORS.length];
            return <Area key={l.key} type="monotone" dataKey={l.key} name={l.name || l.key} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />;
          })}
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={safeData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip {...tooltipStyle} />
        {safeLines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {safeLines.map((l, i) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name || l.key} stroke={l.color || CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function KpiPie({ data, dataKey = 'value', nameKey = 'name', height = 260, colors }: {
  data: any[];
  dataKey?: string;
  nameKey?: string;
  height?: number;
  colors?: string[];
}) {
  const safeData = Array.isArray(data) ? data : [];
  const palette = colors || CHART_COLORS;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={safeData} dataKey={dataKey} nameKey={nameKey} innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {safeData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} stroke="var(--surface-raised)" strokeWidth={2} />)}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ data, dataKey = 'value', color = '#00A7B5', height = 48 }: {
  data: any[]; dataKey?: string; color?: string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

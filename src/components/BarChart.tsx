import React, { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: DataPoint[];
  height?: number;
  title?: string;
  formatValue?: (v: number) => string;
  formatLabel?: (l: string) => string;
  accent?: string;
  showGrid?: boolean;
  animate?: boolean;
}

const DEFAULT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#F97316', '#EC4899',
];

export function BarChart({
  data, height = 160, title, formatValue, formatLabel, accent = '#3B82F6',
  showGrid = true, animate = true,
}: BarChartProps) {
  const max   = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);
  const fmt   = formatValue || ((v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`);
  const fmtL  = formatLabel || ((l: string) => l);

  if (!data.length) return null;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div>
      {title && <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>}
      <div className="relative" style={{ height }}>
        {/* Grid lines */}
        {showGrid && gridLines.map(g => (
          <div
            key={g}
            className="absolute w-full border-t border-dashed border-gray-100"
            style={{ bottom: `${g * 100}%` }}
          />
        ))}

        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-1 px-1">
          {data.map((d, i) => {
            const pct = max > 0 ? (d.value / max) * 100 : 0;
            const color = d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                {/* Tooltip on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap z-10 pointer-events-none">
                  {fmt(d.value)}
                </div>
                <div
                  className={`w-full rounded-t-lg transition-all duration-700 ${animate ? 'bar-animate' : ''}`}
                  style={{
                    height: `${Math.max(pct, 2)}%`,
                    backgroundColor: color,
                    opacity: 0.85,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex gap-1 px-1 mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-xs text-gray-500 truncate">
            {fmtL(d.label)}
          </div>
        ))}
      </div>
    </div>
  );
}

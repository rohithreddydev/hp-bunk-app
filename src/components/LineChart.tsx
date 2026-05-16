import React, { useMemo } from 'react';

interface LinePoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LinePoint[];
  height?: number;
  title?: string;
  color?: string;
  gradient?: boolean;
  showDots?: boolean;
  formatValue?: (v: number) => string;
}

export function LineChart({
  data, height = 120, title, color = '#3B82F6', gradient = true,
  showDots = true, formatValue,
}: LineChartProps) {
  const fmt = formatValue || ((v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`);

  const { pathD, fillD, points } = useMemo(() => {
    if (!data.length) return { pathD: '', fillD: '', points: [] };
    const max = Math.max(...data.map(d => d.value), 1);
    const min = Math.min(...data.map(d => d.value), 0);
    const range = max - min || 1;
    const pad = 8;
    const W = 300, H = height - 2 * pad;

    const pts = data.map((d, i) => ({
      x: data.length === 1 ? W / 2 : (i / (data.length - 1)) * W,
      y: pad + (1 - (d.value - min) / range) * H,
      value: d.value,
      label: d.label,
    }));

    // Smooth bezier curve
    let pathD = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) / 2;
      const cp1y = pts[i - 1].y;
      const cp2x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) / 2;
      const cp2y = pts[i].y;
      pathD += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${pts[i].x},${pts[i].y}`;
    }

    const fillD = `${pathD} L ${pts[pts.length - 1].x},${height} L ${pts[0].x},${height} Z`;

    return { pathD, fillD, points: pts };
  }, [data, height]);

  if (!data.length) return null;

  const gradId = `grad-${Math.random().toString(36).slice(2)}`;

  return (
    <div>
      {title && <p className="text-sm font-semibold text-gray-700 mb-2">{title}</p>}
      <div className="relative w-full overflow-hidden" style={{ height }}>
        <svg width="100%" height={height} viewBox={`0 0 300 ${height}`} preserveAspectRatio="none" className="overflow-visible">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {gradient && <path d={fillD} fill={`url(#${gradId})`} />}
          <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {showDots && points.map((p, i) => (
            <g key={i} className="group">
              <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="white" strokeWidth="1.5" />
              {/* Invisible larger hit area */}
              <circle cx={p.x} cy={p.y} r="10" fill="transparent" />
            </g>
          ))}
        </svg>
      </div>

      {/* X labels */}
      {data.length <= 12 && (
        <div className="flex justify-between px-1 mt-1">
          {data.map((d, i) => (
            <span key={i} className="text-xs text-gray-400">{d.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tiny sparkline — no labels, just the trend line */
export function Sparkline({ data, color = '#3B82F6', height = 32, width = 80 }: {
  data: number[]; color?: string; height?: number; width?: number;
}) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: data.length === 1 ? width / 2 : (i / (data.length - 1)) * width,
    y: (1 - (v - min) / range) * height,
  }));
  if (!pts.length) return null;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  const trend = data.length >= 2 ? data[data.length - 1] - data[0] : 0;
  const lineColor = trend >= 0 ? '#10B981' : '#EF4444';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

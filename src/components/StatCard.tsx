import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number | null;       // percentage change (+ up, - down, null = unknown)
  trendLabel?: string;         // "vs last week"
  icon?: React.ReactNode;
  accent?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'teal';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  onClick?: () => void;
  dark?: boolean;
}

const ACCENT_MAP = {
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   border: 'border-blue-100', trend: 'text-blue-600',   dark: 'bg-blue-900/20' },
  green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-600', border: 'border-green-100',trend: 'text-green-600',  dark: 'bg-green-900/20' },
  red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-600',     border: 'border-red-100',  trend: 'text-red-600',    dark: 'bg-red-900/20' },
  orange: { bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-600',border: 'border-orange-100',trend: 'text-orange-600',dark: 'bg-orange-900/20' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600',border: 'border-purple-100',trend: 'text-purple-600',dark: 'bg-purple-900/20' },
  teal:   { bg: 'bg-teal-50',   icon: 'bg-teal-100 text-teal-600',   border: 'border-teal-100', trend: 'text-teal-600',   dark: 'bg-teal-900/20' },
};

export function StatCard({
  title, value, subtitle, trend, trendLabel = 'vs last period',
  icon, accent = 'blue', size = 'md', loading = false, onClick, dark = false,
}: StatCardProps) {
  const a = ACCENT_MAP[accent];
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const trendIcon = trend == null ? null
    : trend > 0 ? <TrendingUp className="w-3 h-3" />
    : trend < 0 ? <TrendingDown className="w-3 h-3" />
    : <Minus className="w-3 h-3" />;

  const trendColor = trend == null ? 'text-gray-400'
    : trend > 0 ? 'text-emerald-600'
    : trend < 0 ? 'text-red-500'
    : 'text-gray-400';

  if (loading) {
    return (
      <div className={`rounded-2xl border ${a.border} ${dark ? a.dark : a.bg} p-4 animate-pulse`}>
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border ${a.border} ${dark ? a.dark : a.bg} ${isLg ? 'p-6' : isSm ? 'p-3' : 'p-4'} transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-95' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-gray-500 truncate ${isSm ? 'text-xs' : 'text-sm'}`}>{title}</p>
          <p className={`font-bold text-gray-900 mt-1 leading-none ${isLg ? 'text-3xl' : isSm ? 'text-lg' : 'text-2xl'}`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-gray-500 mt-1 ${isSm ? 'text-xs' : 'text-sm'}`}>{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={`${a.icon} rounded-xl flex-shrink-0 ml-3 ${isLg ? 'p-3' : 'p-2'}`}>
            {icon}
          </div>
        )}
      </div>

      {trend != null && (
        <div className={`flex items-center gap-1 mt-2 ${trendColor}`}>
          {trendIcon}
          <span className="text-xs font-semibold">
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
          <span className="text-xs text-gray-400 ml-1">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

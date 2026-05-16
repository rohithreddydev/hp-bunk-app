import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: { text: string; color?: 'green' | 'blue' | 'orange' | 'red' | 'gray' };
  sticky?: boolean;
}

const BADGE_MAP = {
  green:  'bg-emerald-100 text-emerald-700',
  blue:   'bg-blue-100 text-blue-700',
  orange: 'bg-orange-100 text-orange-700',
  red:    'bg-red-100 text-red-700',
  gray:   'bg-gray-100 text-gray-700',
};

export function PageHeader({ title, subtitle, icon, actions, badge, sticky = false }: PageHeaderProps) {
  return (
    <div className={`${sticky ? 'sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100' : ''} px-4 py-3 flex items-center gap-3`}>
      {icon && (
        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base font-bold text-gray-900 truncate">{title}</h1>
          {badge && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${BADGE_MAP[badge.color || 'gray']}`}>
              {badge.text}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

/** Sectioned tab bar for primary navigation */
export function TabBar({ tabs, activeTab, onChange }: {
  tabs: { id: string; label: string; icon?: React.ReactNode; badge?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex overflow-x-auto border-b border-gray-100 bg-white sticky top-0 z-10 scrollbar-hide">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
            activeTab === tab.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
          }`}
        >
          {tab.icon}
          {tab.label}
          {tab.badge != null && tab.badge > 0 && (
            <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {tab.badge > 9 ? '9+' : tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

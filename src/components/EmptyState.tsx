import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8 px-4' : 'py-16 px-6'}`}>
      {icon && (
        <div className={`${compact ? 'w-12 h-12 text-4xl mb-3' : 'w-16 h-16 text-5xl mb-4'} bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400`}>
          {icon}
        </div>
      )}
      <h3 className={`font-semibold text-gray-900 ${compact ? 'text-base' : 'text-lg'}`}>{title}</h3>
      {description && (
        <p className={`text-gray-500 mt-1 max-w-xs ${compact ? 'text-xs' : 'text-sm'}`}>{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
}

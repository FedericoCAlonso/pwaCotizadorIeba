import React from 'react';

interface KPICardProps {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'emerald' | 'sky' | 'amber' | 'tertiary';
}

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  subtext,
  icon,
  variant = 'default'
}) => {
  const variantClasses = {
    default: 'bg-surface-container-high border-outline-variant/20 text-on-surface',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    sky: 'bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-300',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300',
    tertiary: 'bg-tertiary-container/30 border-tertiary/20 text-on-tertiary-container'
  }[variant];

  return (
    <div className={`p-3.5 rounded-2xl border flex items-center justify-between shadow-xs ${variantClasses}`}>
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-medium block truncate opacity-80">{label}</span>
        <div className="text-sm font-bold font-mono truncate">{value}</div>
        {subtext && <span className="text-[10px] block truncate opacity-70 mt-0.5">{subtext}</span>}
      </div>
      {icon && <div className="ml-2 shrink-0 opacity-85">{icon}</div>}
    </div>
  );
};

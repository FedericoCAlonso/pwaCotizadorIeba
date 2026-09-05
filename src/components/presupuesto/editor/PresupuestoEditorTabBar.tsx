import React from 'react';
import {
  Building2,
  ListChecks,
  Users,
  Receipt
} from 'lucide-react';
import { PresupuestoEditorTab } from '../../../viewmodels/usePresupuestoEditorViewModel';

interface TabItem {
  id: PresupuestoEditorTab;
  label: string;
  stepNumber: string;
  icon: React.FC<{ className?: string }>;
  badge?: string | number;
}

interface PresupuestoEditorTabBarProps {
  activeTab: PresupuestoEditorTab;
  onSelectTab: (tab: PresupuestoEditorTab) => void;
  clienteNombre?: string;
  itemsCount: number;
  cuadrillaBadge?: string;
  precioFinalFormatted?: string;
}

export const PresupuestoEditorTabBar: React.FC<PresupuestoEditorTabBarProps> = ({
  activeTab,
  onSelectTab,
  clienteNombre,
  itemsCount,
  cuadrillaBadge,
  precioFinalFormatted
}) => {
  const tabs: TabItem[] = [
    {
      id: 'cliente',
      stepNumber: '1',
      label: 'Obra & Cliente',
      icon: Building2,
      badge: clienteNombre ? '✓' : undefined
    },
    {
      id: 'partidas',
      stepNumber: '2',
      label: 'Partidas & Cómputo',
      icon: ListChecks,
      badge: itemsCount > 0 ? itemsCount : undefined
    },
    {
      id: 'cuadrilla',
      stepNumber: '3',
      label: 'Cuadrilla & Gastos',
      icon: Users,
      badge: cuadrillaBadge
    },
    {
      id: 'comercial',
      stepNumber: '4',
      label: 'Cierre Comercial',
      icon: Receipt,
      badge: precioFinalFormatted
    }
  ];

  return (
    <nav
      aria-label="Etapas de la cotización"
      className="p-1.5 bg-surface-container rounded-2xl border border-outline-variant/30 flex items-center gap-1.5 overflow-x-auto scrollbar-none shadow-2xs"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`flex-1 min-w-[150px] sm:min-w-0 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              isActive
                ? 'bg-surface-container-lowest text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 font-extrabold ${
                isActive
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-highest text-on-surface-variant'
              }`}
            >
              {tab.stepNumber}
            </span>
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-on-surface-variant'}`} />
            <span className="truncate">{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-black shrink-0 ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};

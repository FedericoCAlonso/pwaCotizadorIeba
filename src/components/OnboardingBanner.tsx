import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Package, Users, Layers, FileText, CheckCircle2, ArrowRight, X, Sparkles } from 'lucide-react';

interface OnboardingBannerProps {
  onNavigateTab: (tab: 'insumos' | 'manoObra' | 'tareasTipo' | 'presupuestos' | 'clientes') => void;
}

const ONBOARDING_DISMISSED_KEY = 'ieba_onboarding_dismissed';

export const OnboardingBanner: React.FC<OnboardingBannerProps> = ({ onNavigateTab }) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === 'true';
  });

  const materialesCount = useLiveQuery(() => db.materiales.count()) || 0;
  const manoObraCount = useLiveQuery(() => db.manoObra.count()) || 0;
  const tareasCount = useLiveQuery(() => db.tareasTipo.count()) || 0;
  const presupuestosCount = useLiveQuery(() => db.presupuestos.count()) || 0;

  const steps = [
    {
      id: 'insumos',
      label: 'Catálogo de Materiales',
      description: 'Importa o agrega insumos de electricidad.',
      icon: Package,
      completed: materialesCount > 0,
      targetTab: 'insumos' as const
    },
    {
      id: 'manoObra',
      label: 'Tarifa de Mano de Obra',
      description: 'Define la tarifa horaria para tu equipo.',
      icon: Users,
      completed: manoObraCount > 0,
      targetTab: 'manoObra' as const
    },
    {
      id: 'tareasTipo',
      label: 'Laboratorio de Tareas',
      description: 'Configura ensambles tipo de instalación.',
      icon: Layers,
      completed: tareasCount > 0,
      targetTab: 'tareasTipo' as const
    },
    {
      id: 'presupuestos',
      label: 'Emitir Presupuesto',
      description: 'Crea tu primera cotización en PDF.',
      icon: FileText,
      completed: presupuestosCount > 0,
      targetTab: 'presupuestos' as const
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const isAllCompleted = completedCount === steps.length;

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
  };

  if (isDismissed) return null;

  return (
    <div className="bg-gradient-to-r from-primary/10 via-surface-container-high to-surface-container-low border border-primary/20 rounded-3xl p-4 sm:p-5 shadow-sm text-on-surface mb-6 relative animate-in fade-in duration-300">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 transition-colors"
        title="Descartar guía inicial"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/20 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary text-on-primary rounded-2xl shadow-sm shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm sm:text-base text-on-surface flex items-center gap-2">
              Guía de Configuración Inicial
              {isAllCompleted && (
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs rounded-full font-bold">
                  ¡100% Completado!
                </span>
              )}
            </h3>
            <p className="text-xs text-on-surface-variant">
              Completa los 4 pasos clave para emitir cotizaciones eléctricas precisas y rápidas.
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-32 bg-surface-container-highest rounded-full h-2 overflow-hidden border border-outline-variant/30">
            <div
              className="bg-primary h-full transition-all duration-500 rounded-full"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-primary">
            {completedCount}/{steps.length}
          </span>
        </div>
      </div>

      {/* Steps Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              onClick={() => onNavigateTab(step.targetTab)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                step.completed
                  ? 'bg-emerald-500/5 border-emerald-500/30 hover:bg-emerald-500/10'
                  : 'bg-surface-container border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-high'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl text-xs font-bold ${
                    step.completed
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-primary/10 text-primary'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {step.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <span className="text-[10px] font-mono text-on-surface-variant/70">Paso {idx + 1}</span>
                  )}
                </div>

                <h4 className="font-semibold text-xs text-on-surface group-hover:text-primary transition-colors">
                  {step.label}
                </h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">
                  {step.description}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-end text-[11px] font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                <span>{step.completed ? 'Ver lista' : 'Configurar'}</span>
                <ArrowRight className="w-3 h-3 ml-1" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

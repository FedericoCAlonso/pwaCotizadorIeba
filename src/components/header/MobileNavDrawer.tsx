import React, { useEffect } from 'react';
import { Zap, X, Download, Upload, Settings, ChevronRight } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  navItems: NavItem[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onExportJSON: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenConfig: () => void;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  navItems,
  activeTab,
  setActiveTab,
  onExportJSON,
  onImportJSON,
  onOpenConfig
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('mobile-drawer-open');
    } else {
      document.body.classList.remove('mobile-drawer-open');
    }
    return () => {
      document.body.classList.remove('mobile-drawer-open');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="relative bg-surface-container border-t border-outline-variant/30 rounded-t-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 pb-safe pb-8 animate-in slide-in-from-bottom duration-300"
      >
        {/* Drag handle pill */}
        <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-3 mb-2 shrink-0" />

        <div className="px-5 py-3 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" aria-hidden="true" />
            <h3 id="drawer-title" className="font-bold text-base text-on-surface">Herramientas & Módulos IEBA</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-variant cursor-pointer"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 touch-pan-y overscroll-contain">
          {/* Navigation Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    onClose();
                  }}
                  className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-all min-h-[56px] border cursor-pointer ${
                    isActive
                      ? 'bg-secondary-container text-on-secondary-container border-primary/30 shadow-xs'
                      : 'bg-surface-container-low hover:bg-surface-container-high border-outline-variant/20 text-on-surface'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${isActive ? 'bg-primary/20 text-primary' : 'bg-surface-variant text-on-surface-variant'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold block truncate">{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Utility Actions */}
          <div className="pt-3 border-t border-outline-variant/30 space-y-2">
            <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-1">
              Acciones Rápidas
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onExportJSON();
                  onClose();
                }}
                className="flex items-center gap-2 p-3 bg-surface-container-low hover:bg-surface-container-high rounded-2xl border border-outline-variant/20 text-xs font-medium text-on-surface min-h-[48px] cursor-pointer"
              >
                <Download className="w-4 h-4 text-primary" />
                <span>Respaldar JSON</span>
              </button>

              <label className="flex items-center gap-2 p-3 bg-surface-container-low hover:bg-surface-container-high rounded-2xl border border-outline-variant/20 text-xs font-medium text-on-surface cursor-pointer min-h-[48px]">
                <Upload className="w-4 h-4 text-primary" />
                <span>Restaurar JSON</span>
                <input type="file" accept=".json" onChange={onImportJSON} className="hidden" />
              </label>
            </div>

            <button
              onClick={() => {
                onOpenConfig();
                onClose();
              }}
              className="w-full flex items-center justify-between p-3.5 bg-surface-container-low hover:bg-surface-container-high rounded-2xl border border-outline-variant/20 text-xs font-semibold text-on-surface min-h-[48px] cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-primary" />
                <span>Configuración General & Moneda</span>
              </div>
              <ChevronRight className="w-4 h-4 text-on-surface-variant" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

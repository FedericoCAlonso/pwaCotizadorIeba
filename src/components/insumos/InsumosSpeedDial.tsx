import React from 'react';
import { Zap, FileText, Layers, Plus } from 'lucide-react';

interface InsumosSpeedDialProps {
  isSpeedDialOpen: boolean;
  setIsSpeedDialOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeTab: string;
  onOpenQuickCreateMat: () => void;
  onOpenCreateMat: () => void;
  onOpenCreateCat: () => void;
}

export const InsumosSpeedDial: React.FC<InsumosSpeedDialProps> = ({
  isSpeedDialOpen,
  setIsSpeedDialOpen,
  activeTab,
  onOpenQuickCreateMat,
  onOpenCreateMat,
  onOpenCreateCat
}) => {
  return (
    <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-30 floating-action-btn flex flex-col items-end gap-2.5">
      {isSpeedDialOpen && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-2xs z-20"
          onClick={() => setIsSpeedDialOpen(false)}
        />
      )}

      {isSpeedDialOpen && (
        <div className="flex flex-col items-end gap-2.5 z-30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1.5 rounded-xl bg-surface-container-high text-xs font-semibold text-on-surface shadow-md border border-outline-variant/30 select-none">
              Alta Rápida (1 Clic)
            </span>
            <button
              type="button"
              onClick={() => {
                onOpenQuickCreateMat();
                setIsSpeedDialOpen(false);
              }}
              className="w-12 h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
              title="Alta Rápida de Material"
            >
              <Zap className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1.5 rounded-xl bg-surface-container-high text-xs font-semibold text-on-surface shadow-md border border-outline-variant/30 select-none">
              Ficha Técnica Completa
            </span>
            <button
              type="button"
              onClick={() => {
                onOpenCreateMat();
                setIsSpeedDialOpen(false);
              }}
              className="w-12 h-12 rounded-2xl bg-primary hover:bg-primary/90 text-on-primary flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
              title="Nuevo Material (Ficha Completa)"
            >
              <FileText className="w-5 h-5" />
            </button>
          </div>

          {activeTab === 'categorias' && (
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1.5 rounded-xl bg-surface-container-high text-xs font-semibold text-on-surface shadow-md border border-outline-variant/30 select-none">
                Nueva Categoría
              </span>
              <button
                type="button"
                onClick={() => {
                  onOpenCreateCat();
                  setIsSpeedDialOpen(false);
                }}
                className="w-12 h-12 rounded-2xl bg-secondary hover:bg-secondary/90 text-on-secondary flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
                title="Nueva Categoría"
              >
                <Layers className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (activeTab === 'categorias' && !isSpeedDialOpen) {
            setIsSpeedDialOpen(true);
          } else {
            setIsSpeedDialOpen((prev) => !prev);
          }
        }}
        className={`w-14 h-14 rounded-2xl md:rounded-3xl bg-primary hover:bg-primary/90 text-on-primary shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center transition-all z-30 cursor-pointer ${
          isSpeedDialOpen ? 'bg-primary-container text-on-primary-container' : ''
        }`}
        aria-label={isSpeedDialOpen ? 'Cerrar opciones' : 'Nuevo material o ficha'}
        title="Nuevo Material / Alta Rápida"
      >
        <Plus
          className={`w-7 h-7 transition-transform duration-200 ${
            isSpeedDialOpen ? 'rotate-45' : ''
          }`}
        />
      </button>
    </div>
  );
};

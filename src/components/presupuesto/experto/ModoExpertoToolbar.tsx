import React from 'react';
import { Plus, Zap, Package, FolderPlus, Truck } from 'lucide-react';

interface ModoExpertoToolbarProps {
  createToolbarAction: (action: () => void) => {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onClick: (e: React.MouseEvent) => void;
  };
  insertSnippet: (snippet: string) => void;
  onOpenMultiMaterialModal: () => void;
  onOpenGastosModal: () => void;
  onNavigateField: (direction?: 'forward' | 'backward') => void;
}

export const ModoExpertoToolbar: React.FC<ModoExpertoToolbarProps> = ({
  createToolbarAction,
  insertSnippet,
  onOpenMultiMaterialModal,
  onOpenGastosModal,
  onNavigateField
}) => {
  return (
    <div className="expert-toolbar flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
      <button
        type="button"
        {...createToolbarAction(() => insertSnippet('\n  - 1 u '))}
        className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface-variant hover:text-on-surface font-semibold flex items-center gap-1 border border-outline-variant/20 transition shrink-0 cursor-pointer min-h-[34px]"
      >
        <Plus className="w-3.5 h-3.5 text-primary" />
        <span>+ Partida</span>
      </button>

      <button
        type="button"
        {...createToolbarAction(() =>
          insertSnippet(
            '\n  - 1 u Reparación y Armado de Tablero:\n      materiales:\n        - Tablero Modular DIN 24 Módulos Superficie Chapa Metálica Puerta Ciega IP40:\n            cantidad: 1\n            marca: Gabexel\n      mano_obra:\n        - 4 h Oficial Electricista\n'
          )
        )}
        className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold flex items-center gap-1 border border-primary/30 transition shrink-0 cursor-pointer min-h-[34px]"
        title="Crea una partida a medida con cómputo de materiales y mano de obra"
      >
        <Zap className="w-3.5 h-3.5" />
        <span>+ Partida APU</span>
      </button>

      <button
        type="button"
        {...createToolbarAction(onOpenMultiMaterialModal)}
        className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-primary font-bold flex items-center gap-1 border border-outline-variant/20 transition shrink-0 cursor-pointer min-h-[34px]"
        title="Abre la paleta para seleccionar múltiples insumos con cantidades (Alt + M)"
      >
        <Package className="w-3.5 h-3.5" />
        <span>📦 Paleta Insumos</span>
        <kbd className="hidden sm:inline text-[10px] opacity-70 font-mono">Alt+M</kbd>
      </button>

      <button
        type="button"
        {...createToolbarAction(() => insertSnippet('\nCapítulo Nuevo:\n  - 1 u '))}
        className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface-variant hover:text-on-surface font-semibold flex items-center gap-1 border border-outline-variant/20 transition shrink-0 cursor-pointer min-h-[34px]"
      >
        <FolderPlus className="w-3.5 h-3.5 text-secondary" />
        <span>+ Capítulo</span>
      </button>

      <button
        type="button"
        {...createToolbarAction(onOpenGastosModal)}
        className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1 border border-outline-variant/20 transition shrink-0 cursor-pointer min-h-[34px]"
        title="Abre el catálogo completo de gastos y modificadores de costo (Alt + G)"
      >
        <Truck className="w-3.5 h-3.5" />
        <span>🏷️ Catálogo Gastos</span>
        <kbd className="hidden sm:inline text-[10px] opacity-70 font-mono">Alt+G</kbd>
      </button>

      <button
        type="button"
        {...createToolbarAction(() =>
          insertSnippet('\ncalculos:\n  superficie: 120\n  bocas: =ceil(superficie / 6)\n  cable_m: =bocas * 12\n')
        )}
        className="px-2.5 py-1.5 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-xl font-bold flex items-center gap-1 border border-secondary/30 transition shrink-0 cursor-pointer min-h-[34px]"
        title="Define bloque de variables y fórmulas de cálculo en cascada"
      >
        <span className="font-mono text-sm font-black">=</span>
        <span>+ Cálculos</span>
      </button>

      {/* Accesorio de Teclado Rápido para móvil y tipeo ágil */}
      <div className="h-5 w-[1px] bg-outline-variant/30 shrink-0 mx-0.5" />

      <button
        type="button"
        {...createToolbarAction(() => insertSnippet('  '))}
        className="px-2 py-1 bg-surface-container-high hover:bg-surface-container-highest rounded-lg text-on-surface font-mono text-[11px] font-bold border border-outline-variant/30 transition shrink-0 cursor-pointer min-h-[32px]"
        title="Insertar sangría (2 espacios)"
      >
        Tab
      </button>

      <button
        type="button"
        {...createToolbarAction(() => insertSnippet(': '))}
        className="px-2 py-1 bg-surface-container-high hover:bg-surface-container-highest rounded-lg text-on-surface font-mono text-[11px] font-bold border border-outline-variant/30 transition shrink-0 cursor-pointer min-h-[32px]"
        title="Insertar dos puntos"
      >
        :
      </button>

      <button
        type="button"
        {...createToolbarAction(() => insertSnippet('- '))}
        className="px-2 py-1 bg-surface-container-high hover:bg-surface-container-highest rounded-lg text-on-surface font-mono text-[11px] font-bold border border-outline-variant/30 transition shrink-0 cursor-pointer min-h-[32px]"
        title="Insertar guión de lista"
      >
        -
      </button>

      <button
        type="button"
        {...createToolbarAction(() => insertSnippet('='))}
        className="px-2 py-1 bg-surface-container-high hover:bg-surface-container-highest rounded-lg text-primary font-mono text-[11px] font-bold border border-outline-variant/30 transition shrink-0 cursor-pointer min-h-[32px]"
        title="Insertar fórmula o variable"
      >
        =
      </button>

      <button
        type="button"
        {...createToolbarAction(() => insertSnippet('# '))}
        className="px-2 py-1 bg-surface-container-high hover:bg-surface-container-highest rounded-lg text-on-surface font-mono text-[11px] font-bold border border-outline-variant/30 transition shrink-0 cursor-pointer min-h-[32px]"
        title="Insertar comentario"
      >
        #
      </button>

      <button
        type="button"
        {...createToolbarAction(() => onNavigateField('forward'))}
        className="px-2.5 py-1 bg-primary/15 hover:bg-primary/25 text-primary rounded-lg font-bold text-[11px] border border-primary/30 transition shrink-0 cursor-pointer min-h-[32px] flex items-center gap-1"
        title="Saltar al siguiente campo editable (Alt + Enter)"
      >
        <span>⏭ Campo</span>
        <kbd className="hidden sm:inline text-[9px] opacity-75 font-mono">Alt+Enter</kbd>
      </button>
    </div>
  );
};

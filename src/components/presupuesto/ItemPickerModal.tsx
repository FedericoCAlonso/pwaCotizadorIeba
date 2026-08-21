import React, { useState, useEffect, useRef } from 'react';
import { Layers, X, Search, Sliders, Plus, CornerDownLeft } from 'lucide-react';
import { TareaTipo, Insumo, CategoriaManoDeObra } from '../../core/types';
import { calcularCostoTareaTipo, formatARS } from '../../core/calculations';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ItemPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tareasTipo: TareaTipo[];
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  onSelectTarea: (tarea: TareaTipo) => void;
  onConfigureParametricTarea?: (tarea: TareaTipo) => void;
}

export const ItemPickerModal: React.FC<ItemPickerModalProps> = ({
  isOpen,
  onClose,
  tareasTipo,
  insumosMap,
  manoObraMap,
  onSelectTarea,
  onConfigureParametricTarea,
}) => {
  useEscapeKey(isOpen, onClose);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const filteredTareas = tareasTipo.filter(
    (t) =>
      t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  const handleSelect = (tarea: TareaTipo) => {
    if (tarea.esParametrico && onConfigureParametricTarea) {
      onConfigureParametricTarea(tarea);
    } else {
      onSelectTarea(tarea);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredTareas.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = Math.min(prev + 1, filteredTareas.length - 1);
        itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = Math.max(prev - 1, 0);
        itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredTareas[selectedIndex];
      if (target) {
        handleSelect(target);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-on-surface"
        onKeyDown={handleKeyDown}
      >
        <div className="px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between">
          <h3 className="font-semibold text-on-surface text-base flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <span>Seleccionar Tarea Tipo del Catálogo</span>
          </h3>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-variant transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-outline-variant/20 bg-surface-container-low">
          <div className="relative">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar tarea por nombre o categoría... (usa ↑ ↓ y Enter)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl pl-9 pr-4 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {filteredTareas.length === 0 ? (
            <p className="text-center text-on-surface-variant text-sm py-8">
              {searchTerm
                ? 'No se encontraron tareas tipo con ese nombre.'
                : 'No hay Tareas Tipo cargadas en el catálogo. Puedes cargarlas desde la pestaña "Tareas Tipo".'}
            </p>
          ) : (
            filteredTareas.map((tarea, idx) => {
              const cost = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);
              const isHighlighted = idx === selectedIndex;
              return (
                <div
                  key={tarea.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  onClick={() => handleSelect(tarea)}
                  className={`border p-4 rounded-2xl cursor-pointer transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 group ${
                    isHighlighted
                      ? 'bg-primary/10 border-primary shadow-sm'
                      : 'bg-surface-container-low border-outline-variant/20 hover:border-primary/50 hover:bg-surface-container/80'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-on-tertiary-container bg-tertiary-container px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {tarea.categoria}
                      </span>
                      {tarea.esParametrico && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md flex items-center gap-1 select-none font-mono">
                          <Sliders className="w-3 h-3" />
                          <span>Paramétrico</span>
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-on-surface-variant">
                        /{tarea.unidad}
                      </span>
                    </div>
                    <h4 className="font-bold text-on-surface group-hover:text-primary transition-colors mt-1">
                      {tarea.nombre}
                    </h4>
                    <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-3">
                      <span>Insumos: {cost.insumosSnapshotUnitario.length}</span>
                      <span>•</span>
                      <span>MO: {cost.manoObraSnapshotUnitario.reduce((acc, m) => acc + m.horasTotales, 0)} hs</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider block">
                        Costo Base Unit.
                      </span>
                      <span className="font-mono text-base font-bold text-primary">
                        {formatARS(cost.costoDirectoUnitario)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(tarea.parametros && tarea.parametros.length > 0) || (tarea.variables && tarea.variables.length > 0) || tarea.esParametrico ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(tarea);
                          }}
                          className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-on-primary rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition"
                          title="Configurar parámetros de este trabajo tipo"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Configurar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(tarea);
                          }}
                          className={`p-2 rounded-xl transition ${
                            isHighlighted
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-variant hover:bg-primary hover:text-on-primary text-on-surface-variant'
                          }`}
                          title="Agregar ítem al presupuesto"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Keyboard Helper Footer */}
        <div className="px-6 py-2.5 bg-surface-container-low border-t border-outline-variant/20 flex items-center justify-between text-[11px] text-on-surface-variant">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-surface-container-highest rounded border border-outline-variant/30 font-mono text-[10px]">↑</kbd> <kbd className="px-1.5 py-0.5 bg-surface-container-highest rounded border border-outline-variant/30 font-mono text-[10px]">↓</kbd> Navegar</span>
            <span><kbd className="px-1.5 py-0.5 bg-surface-container-highest rounded border border-outline-variant/30 font-mono text-[10px]">Enter</kbd> Seleccionar</span>
            <span><kbd className="px-1.5 py-0.5 bg-surface-container-highest rounded border border-outline-variant/30 font-mono text-[10px]">Esc</kbd> Cerrar</span>
          </div>
          <span className="font-medium">{filteredTareas.length} disponibles</span>
        </div>
      </div>
    </div>
  );
};

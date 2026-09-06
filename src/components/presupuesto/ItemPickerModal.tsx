import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layers, X, Search, Sliders, Plus, GraduationCap, Truck, FolderPlus } from 'lucide-react';
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
  onAddCustomItem?: (descripcion: string) => void;
  onAddCapitulo?: (nombre?: string) => void;
}

export const ItemPickerModal: React.FC<ItemPickerModalProps> = ({
  isOpen,
  onClose,
  tareasTipo,
  insumosMap,
  manoObraMap,
  onSelectTarea,
  onConfigureParametricTarea,
  onAddCustomItem,
  onAddCapitulo
}) => {
  useEscapeKey(isOpen, onClose);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Categorías disponibles
  const categorias = useMemo(() => {
    const set = new Set<string>();
    tareasTipo.forEach((t) => {
      if (t.categoria) set.add(t.categoria);
    });
    return ['todas', ...Array.from(set)];
  }, [tareasTipo]);

  const filteredTareas = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return tareasTipo.filter((t) => {
      const matchCat = selectedCategoria === 'todas' || t.categoria === selectedCategoria;
      const matchSearch =
        !q ||
        t.nombre.toLowerCase().includes(q) ||
        t.categoria.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [tareasTipo, searchTerm, selectedCategoria]);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedCategoria('todas');
      setSelectedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm.trim() && filteredTareas.length === 0) {
      setSelectedIndex(-1);
    } else {
      setSelectedIndex(0);
    }
  }, [searchTerm, filteredTareas.length]);

  const handleSelect = (tarea: TareaTipo) => {
    const isParametricJob = Boolean(
      tarea.esParametrico ||
      (tarea.parametros && tarea.parametros.length > 0) ||
      (tarea.variables && tarea.variables.length > 0) ||
      tarea.formulaHonorarios
    );

    if (isParametricJob && onConfigureParametricTarea) {
      onConfigureParametricTarea(tarea);
    } else {
      onSelectTarea(tarea);
    }
    onClose();
  };

  const handleCreateCustom = (desc: string) => {
    if (onAddCustomItem) {
      onAddCustomItem(desc);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Shift + Enter -> crear ítem libre siempre con el texto escrito
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleCreateCustom(searchTerm.trim());
      return;
    }

    // Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex === -1 || filteredTareas.length === 0) {
        handleCreateCustom(searchTerm.trim());
        return;
      }

      const target = filteredTareas[selectedIndex];
      if (target) {
        handleSelect(target);
      }
      return;
    }

    if (filteredTareas.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = Math.min(prev + 1, filteredTareas.length - 1);
        if (next >= 0) {
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        }
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const minIndex = searchTerm.trim() ? -1 : 0;
        const next = Math.max(prev - 1, minIndex);
        if (next >= 0) {
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        }
        return next;
      });
    }
  };

  if (!isOpen) return null;

  const hasSearch = searchTerm.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="bg-surface-container border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] text-on-surface pb-safe"
        onKeyDown={handleKeyDown}
      >
        {/* Mobile drag bar */}
        <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-outline-variant/30 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-on-surface text-sm sm:text-base leading-snug truncate">
                Agregar Partida a la Cotización
              </h3>
              <p className="text-xs text-on-surface-variant hidden sm:block">
                Escribí para crear una partida libre o seleccioná una tarea del catálogo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-2 rounded-full hover:bg-surface-variant transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Omnibar */}
        <div className="p-3 sm:p-4 border-b border-outline-variant/20 bg-surface-container-low shrink-0 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar en catálogo o escribir nombre para ítem libre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all min-h-[42px]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-2.5 text-on-surface-variant hover:text-on-surface p-1"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Categorías Filter Chips */}
          {categorias.length > 2 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x overscroll-contain pb-0.5">
              {categorias.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedCategoria(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                    selectedCategoria === cat
                      ? 'bg-primary text-on-primary border-transparent shadow-2xs'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant border-outline-variant/30'
                  }`}
                >
                  {cat === 'todas' ? 'Todas las Categorías' : cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {/* Opción Dinámica: Crear como Ítem Libre o Capítulo */}
          {hasSearch ? (
            <div className="space-y-2">
              <div
                onClick={() => handleCreateCustom(searchTerm.trim())}
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-2xs ${
                  selectedIndex === -1
                    ? 'bg-primary/15 border-primary shadow-sm ring-2 ring-primary/30'
                    : 'bg-primary/5 border-dashed border-primary/40 hover:bg-primary/10'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-primary text-on-primary shrink-0 shadow-2xs">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary block">
                      Crear como Ítem Libre
                    </span>
                    <span className="text-sm sm:text-base font-bold text-on-surface truncate block">
                      "{searchTerm.trim()}"
                    </span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-primary bg-surface-container px-2.5 py-1 rounded-lg border border-outline-variant/30 shrink-0">
                  {filteredTareas.length === 0 || selectedIndex === -1 ? 'Enter ↵' : 'Shift+Enter'}
                </span>
              </div>

              {onAddCapitulo && (
                <div
                  onClick={() => {
                    onAddCapitulo(searchTerm.trim());
                    onClose();
                  }}
                  className="p-2.5 sm:p-3 rounded-2xl bg-surface-container-high/60 hover:bg-surface-container-highest border border-outline-variant/30 transition-all flex items-center justify-between gap-3 cursor-pointer group text-on-surface"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-xl bg-secondary/15 text-secondary shrink-0 group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                      <FolderPlus className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold uppercase tracking-wider text-secondary block">
                        Crear como Capítulo / Ambiente
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-on-surface truncate block">
                        "{searchTerm.trim()}"
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-secondary bg-secondary/10 px-2.5 py-1 rounded-lg shrink-0">
                    + Capítulo
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className={`grid gap-2.5 ${onAddCapitulo ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              <div
                onClick={() => handleCreateCustom('')}
                className="p-3 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 transition-all flex items-center justify-between gap-2.5 cursor-pointer text-on-surface group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-bold block truncate">
                      Partida en Blanco (Ítem Libre)
                    </span>
                    <span className="text-xs text-on-surface-variant block truncate">
                      Cargar descripción y costos directo
                    </span>
                  </div>
                </div>
                <span className="text-xs font-mono text-on-surface-variant opacity-60 hidden sm:inline shrink-0">
                  Shift+↵
                </span>
              </div>

              {onAddCapitulo && (
                <div
                  onClick={() => {
                    onAddCapitulo();
                    onClose();
                  }}
                  className="p-3 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 transition-all flex items-center justify-between gap-2.5 cursor-pointer text-on-surface group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-secondary/15 text-secondary shrink-0 group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                      <FolderPlus className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold block truncate">
                        Nuevo Capítulo / Ambiente
                      </span>
                      <span className="text-xs text-on-surface-variant block truncate">
                        Sección para agrupar partidas
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-lg shrink-0">
                    + Agrupar
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Separador de Sección */}
          <div className="flex items-center justify-between pt-2 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Tareas del Catálogo ({filteredTareas.length})
            </span>
            {hasSearch && filteredTareas.length > 0 && (
              <span className="text-xs text-on-surface-variant font-mono">
                Presioná ↓ para navegar
              </span>
            )}
          </div>

          {/* Lista de Tareas Tipo del Catálogo */}
          {filteredTareas.length === 0 ? (
            <div className="text-center py-8 px-4 bg-surface-container-low rounded-2xl border border-outline-variant/20 space-y-1.5">
              <p className="text-xs sm:text-sm font-medium text-on-surface">
                No hay tareas en el catálogo que coincidan con "{searchTerm}".
              </p>
              <p className="text-xs text-on-surface-variant">
                Presioná <strong>Enter</strong> para crearla como <strong>ítem libre</strong> con este nombre.
              </p>
            </div>
          ) : (
            filteredTareas.map((tarea, idx) => {
              const cost = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);
              const isHighlighted = idx === selectedIndex;
              const isParametrico = Boolean(
                tarea.esParametrico ||
                (tarea.parametros && tarea.parametros.length > 0) ||
                (tarea.variables && tarea.variables.length > 0) ||
                tarea.formulaHonorarios
              );

              return (
                <div
                  key={tarea.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  onClick={() => handleSelect(tarea)}
                  className={`border p-3.5 sm:p-4 rounded-2xl cursor-pointer transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 group shadow-2xs ${
                    isHighlighted
                      ? 'bg-primary/10 border-primary shadow-sm ring-1 ring-primary/40'
                      : 'bg-surface-container-low border-outline-variant/20 hover:border-primary/50 hover:bg-surface-container/80'
                  }`}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-on-tertiary-container bg-tertiary-container px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {tarea.categoria}
                      </span>
                      {tarea.naturaleza === 'servicio_profesional' ? (
                        <span className="text-xs font-bold text-purple-800 dark:text-purple-200 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 select-none font-mono">
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>Servicio Profesional</span>
                        </span>
                      ) : tarea.naturaleza === 'servicio_tercerizado' ? (
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 select-none font-mono">
                          <Truck className="w-3.5 h-3.5" />
                          <span>Tercerizado</span>
                        </span>
                      ) : isParametrico ? (
                        <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md flex items-center gap-1 select-none font-mono">
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Paramétrico</span>
                        </span>
                      ) : null}
                      <span className="text-xs font-mono text-on-surface-variant font-bold">
                        /{tarea.unidad || 'u'}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm sm:text-base text-on-surface group-hover:text-primary transition-colors leading-snug">
                      {tarea.nombre}
                    </h4>

                    <div className="text-xs text-on-surface-variant flex items-center gap-3">
                      {tarea.naturaleza === 'servicio_profesional' ? (
                        <span className="font-medium text-purple-700 dark:text-purple-300">
                          Honorarios: {formatARS(cost.costoServiciosUnitario || 0)}
                          {cost.insumosSnapshotUnitario.length > 0 ? ` • Insumos: ${cost.insumosSnapshotUnitario.length}` : ''}
                        </span>
                      ) : (
                        <>
                          <span>Insumos: {cost.insumosSnapshotUnitario.length}</span>
                          <span>•</span>
                          <span>MO: {cost.manoObraSnapshotUnitario.reduce((acc, m) => acc + m.horasTotales, 0)} hs</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-on-surface-variant uppercase tracking-wider block font-semibold">
                        Costo Directo
                      </span>
                      <span className="font-mono text-base font-bold text-primary">
                        {formatARS(cost.costoDirectoUnitario)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isParametrico ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(tarea);
                          }}
                          className="px-3 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95"
                          title="Configurar variables de este trabajo tipo"
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
                          className={`px-3 py-2 rounded-xl transition flex items-center gap-1 text-xs font-bold active:scale-95 ${
                            isHighlighted
                              ? 'bg-primary text-on-primary shadow-xs'
                              : 'bg-primary/10 hover:bg-primary hover:text-on-primary text-primary'
                          }`}
                          title="Agregar partida a la cotización"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Agregar</span>
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
        <div className="px-4 sm:px-6 py-2.5 bg-surface-container-low border-t border-outline-variant/20 hidden sm:flex items-center justify-between text-xs text-on-surface-variant shrink-0">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-surface-container-highest rounded border border-outline-variant/30 font-mono text-xs">↑</kbd>{' '}
              <kbd className="px-1.5 py-0.5 bg-surface-container-highest rounded border border-outline-variant/30 font-mono text-xs">↓</kbd>{' '}
              Navegar
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-surface-container-highest rounded border border-outline-variant/30 font-mono text-xs">Enter</kbd>{' '}
              Seleccionar / Crear
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-surface-container-highest rounded border border-outline-variant/30 font-mono text-xs">Shift + Enter</kbd>{' '}
              Ítem Libre
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-surface-container-highest rounded border border-outline-variant/30 font-mono text-xs">Esc</kbd>{' '}
              Cerrar
            </span>
          </div>
          <span className="font-semibold">{filteredTareas.length} en catálogo</span>
        </div>
      </div>
    </div>
  );
};

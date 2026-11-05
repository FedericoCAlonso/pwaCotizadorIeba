import React, { useState, useMemo } from 'react';
import { X, Search, Briefcase, Package, Zap, ChevronRight, Check } from 'lucide-react';
import { TareaTipo, Insumo, CategoriaManoDeObra } from '../../../core/types';
import { calcularCostoTareaTipo, formatARS } from '../../../core/calculations';

export interface InsertarTrabajoTipoModalProps {
  isOpen: boolean;
  onClose: () => void;
  tareasTipo: TareaTipo[];
  insumosMap?: Map<string, Insumo>;
  manoObraMap?: Map<string, CategoriaManoDeObra>;
  onInsertTrabajoTipo: (tarea: TareaTipo, multiplier: number) => void;
}

/**
 * InsertarTrabajoTipoModal: Modal para seleccionar un trabajo tipo del catálogo
 * y expandirlo en líneas editables de materiales y mano de obra dentro del ítem (Fase 3 - Inciso b).
 */
export const InsertarTrabajoTipoModal: React.FC<InsertarTrabajoTipoModalProps> = ({
  isOpen,
  onClose,
  tareasTipo = [],
  insumosMap,
  manoObraMap,
  onInsertTrabajoTipo
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [selectedTareaId, setSelectedTareaId] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState<string>('1');

  // Categorías únicas
  const categorias = useMemo(() => {
    const set = new Set<string>();
    tareasTipo.forEach((t) => {
      if (t.categoria) set.add(t.categoria);
    });
    return Array.from(set).sort();
  }, [tareasTipo]);

  // Filtrado de tareas
  const filteredTareas = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    return tareasTipo.filter((t) => {
      const matchCat =
        selectedCategory === 'todas' ||
        (t.categoria || '').toLowerCase() === selectedCategory.toLowerCase();
      const matchSearch =
        !query ||
        t.nombre.toLowerCase().includes(query) ||
        (t.categoria || '').toLowerCase().includes(query);
      return matchCat && matchSearch;
    });
  }, [tareasTipo, searchTerm, selectedCategory]);

  const selectedTarea = useMemo(() => {
    return tareasTipo.find((t) => t.id === selectedTareaId) || null;
  }, [tareasTipo, selectedTareaId]);

  // Costo estimado de la tarea seleccionada
  const selectedCost = useMemo(() => {
    if (!selectedTarea) return null;
    const iMap = insumosMap || new Map();
    const moMap = manoObraMap || new Map();
    return calcularCostoTareaTipo(selectedTarea, iMap, moMap);
  }, [selectedTarea, insumosMap, manoObraMap]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedTarea) return;
    const multNum = Math.max(0.001, Number(multiplier.replace(',', '.')) || 1);
    onInsertTrabajoTipo(selectedTarea, multNum);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-insert-trabajo-title"
    >
      <div className="relative w-full max-w-2xl bg-surface-container-high rounded-2xl shadow-2xl border border-outline-variant/30 flex flex-col max-h-[90vh] overflow-hidden">
        {/* ─── Cabecera ─── */}
        <div className="flex items-center justify-between px-4 py-3 bg-surface-container border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Briefcase className="w-5 h-5" />
            </span>
            <div>
              <h2 id="modal-insert-trabajo-title" className="text-sm font-bold text-on-surface">
                Insertar Trabajo Tipo en el Ítem
              </h2>
              <p className="text-xs text-on-surface-variant">
                Seleccioná una tarea tipo para expandir sus insumos y mano de obra en líneas editables.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── Filtros de Búsqueda y Categorías ─── */}
        <div className="p-3 bg-surface-container/50 border-b border-outline-variant/20 flex flex-col gap-2">
          {/* Barra de búsqueda */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant/60" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar trabajo tipo por nombre..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-container-lowest border border-outline-variant/40 rounded-xl outline-hidden focus:border-primary text-on-surface placeholder:text-on-surface-variant/50"
            />
          </div>

          {/* Categorías Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory('todas')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap cursor-pointer transition-all ${
                selectedCategory === 'todas'
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              Todas ({tareasTipo.length})
            </button>
            {categorias.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap cursor-pointer transition-all ${
                  selectedCategory.toLowerCase() === cat.toLowerCase()
                    ? 'bg-primary text-on-primary shadow-2xs'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Lista de Trabajos Tipo ─── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 divide-y divide-outline-variant/10">
          {filteredTareas.length === 0 ? (
            <div className="text-center py-10 text-xs text-on-surface-variant/60">
              No se encontraron trabajos tipo con los criterios de búsqueda.
            </div>
          ) : (
            filteredTareas.map((tarea) => {
              const isSelected = selectedTareaId === tarea.id;
              const insCount = tarea.insumos?.length || 0;
              const moCount = tarea.manoObra?.length || 0;

              return (
                <div
                  key={tarea.id}
                  onClick={() => setSelectedTareaId(tarea.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-primary/10 border-primary shadow-xs'
                      : 'bg-surface-container-lowest/60 border-outline-variant/30 hover:bg-surface-container-highest/60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-on-surface truncate">
                        {tarea.nombre}
                      </span>
                      {tarea.categoria && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary/10 text-secondary font-medium">
                          {tarea.categoria}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3 text-primary" />
                        {insCount} {insCount === 1 ? 'material' : 'materiales'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-secondary" />
                        {moCount} {moCount === 1 ? 'labor' : 'labores MO'}
                      </span>
                      <span className="font-mono text-on-surface-variant/70">
                        Unidad: {tarea.unidad || 'u'}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-primary border-primary text-on-primary'
                          : 'border-outline-variant/50 text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ─── Footer con Multiplicador y Acción de Inserción ─── */}
        <div className="p-3 bg-surface-container border-t border-outline-variant/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-on-surface-variant">
              Multiplicador:
            </label>
            <input
              type="text"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              className="w-16 px-2 py-1 text-xs text-right font-mono bg-surface-container-lowest border border-outline-variant/40 rounded-lg outline-hidden focus:border-primary text-on-surface"
              placeholder="1"
            />
            {selectedCost && (
              <span className="text-xs text-on-surface-variant/80 ml-2 hidden sm:inline">
                Costo estimado: <strong className="font-mono text-secondary">{formatARS(selectedCost.costoDirectoUnitario * (Number(multiplier.replace(',', '.')) || 1))}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!selectedTarea}
              onClick={handleConfirm}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-primary text-on-primary shadow-xs hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Insertar en este Ítem</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

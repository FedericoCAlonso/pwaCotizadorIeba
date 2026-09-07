import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Check, Package, Layers, Plus, Minus, CornerDownLeft } from 'lucide-react';
import { Insumo } from '../../../core/types';
import { normalizeString, scoreSearchMatch } from './dslParser';

interface MultiMaterialPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  insumosMap: Map<string, Insumo>;
  onInsertMaterials: (formattedYamlLines: string) => void;
  currentIndent?: string;
}

export const MultiMaterialPickerModal: React.FC<MultiMaterialPickerModalProps> = ({
  isOpen,
  onClose,
  insumosMap,
  onInsertMaterials,
  currentIndent = '      '
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, { quantity: number; unit: string }>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Extraer insumos ordenados y categorías únicas
  const allInsumos = useMemo(() => Array.from(insumosMap.values()), [insumosMap]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    allInsumos.forEach((ins) => {
      if (ins.categoria) set.add(ins.categoria);
    });
    return Array.from(set).sort();
  }, [allInsumos]);

  // Filtrado reactivo de insumos
  const filteredInsumos = useMemo(() => {
    let pool = allInsumos;
    if (selectedCategory) {
      pool = pool.filter((ins) => ins.categoria === selectedCategory);
    }
    if (!searchTerm.trim()) {
      return pool;
    }

    return pool
      .map((ins) => ({
        insumo: ins,
        score: scoreSearchMatch({
          query: searchTerm,
          title: ins.nombre,
          category: ins.categoria,
          extraText: `${ins.marca || ''} ${ins.unidad || ''} ${ins.notas || ''}`
        })
      }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.insumo);
  }, [allInsumos, selectedCategory, searchTerm]);

  // Focus inicial
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
      setSelectedCategory(null);
      setSelectedItems({});
    }
  }, [isOpen]);

  // Manejo de atajo Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleItem = (insumo: Insumo) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[insumo.id]) {
        delete next[insumo.id];
      } else {
        next[insumo.id] = { quantity: 1, unit: insumo.unidad || 'u' };
      }
      return next;
    });
  };

  const updateQuantity = (insumoId: string, qty: number, unit: string) => {
    if (qty <= 0) {
      setSelectedItems((prev) => {
        const next = { ...prev };
        delete next[insumoId];
        return next;
      });
    } else {
      setSelectedItems((prev) => ({
        ...prev,
        [insumoId]: { quantity: qty, unit }
      }));
    }
  };

  const selectedCount = Object.keys(selectedItems).length;

  const totalEstimado = useMemo(() => {
    let sum = 0;
    Object.entries(selectedItems).forEach(([id, { quantity }]) => {
      const ins = insumosMap.get(id);
      if (ins) {
        sum += quantity * (ins.precioActual || 0);
      }
    });
    return sum;
  }, [selectedItems, insumosMap]);

  const handleConfirmInsert = () => {
    if (selectedCount === 0) return;

    const lines: string[] = [];
    Object.entries(selectedItems).forEach(([id, { quantity, unit }]) => {
      const ins = insumosMap.get(id);
      if (ins) {
        lines.push(`${currentIndent}- ${quantity} ${unit} ${ins.nombre}`);
      }
    });

    onInsertMaterials(lines.join('\n') + '\n');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-scrim/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface-container-high border border-outline-variant/30 rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Cabecera del Modal */}
        <div className="p-4 sm:p-5 border-b border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-on-surface">
                  Paleta Rápida de Insumos
                </h3>
                <span className="text-[10px] font-mono font-bold bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-md border border-outline-variant/30">
                  Alt + M
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Selecciona múltiples materiales con cantidad para insertarlos en bloque en el YAML
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Buscador y Filtro por Categorías */}
        <div className="p-4 border-b border-outline-variant/15 space-y-3 bg-surface-container/60">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre de material o categoría..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-xs sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium placeholder:text-on-surface-variant/40"
            />
          </div>

          {/* Chips de Categorías */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                selectedCategory === null
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'bg-surface-container-highest/80 text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Todas ({allInsumos.length})
            </button>

            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? null : cat)}
                  className={`px-3 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer capitalize ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-2xs'
                      : 'bg-surface-container-highest/80 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista de Insumos con Selector de Cantidad */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 divide-y divide-outline-variant/10">
          {filteredInsumos.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant text-sm">
              No se encontraron insumos que coincidan con la búsqueda.
            </div>
          ) : (
            filteredInsumos.map((ins) => {
              const isSelected = !!selectedItems[ins.id];
              const qty = selectedItems[ins.id]?.quantity || 1;

              return (
                <div
                  key={ins.id}
                  className={`pt-2 pb-1 px-3 rounded-2xl flex items-center justify-between gap-3 transition-colors ${
                    isSelected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-surface-container'
                  }`}
                >
                  <div
                    onClick={() => toggleItem(ins)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none"
                  >
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                        isSelected
                          ? 'bg-primary border-primary text-on-primary'
                          : 'border-outline-variant/60 bg-surface-container-lowest'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-bold text-on-surface truncate">
                        {ins.nombre}
                      </div>
                      <div className="text-[11px] text-on-surface-variant font-mono">
                        $ {Math.round(ins.precioActual || 0).toLocaleString('es-AR')} / {ins.unidad || 'u'}
                        {ins.categoria && (
                          <span className="ml-2 font-sans opacity-75 capitalize">
                            • {ins.categoria}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Controles de Cantidad */}
                  {isSelected ? (
                    <div className="flex items-center gap-1.5 bg-surface-container-lowest px-2 py-1 rounded-xl border border-outline-variant/30 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => updateQuantity(ins.id, qty - 1, ins.unidad || 'u')}
                        className="w-6 h-6 rounded-md hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <input
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) => updateQuantity(ins.id, parseFloat(e.target.value) || 1, ins.unidad || 'u')}
                        className="w-12 text-center font-mono font-bold text-xs bg-transparent focus:outline-none"
                      />
                      <span className="text-[10px] text-on-surface-variant font-bold">
                        {ins.unidad || 'u'}
                      </span>

                      <button
                        type="button"
                        onClick={() => updateQuantity(ins.id, qty + 1, ins.unidad || 'u')}
                        className="w-6 h-6 rounded-md hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleItem(ins)}
                      className="px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition cursor-pointer"
                    >
                      + Agregar
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Barra Inferior de Acción */}
        <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low flex items-center justify-between">
          <div className="text-xs">
            <span className="font-bold text-on-surface">
              {selectedCount} {selectedCount === 1 ? 'insumo seleccionado' : 'insumos seleccionados'}
            </span>
            {totalEstimado > 0 && (
              <span className="text-on-surface-variant font-mono ml-2">
                (Total: $ {Math.round(totalEstimado).toLocaleString('es-AR')})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmInsert}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-40 text-on-primary text-xs sm:text-sm font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-98"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
              <span>Insertar en YAML ({selectedCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

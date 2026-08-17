import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Search,
  X,
  Plus,
  Minus,
  Check,
  Package,
  Layers,
  Sparkles,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import { db } from '../../db/database';
import { Insumo, CategoriaMaterial } from '../../core/types';
import { formatARS } from '../../core/calculations';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useToast } from '../../contexts/ToastContext';
import { MathInput } from '../common/MathInput';

export interface StagedItemPayload {
  material: Insumo;
  cantidad: number;
  formula?: string;
}

interface MaterialPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  insumosMap: Map<string, Insumo>;
  alreadySelectedIds?: string[];
  onAddMaterial: (material: Insumo, cantidad: number, formula?: string) => void;
  onAddMultipleMaterials?: (items: StagedItemPayload[]) => void;
}

interface StagedEntry {
  cantidad: number;
  formula?: string;
}

export const MaterialPickerModal: React.FC<MaterialPickerModalProps> = ({
  isOpen,
  onClose,
  insumosMap,
  alreadySelectedIds = [],
  onAddMaterial,
  onAddMultipleMaterials,
}) => {
  useEscapeKey(isOpen, onClose);
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const rawCategorias = useLiveQuery(() => db.categoriasMaterial.toArray()) || [];
  const categorias = useMemo(() => rawCategorias.filter((c) => !c.deleted), [rawCategorias]);
  const categoriasMap = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  // Map of materialId -> staged entry for staged multi-add
  const [stagedQuantities, setStagedQuantities] = useState<Map<string, StagedEntry>>(new Map());

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedCategory('todas');
      setStagedQuantities(new Map());
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const allInsumos = useMemo(() => {
    return Array.from(insumosMap.values());
  }, [insumosMap]);

  // Extract available unique category IDs in current catalog
  const availableCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    allInsumos.forEach((ins) => {
      if (ins.categoriaId || ins.categoria) {
        ids.add(ins.categoriaId || ins.categoria || '');
      }
    });
    return Array.from(ids);
  }, [allInsumos]);

  // Filtered materials
  const filteredInsumos = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return allInsumos.filter((ins) => {
      const catId = ins.categoriaId || ins.categoria || '';
      const catName = (categoriasMap.get(catId) || catId).toLowerCase();
      const matchesCategory = selectedCategory === 'todas' || catId === selectedCategory;

      if (!matchesCategory) return false;
      if (!term) return true;

      const matchesName = ins.nombre.toLowerCase().includes(term);
      const matchesCatName = catName.includes(term);
      const matchesAttr = ins.atributos?.some(
        (a) => a.clave.toLowerCase().includes(term) || a.valor.toLowerCase().includes(term)
      );
      const matchesCode = (ins.codigoProveedor || '').toLowerCase().includes(term);

      return matchesName || matchesCatName || matchesAttr || matchesCode;
    });
  }, [allInsumos, searchTerm, selectedCategory, categoriasMap]);

  // Handler for single add (1-tap)
  const handleQuickAdd = (insumo: Insumo, qty: number = 1, formula?: string) => {
    const quantity = qty > 0 ? qty : 1;
    onAddMaterial(insumo, quantity, formula);
    toast.success(`Agregado: ${insumo.nombre} (${quantity} ${insumo.unidadVenta || insumo.unidad || 'u'})`);
  };

  // Quantity staging stepper
  const updateStagedQuantity = (insumoId: string, delta: number) => {
    setStagedQuantities((prev) => {
      const next = new Map(prev);
      const current = next.get(insumoId)?.cantidad || 0;
      const updated = Math.max(0, current + delta);
      if (updated === 0) {
        next.delete(insumoId);
      } else {
        next.set(insumoId, { cantidad: updated, formula: undefined });
      }
      return next;
    });
  };

  const setExplicitStagedQuantity = (insumoId: string, val: number, formula?: string) => {
    setStagedQuantities((prev) => {
      const next = new Map(prev);
      if (val <= 0 || isNaN(val)) {
        next.delete(insumoId);
      } else {
        next.set(insumoId, { cantidad: val, formula });
      }
      return next;
    });
  };

  // Handle adding all staged materials
  const handleApplyStaged = () => {
    if (stagedQuantities.size === 0) return;

    const itemsToAdd: StagedItemPayload[] = [];
    stagedQuantities.forEach((entry, id) => {
      const mat = insumosMap.get(id);
      if (mat && entry.cantidad > 0) {
        itemsToAdd.push({ material: mat, cantidad: entry.cantidad, formula: entry.formula });
      }
    });

    if (onAddMultipleMaterials) {
      onAddMultipleMaterials(itemsToAdd);
    } else {
      itemsToAdd.forEach((item) => onAddMaterial(item.material, item.cantidad, item.formula));
    }

    toast.success(`Se agregaron ${itemsToAdd.length} materiales a la Tarea Tipo.`);
    onClose();
  };

  const stagedCount = stagedQuantities.size;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-surface border border-outline-variant/30 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-on-surface z-10 animate-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-2xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-on-surface text-base sm:text-lg">
                Catálogo de Materiales & Insumos
              </h3>
              <p className="text-xs text-on-surface-variant">
                Selecciona los materiales que componen esta Tarea Tipo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Chips Toolbar */}
        <div className="p-3 sm:p-4 border-b border-outline-variant/20 bg-surface-container-low space-y-3 shrink-0">
          {/* Search Box M3 */}
          <div className="relative">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por nombre, norma (ej: IRAM 2178), sección, marca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-full pl-10 pr-8 py-2.5 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-h-[42px]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-2.5 text-on-surface-variant hover:text-on-surface p-0.5"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1 touch-pan-x overscroll-contain">
            <button
              type="button"
              onClick={() => setSelectedCategory('todas')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedCategory === 'todas'
                  ? 'bg-secondary-container text-on-secondary-container shadow-xs'
                  : 'bg-surface-variant/70 text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              <span>Todas</span>
              <span className="text-[10px] opacity-75 font-mono">({allInsumos.length})</span>
            </button>

            {availableCategoryIds.map((catId) => {
              const catName = categoriasMap.get(catId) || catId || 'Sin Categoría';
              const count = allInsumos.filter((i) => (i.categoriaId || i.categoria) === catId).length;
              const isSelected = selectedCategory === catId;

              return (
                <button
                  key={catId}
                  type="button"
                  onClick={() => setSelectedCategory(catId)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-primary-container text-on-primary-container border border-primary/30 shadow-xs'
                      : 'bg-surface-variant/70 text-on-surface-variant hover:bg-surface-variant'
                  }`}
                >
                  <span>{catName}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Materials List / Cards Container */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-2.5 flex-1 no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {filteredInsumos.length === 0 ? (
            <div className="text-center py-12 px-4 border-2 border-dashed border-outline-variant/30 rounded-3xl bg-surface-container-low">
              <Package className="w-12 h-12 text-outline-variant mx-auto mb-3" />
              <p className="text-sm font-semibold text-on-surface">No se encontraron materiales coincidentes.</p>
              <p className="text-xs text-on-surface-variant mt-1 max-w-sm mx-auto">
                Prueba ajustando la búsqueda o el filtro de categorías.
              </p>
            </div>
          ) : (
            filteredInsumos.map((ins) => {
              const isAlreadyInTarea = alreadySelectedIds.includes(ins.id);
              const stagedEntry = stagedQuantities.get(ins.id);
              const stagedQty = stagedEntry?.cantidad || 0;
              const stagedFormula = stagedEntry?.formula;
              const catName = categoriasMap.get(ins.categoriaId || ins.categoria || '') || ins.categoriaId || ins.categoria;
              const unit = ins.unidadVenta || ins.unidad || 'u';

              return (
                <div
                  key={ins.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    stagedQty > 0
                      ? 'bg-secondary-container/30 border-primary/50 shadow-xs'
                      : isAlreadyInTarea
                      ? 'bg-surface-container-low/60 border-outline-variant/30'
                      : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/20'
                  }`}
                >
                  {/* Left: Material Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {catName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant uppercase tracking-wider">
                          {catName}
                        </span>
                      )}
                      {ins.unidadVenta && (
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          /{ins.unidadVenta}
                        </span>
                      )}
                      {isAlreadyInTarea && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> En la Tarea
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs sm:text-sm font-bold text-on-surface leading-snug">
                      {ins.nombre}
                    </h4>

                    {/* Attributes preview / Price */}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-on-surface-variant">
                      <span className="font-mono font-bold text-primary text-xs">
                        {ins.precioActual ? formatARS(ins.precioActual) : 'Sin precio cargado'}
                      </span>
                      {ins.atributos && ins.atributos.length > 0 && (
                        <span className="text-[11px] text-on-surface-variant/80 truncate">
                          • {ins.atributos.slice(0, 3).map((a) => `${a.clave}: ${a.valor}`).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Quantity Stepper & Quick Action */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/15">
                    {/* Stepper for Staged Qty */}
                    <div className="w-24">
                      <MathInput
                        value={stagedQty}
                        formula={stagedFormula}
                        onChange={(val, form) => setExplicitStagedQuantity(ins.id, val, form)}
                        placeholder="0"
                        size="sm"
                        min={0}
                        step={0.1}
                      />
                    </div>

                    <span className="text-[11px] font-mono text-on-surface-variant min-w-[24px]">
                      {unit}
                    </span>

                    {/* Quick Add Button */}
                    <button
                      type="button"
                      onClick={() => handleQuickAdd(ins, stagedQty > 0 ? stagedQty : 1, stagedFormula)}
                      className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-on-primary font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1 active:scale-95 shrink-0"
                      title={`Agregar ${stagedQty > 0 ? stagedQty : 1} ${unit} de este material`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{stagedQty > 0 ? `+ Añadir (${stagedQty})` : '+ Añadir (1)'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer / Multi-Add Sticky Bar */}
        <div className="p-3 sm:p-4 border-t border-outline-variant/20 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-on-surface-variant text-center sm:text-left">
            {stagedCount > 0 ? (
              <span className="font-semibold text-primary">
                {stagedCount} {stagedCount === 1 ? 'material seleccionado' : 'materiales seleccionados'} con cantidad lista.
              </span>
            ) : (
              <span>Puedes usar los botones (+ Añadir) individuales o seleccionar varios insumos.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
            >
              Listo / Cerrar
            </button>

            {stagedCount > 0 && (
              <button
                type="button"
                onClick={handleApplyStaged}
                className="flex-1 sm:flex-initial px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs rounded-full shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Incorporar Selección ({stagedCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

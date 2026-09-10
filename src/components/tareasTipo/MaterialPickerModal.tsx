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
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { db } from '../../db/database';
import { Insumo, CategoriaMaterial } from '../../core/types';
import { formatARS, safeNum } from '../../core/calculations';
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
  currentScope?: Record<string, number | boolean>;
  onAddMaterial: (material: Insumo, cantidad: number, formula?: string) => void;
  onAddMultipleMaterials?: (items: StagedItemPayload[]) => void;
  titleOverride?: string;
  subtitleOverride?: string;
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
  currentScope,
  onAddMaterial,
  onAddMultipleMaterials,
  titleOverride,
  subtitleOverride,
}) => {
  useEscapeKey(isOpen, onClose);
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const rawCategorias = useLiveQuery(() => db.categoriasMaterial.toArray()) || [];
  const categorias = useMemo(() => rawCategorias.filter((c) => !c.deleted), [rawCategorias]);
  const categoriasMap = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState<boolean>(false);
  // Map of materialId -> staged entry for staged multi-add
  const [stagedQuantities, setStagedQuantities] = useState<Map<string, StagedEntry>>(new Map());
  // Set of materialId for batch checkbox selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Shared batch quantity for checked materials
  const [batchQuantity, setBatchQuantity] = useState<number>(1);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedCategory('todas');
      setIsCategoriesExpanded(false);
      setStagedQuantities(new Map());
      setSelectedIds(new Set());
      setBatchQuantity(1);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const allInsumos = useMemo(() => {
    return Array.from(insumosMap.values());
  }, [insumosMap]);

  // Search-matched materials (independent of category filter)
  const searchMatchedInsumos = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return allInsumos;
    return allInsumos.filter((ins) => {
      const catId = ins.categoriaId || ins.categoria || '';
      const catName = (categoriasMap.get(catId) || catId).toLowerCase();
      const matchesName = ins.nombre.toLowerCase().includes(term);
      const matchesCatName = catName.includes(term);
      const matchesAttr = ins.atributos?.some(
        (a) => a.clave.toLowerCase().includes(term) || a.valor.toLowerCase().includes(term)
      );
      const matchesCode = (ins.codigoProveedor || '').toLowerCase().includes(term);

      return matchesName || matchesCatName || matchesAttr || matchesCode;
    });
  }, [allInsumos, searchTerm, categoriasMap]);

  // Dynamic category counts based on current search matches
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ins of searchMatchedInsumos) {
      const catId = ins.categoriaId || ins.categoria || 'sin_categoria';
      counts.set(catId, (counts.get(catId) || 0) + 1);
    }
    return counts;
  }, [searchMatchedInsumos]);

  // Extract available unique category IDs that have at least 1 match in search
  const availableCategoryIds = useMemo(() => {
    return Array.from(categoryCounts.keys());
  }, [categoryCounts]);

  // Auto-reset selected category to 'todas' if the active filter no longer has any matches under current search
  useEffect(() => {
    if (selectedCategory !== 'todas' && !categoryCounts.has(selectedCategory)) {
      setSelectedCategory('todas');
    }
  }, [categoryCounts, selectedCategory]);

  // Final filtered materials (by search and active category)
  const filteredInsumos = useMemo(() => {
    if (selectedCategory === 'todas') {
      return searchMatchedInsumos;
    }
    return searchMatchedInsumos.filter(
      (ins) => (ins.categoriaId || ins.categoria || 'sin_categoria') === selectedCategory
    );
  }, [searchMatchedInsumos, selectedCategory]);

  // Checkbox toggle for multi-select
  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedIds(new Set(filteredInsumos.map((i) => i.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleApplyBatchQuantity = () => {
    const qty = Math.max(0.01, safeNum(batchQuantity) || 1);
    setStagedQuantities((prev) => {
      const next = new Map(prev);
      selectedIds.forEach((id) => {
        next.set(id, { cantidad: qty });
      });
      return next;
    });
    toast.success(`Se asignó cantidad ${qty} a ${selectedIds.size} materiales seleccionados.`);
  };

  const handleApplyAndIncorporateBatch = () => {
    if (selectedIds.size === 0) return;
    const qty = Math.max(0.01, safeNum(batchQuantity) || 1);
    const itemsToAdd: StagedItemPayload[] = [];
    selectedIds.forEach((id) => {
      const mat = insumosMap.get(id);
      if (mat) {
        itemsToAdd.push({ material: mat, cantidad: qty });
      }
    });

    if (onAddMultipleMaterials) {
      onAddMultipleMaterials(itemsToAdd);
    } else {
      itemsToAdd.forEach((item) => onAddMaterial(item.material, item.cantidad, item.formula));
    }

    toast.success(`Se incorporaron ${itemsToAdd.length} materiales con cantidad ${qty}.`);
    onClose();
  };

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

  const setExplicitStagedQuantity = (insumoId: string, val: number | null, formula?: string) => {
    setStagedQuantities((prev) => {
      const next = new Map(prev);
      if (val === null || val <= 0 || isNaN(val)) {
        next.delete(insumoId);
      } else {
        next.set(insumoId, { cantidad: val, formula });
      }
      return next;
    });
  };

  // Handle adding all staged materials
  const handleApplyStaged = () => {
    const combined = new Map(stagedQuantities);
    if (selectedIds.size > 0) {
      const qty = Math.max(0.01, safeNum(batchQuantity) || 1);
      selectedIds.forEach((id) => {
        if (!combined.has(id) || (combined.get(id)?.cantidad || 0) === 0) {
          combined.set(id, { cantidad: qty });
        }
      });
    }

    if (combined.size === 0) return;

    const itemsToAdd: StagedItemPayload[] = [];
    combined.forEach((entry, id) => {
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

    toast.success(`Se agregaron ${itemsToAdd.length} materiales.`);
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
                {titleOverride || 'Catálogo de Materiales & Insumos'}
              </h3>
              <p className="text-xs text-on-surface-variant">
                {subtitleOverride || 'Selecciona los materiales que componen esta Tarea Tipo'}
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
          {/* Search Box M3 & Bulk select toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
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

            {filteredInsumos.length > 0 && (
              <button
                type="button"
                onClick={
                  selectedIds.size === filteredInsumos.length && filteredInsumos.length > 0
                    ? handleClearSelection
                    : handleSelectAllVisible
                }
                className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-semibold bg-surface-container-highest hover:bg-surface-variant text-on-surface border border-outline-variant/30 transition shrink-0 min-h-[42px]"
                title="Seleccionar o deseleccionar todos los materiales mostrados"
              >
                {selectedIds.size === filteredInsumos.length && filteredInsumos.length > 0 ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Deseleccionar ({filteredInsumos.length})</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-primary" />
                    <span>Marcar todos ({filteredInsumos.length})</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Category Filter Chips Toolbar */}
          <div className="space-y-1.5">
            {availableCategoryIds.length > 3 && (
              <div className="flex items-center justify-between text-xs text-on-surface-variant px-0.5">
                <span className="font-semibold text-xs uppercase tracking-wider text-on-surface-variant/75">
                  Categorías
                </span>
                <button
                  type="button"
                  onClick={() => setIsCategoriesExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors py-0.5 px-1.5 rounded-lg hover:bg-primary/10"
                  aria-expanded={isCategoriesExpanded}
                  title={isCategoriesExpanded ? 'Mostrar en una sola fila desplazable' : 'Desplegar todas las categorías en cuadrícula'}
                >
                  <span>{isCategoriesExpanded ? 'Colapsar fila' : 'Ver todas'}</span>
                  {isCategoriesExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}

            <div className="relative">
              <div
                className={`transition-all duration-200 ${
                  isCategoriesExpanded
                    ? 'flex flex-wrap items-center gap-1.5 max-h-36 overflow-y-auto no-scrollbar p-0.5'
                    : 'flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1 pr-6 touch-pan-x overscroll-contain'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedCategory('todas')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 ${
                    selectedCategory === 'todas'
                      ? 'bg-secondary-container text-on-secondary-container shadow-xs'
                      : 'bg-surface-variant/70 text-on-surface-variant hover:bg-surface-variant'
                  }`}
                >
                  <span>Todas</span>
                </button>

                {availableCategoryIds.map((catId) => {
                  const catName = categoriasMap.get(catId) || (catId === 'sin_categoria' ? 'Sin Categoría' : catId);
                  const isSelected = selectedCategory === catId;

                  return (
                    <button
                      key={catId}
                      type="button"
                      onClick={() => setSelectedCategory(catId)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 ${
                        isSelected
                          ? 'bg-primary-container text-on-primary-container border border-primary/30 shadow-xs'
                          : 'bg-surface-variant/70 text-on-surface-variant hover:bg-surface-variant'
                      }`}
                    >
                      <span>{catName}</span>
                    </button>
                  );
                })}
              </div>

              {/* Indicador sutil de scroll lateral derecho cuando está colapsado y hay más de 3 categorías */}
              {!isCategoriesExpanded && availableCategoryIds.length > 3 && (
                <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-surface-container-low to-transparent" />
              )}
            </div>
          </div>
        </div>

        {/* Batch Action Toolbar when 1+ materials are checked */}
        {selectedIds.size > 0 && (
          <div className="mx-3 sm:mx-4 my-2.5 p-3 bg-primary/10 border border-primary/30 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150 shadow-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4" />
                <span>{selectedIds.size} {selectedIds.size === 1 ? 'material seleccionado' : 'materiales seleccionados'}</span>
              </span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-xs text-on-surface-variant hover:text-on-surface underline ml-1"
              >
                Limpiar
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap ml-auto">
              <span className="text-xs font-medium text-on-surface-variant">Cantidad para lote:</span>
              <div className="w-20">
                <MathInput
                  value={batchQuantity}
                  onChange={(v) => setBatchQuantity(Math.max(0.01, v || 1))}
                  scope={currentScope}
                  size="sm"
                  min={0.01}
                  step={0.5}
                />
              </div>
              <button
                type="button"
                onClick={handleApplyBatchQuantity}
                className="px-2.5 py-1.5 text-xs font-semibold bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface rounded-xl border border-outline-variant/40 transition"
                title="Asigna esta cantidad a los seleccionados en la lista"
              >
                Asignar
              </button>
              <button
                type="button"
                onClick={handleApplyAndIncorporateBatch}
                className="px-3.5 py-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-on-primary rounded-xl shadow-xs transition flex items-center gap-1.5 active:scale-95"
                title="Incorpora los seleccionados directamente con esta cantidad y cierra el selector"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Incorporar ({selectedIds.size})</span>
              </button>
            </div>
          </div>
        )}

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
              const isChecked = selectedIds.has(ins.id);
              const stagedEntry = stagedQuantities.get(ins.id);
              const stagedQty = stagedEntry?.cantidad || 0;
              const stagedFormula = stagedEntry?.formula;
              const catName = categoriasMap.get(ins.categoriaId || ins.categoria || '') || ins.categoriaId || ins.categoria;
              const unit = ins.unidadVenta || ins.unidad || 'u';

              return (
                <div
                  key={ins.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isChecked
                      ? 'bg-primary/10 border-primary/50 shadow-xs'
                      : stagedQty > 0
                      ? 'bg-secondary-container/30 border-primary/40 shadow-xs'
                      : isAlreadyInTarea
                      ? 'bg-surface-container-low/60 border-outline-variant/30'
                      : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/20'
                  }`}
                >
                  {/* Left: Checkbox & Material Info */}
                  <div className="min-w-0 flex-1 flex items-start gap-2.5">
                    {/* Checkbox for batch selection */}
                    <button
                      type="button"
                      onClick={() => toggleSelectId(ins.id)}
                      className="p-1 text-on-surface-variant hover:text-primary transition-colors shrink-0 mt-0.5"
                      title={isChecked ? 'Deseleccionar' : 'Seleccionar para lote'}
                      aria-label={`Seleccionar ${ins.nombre}`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Square className="w-5 h-5 text-outline-variant hover:text-outline" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {catName && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant uppercase tracking-wider">
                            {catName}
                          </span>
                        )}
                        {ins.unidadVenta && (
                          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            /{ins.unidadVenta}
                          </span>
                        )}
                        {isAlreadyInTarea && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> En la Partida
                          </span>
                        )}
                      </div>

                      <h4
                        onClick={() => toggleSelectId(ins.id)}
                        className="text-xs sm:text-sm font-bold text-on-surface leading-snug cursor-pointer hover:text-primary transition-colors"
                      >
                        {ins.nombre}
                      </h4>

                      {/* Attributes preview / Price */}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-on-surface-variant">
                        <span className="font-mono font-bold text-primary text-xs">
                          {ins.precioActual ? formatARS(ins.precioActual) : 'Sin precio cargado'}
                        </span>
                        {ins.atributos && ins.atributos.length > 0 && (
                          <span className="text-xs text-on-surface-variant/80 truncate">
                            • {ins.atributos.slice(0, 3).map((a) => `${a.clave}: ${a.valor}`).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Quantity Stepper & Quick Action */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/15">
                    {/* Stepper for Staged Qty */}
                    <div className="w-24">
                      <MathInput
                        value={stagedQty}
                        formula={stagedFormula}
                        scope={currentScope}
                        onChange={(val, form) => setExplicitStagedQuantity(ins.id, val, form)}
                        placeholder="0"
                        size="sm"
                        min={0}
                        step={0.1}
                      />
                    </div>

                    <span className="text-xs font-mono text-on-surface-variant min-w-[24px]">
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

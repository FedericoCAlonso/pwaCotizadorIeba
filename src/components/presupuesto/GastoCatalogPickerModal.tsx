import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  X,
  Search,
  Plus,
  Check,
  RotateCcw,
  Zap,
  Sliders,
  DollarSign,
  Percent,
  Layers,
  HardHat,
  Package,
  Truck,
  CheckSquare,
  Square
} from 'lucide-react';
import { CostoIndirecto, GastoPresupuestoConfig, DestinoGasto } from '../../core/types';
import { formatARS } from '../../core/calculations';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface GastoCatalogPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalogGastos: CostoIndirecto[];
  currentGastosConfig: GastoPresupuestoConfig[];
  onAddGastos: (gastos: CostoIndirecto[]) => void;
}

export const GastoCatalogPickerModal: React.FC<GastoCatalogPickerModalProps> = ({
  isOpen,
  onClose,
  catalogGastos = [],
  currentGastosConfig = [],
  onAddGastos
}) => {
  useEscapeKey(isOpen, onClose);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDestino, setFilterDestino] = useState<string>('todos');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setFilterDestino('todos');
      setSelectedIds(new Set());
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const activeIdsInBudget = useMemo(() => {
    return new Set(
      currentGastosConfig
        .map((g) => g.costoIndirectoId || g.id)
        .filter(Boolean) as string[]
    );
  }, [currentGastosConfig]);

  const filteredGastos = useMemo(() => {
    return catalogGastos.filter((g) => {
      if (g.deleted) return false;
      const matchesSearch =
        g.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.formula && g.formula.toLowerCase().includes(searchTerm.toLowerCase()));

      const dest = g.destino || (g.tipo === 'porcentual_sobre_costo' ? 'costo_indirecto' : 'costo_indirecto');
      const matchesDestino = filterDestino === 'todos' || dest === filterDestino;

      return matchesSearch && matchesDestino;
    });
  }, [catalogGastos, searchTerm, filterDestino]);

  const handleToggleSelect = (id: string) => {
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

  const handleSelectDefaults = () => {
    const defaultIds = catalogGastos
      .filter((g) => !g.deleted && g.incluirPorDefecto !== false)
      .map((g) => g.id);
    setSelectedIds(new Set(defaultIds));
  };

  const handleSelectAllFiltered = () => {
    const allIds = filteredGastos.map((g) => g.id);
    setSelectedIds(new Set(allIds));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleAddSelected = () => {
    if (selectedIds.size === 0) return;
    const toAdd = catalogGastos.filter((g) => selectedIds.has(g.id));
    onAddGastos(toAdd);
    onClose();
  };

  const handleAddSingle = (gasto: CostoIndirecto) => {
    onAddGastos([gasto]);
    onClose();
  };

  const getDestinoBadge = (dest?: DestinoGasto) => {
    switch (dest) {
      case 'mano_obra':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-xs font-bold">
            <HardHat className="w-3.5 h-3.5" /> Mano de Obra
          </span>
        );
      case 'materiales':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-500 text-xs font-bold">
            <Package className="w-3.5 h-3.5" /> Materiales
          </span>
        );
      case 'servicios':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-500 text-xs font-bold">
            <Truck className="w-3.5 h-3.5" /> Servicios
          </span>
        );
      case 'costo_indirecto':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400 text-xs font-bold">
            <Layers className="w-3.5 h-3.5" /> Gastos Generales
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] text-on-surface pb-safe">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-outline-variant/20 bg-surface-container-low flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-on-surface truncate">
                Catálogo de Gastos y Costos Indirectos
              </h3>
              <p className="text-xs text-on-surface-variant truncate">
                Selecciona gastos estándar para incorporarlos a esta cotización
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-outline-variant/20 bg-surface-container-low/50 space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar gasto en el catálogo..."
              className="w-full bg-surface border border-outline-variant/30 rounded-2xl pl-10 pr-4 py-2 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Filter Pills and Quick Selection */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'mano_obra', label: 'Mano de Obra' },
                { id: 'materiales', label: 'Materiales' },
                { id: 'servicios', label: 'Servicios' },
                { id: 'costo_indirecto', label: 'Gastos Grales.' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterDestino(tab.id)}
                  className={`px-3 py-1 rounded-xl font-medium transition-colors whitespace-nowrap text-xs ${
                    filterDestino === tab.id
                      ? 'bg-primary text-on-primary shadow-xs font-bold'
                      : 'bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectDefaults}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Por Defecto
              </button>
              <span className="text-outline-variant">·</span>
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-xs font-semibold text-on-surface-variant hover:text-on-surface"
              >
                Todos ({filteredGastos.length})
              </button>
              {selectedIds.size > 0 && (
                <>
                  <span className="text-outline-variant">·</span>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-xs font-semibold text-error hover:underline"
                  >
                    Limpiar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Catalog Items List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 overscroll-contain">
          {filteredGastos.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-sm font-medium text-on-surface-variant">
                No se encontraron gastos en el catálogo
              </p>
              <p className="text-xs text-on-surface-variant/70">
                Puedes crear un nuevo gasto en la sección de Mano de Obra o mediante "+ Nuevo Gasto".
              </p>
            </div>
          ) : (
            filteredGastos.map((g) => {
              const isSelected = selectedIds.has(g.id);
              const isAlreadyInBudget = activeIdsInBudget.has(g.id);
              const modalidad = g.modalidad || (g.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo');
              const destino = g.destino || (g.tipo === 'porcentual_sobre_costo' ? 'costo_indirecto' : 'costo_indirecto');

              return (
                <div
                  key={g.id}
                  onClick={() => handleToggleSelect(g.id)}
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-primary/10 border-primary shadow-xs'
                      : isAlreadyInBudget
                        ? 'bg-surface-container-low/80 border-outline-variant/30 hover:border-primary/50'
                        : 'bg-surface border-outline-variant/20 hover:border-primary/40 hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="text-primary shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Square className="w-5 h-5 text-on-surface-variant/50" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-on-surface truncate">
                          {g.nombre}
                        </span>
                        {isAlreadyInBudget && (
                          <span className="px-2 py-0.5 rounded-md bg-surface-variant text-on-surface-variant text-xs font-semibold">
                            En cotización
                          </span>
                        )}
                        {g.incluirPorDefecto !== false && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-semibold">
                            Predeterminado
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs text-on-surface-variant">
                        {getDestinoBadge(destino)}

                        <span className="font-mono font-bold text-on-surface">
                          {modalidad === 'porcentual' ? (
                            <span className="inline-flex items-center gap-0.5 text-primary">
                              <Percent className="w-3 h-3" /> {g.valor}%
                            </span>
                          ) : modalidad === 'parametrico' ? (
                            <span className="inline-flex items-center gap-0.5 text-primary">
                              <Zap className="w-3 h-3" /> Fórmula
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-on-surface">
                              <DollarSign className="w-3 h-3" /> {formatARS(g.valor)}
                            </span>
                          )}
                        </span>

                        {g.parametros && g.parametros.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            <Sliders className="w-3 h-3" /> {g.parametros.length} var.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddSingle(g);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-transform active:scale-95 shadow-xs"
                      title="Agregar de inmediato"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Agregar</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-outline-variant/20 bg-surface-container-low shrink-0 flex items-center justify-between gap-3">
          <span className="text-xs text-on-surface-variant">
            {selectedIds.size === 0
              ? 'Selecciona uno o más gastos para agregar'
              : `${selectedIds.size} ${selectedIds.size === 1 ? 'gasto seleccionado' : 'gastos seleccionados'}`}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-variant transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={handleAddSelected}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Agregar a la Cotización ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

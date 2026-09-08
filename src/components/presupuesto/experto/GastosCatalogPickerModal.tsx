import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Check,
  Truck,
  Percent,
  DollarSign,
  Hash,
  CornerDownLeft,
  Plus
} from 'lucide-react';
import { CostoIndirecto, DestinoGasto, ModalidadGasto } from '../../../core/types';
import { scoreSearchMatch } from './dslParser';
import { db } from '../../../db/database';
import { useLiveQuery } from 'dexie-react-hooks';

interface SelectedGastoConfig {
  nombre: string;
  modalidad: ModalidadGasto;
  destino: DestinoGasto;
  valor: number;
  formula?: string;
}

interface GastosCatalogPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  costosIndirectos?: CostoIndirecto[];
  onInsertGastos: (formattedYamlLines: string) => void;
}

export const GastosCatalogPickerModal: React.FC<GastosCatalogPickerModalProps> = ({
  isOpen,
  onClose,
  costosIndirectos,
  onInsertGastos
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModalidad, setFilterModalidad] = useState<'todos' | 'porcentual' | 'monto_fijo' | 'parametrico'>('todos');
  const [filterDestino, setFilterDestino] = useState<'todos' | DestinoGasto>('todos');
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedGastoConfig>>({});
  const [showCustomExpenseRow, setShowCustomExpenseRow] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customModalidad, setCustomModalidad] = useState<ModalidadGasto>('porcentual');
  const [customDestino, setCustomDestino] = useState<DestinoGasto>('costo_indirecto');
  const [customValor, setCustomValor] = useState<number>(5);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Consulta reactiva si no se pasan gastos como prop
  const liveCostos = useLiveQuery(
    () => db.costosIndirectos.filter((c) => !c.deleted).toArray(),
    [],
    []
  );

  const catalog: CostoIndirecto[] = useMemo(() => {
    const rawList = costosIndirectos && costosIndirectos.length > 0 ? costosIndirectos : liveCostos;
    return (rawList || []).filter((c) => !c.deleted);
  }, [costosIndirectos, liveCostos]);

  // Gastos predeterminados sugeridos si la base de datos está vacía
  const defaultPresets: CostoIndirecto[] = useMemo(
    () => [
      {
        id: 'preset-seguro-art',
        nombre: 'Seguro ART y Cargas',
        modalidad: 'porcentual',
        destino: 'mano_obra',
        valor: 8,
        incluirPorDefecto: false
      },
      {
        id: 'preset-merma-materiales',
        nombre: 'Merma de Materiales',
        modalidad: 'porcentual',
        destino: 'materiales',
        valor: 5,
        incluirPorDefecto: false
      },
      {
        id: 'preset-gastos-generales',
        nombre: 'Gastos Generales de Obra',
        modalidad: 'porcentual',
        destino: 'costo_indirecto',
        valor: 10,
        incluirPorDefecto: false
      },
      {
        id: 'preset-flete-logistica',
        nombre: 'Flete y Logística',
        modalidad: 'monto_fijo',
        destino: 'costo_indirecto',
        valor: 25000,
        incluirPorDefecto: false
      },
      {
        id: 'preset-coordinacion-servicios',
        nombre: 'Coordinación de Subcontratos',
        modalidad: 'porcentual',
        destino: 'servicios',
        valor: 5,
        incluirPorDefecto: false
      }
    ],
    []
  );

  const mergedCatalog = useMemo(() => {
    if (catalog.length > 0) return catalog;
    return defaultPresets;
  }, [catalog, defaultPresets]);

  // Filtrado reactivo de gastos
  const filteredGastos = useMemo(() => {
    let pool = mergedCatalog;

    if (filterModalidad !== 'todos') {
      pool = pool.filter((g) => {
        const mod = g.modalidad || (g.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo');
        return mod === filterModalidad;
      });
    }

    if (filterDestino !== 'todos') {
      pool = pool.filter((g) => (g.destino || 'costo_indirecto') === filterDestino);
    }

    if (!searchTerm.trim()) {
      return pool;
    }

    return pool
      .map((g) => ({
        gasto: g,
        score: scoreSearchMatch({
          query: searchTerm,
          title: g.nombre,
          category: g.destino,
          extraText: `${g.modalidad || ''} ${g.formula || ''} ${g.valor || ''}`
        })
      }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.gasto);
  }, [mergedCatalog, filterModalidad, filterDestino, searchTerm]);

  // Focus inicial y reseteo
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
      setFilterModalidad('todos');
      setFilterDestino('todos');
      setSelectedItems({});
      setShowCustomExpenseRow(false);
      setCustomName('');
    }
  }, [isOpen]);

  // Manejo de atajo Escape y Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleConfirmInsert();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedItems, onClose]);

  const toggleItem = (gasto: CostoIndirecto) => {
    const mod: ModalidadGasto = gasto.modalidad || (gasto.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo');
    const dest: DestinoGasto = gasto.destino || 'costo_indirecto';
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[gasto.id]) {
        delete next[gasto.id];
      } else {
        next[gasto.id] = {
          nombre: gasto.nombre,
          modalidad: mod,
          destino: dest,
          valor: Number(gasto.valor || 0),
          formula: gasto.formula
        };
      }
      return next;
    });
  };

  const updateItemConfig = (id: string, updates: Partial<SelectedGastoConfig>) => {
    setSelectedItems((prev) => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          ...updates
        }
      };
    });
  };

  const handleAddCustomExpense = () => {
    if (!customName.trim()) return;
    const customId = `custom-${Date.now()}`;
    setSelectedItems((prev) => ({
      ...prev,
      [customId]: {
        nombre: customName.trim(),
        modalidad: customModalidad,
        destino: customDestino,
        valor: customValor
      }
    }));
    setCustomName('');
    setShowCustomExpenseRow(false);
  };

  const handleConfirmInsert = () => {
    const selectedList = Object.values(selectedItems);
    if (selectedList.length === 0) return;

    const formattedLines = selectedList
      .map((item) => {
        if (item.modalidad === 'porcentual') {
          const destName =
            item.destino === 'mano_obra'
              ? 'mano_obra'
              : item.destino === 'materiales'
              ? 'materiales'
              : item.destino === 'servicios'
              ? 'servicios'
              : 'costo_directo';
          return `  - ${item.nombre}: ${item.valor}% sobre ${destName}`;
        } else if (item.modalidad === 'parametrico' && item.formula) {
          return `  - ${item.nombre}: =${item.formula}`;
        } else {
          const montoNum = Math.round(item.valor || 0);
          return `  - ${item.nombre}: $ ${montoNum}`;
        }
      })
      .join('\n') + '\n';

    onInsertGastos(formattedLines);
    onClose();
  };

  if (!isOpen) return null;

  const selectedCount = Object.keys(selectedItems).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gastos-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-scrim/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-high text-on-surface w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between gap-3 bg-surface-container-low">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="gastos-modal-title" className="font-bold text-sm sm:text-base text-on-surface truncate">
                Catálogo de Gastos y Costos Indirectos
              </h3>
              <p className="text-xs text-on-surface-variant truncate">
                Seleccioná y ajustá modificadores de costo para insertar en el YAML (Alt + G)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-xl transition cursor-pointer shrink-0"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Buscador y Filtros */}
        <div className="p-3 border-b border-outline-variant/15 space-y-2.5 bg-surface-container">
          {/* Campo de búsqueda */}
          <div className="relative">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar gasto por nombre, destino o fórmula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-surface-container-lowest text-on-surface text-xs sm:text-sm rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-on-surface-variant/60"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro de Modalidad */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-on-surface-variant font-medium mr-1 shrink-0">Tipo:</span>
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'porcentual', label: '% Porcentual' },
              { id: 'monto_fijo', label: '$ Monto Fijo' },
              { id: 'parametrico', label: '= Paramétrico' }
            ].map((tab) => {
              const isSelected = filterModalidad === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterModalidad(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-surface-container-highest/80 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Filtro de Destino */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-on-surface-variant font-medium mr-1 shrink-0">Aplica a:</span>
            {[
              { id: 'todos', label: 'Todos los destinos' },
              { id: 'mano_obra', label: 'Mano de Obra' },
              { id: 'materiales', label: 'Materiales' },
              { id: 'servicios', label: 'Servicios' },
              { id: 'costo_indirecto', label: 'Costo Directo' }
            ].map((tab) => {
              const isSelected = filterDestino === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterDestino(tab.id as any)}
                  className={`px-2 py-0.5 rounded-md font-medium transition shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-primary/20 text-primary border border-primary/30 font-bold'
                      : 'bg-surface-container-highest/50 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista de Gastos */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-outline-variant/10">
          {filteredGastos.length === 0 ? (
            <div className="text-center py-8 px-4 text-on-surface-variant space-y-2">
              <p className="text-sm font-semibold">No se encontraron gastos con los filtros aplicados</p>
              <p className="text-xs">Podés definir un gasto libre o limpiar la búsqueda.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilterModalidad('todos');
                  setFilterDestino('todos');
                }}
                className="mt-2 px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition cursor-pointer"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            filteredGastos.map((gasto) => {
              const isSelected = Boolean(selectedItems[gasto.id]);
              const currentConfig = selectedItems[gasto.id];
              const mod: ModalidadGasto = gasto.modalidad || (gasto.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo');
              const dest: DestinoGasto = gasto.destino || 'costo_indirecto';

              const destLabel =
                dest === 'mano_obra'
                  ? 'Mano de Obra'
                  : dest === 'materiales'
                  ? 'Materiales'
                  : dest === 'servicios'
                  ? 'Servicios'
                  : 'Costo Directo';

              return (
                <div
                  key={gasto.id}
                  className={`pt-2 pb-2 px-2.5 rounded-xl transition-colors flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-purple-500/10 border border-purple-500/25'
                      : 'hover:bg-surface-container-lowest/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div
                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                      onClick={() => toggleItem(gasto)}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition shrink-0 border ${
                          isSelected
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'border-outline-variant/60 bg-surface-container-lowest'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-on-surface">
                            {gasto.nombre}
                          </span>
                          {/* Destino Badge */}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-container-highest text-on-surface-variant">
                            s/ {destLabel}
                          </span>
                          {/* Modalidad Badge */}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary">
                            {mod === 'porcentual' ? `${gasto.valor}%` : mod === 'parametrico' ? `=${gasto.formula}` : `$ ${Math.round(gasto.valor || 0).toLocaleString('es-AR')}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isSelected ? (
                      <button
                        type="button"
                        onClick={() => toggleItem(gasto)}
                        className="px-2.5 py-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 rounded-lg transition cursor-pointer shrink-0"
                      >
                        + Seleccionar
                      </button>
                    ) : null}
                  </div>

                  {/* Editor rápido cuando está seleccionado */}
                  {isSelected && currentConfig && (
                    <div className="pl-7 pr-1 pt-1.5 border-t border-purple-500/20 flex flex-wrap items-center gap-3 text-xs">
                      {currentConfig.modalidad === 'porcentual' ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-on-surface-variant text-[11px] font-medium">Porcentaje:</span>
                          <div className="flex items-center bg-surface-container-lowest px-2 py-0.5 rounded-lg border border-outline-variant/30">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="100"
                              value={currentConfig.valor}
                              onChange={(e) =>
                                updateItemConfig(gasto.id, { valor: parseFloat(e.target.value) || 0 })
                              }
                              className="w-14 font-mono font-bold text-xs bg-transparent focus:outline-none text-right"
                            />
                            <span className="font-bold text-[11px] ml-1 text-on-surface-variant">%</span>
                          </div>
                          <span className="text-on-surface-variant text-[11px] font-medium ml-2">sobre:</span>
                          <select
                            value={currentConfig.destino}
                            onChange={(e) =>
                              updateItemConfig(gasto.id, { destino: e.target.value as DestinoGasto })
                            }
                            className="bg-surface-container-lowest text-on-surface text-[11px] font-semibold py-0.5 px-2 rounded-lg border border-outline-variant/30 focus:outline-none"
                          >
                            <option value="costo_indirecto">Costo Directo Total</option>
                            <option value="mano_obra">Mano de Obra</option>
                            <option value="materiales">Materiales</option>
                            <option value="servicios">Servicios</option>
                          </select>
                        </div>
                      ) : currentConfig.modalidad === 'parametrico' ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <span className="text-on-surface-variant text-[11px] font-medium">Fórmula:</span>
                          <input
                            type="text"
                            value={currentConfig.formula || ''}
                            onChange={(e) => updateItemConfig(gasto.id, { formula: e.target.value })}
                            placeholder="ej: dias_obra * 5000"
                            className="flex-1 bg-surface-container-lowest text-on-surface font-mono text-xs px-2 py-0.5 rounded-lg border border-outline-variant/30 focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-on-surface-variant text-[11px] font-medium">Monto fijo:</span>
                          <div className="flex items-center bg-surface-container-lowest px-2 py-0.5 rounded-lg border border-outline-variant/30">
                            <span className="font-bold text-[11px] mr-1 text-on-surface-variant">$</span>
                            <input
                              type="number"
                              step="500"
                              min="0"
                              value={currentConfig.valor}
                              onChange={(e) =>
                                updateItemConfig(gasto.id, { valor: parseFloat(e.target.value) || 0 })
                              }
                              className="w-24 font-mono font-bold text-xs bg-transparent focus:outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sección: Gasto Libre Personalizado */}
        <div className="p-3 border-t border-outline-variant/15 bg-surface-container-low/70">
          {!showCustomExpenseRow ? (
            <button
              type="button"
              onClick={() => setShowCustomExpenseRow(true)}
              className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1.5 cursor-pointer py-0.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Agregar gasto libre no listado en el catálogo</span>
            </button>
          ) : (
            <div className="space-y-2 bg-surface-container p-2.5 rounded-xl border border-outline-variant/20">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface">
                <span>Nuevo Gasto Personalizado</span>
                <button
                  type="button"
                  onClick={() => setShowCustomExpenseRow(false)}
                  className="text-on-surface-variant hover:text-on-surface p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Nombre del gasto (ej: Seguro Caución)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="flex-1 min-w-[180px] bg-surface-container-lowest px-2.5 py-1 text-xs rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none"
                />
                <select
                  value={customModalidad}
                  onChange={(e) => setCustomModalidad(e.target.value as ModalidadGasto)}
                  className="bg-surface-container-lowest text-on-surface text-xs py-1 px-2 rounded-lg border border-outline-variant/30 focus:outline-none"
                >
                  <option value="porcentual">Porcentual (%)</option>
                  <option value="monto_fijo">Monto Fijo ($)</option>
                </select>
                {customModalidad === 'porcentual' && (
                  <select
                    value={customDestino}
                    onChange={(e) => setCustomDestino(e.target.value as DestinoGasto)}
                    className="bg-surface-container-lowest text-on-surface text-xs py-1 px-2 rounded-lg border border-outline-variant/30 focus:outline-none"
                  >
                    <option value="costo_indirecto">s/ Costo Directo</option>
                    <option value="mano_obra">s/ Mano de Obra</option>
                    <option value="materiales">s/ Materiales</option>
                    <option value="servicios">s/ Servicios</option>
                  </select>
                )}
                <div className="flex items-center bg-surface-container-lowest px-2 py-0.5 rounded-lg border border-outline-variant/30">
                  <span className="text-xs font-bold mr-1 text-on-surface-variant">
                    {customModalidad === 'porcentual' ? '%' : '$'}
                  </span>
                  <input
                    type="number"
                    value={customValor}
                    onChange={(e) => setCustomValor(parseFloat(e.target.value) || 0)}
                    className="w-16 font-mono text-xs bg-transparent focus:outline-none font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomExpense}
                  disabled={!customName.trim()}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg cursor-pointer transition shrink-0"
                >
                  Agregar a Selección
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Barra Inferior de Acción */}
        <div className="p-3 sm:p-4 border-t border-outline-variant/20 bg-surface-container-low flex items-center justify-between gap-2">
          <div className="text-xs">
            <span className="font-bold text-on-surface">
              {selectedCount} {selectedCount === 1 ? 'gasto seleccionado' : 'gastos seleccionados'}
            </span>
            <span className="hidden sm:inline text-on-surface-variant ml-2 text-[11px]">
              (Ctrl + Enter para insertar)
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmInsert}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-98"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
              <span>Insertar en Presupuesto ({selectedCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

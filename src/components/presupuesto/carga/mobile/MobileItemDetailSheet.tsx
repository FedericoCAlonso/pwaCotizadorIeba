import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Wrench,
  Truck,
  Sliders,
  FileText,
  ChevronLeft,
  ChevronRight,
  Check,
  Edit2
} from 'lucide-react';
import {
  ItemPresupuesto,
  Insumo,
  CategoriaManoDeObra,
  ParametroItem
} from '../../../../core/types';
import { formatARS } from '../../../../core/calculations';
import { useHaptics } from '../../../../hooks/useHaptics';
import { useEscapeKey } from '../../../../hooks/useEscapeKey';
import { MobileDetailMaterialsTab } from './detail/MobileDetailMaterialsTab';
import { MobileDetailLaborTab } from './detail/MobileDetailLaborTab';
import { MobileDetailServicesTab } from './detail/MobileDetailServicesTab';
import { MobileDetailParamsTab } from './detail/MobileDetailParamsTab';
import { MobileDetailNotesTab } from './detail/MobileDetailNotesTab';

export type MobileDetailTab = 'materiales' | 'mano_obra' | 'servicios' | 'parametros' | 'notas';

export interface MobileItemDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemPresupuesto | null;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  calculosVariables?: Record<string, number | string>;
  currentIndex?: number;
  totalItems?: number;
  initialTab?: MobileDetailTab;
  onPrevItem?: () => void;
  onNextItem?: () => void;
  onUpdateItem?: (updates: Partial<ItemPresupuesto>) => void;
  onAddMaterial: (material: Insumo, cantidad: number, formula?: string) => void;
  onRemoveMaterial: (index: number) => void;
  onUpdateMaterialFormula: (index: number, formula: string) => void;
  onOpenMaterialCatalog: () => void;
  onAddLabor: (categoriaId: string, horas: number, formula?: string) => void;
  onRemoveLabor: (index: number) => void;
  onUpdateLaborFormula: (index: number, formula: string) => void;
  onAddService: (descripcion: string, costo: number) => void;
  onRemoveService: (index: number) => void;
  onUpdateNotas?: (notas: string, exclusiones?: string) => void;
  onUpdateParametros?: (parametros: ParametroItem[]) => void;
}

export const MobileItemDetailSheet: React.FC<MobileItemDetailSheetProps> = ({
  isOpen,
  onClose,
  item,
  insumosMap,
  manoObraMap,
  calculosVariables,
  currentIndex,
  totalItems,
  initialTab = 'materiales',
  onPrevItem,
  onNextItem,
  onUpdateItem,
  onAddMaterial,
  onRemoveMaterial,
  onUpdateMaterialFormula,
  onOpenMaterialCatalog,
  onAddLabor,
  onRemoveLabor,
  onUpdateLaborFormula,
  onAddService,
  onRemoveService,
  onUpdateNotas,
  onUpdateParametros
}) => {
  const haptics = useHaptics();
  const [activeTab, setActiveTab] = useState<MobileDetailTab>(initialTab);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (item) {
      setEditedTitle(item.descripcion || '');
      setIsEditingTitle(false);
    }
  }, [item?.id]);

  useEscapeKey(isOpen, onClose);

  if (!isOpen || !item) return null;

  const insumos = item.insumosSnapshot || [];
  const manoObra = item.manoObraSnapshot || [];
  const servicios = item.serviciosTercerizados || [];
  const parametros = item.parametros || [];
  const hasNotes = Boolean(item.notasTecnicas || item.clausulaExclusiones);

  const costoDirectoTotal = item.costoDirectoTotal ?? item.costoTotal ?? 0;
  const precioFinalItem = item.precioFinalItem ?? item.precioVentaTotal ?? item.costoDirectoTotal ?? 0;

  const hasPager = totalItems !== undefined && totalItems > 1;
  const canPrev = Boolean(hasPager && currentIndex !== undefined && currentIndex > 0);
  const canNext = Boolean(hasPager && currentIndex !== undefined && currentIndex < totalItems - 1);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-surface rounded-t-3xl border-t border-outline-variant/30 shadow-2xl flex flex-col h-[94dvh] overflow-hidden animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Detalle y despiece de ítem"
      >
        {/* ─── Cabecera fija del Sheet con Drag Handle y Precios ─── */}
        <div className="bg-surface-container-high border-b border-outline-variant/20 px-4 pt-2 pb-3 shrink-0">
          {/* Tirador visual */}
          <div className="flex justify-center mb-2">
            <div className="w-12 h-1.5 rounded-full bg-outline-variant/50" />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase font-mono tracking-wider">
                  Ítem
                </span>
                <span className="text-[11px] font-mono text-on-surface-variant font-bold">
                  {item.cantidad} {item.unidad || 'u'}
                </span>
              </div>
              {isEditingTitle ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editedTitle.trim() && onUpdateItem) {
                          onUpdateItem({ descripcion: editedTitle.trim() });
                        }
                        setIsEditingTitle(false);
                      } else if (e.key === 'Escape') {
                        setEditedTitle(item.descripcion || '');
                        setIsEditingTitle(false);
                      }
                    }}
                    className="flex-1 px-2 py-1 text-sm bg-surface border border-primary rounded-lg text-on-surface focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (editedTitle.trim() && onUpdateItem) {
                        onUpdateItem({ descripcion: editedTitle.trim() });
                      }
                      setIsEditingTitle(false);
                    }}
                    className="p-1.5 rounded-lg bg-primary text-on-primary cursor-pointer"
                    aria-label="Confirmar cambio de nombre"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <h3 className="text-base font-bold text-on-surface truncate leading-snug">
                    {item.descripcion || 'Sin descripción'}
                  </h3>
                  {onUpdateItem && (
                    <button
                      type="button"
                      onClick={() => {
                        haptics.selection();
                        setEditedTitle(item.descripcion || '');
                        setIsEditingTitle(true);
                      }}
                      className="p-1 text-on-surface-variant/50 hover:text-primary rounded-md transition-colors cursor-pointer shrink-0"
                      title="Editar descripción del ítem"
                      aria-label="Editar descripción"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                haptics.selection();
                onClose();
              }}
              className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer shrink-0 -mr-1"
              aria-label="Cerrar detalle"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Fila de Totales de la Partida */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/15 text-xs">
            <span className="font-mono text-on-surface-variant">
              Costo Directo: <strong className="text-on-surface font-semibold">{formatARS(costoDirectoTotal)}</strong>
            </span>
            <span className="font-mono text-primary font-bold">
              Precio Venta: <span className="text-sm font-extrabold">{formatARS(precioFinalItem)}</span>
            </span>
          </div>
        </div>

        {/* ─── Barra de Pestañas Táctil con Scroll Horizontal ─── */}
        <div className="bg-surface-container-low border-b border-outline-variant/20 px-2 py-1.5 shrink-0 overflow-x-auto no-scrollbar flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setActiveTab('materiales');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[38px] active:scale-95 ${
              activeTab === 'materiales'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Materiales ({insumos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setActiveTab('mano_obra');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[38px] active:scale-95 ${
              activeTab === 'mano_obra'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Mano Obra ({manoObra.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setActiveTab('servicios');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[38px] active:scale-95 ${
              activeTab === 'servicios'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Servicios ({servicios.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setActiveTab('parametros');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[38px] active:scale-95 ${
              activeTab === 'parametros'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Parámetros ({parametros.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setActiveTab('notas');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[38px] active:scale-95 ${
              activeTab === 'notas'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Notas</span>
            {hasNotes && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />}
          </button>
        </div>

        {/* ─── Contenido con Scroll Independiente ─── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 bg-surface">
          {activeTab === 'materiales' && (
            <MobileDetailMaterialsTab
              insumos={insumos}
              itemCantidad={item.cantidad || 1}
              insumosMap={insumosMap}
              onAddMaterial={onAddMaterial}
              onRemoveMaterial={onRemoveMaterial}
              onUpdateMaterialFormula={onUpdateMaterialFormula}
              onOpenMaterialCatalog={onOpenMaterialCatalog}
            />
          )}

          {activeTab === 'mano_obra' && (
            <MobileDetailLaborTab
              manoObra={manoObra}
              manoObraMap={manoObraMap}
              onAddLabor={onAddLabor}
              onRemoveLabor={onRemoveLabor}
              onUpdateLaborFormula={onUpdateLaborFormula}
            />
          )}

          {activeTab === 'servicios' && (
            <MobileDetailServicesTab
              servicios={servicios}
              onAddService={onAddService}
              onRemoveService={onRemoveService}
            />
          )}

          {activeTab === 'parametros' && (
            <MobileDetailParamsTab
              parametros={parametros}
              calculosVariables={calculosVariables}
              onUpdateParametros={(params) => onUpdateParametros?.(params)}
            />
          )}

          {activeTab === 'notas' && (
            <MobileDetailNotesTab
              notasTecnicas={item.notasTecnicas}
              clausulaExclusiones={item.clausulaExclusiones}
              onUpdateNotas={onUpdateNotas}
            />
          )}
        </div>

        {/* ─── Footer Ergonómico de Pulgar con Paginador Secuencial ─── */}
        <div className="bg-surface-container-high border-t border-outline-variant/30 px-4 py-2.5 pb-safe flex items-center justify-between gap-3 shrink-0">
          {/* Paginador Siguiente / Anterior */}
          {hasPager ? (
            <div className="flex items-center gap-1.5 bg-surface rounded-xl p-1 border border-outline-variant/30">
              <button
                type="button"
                onClick={() => {
                  haptics.selection();
                  onPrevItem?.();
                }}
                disabled={!canPrev}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-on-surface hover:bg-surface-container-high disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                aria-label="Ítem anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-mono text-xs font-bold text-on-surface px-1 min-w-[48px] text-center">
                {(currentIndex ?? 0) + 1}/{totalItems}
              </span>
              <button
                type="button"
                onClick={() => {
                  haptics.selection();
                  onNextItem?.();
                }}
                disabled={!canNext}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-on-surface hover:bg-surface-container-high disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                aria-label="Siguiente ítem"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div />
          )}

          {/* Botón Principal "Listo" */}
          <button
            type="button"
            onClick={() => {
              haptics.selection();
              onClose();
            }}
            className="flex-1 max-w-[160px] flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-xs hover:opacity-95 active:scale-95 transition-all min-h-[44px] cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Listo</span>
          </button>
        </div>
      </div>
    </div>
  );
};

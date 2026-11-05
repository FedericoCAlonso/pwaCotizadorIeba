import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ItemPresupuesto,
  CapituloPresupuesto,
  InsumoSnapshot,
  ManoObraSnapshot,
  ServicioTercerizado,
  Insumo,
  CategoriaManoDeObra,
  TareaTipo
} from '../../../core/types';
import { TotalesPresupuestoResultado, formatARS, roundMoney, safeNum } from '../../../core/calculations';
import { MaterialCatalogSuggestion } from '../../../core/materialSuggestions';
import { SmartSheetVariablesBar } from './SmartSheetVariablesBar';
import { SmartSheetItemizadoTable } from './SmartSheetItemizadoTable';
import { SmartSheetLineasTable } from './SmartSheetLineasTable';
import { SmartSheetCascadaBar } from './SmartSheetCascadaBar';
import { SmartSheetNarrowView } from './SmartSheetNarrowView';
import { DollarSign } from 'lucide-react';

/**
 * Propiedades del componente principal SmartSheetView (Planilla Inteligente).
 */
export interface SmartSheetViewProps {
  /** Lista de ítems en el presupuesto */
  items: ItemPresupuesto[];
  /** Setter reactivo para actualizar la lista de ítems de la cotización */
  setItems?: React.Dispatch<React.SetStateAction<ItemPresupuesto[]>>;
  /** Capítulos de agrupación */
  capitulos: CapituloPresupuesto[];
  /** Totales calculados de la cotización por calcularTotalesPresupuesto */
  totales: TotalesPresupuestoResultado;
  /** Variables de obra globales que alimentan las fórmulas */
  calculosVariables?: Record<string, number | string>;
  /** Callback opcional para volver o alternar a la vista clásica */
  onToggleClassicView?: () => void;
  /** Callback opcional directo para actualizar snapshots de un ítem */
  onUpdateItemLines?: (
    itemId: string,
    updatedSnapshots: {
      insumosSnapshot?: InsumoSnapshot[];
      manoObraSnapshot?: ManoObraSnapshot[];
      serviciosTercerizados?: ServicioTercerizado[];
    }
  ) => void;
  /** Mapa de insumos y materiales del catálogo con precios vigentes */
  insumosMap?: Map<string, Insumo>;
  /** Mapa de mano de obra del catálogo */
  manoObraMap?: Map<string, CategoriaManoDeObra>;
  /** Tareas tipo disponibles en el catálogo */
  tareasTipo?: TareaTipo[];
  /** Forzar modo pantalla angosta (< 700 px) para pruebas o configuración */
  isNarrow?: boolean;
}

/**
 * SmartSheetView: Nueva pantalla de Planilla Inteligente de esquema fijo en 3 zonas apiladas.
 * - Línea al tope: Variables de la obra (bocas, superficie, etc.) que alimentan las fórmulas.
 * - Zona 1 (arriba): Itemizado con columnas Número, Descripción, Costo Directo, Precio Final (capítulos como agrupación).
 * - Zona 2 (medio): Líneas del ítem seleccionado (Materiales, Mano de Obra, Servicios) con fórmulas y resultado.
 * - Zona 3 (abajo): Cascada APU de costos del ítem seleccionado (Costo Directo → GG → Beneficio → Subtotal → Impuestos → Precio Final).
 * Modo de solo lectura en Fase 1, sin tocar la lógica de cálculo existente.
 */
export const SmartSheetView: React.FC<SmartSheetViewProps> = ({
  items,
  setItems,
  capitulos,
  totales,
  calculosVariables,
  onToggleClassicView,
  onUpdateItemLines: onUpdateItemLinesProp,
  insumosMap,
  manoObraMap,
  tareasTipo = [],
  isNarrow: isNarrowProp
}) => {
  // Detección de pantalla angosta (< 700 px) para Fase 4
  const [isWindowNarrow, setIsWindowNarrow] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 700;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => setIsWindowNarrow(window.innerWidth < 700);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isNarrow = isNarrowProp !== undefined ? isNarrowProp : isWindowNarrow;

  // Mapa de ítems calculados determinísticamente para acceso O(1)
  const calculatedItemsMap = useMemo(() => {
    const map = new Map<string, ItemPresupuesto>();
    (totales?.itemsCalculados || []).forEach((ci) => {
      map.set(ci.id, ci);
    });
    return map;
  }, [totales?.itemsCalculados]);

  // Sugerencias de catálogo de materiales para autocompletado y pegado (Fase 3)
  const materialSuggestions: MaterialCatalogSuggestion[] = useMemo(() => {
    if (insumosMap && insumosMap.size > 0) {
      return Array.from(insumosMap.values()).map((ins) => ({
        id: ins.id,
        nombre: ins.nombre,
        unidad: ins.unidad || 'u',
        precioVigente: safeNum(ins.precioActual),
        marcaModelo: ins.marca?.trim() || 'sin definir',
        categoriaId: ins.categoria
      }));
    }
    return [];
  }, [insumosMap]);

  // Selección del ítem activo: por defecto el primer ítem si existe
  const [selectedItemId, setSelectedItemId] = useState<string | null>(() => {
    return items.length > 0 ? items[0].id : null;
  });

  // Asegurar que si el ítem seleccionado ya no existe, seleccione el primero disponible
  const currentSelectedId = useMemo(() => {
    if (selectedItemId && items.some(it => it.id === selectedItemId)) {
      return selectedItemId;
    }
    return items.length > 0 ? items[0].id : null;
  }, [selectedItemId, items]);

  const selectedItem = useMemo(() => {
    if (!currentSelectedId) return null;
    return items.find(it => it.id === currentSelectedId) || null;
  }, [currentSelectedId, items]);

  const calculatedSelectedItem = useMemo(() => {
    if (!currentSelectedId) return null;
    return calculatedItemsMap.get(currentSelectedId) || null;
  }, [currentSelectedId, calculatedItemsMap]);

  // Actualizar líneas y snapshots de un ítem, recalculando sus costos directos y cascada
  const handleUpdateItemLines = useCallback(
    (
      itemId: string,
      updatedSnapshots: {
        insumosSnapshot?: InsumoSnapshot[];
        manoObraSnapshot?: ManoObraSnapshot[];
        serviciosTercerizados?: ServicioTercerizado[];
      }
    ) => {
      if (onUpdateItemLinesProp) {
        onUpdateItemLinesProp(itemId, updatedSnapshots);
        return;
      }
      if (!setItems) return;

      setItems((prevItems) =>
        prevItems.map((item) => {
          if (item.id !== itemId) return item;

          const insumos = updatedSnapshots.insumosSnapshot ?? item.insumosSnapshot ?? [];
          const manoObra = updatedSnapshots.manoObraSnapshot ?? item.manoObraSnapshot ?? [];
          const servicios = updatedSnapshots.serviciosTercerizados ?? item.serviciosTercerizados ?? [];

          // Recálculo determinista de costos directos
          const costoInsumos = roundMoney(
            insumos.reduce((acc, i) => acc + safeNum(i.subtotalInsumo), 0)
          );
          const costoManoObra = roundMoney(
            manoObra.reduce((acc, m) => acc + safeNum(m.subtotalManoObra), 0)
          );
          const costoServicios = roundMoney(
            servicios.reduce(
              (acc, s) => acc + safeNum(s.costo) * (safeNum(s.cantidad) > 0 ? safeNum(s.cantidad) : 1),
              0
            )
          );
          const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios);
          const cant = safeNum(item.cantidad) > 0 ? safeNum(item.cantidad) : 1;
          const costoUnitario = roundMoney(costoDirectoTotal / cant);

          return {
            ...item,
            insumosSnapshot: insumos,
            manoObraSnapshot: manoObra,
            serviciosTercerizados: servicios,
            costoInsumos,
            costoManoObra,
            costoServicios,
            costoDirectoTotal,
            costoUnitario,
            costoTotal: costoDirectoTotal,
            desacoplado: item.tareaTipoId ? true : item.desacoplado
          };
        })
      );
    },
    [onUpdateItemLinesProp, setItems]
  );

  // Fase 4: Para pantallas angostas (< 700 px), mostrar la vista móvil optimizada
  if (isNarrow) {
    return (
      <SmartSheetNarrowView
        items={items}
        capitulos={capitulos}
        totales={totales}
        selectedItemId={currentSelectedId}
        onSelectItem={setSelectedItemId}
        onUpdateItemLines={handleUpdateItemLines}
        materialSuggestions={materialSuggestions}
      />
    );
  }

  return (
    <div
      className="flex-1 min-h-0 w-full flex flex-col bg-surface select-none outline-none overflow-hidden"
      role="main"
      aria-label="Planilla Inteligente de Cotización"
    >
      {/* ─── Línea al tope: Variables de la Obra ─── */}
      <SmartSheetVariablesBar calculosVariables={calculosVariables} />

      {/* ─── Zona 1: ITEMIZADO (arriba) ─── */}
      <div className="flex-1 min-h-[140px] flex flex-col overflow-hidden">
        <SmartSheetItemizadoTable
          items={items}
          capitulos={capitulos}
          calculatedItemsMap={calculatedItemsMap}
          selectedItemId={currentSelectedId}
          onSelectItem={setSelectedItemId}
        />
      </div>

      {/* ─── Zona 2: LÍNEAS del ítem seleccionado (en el medio) ─── */}
      <div className="flex-1 min-h-[140px] flex flex-col overflow-hidden">
        <SmartSheetLineasTable
          selectedItem={selectedItem}
          calculatedItem={calculatedSelectedItem}
          onUpdateItemLines={handleUpdateItemLines}
          calculosVariables={calculosVariables}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          tareasTipo={tareasTipo}
          materialSuggestions={materialSuggestions}
        />
      </div>

      {/* ─── Zona 3: CASCADA APU del ítem seleccionado (abajo, solo lectura) ─── */}
      <SmartSheetCascadaBar
        selectedItem={selectedItem}
        calculatedItem={calculatedSelectedItem}
      />

      {/* ─── Barra de Totales Generales de la Cotización (Resumen Global) ─── */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-container-highest border-t border-outline-variant/30 text-xs font-mono text-on-surface select-none shrink-0">
        <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
          <span className="text-on-surface-variant text-[11px] font-sans font-semibold">
            TOTALES GLOBALES:
          </span>
          <span className="text-on-surface-variant">
            Costo Directo:{' '}
            <strong className="text-on-surface">
              {formatARS(totales?.subtotalCostosDirectos ?? 0)}
            </strong>
          </span>
          <span className="text-on-surface-variant hidden sm:inline">
            Gastos Generales:{' '}
            <strong className="text-on-surface">
              {formatARS(totales?.gastosGeneralesTotal ?? totales?.subtotalCostosIndirectos ?? 0)}
            </strong>
          </span>
          <span className="text-on-surface-variant hidden md:inline">
            Beneficio:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {formatARS(totales?.beneficioMonto ?? 0)}
            </strong>
          </span>
          <span className="text-on-surface-variant hidden lg:inline">
            Impuestos:{' '}
            <strong className="text-on-surface">
              {formatARS(totales?.montoImpuestosTotal ?? 0)}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-baseline gap-1.5 text-primary">
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider hidden xs:inline">
              Precio Final:
            </span>
            <span className="text-sm sm:text-base font-extrabold">
              {formatARS(totales?.precioFinalGlobal ?? totales?.totalARS ?? 0)}
            </span>
          </div>

          {onToggleClassicView && (
            <button
              type="button"
              onClick={onToggleClassicView}
              className="ml-3 px-2 py-1 text-[11px] font-sans font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer border border-primary/20"
              title="Alternar a la vista clásica del editor"
            >
              Ver Editor Clásico
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

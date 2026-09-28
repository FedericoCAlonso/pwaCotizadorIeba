import React from 'react';
import {
  ItemPresupuesto,
  TareaTipo,
  ParametroItem,
  InsumoSnapshot,
  ManoObraSnapshot,
  ServicioTercerizado,
  Insumo,
  CategoriaManoDeObra
} from '../../../core/types';
import { ItemDetailPanelHeader } from './ItemDetailPanelHeader';
import { ItemDetailParametersSection } from './ItemDetailParametersSection';
import { ItemDetailRubrosSection } from './ItemDetailRubrosSection';
import { ItemDetailAdvancedSection } from './ItemDetailAdvancedSection';
import { formatARS, TotalesPresupuestoResultado } from '../../../core/calculations';
import { Calculator, ChevronRight, BarChart2 } from 'lucide-react';

interface ItemDetailPanelProps {
  item: ItemPresupuesto | null;
  isOpen: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  tareasTipo?: TareaTipo[];
  insumosMap?: Map<string, Insumo>;
  manoObraMap?: Map<string, CategoriaManoDeObra>;
  totales?: TotalesPresupuestoResultado;
  onClose: () => void;
  onUpdateParametros: (parametros: ParametroItem[]) => void;
  onUpdateCantidad: (cantidad: number, formulaCantidad?: string) => void;
  onUpdateLines: (updates: {
    insumosSnapshot?: InsumoSnapshot[];
    manoObraSnapshot?: ManoObraSnapshot[];
    serviciosTercerizados?: ServicioTercerizado[];
    condicionTrabajo?: 'normal' | 'dificultosa' | 'favorable';
    precioManual?: number;
    notasTecnicas?: string;
  }) => void;
  onDesacoplar?: () => void;
  onActualizarVersion?: () => void;
  onSaveAsTareaTipo?: (item: ItemPresupuesto) => void;
  onOpenMaterialPicker?: () => void;
}

export const ItemDetailPanel: React.FC<ItemDetailPanelProps> = ({
  item,
  isOpen,
  isCollapsed = false,
  onToggleCollapse,
  tareasTipo = [],
  insumosMap = new Map(),
  manoObraMap = new Map(),
  totales,
  onClose,
  onUpdateParametros,
  onUpdateCantidad,
  onUpdateLines,
  onDesacoplar,
  onActualizarVersion,
  onSaveAsTareaTipo,
  onOpenMaterialPicker
}) => {
  // En desktop si está colapsado o no está abierto
  if (isCollapsed) {
    return (
      <div className="hidden md:flex flex-col items-center justify-start py-4 px-1 bg-surface border-l border-outline-variant/30 select-none">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors cursor-pointer"
          title="Abrir Inspector de Partida"
        >
          <BarChart2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (!isOpen || !item) {
    return (
      <aside className="hidden md:flex flex-col w-80 lg:w-96 bg-surface-container-lowest border-l border-outline-variant/30 p-6 select-none items-center justify-center text-center text-on-surface-variant/60">
        <BarChart2 className="w-10 h-10 text-on-surface-variant/30 mb-2" />
        <h4 className="text-sm font-semibold text-on-surface">Inspector de Partida</h4>
        <p className="text-xs max-w-xs mt-1">
          Hacé clic en cualquier fila de la planilla para inspeccionar sus fórmulas, parámetros y detalles técnicos.
        </p>
      </aside>
    );
  }

  return (
    <>
      {/* Backdrop transparente en móvil */}
      <div
        className="fixed inset-0 bg-black/30 z-30 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel lateral: derecho en escritorio, bottom sheet en móvil */}
      <aside
        className={`fixed md:static inset-x-0 bottom-0 z-40 md:z-auto h-[85vh] md:h-full w-full md:w-96 lg:w-[420px] bg-surface border-t md:border-t-0 md:border-l border-outline-variant/30 flex flex-col rounded-t-3xl md:rounded-none shadow-xl md:shadow-none transition-transform duration-200 select-none overflow-hidden shrink-0`}
      >
        {/* Encabezado con estado y desacople */}
        <ItemDetailPanelHeader
          item={item}
          tareasTipo={tareasTipo}
          onClose={onClose}
          onDesacoplar={onDesacoplar}
          onActualizarVersion={onActualizarVersion}
          onSaveAsTareaTipo={() => onSaveAsTareaTipo?.(item)}
        />

        {/* Cuerpo scrolleable */}
        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/20">
          {/* 1. Parámetros del Ítem */}
          <ItemDetailParametersSection
            parametros={item.parametros}
            erroresFormulas={item.erroresFormulas}
            onUpdateParametros={onUpdateParametros}
          />

          {/* 2. Cantidad Principal del Ítem */}
          <div className="p-3.5 select-none bg-surface-container-lowest">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-secondary" />
                <span>Cantidad Principal</span>
              </label>
              <span className="text-xs font-mono font-bold text-primary">
                {item.cantidad} {item.unidad || 'u'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                defaultValue={item.formulaCantidad || String(item.cantidad)}
                placeholder="Número o fórmula =..."
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val.startsWith('=')) {
                    onUpdateCantidad(item.cantidad, val);
                  } else {
                    const num = Number(val.replace(',', '.'));
                    onUpdateCantidad(isNaN(num) || num <= 0 ? 1 : num, undefined);
                  }
                }}
                className="flex-1 px-2.5 py-1 text-xs font-mono bg-surface border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                defaultValue={item.unidad || 'u'}
                onBlur={(e) => onUpdateLines({ ...item, unidad: e.target.value.trim() || 'u' } as any)}
                placeholder="Unidad"
                className="w-16 px-2 py-1 text-xs text-center font-medium bg-surface border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none"
              />
            </div>
          </div>

          {/* 3. Desglose por Rubro (Materiales, Mano de Obra, Servicios) */}
          <ItemDetailRubrosSection
            insumosSnapshot={item.insumosSnapshot}
            manoObraSnapshot={item.manoObraSnapshot}
            serviciosTercerizados={item.serviciosTercerizados}
            erroresFormulas={item.erroresFormulas}
            insumosMap={insumosMap}
            manoObraMap={manoObraMap}
            onUpdateLines={onUpdateLines}
            onOpenMaterialPicker={onOpenMaterialPicker}
          />

          {/* 4. Sección Avanzada (Plegada) */}
          <ItemDetailAdvancedSection
            item={item}
            onUpdateItem={onUpdateLines}
          />
        </div>

        {/* Resumen de totales de la partida fijado al pie */}
        <div className="p-3 bg-surface-container-high border-t border-outline-variant/30 flex items-center justify-between text-xs font-mono select-none">
          <div>
            <span className="text-[10px] text-on-surface-variant block uppercase tracking-wider font-sans font-semibold">
              Costo Directo
            </span>
            <span className="font-bold text-on-surface">
              {formatARS(item.costoDirectoTotal || 0)}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-secondary block uppercase tracking-wider font-sans font-semibold">
              Precio Sugerido Venta
            </span>
            <span className="font-bold text-secondary text-sm">
              {formatARS(item.precioFinalItem ?? item.precioVentaTotal ?? item.costoDirectoTotal ?? 0)}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};

import React from 'react';
import {
  Package,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Sliders,
  ShieldAlert,
  Ruler,
  Calculator
} from 'lucide-react';
import { ItemPresupuesto } from '../../core/types';
import { formatARS, roundMoney } from '../../core/calculations';
import { OnlinePriceButton } from '../OnlinePriceButton';
import { MathInput } from '../common/MathInput';

interface PresupuestoItemRowProps {
  item: ItemPresupuesto;
  index: number;
  calcItem: ItemPresupuesto;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onUpdateItemCondicion: (index: number, condicion: 'normal' | 'dificultosa' | 'favorable') => void;
  onUpdateItemQuantity: (index: number, qty: number, formula?: string) => void;
  onUpdateItemUnit: (index: number, unit: string) => void;
  onUpdateItemUnitDirectCost: (index: number, cost: number) => void;
  onUpdateItemDescription: (index: number, desc: string) => void;
  onRemoveItem: (index: number) => void;
  onSaveAsTemplate: (item: ItemPresupuesto) => void;
  onOpenParametricModal?: (index: number) => void;
  onOpenMaterialModal?: (index: number) => void;
  condicionesTrabajo: Array<{ value: string; label: string }>;
}

export const PresupuestoItemRow: React.FC<PresupuestoItemRowProps> = ({
  item,
  index,
  calcItem,
  isExpanded,
  onToggleExpand,
  onUpdateItemCondicion,
  onUpdateItemQuantity,
  onUpdateItemUnit,
  onUpdateItemUnitDirectCost,
  onUpdateItemDescription,
  onRemoveItem,
  onSaveAsTemplate,
  onOpenParametricModal,
  onOpenMaterialModal,
  condicionesTrabajo,
}) => {
  const hasSnapshots =
    (item.insumosSnapshot && item.insumosSnapshot.length > 0) ||
    (item.manoObraSnapshot && item.manoObraSnapshot.length > 0);
  const isCustom = !item.tareaTipoId || !hasSnapshots;

  return (
    <div className="bg-surface-container-highest/40 border border-outline-variant/20 rounded-2xl p-4 space-y-3 hover:border-outline-variant/40 transition">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <label className="text-[10px] text-on-surface-variant font-semibold uppercase">
              {item.esAdHoc
                ? 'Ítem Ad-Hoc (Sin Catálogo)'
                : isCustom
                ? 'Partida Libre — Descripción'
                : 'Descripción de la Partida'}
            </label>
            {item.esAdHoc && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-tertiary-container text-on-tertiary-container select-none">
                Ad-Hoc
              </span>
            )}
          </div>
          <input
            type="text"
            value={item.descripcion}
            onChange={(e) => onUpdateItemDescription(index, e.target.value)}
            className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-1.5 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          {/* Badges de Parámetros Dinámicos del Trabajo Tipo */}
          {item.valoresVariables && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => onOpenParametricModal?.(index)}
                className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 font-mono flex items-center gap-1.5 transition"
                title="Click para reajustar los parámetros de este trabajo tipo"
              >
                <Sliders className="w-3 h-3" />
                <span>Parámetros:</span>
                {Object.entries(item.valoresVariables).map(([key, val]) => (
                  <span key={key} className="font-semibold opacity-90">
                    {key}: {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(2)) : val}
                  </span>
                ))}
              </button>

              {item.clausulaExclusiones && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 font-medium"
                  title={item.clausulaExclusiones}
                >
                  <ShieldAlert className="w-3 h-3 text-amber-500" />
                  <span>Exclusiones Activas</span>
                </span>
              )}
            </div>
          )}
          {/* Badges de Cómputo Paramétrico de Materiales */}
          {item.parametrosEstimacionMaterial && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => onOpenMaterialModal?.(index)}
                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1 transition text-left"
                title="Click para reajustar cálculo paramétrico de material"
              >
                <Ruler className="w-3 h-3 shrink-0" />
                <span>{item.parametrosEstimacionMaterial.explicacionCalculo}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5">
          {/* Modificador por Condición de Obra */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-on-surface-variant">Obra:</span>
            <select
              value={item.condicionTrabajo || 'normal'}
              onChange={(e) => onUpdateItemCondicion(index, e.target.value as any)}
              className="bg-surface-container-highest border border-outline-variant/30 rounded-xl px-2 py-1 text-xs text-on-surface focus:outline-none"
            >
              {condicionesTrabajo.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity with MathInput, Unit & Parametric Ruler Button */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-on-surface-variant font-semibold">Cant:</span>
            <div className="w-28">
              <MathInput
                value={item.cantidad}
                formula={item.formulaCantidad}
                onChange={(val, form) => onUpdateItemQuantity(index, val, form)}
                suffix={item.unidad}
                size="sm"
                min={0.01}
                step={0.1}
              />
            </div>
            <input
              type="text"
              value={item.unidad}
              onChange={(e) => onUpdateItemUnit(index, e.target.value)}
              className="w-12 bg-surface-container-highest border border-outline-variant/30 rounded-xl px-1.5 py-1 text-xs text-on-surface text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
              title="Unidad de medida (ej: u, boca, m, gl)"
            />
            {onOpenMaterialModal && (
              <button
                type="button"
                onClick={() => onOpenMaterialModal(index)}
                className="p-1.5 bg-surface-container-highest hover:bg-primary/20 hover:text-primary text-on-surface-variant rounded-xl border border-outline-variant/30 transition flex items-center justify-center shrink-0"
                title="Cómputo Métrico Paramétrico (Superficie, Cañería, Desperdicio)"
              >
                <Ruler className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Direct Unit Cost */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-on-surface-variant">Costo Unit:</span>
            {isCustom ? (
              <div className="w-28">
                <MathInput
                  value={
                    item.costoUnitario !== undefined
                      ? item.costoUnitario
                      : roundMoney((item.costoDirectoTotal || 0) / (item.cantidad || 1))
                  }
                  onChange={(val) => onUpdateItemUnitDirectCost(index, val)}
                  prefix="$"
                  size="sm"
                  min={0}
                  step={1}
                />
              </div>
            ) : (
              <span className="font-mono text-xs font-bold text-on-surface bg-surface-container px-2.5 py-1 rounded-xl border border-outline-variant/20">
                {formatARS(calcItem.costoUnitario ?? (item.costoDirectoTotal / (item.cantidad || 1)))}
              </span>
            )}
          </div>

          {/* Client APU Sale Price Badge */}
          <div className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-xl flex items-center gap-1.5 text-primary font-mono">
            <span className="text-[10px] font-bold uppercase tracking-wider">Venta:</span>
            <span className="text-xs font-bold font-mono">
              {formatARS(calcItem.precioVentaClienteUnitario ?? item.precioVentaUnitario)}
            </span>
            <span className="text-[10px] opacity-75">/{item.unidad || 'u'}</span>
          </div>

          {/* Expand Breakdown Toggle (if has snapshots) */}
          {hasSnapshots && (
            <button
              type="button"
              onClick={() => onToggleExpand(item.id)}
              className="p-1.5 text-on-surface-variant hover:text-primary rounded-xl hover:bg-surface-variant transition-colors"
              title={isExpanded ? 'Ocultar desglose de insumos y mano de obra' : 'Ver desglose de insumos y mano de obra'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}

          {/* Parametric Job Complexity Settings Button */}
          {onOpenParametricModal && (
            <button
              type="button"
              onClick={() => onOpenParametricModal(index)}
              className={`p-1.5 rounded-xl transition-colors ${
                item.parametrosTrabajoTipo
                  ? 'text-primary bg-primary/10 hover:bg-primary/20'
                  : 'text-on-surface-variant hover:text-primary hover:bg-surface-variant'
              }`}
              title="Configurar parámetros de complejidad (Antigüedad, Altura, Accesibilidad, Desarmado)"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onSaveAsTemplate(item)}
            className="p-1.5 text-primary hover:bg-primary/10 rounded-xl transition-colors"
            title="Guardar este módulo/partida como Trabajo Tipo"
          >
            <Sparkles className="w-4 h-4 text-primary" />
          </button>

          <button
            type="button"
            onClick={() => onRemoveItem(index)}
            className="p-1.5 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors"
            title="Eliminar ítem"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible Insumos & Mano de Obra Snapshot Breakdown */}
      {isExpanded && hasSnapshots && (
        <div className="bg-surface-container-low/90 p-3.5 rounded-xl border border-outline-variant/30 space-y-3 text-xs">
          {/* Insumos Snapshot */}
          {item.insumosSnapshot && item.insumosSnapshot.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-primary tracking-wider">
                <span>Materiales e Insumos ({item.insumosSnapshot.length})</span>
                <span className="font-mono">{formatARS(item.costoInsumos)}</span>
              </div>
              <div className="space-y-1 divide-y divide-outline-variant/10">
                {item.insumosSnapshot.map((ins, iIdx) => (
                  <div key={iIdx} className="pt-1 flex items-center justify-between text-on-surface-variant text-[11px]">
                    <div className="flex items-center gap-1.5 truncate flex-1">
                      <span className="truncate">{ins.nombre}</span>
                      <OnlinePriceButton tipo="material" customNombre={ins.nombre} size="xs" variant="icon" />
                    </div>
                    <div className="flex items-center gap-3 font-mono shrink-0 ml-2">
                      <span>
                        {ins.cantidadTotal} {ins.unidad} × {formatARS(ins.precioUnitarioCongelado)}
                      </span>
                      <strong className="text-on-surface font-semibold">{formatARS(ins.subtotalInsumo)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mano de Obra Snapshot */}
          {item.manoObraSnapshot && item.manoObraSnapshot.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-outline-variant/20">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-primary tracking-wider">
                <span>Mano de Obra ({item.manoObraSnapshot.length})</span>
                <span className="font-mono">{formatARS(item.costoManoObra)}</span>
              </div>
              <div className="space-y-1 divide-y divide-outline-variant/10">
                {item.manoObraSnapshot.map((mo, mIdx) => (
                  <div key={mIdx} className="pt-1 flex items-center justify-between text-on-surface-variant text-[11px]">
                    <span className="truncate flex-1">{mo.nombreCategoria}</span>
                    <div className="flex items-center gap-3 font-mono shrink-0 ml-2">
                      <span>
                        {mo.horasTotales} hs × {formatARS(mo.costoHoraCongelado)}/h
                      </span>
                      <strong className="text-on-surface font-semibold">{formatARS(mo.subtotalManoObra)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Servicios Tercerizados Snapshot */}
          {item.serviciosTercerizados && item.serviciosTercerizados.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-outline-variant/20">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 tracking-wider">
                <span>Servicios Tercerizados ({item.serviciosTercerizados.length})</span>
                <span className="font-mono">{formatARS(item.costoServiciosTercerizados || 0)}</span>
              </div>
              <div className="space-y-1 divide-y divide-outline-variant/10">
                {item.serviciosTercerizados.map((st, sIdx) => (
                  <div key={sIdx} className="pt-1 flex items-center justify-between text-on-surface-variant text-[11px]">
                    <span className="truncate flex-1">
                      {st.descripcion} {st.nombreProveedor ? `(${st.nombreProveedor})` : ''}
                    </span>
                    <strong className="text-on-surface font-mono font-semibold">{formatARS(st.costo)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Breakdown Cost Footer per Item */}
      <div className="bg-surface-container-highest/60 p-3 rounded-xl border border-outline-variant/20 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-on-surface-variant">
          <span>
            Insumos: <strong className="text-on-surface">{formatARS(item.costoInsumos)}</strong>
          </span>
          <span>•</span>
          <span>
            Mano Obra: <strong className="text-on-surface">{formatARS(item.costoManoObra)}</strong>
          </span>
          <span>•</span>
          <span>
            Costo Directo (C):{' '}
            <strong className="text-on-surface font-mono font-bold">
              {formatARS(calcItem.costoDirectoTotal ?? item.costoDirectoTotal)}
            </strong>
            <span className="text-[10px] text-on-surface-variant ml-1 font-normal">
              ({formatARS(calcItem.costoUnitario ?? (item.costoDirectoTotal / (item.cantidad || 1)))}/{item.unidad || 'u'})
            </span>
          </span>
        </div>

        {/* Client Sale Price calculated with APU */}
        <div className="bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
            Total Venta Renglón:
          </span>
          <span className="font-mono font-bold text-primary text-sm">
            {formatARS(calcItem.precioVentaClienteTotal ?? item.precioVentaTotal)}
          </span>
        </div>

        {/* APU Prorated Micro-Breakdown when GG absolutes exist */}
        {calcItem.ggAbsolutoProrrateado ? (
          <div className="w-full flex flex-wrap items-center justify-between gap-2 text-[10px] text-on-surface-variant font-mono pt-1 border-t border-outline-variant/10">
            <span>Incidencia: {((calcItem.incidencia || 0) * 100).toFixed(1)}%</span>
            <span>GG Fijo Prorr.: +{formatARS(calcItem.ggAbsolutoProrrateado || 0)}</span>
            <span>Base APU: {formatARS(calcItem.baseCostoItem || 0)}</span>
            <span>Beneficio: {formatARS(calcItem.beneficioItem || 0)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

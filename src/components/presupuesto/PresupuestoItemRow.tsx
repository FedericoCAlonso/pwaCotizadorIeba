import React, { useState } from 'react';
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Sliders,
  ShieldAlert,
  Ruler,
  FileText,
  Layers,
  MoreVertical,
  Edit3
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
  onUpdateItemNotasTecnicas?: (index: number, notas: string) => void;
  onRemoveItem: (index: number) => void;
  onSaveAsTemplate: (item: ItemPresupuesto) => void;
  onOpenParametricModal?: (index: number) => void;
  onOpenMaterialModal?: (index: number) => void;
  onOpenInSituEditor?: (index: number) => void;
  condicionesTrabajo: Array<{ value: string; label: string }>;
  titleInputRef?: (el: HTMLInputElement | null) => void;
  onEnterAtEnd?: () => void;
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
  onUpdateItemNotasTecnicas,
  onRemoveItem,
  onSaveAsTemplate,
  onOpenParametricModal,
  onOpenMaterialModal,
  onOpenInSituEditor,
  condicionesTrabajo,
  titleInputRef,
  onEnterAtEnd
}) => {
  const [showItemMenu, setShowItemMenu] = useState(false);

  const hasSnapshots =
    (item.insumosSnapshot && item.insumosSnapshot.length > 0) ||
    (item.manoObraSnapshot && item.manoObraSnapshot.length > 0);
  const isCustom = !item.tareaTipoId && !hasSnapshots;
  const isParametric = Boolean(item.valoresVariables || item.parametrosTrabajoTipo || item.tareaTipoId);
  const hasMaterialCalc = Boolean(item.parametrosEstimacionMaterial);

  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-4 sm:p-5 space-y-3.5 hover:border-outline-variant/50 transition-all shadow-2xs">
      {/* 1. Header de Partida (M3 Primary Header) */}
      <div className="flex items-center justify-between gap-2.5">
        {/* Left: # Index & Title Input */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-mono font-bold text-on-surface-variant px-2.5 py-1 rounded-xl bg-surface-container shrink-0">
            #{index + 1}
          </span>
          <input
            ref={titleInputRef}
            type="text"
            placeholder="Título del trabajo / partida..."
            value={item.descripcion}
            onChange={(e) => onUpdateItemDescription(index, e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/30 rounded-xl px-3 py-1.5 text-sm sm:text-base font-bold text-on-surface placeholder:text-on-surface-variant/40 transition shadow-2xs"
          />
        </div>

        {/* Right: Type Badge & Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isCustom ? (
            <span className="hidden sm:inline-flex text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 items-center gap-1">
              <FileText className="w-3 h-3" />
              <span>Directo</span>
            </span>
          ) : (
            <span className="hidden sm:inline-flex text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>Catálogo</span>
            </span>
          )}

          {/* Primary contextual action (Parámetros / Desglosar) */}
          {isParametric && onOpenParametricModal ? (
            <button
              type="button"
              onClick={() => onOpenParametricModal(index)}
              className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 px-2.5 sm:px-3 py-1.5 rounded-full transition shadow-2xs"
              title="Configurar parámetros y variables de la tarea"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Parámetros</span>
            </button>
          ) : onOpenInSituEditor ? (
            <button
              type="button"
              onClick={() => onOpenInSituEditor(index)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 px-2.5 sm:px-3 py-1.5 rounded-full transition shadow-2xs"
              title="Componer o editar insumos y horas para esta partida"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{hasSnapshots ? 'Desglose' : 'Desglosar'}</span>
            </button>
          ) : null}

          {/* Secondary Actions Menu Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowItemMenu((v) => !v)}
              className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors"
              title="Más acciones para esta partida"
              aria-label="Más acciones"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showItemMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowItemMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 z-30 bg-surface-container-high rounded-2xl shadow-xl py-1.5 min-w-[190px] border border-outline-variant/30 text-on-surface animate-in fade-in zoom-in-95 duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      onSaveAsTemplate(item);
                      setShowItemMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-primary hover:bg-primary/10 transition-colors text-left font-medium"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Guardar en Catálogo</span>
                  </button>

                  {isParametric && onOpenParametricModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenParametricModal(index);
                        setShowItemMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <Sliders className="w-4 h-4 text-on-surface-variant" />
                      <span>Reajustar Parámetros</span>
                    </button>
                  )}

                  {hasMaterialCalc && onOpenMaterialModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenMaterialModal(index);
                        setShowItemMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <Ruler className="w-4 h-4 text-on-surface-variant" />
                      <span>Cálculo Paramétrico</span>
                    </button>
                  )}

                  <hr className="border-outline-variant/20 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      onRemoveItem(index);
                      setShowItemMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-error hover:bg-error-container/20 transition-colors text-left font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar Partida</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Alcance Técnico y Chips M3 Tonales */}
      <div className="space-y-2">
        <textarea
          rows={2}
          placeholder="Detalle técnico y alcance de la partida: marcas, materiales incluidos, desmonte, pruebas..."
          value={item.notasTecnicas || item.clausulaTecnica || ''}
          onChange={(e) => onUpdateItemNotasTecnicas?.(index, e.target.value)}
          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-3.5 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 resize-y leading-relaxed transition shadow-2xs"
        />

        {/* Chips Tonales (Parámetros, Fórmulas y Exclusiones) */}
        {((item.valoresParametros || item.valoresVariables) || item.parametrosEstimacionMaterial || item.clausulaExclusiones) && (
          <div className="flex flex-wrap items-center gap-2 max-w-full">
            {(item.valoresParametros || item.valoresVariables) && (
              <button
                type="button"
                onClick={() => onOpenParametricModal?.(index)}
                className="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 flex flex-wrap items-center gap-1.5 transition text-left max-w-full"
                title="Clic para reajustar los parámetros de este trabajo tipo"
              >
                <span className="font-bold flex items-center gap-1 shrink-0">
                  <Sliders className="w-3 h-3" />
                  <span>Parámetros:</span>
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {Object.entries(item.valoresParametros || item.valoresVariables || {}).map(([key, val]) => (
                    <span key={key} className="bg-primary/20 px-1.5 py-0.5 rounded text-[10px] font-semibold break-words">
                      {key}: {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(2)) : val}
                    </span>
                  ))}
                </span>
              </button>
            )}

            {item.parametrosEstimacionMaterial && (
              <button
                type="button"
                onClick={() => onOpenMaterialModal?.(index)}
                className="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 flex items-center gap-1.5 transition text-left max-w-full"
                title="Clic para reajustar cálculo métrico de material"
              >
                <Ruler className="w-3 h-3 shrink-0" />
                <span className="break-words truncate max-w-xs sm:max-w-md">{item.parametrosEstimacionMaterial.explicacionCalculo}</span>
              </button>
            )}

            {item.clausulaExclusiones && (
              <span
                className="text-[11px] px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 flex items-center gap-1 font-medium max-w-full truncate"
                title={item.clausulaExclusiones}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">Exclusiones Activas</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Matriz Numérica Equilibrada (Key Metrics Grid - 2 Columnas M3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-surface-container/60 p-3.5 sm:p-4 rounded-2xl border border-outline-variant/20 items-center">
        {/* Columna Izquierda: Parámetros Físicos */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
            Cómputo Físico & Entorno
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Cantidad */}
            <div className="w-24 sm:w-28">
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

            {/* Unidad */}
            <input
              type="text"
              value={item.unidad}
              onChange={(e) => onUpdateItemUnit(index, e.target.value)}
              className="w-12 sm:w-14 bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-2 py-1 text-xs text-on-surface text-center font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-2xs"
              title="Unidad de medida (ej: u, boca, m, gl)"
            />

            {/* Condición de Obra */}
            <select
              value={item.condicionTrabajo || 'normal'}
              onChange={(e) => onUpdateItemCondicion(index, e.target.value as any)}
              className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-2 py-1 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50 shadow-2xs flex-1 min-w-[90px]"
              title="Condición de trabajo en obra (afecta rendimiento de MO)"
            >
              {condicionesTrabajo.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Columna Derecha: Valores Económicos y Venta Final */}
        <div className="space-y-1.5 sm:border-l sm:border-outline-variant/20 sm:pl-3.5">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
            <span>Costo Base</span>
            <span className="text-primary font-bold">Precio Venta Final</span>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Costo Directo Unitario */}
            <div className="text-xs">
              {isCustom ? (
                <div className="w-24 sm:w-28">
                  <MathInput
                    value={
                      item.costoUnitario !== undefined
                        ? item.costoUnitario
                        : roundMoney((item.costoDirectoTotal || 0) / (item.cantidad || 1))
                    }
                    onChange={(val) => onUpdateItemUnitDirectCost(index, val)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter' && onEnterAtEnd) {
                        e.preventDefault();
                        onEnterAtEnd();
                      }
                    }}
                    prefix="$"
                    size="sm"
                    min={0}
                    step={1}
                  />
                </div>
              ) : (
                <div className="font-mono text-xs font-medium text-on-surface-variant">
                  <span className="text-[10px] block opacity-70">Directo:</span>
                  <span className="font-bold text-on-surface">{formatARS(calcItem.costoDirectoTotal ?? item.costoDirectoTotal)}</span>
                </div>
              )}
            </div>

            {/* Total Venta Partida Destacado */}
            <div className="bg-primary/10 border border-primary/25 px-3 py-1.5 rounded-xl flex items-baseline gap-1.5 text-primary text-right">
              <span className="font-mono font-black text-sm sm:text-base">
                {formatARS(calcItem.precioVentaClienteTotal ?? item.precioVentaTotal)}
              </span>
              <span className="text-[10px] font-mono text-primary/70">
                ({formatARS(calcItem.precioVentaClienteUnitario ?? item.precioVentaUnitario)}/{item.unidad || 'u'})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Acordeón de Desglose Técnico (Progressive Disclosure) */}
      {hasSnapshots && (
        <div className="pt-1 border-t border-outline-variant/15">
          <button
            type="button"
            onClick={() => onToggleExpand(item.id)}
            className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="font-medium">
                Desglose: {item.insumosSnapshot?.length || 0} materiales · {item.manoObraSnapshot?.length || 0} categorías MO
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono">
              <span>{isExpanded ? 'Ocultar' : 'Ver detalle'}</span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isExpanded && (
            <div className="mt-2 bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/25 space-y-3 text-xs animate-in fade-in-50 duration-150">
              {/* Insumos Snapshot */}
              {item.insumosSnapshot && item.insumosSnapshot.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold text-primary tracking-wider">
                    <span>Materiales e Insumos ({item.insumosSnapshot.length})</span>
                    <span className="font-mono">{formatARS(item.costoInsumos)}</span>
                  </div>
                  <div className="space-y-1 divide-y divide-outline-variant/10">
                    {item.insumosSnapshot.map((ins, iIdx) => (
                      <div key={iIdx} className="pt-1 flex flex-wrap sm:flex-nowrap items-center justify-between gap-1 text-on-surface-variant text-[11px]">
                        <div className="flex items-center gap-1.5 truncate flex-1 min-w-[120px]">
                          <span className="truncate">{ins.nombre}</span>
                          <OnlinePriceButton tipo="material" customNombre={ins.nombre} size="xs" variant="icon" />
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 font-mono shrink-0 w-full sm:w-auto text-[10px] sm:text-[11px]">
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
                      <div key={mIdx} className="pt-1 flex flex-wrap sm:flex-nowrap items-center justify-between gap-1 text-on-surface-variant text-[11px]">
                        <span className="truncate flex-1 min-w-[120px]">{mo.nombreCategoria}</span>
                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 font-mono shrink-0 w-full sm:w-auto text-[10px] sm:text-[11px]">
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

              {/* APU Prorated Micro-Breakdown when GG absolutes exist */}
              {calcItem.ggAbsolutoProrrateado ? (
                <div className="w-full flex flex-wrap items-center justify-between gap-2 text-[10px] text-on-surface-variant font-mono pt-2 border-t border-outline-variant/15">
                  <span>Incidencia: {((calcItem.incidencia || 0) * 100).toFixed(1)}%</span>
                  <span>GG Fijo Prorr.: +{formatARS(calcItem.ggAbsolutoProrrateado || 0)}</span>
                  <span>Base APU: {formatARS(calcItem.baseCostoItem || 0)}</span>
                  <span>Beneficio: {formatARS(calcItem.beneficioItem || 0)}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

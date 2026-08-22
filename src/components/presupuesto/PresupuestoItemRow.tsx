import React from 'react';
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Sliders,
  ShieldAlert,
  Ruler,
  FileText,
  Layers
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
  const hasSnapshots =
    (item.insumosSnapshot && item.insumosSnapshot.length > 0) ||
    (item.manoObraSnapshot && item.manoObraSnapshot.length > 0);
  const isCustom = !item.tareaTipoId && !hasSnapshots;
  const isParametric = Boolean(item.valoresVariables || item.parametrosTrabajoTipo || item.tareaTipoId);
  const hasMaterialCalc = Boolean(item.parametrosEstimacionMaterial);

  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-4 space-y-3.5 hover:border-outline-variant/50 transition shadow-2xs">
      {/* 1. Header de la Partida / Renglón */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-on-surface-variant font-mono px-2 py-0.5 rounded-md bg-surface-container">
            #{index + 1}
          </span>
          {isCustom ? (
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              <span>Ítem Directo</span>
            </span>
          ) : (
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-primary/15 text-primary border border-primary/20 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>Tarea de Catálogo</span>
            </span>
          )}
        </div>

        {/* Acciones principales de la fila */}
        <div className="flex items-center gap-1.5">
          {isParametric && onOpenParametricModal ? (
            <button
              type="button"
              onClick={() => onOpenParametricModal(index)}
              className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 px-2.5 py-1 rounded-xl transition shadow-2xs"
              title="Configurar parámetros y variables de este trabajo tipo"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Parámetros</span>
            </button>
          ) : onOpenInSituEditor ? (
            <button
              type="button"
              onClick={() => onOpenInSituEditor(index)}
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 px-2.5 py-1 rounded-xl transition shadow-2xs"
              title="Desglosar o componer insumos y horas para esta partida"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{hasSnapshots ? 'Editar Desglose' : 'Desglosar In-Situ'}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onSaveAsTemplate(item)}
            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-inverse bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2.5 py-1 rounded-xl transition shadow-2xs"
            title="Guardar este ítem como Tarea Tipo / Plantilla en el Catálogo"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Guardar en Catálogo</span>
          </button>

          <button
            type="button"
            onClick={() => onRemoveItem(index)}
            className="p-1.5 text-on-surface-variant hover:text-error rounded-xl hover:bg-error-container/30 transition-colors"
            title="Eliminar partida"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Área de Texto: Título y Detalle / Alcance Técnico */}
      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider block mb-1">
            Título / Concepto del Trabajo
          </label>
          <input
            ref={titleInputRef}
            type="text"
            placeholder="Ej: Provisión y colocación de disyuntor bipolar 40A..."
            value={item.descripcion}
            onChange={(e) => onUpdateItemDescription(index, e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2 text-sm font-semibold text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors shadow-2xs"
          />
        </div>

        <div>
          <label className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider block mb-1">
            Detalle Técnico / Alcance de la Partida (Multilínea)
          </label>
          <textarea
            rows={2}
            placeholder="Especificaciones técnicas, marcas, materiales incluidos, desmonte previo, pruebas de funcionamiento..."
            value={item.notasTecnicas || item.clausulaTecnica || ''}
            onChange={(e) => onUpdateItemNotasTecnicas?.(index, e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-y leading-relaxed transition-colors shadow-2xs"
          />
        </div>

        {/* Badges de Parámetros Dinámicos (Solo si existen) */}
        {(item.valoresParametros || item.valoresVariables) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 max-w-full">
            <button
              type="button"
              onClick={() => onOpenParametricModal?.(index)}
              className="text-[10px] font-bold p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-mono flex flex-wrap items-center gap-1.5 transition text-left max-w-full"
              title="Click para reajustar los parámetros de este trabajo tipo"
            >
              <span className="flex items-center gap-1 font-bold shrink-0">
                <Sliders className="w-3 h-3 text-primary shrink-0" />
                <span>Parámetros:</span>
              </span>
              <span className="flex flex-wrap items-center gap-1 max-w-full">
                {Object.entries(item.valoresParametros || item.valoresVariables || {}).map(([key, val]) => (
                  <span key={key} className="bg-primary/15 px-1.5 py-0.5 rounded text-[10px] font-semibold break-words">
                    {key}: {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(2)) : val}
                  </span>
                ))}
              </span>
            </button>

            {item.clausulaExclusiones && (
              <span
                className="text-[10px] px-2 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 font-medium max-w-full truncate"
                title={item.clausulaExclusiones}
              >
                <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="truncate">Exclusiones Activas</span>
              </span>
            )}
          </div>
        )}

        {/* Badges de Cómputo Paramétrico de Materiales (Solo si existen) */}
        {item.parametrosEstimacionMaterial && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 max-w-full">
            <button
              type="button"
              onClick={() => onOpenMaterialModal?.(index)}
              className="max-w-full text-[10px] font-bold px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono flex items-start gap-1.5 transition text-left"
              title="Click para reajustar cálculo paramétrico de material"
            >
              <Ruler className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="break-words leading-relaxed">{item.parametrosEstimacionMaterial.explicacionCalculo}</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Fila de Cómputos Numéricos y Parámetros */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-outline-variant/15">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Modificador por Condición de Obra */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-on-surface-variant font-medium">Obra:</span>
            <select
              value={item.condicionTrabajo || 'normal'}
              onChange={(e) => onUpdateItemCondicion(index, e.target.value as any)}
              className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-2 py-1 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50 shadow-2xs"
            >
              {condicionesTrabajo.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Cantidad & Unidad */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-on-surface-variant font-semibold">Cant:</span>
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
            <input
              type="text"
              value={item.unidad}
              onChange={(e) => onUpdateItemUnit(index, e.target.value)}
              className="w-12 sm:w-14 bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-2 py-1 text-xs text-on-surface text-center font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-2xs"
              title="Unidad de medida (ej: u, boca, m, gl)"
            />

            {/* Botón de Cómputo Métrico Paramétrico (Solo si la tarea admite cómputo de materiales) */}
            {hasMaterialCalc && onOpenMaterialModal && (
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
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          {/* Costo Directo Unitario */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-on-surface-variant font-medium">Costo Unit:</span>
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
              <span className="font-mono text-xs font-bold text-on-surface bg-surface-container px-2 py-1 rounded-xl border border-outline-variant/20">
                {formatARS(calcItem.costoUnitario ?? (item.costoDirectoTotal / (item.cantidad || 1)))}
              </span>
            )}
          </div>

          {/* Precio Venta Cliente Unitario */}
          <div className="bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-xl flex items-center gap-1.5 text-primary font-mono">
            <span className="text-[10px] font-bold uppercase tracking-wider">Venta:</span>
            <span className="text-xs font-bold font-mono">
              {formatARS(calcItem.precioVentaClienteUnitario ?? item.precioVentaUnitario)}
            </span>
            <span className="text-[10px] opacity-75">/{item.unidad || 'u'}</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Botón de Parámetros de Complejidad (Solo si es paramétrico) */}
            {isParametric && onOpenParametricModal && (
              <button
                type="button"
                onClick={() => onOpenParametricModal(index)}
                className="p-1.5 text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors shrink-0"
                title="Configurar parámetros de complejidad de este trabajo"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}

            {/* Botón Desplegable para ver Desglose (Solo si tiene snapshots de insumos/mano de obra) */}
            {hasSnapshots && (
              <button
                type="button"
                onClick={() => onToggleExpand(item.id)}
                className="p-1.5 text-on-surface-variant hover:text-primary rounded-xl hover:bg-surface-variant transition-colors shrink-0"
                title={isExpanded ? 'Ocultar desglose de insumos y mano de obra' : 'Ver desglose de insumos y mano de obra'}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Desglose Colapsable de Insumos & Mano de Obra Snapshot */}
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
        </div>
      )}

      {/* 5. Footer de Costos y Venta del Renglón */}
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

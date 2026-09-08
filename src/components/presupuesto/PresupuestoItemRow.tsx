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
  Edit3,
  GraduationCap,
  Truck,
  Package,
  Plus,
  Tag,
  Clock
} from 'lucide-react';
import { ItemPresupuesto, CategoriaManoDeObra } from '../../core/types';
import { formatARS, roundMoney } from '../../core/calculations';
import { MathInput } from '../common/MathInput';
import { ItemMaterialsSection } from './row/ItemMaterialsSection';
import { ItemLaborSection } from './row/ItemLaborSection';
import { ItemServicesSection } from './row/ItemServicesSection';

interface PresupuestoItemRowProps {
  item: ItemPresupuesto;
  index: number;
  calcItem: ItemPresupuesto;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onUpdateItemCondicion: (index: number, condicion: 'normal' | 'dificultosa' | 'favorable') => void;
  onUpdateItemQuantity: (index: number, qty: number | null, formula?: string) => void;
  onUpdateItemUnit: (index: number, unit: string) => void;
  onUpdateItemUnitDirectCost: (index: number, cost: number | null) => void;
  onUpdateItemDescription: (index: number, desc: string) => void;
  onUpdateItemNotasTecnicas?: (index: number, notas: string) => void;
  onRemoveItem: (index: number) => void;
  onSaveAsTemplate: (item: ItemPresupuesto) => void;
  onOpenParametricModal?: (index: number) => void;
  onOpenMaterialModal?: (index: number) => void;
  onOpenInSituEditor?: (index: number) => void;
  onOpenMaterialPicker?: (index: number) => void;
  onOpenMaterialBrandModal?: (itemIndex: number, materialIndex: number) => void;
  onUpdateItemMaterialQuantity?: (itemIndex: number, materialIndex: number, newQty: number | null) => void;
  onRemoveItemMaterial?: (itemIndex: number, materialIndex: number) => void;
  onUpdateItemManoObraCost?: (index: number, moCost: number | null) => void;
  onAddLaborRole?: (itemIndex: number, categoriaId: string, horas: number) => void;
  onUpdateItemLaborHours?: (itemIndex: number, laborIndex: number, newHours: number | null) => void;
  onRemoveItemLabor?: (itemIndex: number, laborIndex: number) => void;
  categoriasManoObra?: CategoriaManoDeObra[];
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
  onOpenMaterialPicker,
  onOpenMaterialBrandModal,
  onUpdateItemMaterialQuantity,
  onRemoveItemMaterial,
  onUpdateItemManoObraCost,
  onAddLaborRole,
  onUpdateItemLaborHours,
  onRemoveItemLabor,
  categoriasManoObra,
  condicionesTrabajo,
  titleInputRef,
  onEnterAtEnd
}) => {
  const [showItemMenu, setShowItemMenu] = useState(false);

  const hasSnapshots =
    (item.insumosSnapshot && item.insumosSnapshot.length > 0) ||
    (item.manoObraSnapshot && item.manoObraSnapshot.length > 0) ||
    (item.costoServicios !== undefined && item.costoServicios > 0);
  const isCustom = !item.tareaTipoId && !hasSnapshots;
  const isItemLibre = item.tipoItem === 'item_libre' || (!item.tareaTipoId && !item.materialId && !item.ofertaId);
  const hasParametrosValores = Boolean(
    (item.valoresVariables && Object.keys(item.valoresVariables).length > 0) ||
    item.parametrosTrabajoTipo ||
    item.tareaTipoId ||
    (item.tareaTipoConfig?.parametros && item.tareaTipoConfig.parametros.length > 0)
  );
  const isParametric = hasParametrosValores;
  const hasMaterialCalc = Boolean(item.parametrosEstimacionMaterial);

  const renderItemMenu = () => {
    if (!showItemMenu) return null;
    return (
      <>
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowItemMenu(false)}
        />
        <div className="absolute right-0 top-full mt-1.5 z-30 bg-surface-container-high rounded-2xl shadow-xl py-2 min-w-[230px] border border-outline-variant/30 text-on-surface animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => {
              onSaveAsTemplate(item);
              setShowItemMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-primary hover:bg-primary/10 transition-colors text-left font-semibold min-h-[42px]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Guardar en Catálogo</span>
          </button>

          {isItemLibre && !hasSnapshots && (
            <button
              type="button"
              onClick={() => {
                onToggleExpand(item.id);
                setShowItemMenu(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-surface-container-highest transition-colors text-left font-semibold min-h-[42px]"
            >
              <Layers className="w-4 h-4" />
              <span>Desglosar Costos (Materiales / MO)</span>
            </button>
          )}

          {onOpenMaterialPicker && (
            <button
              type="button"
              onClick={() => {
                onOpenMaterialPicker(index);
                setShowItemMenu(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-primary hover:bg-primary/10 transition-colors text-left font-semibold min-h-[42px]"
            >
              <Package className="w-4 h-4" />
              <span>Agregar Materiales del Catálogo</span>
            </button>
          )}

          {onOpenInSituEditor && (
            <button
              type="button"
              onClick={() => {
                onOpenInSituEditor(index);
                setShowItemMenu(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-surface-container-highest transition-colors text-left font-semibold min-h-[42px]"
            >
              <Edit3 className="w-4 h-4" />
              <span>Editar Fórmulas y Materiales</span>
            </button>
          )}

          {isParametric && onOpenParametricModal && (
            <button
              type="button"
              onClick={() => {
                onOpenParametricModal(index);
                setShowItemMenu(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest transition-colors text-left font-medium min-h-[42px]"
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
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest transition-colors text-left font-medium min-h-[42px]"
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
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-error hover:bg-error-container/20 transition-colors text-left font-semibold min-h-[42px]"
          >
            <Trash2 className="w-4 h-4" />
            <span>Eliminar Partida</span>
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-3.5 hover:border-outline-variant/50 transition-all shadow-2xs">
      {/* 1. Header de Partida (M3 Primary Header: Mobile 2-filas ergonómico, Desktop 1-fila espacioso) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Fila 1 en móvil / Lado izquierdo en escritorio: Índice, Título a ancho completo y Menú móvil */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="text-xs sm:text-sm font-mono font-bold text-on-surface-variant px-2.5 py-1.5 rounded-xl bg-surface-container shrink-0">
            #{index + 1}
          </span>
          <input
            ref={titleInputRef}
            type="text"
            placeholder="Título del trabajo / partida..."
            value={item.descripcion}
            onChange={(e) => onUpdateItemDescription(index, e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/30 rounded-xl px-3.5 py-2.5 text-sm sm:text-base font-bold text-on-surface placeholder:text-on-surface-variant/40 transition shadow-2xs min-h-[44px]"
          />

          {/* Menú de acciones secundario en móvil (3 puntos) */}
          <div className="sm:hidden relative shrink-0">
            <button
              type="button"
              onClick={() => setShowItemMenu((v) => !v)}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors min-h-[42px] min-w-[42px] flex items-center justify-center"
              title="Más acciones para esta partida"
              aria-label="Más acciones"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {renderItemMenu()}
          </div>
        </div>

        {/* Fila 2 en móvil / Lado derecho en escritorio: Badges de naturaleza y Botones contextuales */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {item.naturaleza === 'servicio_profesional' ? (
            <span className="inline-flex text-xs sm:text-sm font-semibold px-3 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 items-center gap-1.5">
              <GraduationCap className="w-4 h-4" />
              <span>Servicio Profesional</span>
            </span>
          ) : item.naturaleza === 'servicio_tercerizado' ? (
            <span className="inline-flex text-xs sm:text-sm font-semibold px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 items-center gap-1.5">
              <Truck className="w-4 h-4" />
              <span>Servicio Tercerizado</span>
            </span>
          ) : isItemLibre ? (
            <span className="inline-flex text-xs sm:text-sm font-semibold px-3 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 items-center gap-1.5">
              <FileText className="w-4 h-4" />
              <span>{hasSnapshots ? 'Desglosado' : 'Directo'}</span>
            </span>
          ) : (
            <span className="inline-flex text-xs sm:text-sm font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>Catálogo</span>
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            {/* Primary contextual action (Parámetros / Fórmulas y Materiales / Desglosar) */}
            {(isItemLibre || isCustom) && onOpenMaterialPicker && (
              <button
                type="button"
                onClick={() => onOpenMaterialPicker(index)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 px-3 py-2 rounded-xl transition shadow-2xs min-h-[40px]"
                title="Seleccionar y agregar materiales desde el catálogo para esta partida"
              >
                <Package className="w-4 h-4" />
                <span>+ Materiales</span>
              </button>
            )}

            {isItemLibre ? (
              <>
                {onOpenInSituEditor && (
                  <button
                    type="button"
                    onClick={() => onOpenInSituEditor(index)}
                    className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 px-3 py-2 rounded-xl transition shadow-2xs min-h-[40px]"
                    title="Editar fórmulas, materiales y mano de obra para este ítem libre"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>{hasSnapshots ? 'Fórmulas y Mat.' : 'Desglosar'}</span>
                  </button>
                )}
                {isParametric && onOpenParametricModal && (
                  <button
                    type="button"
                    onClick={() => onOpenParametricModal(index)}
                    className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 px-3 py-2 rounded-xl transition shadow-2xs min-h-[40px]"
                    title="Ajustar valores de los parámetros"
                  >
                    <Sliders className="w-4 h-4" />
                    <span>Parámetros</span>
                  </button>
                )}
              </>
            ) : (
              <>
                {isParametric && onOpenParametricModal ? (
                  <button
                    type="button"
                    onClick={() => onOpenParametricModal(index)}
                    className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 px-3 py-2 rounded-xl transition shadow-2xs min-h-[40px]"
                    title="Configurar parámetros y variables de la tarea"
                  >
                    <Sliders className="w-4 h-4" />
                    <span>Parámetros</span>
                  </button>
                ) : onOpenInSituEditor ? (
                  <button
                    type="button"
                    onClick={() => onOpenInSituEditor(index)}
                    className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 px-3 py-2 rounded-xl transition shadow-2xs min-h-[40px]"
                    title="Componer o editar insumos y horas para esta partida"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>{hasSnapshots ? 'Desglose' : 'Desglosar'}</span>
                  </button>
                ) : null}
              </>
            )}

            {/* Menú de acciones secundario en escritorio (3 puntos) */}
            <div className="hidden sm:block relative">
              <button
                type="button"
                onClick={() => setShowItemMenu((v) => !v)}
                className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                title="Más acciones para esta partida"
                aria-label="Más acciones"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {renderItemMenu()}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Alcance Técnico y Chips Tonales */}
      <div className="space-y-2">
        <textarea
          rows={item.notasTecnicas || item.clausulaTecnica ? 2 : 1}
          placeholder="Alcance técnico y notas: marcas, materiales incluidos, desmonte, pruebas..."
          value={item.notasTecnicas || item.clausulaTecnica || ''}
          onChange={(e) => onUpdateItemNotasTecnicas?.(index, e.target.value)}
          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl sm:rounded-2xl px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 resize-y leading-relaxed transition shadow-2xs min-h-[46px]"
        />

        {/* Chips Tonales (Parámetros, Fórmulas y Exclusiones) */}
        {((item.valoresParametros || item.valoresVariables) || item.parametrosEstimacionMaterial || item.clausulaExclusiones) && (
          <div className="flex flex-wrap items-center gap-2 max-w-full">
            {(item.valoresParametros || item.valoresVariables) && (
              <button
                type="button"
                onClick={() => onOpenParametricModal?.(index)}
                className="text-xs sm:text-sm font-mono px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 flex flex-wrap items-center gap-1.5 transition text-left max-w-full"
                title="Clic para reajustar los parámetros de este trabajo tipo"
              >
                <span className="font-bold flex items-center gap-1 shrink-0">
                  <Sliders className="w-4 h-4" />
                  <span>Parámetros:</span>
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {Object.entries(item.valoresParametros || item.valoresVariables || {}).map(([key, val]) => (
                    <span key={key} className="bg-primary/20 px-2 py-0.5 rounded text-xs sm:text-sm font-semibold break-words">
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
                className="text-xs sm:text-sm font-mono px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 flex items-center gap-1.5 transition text-left max-w-full"
                title="Clic para reajustar cálculo métrico de material"
              >
                <Ruler className="w-4 h-4 shrink-0" />
                <span className="break-words truncate max-w-xs sm:max-w-md">{item.parametrosEstimacionMaterial.explicacionCalculo}</span>
              </button>
            )}

            {item.clausulaExclusiones && (
              <span
                className="text-xs sm:text-sm px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 flex items-center gap-1 font-medium max-w-full truncate"
                title={item.clausulaExclusiones}
              >
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="truncate">Exclusiones Activas</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Strip Numérico Limpio y Ergonómico (Cómputo x Costo = Total Venta) */}
      <div className="bg-surface-container/40 rounded-2xl p-3 sm:p-4 border border-outline-variant/20 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        {/* Bloque Cómputo: Cantidad, Unidad, Condición de Obra */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap sm:flex-nowrap flex-1">
          {/* Cantidad */}
          <div className="flex flex-col gap-1 w-28 sm:w-36 flex-1 sm:flex-none">
            <span className="text-xs sm:text-sm font-bold text-on-surface-variant">Cantidad</span>
            <MathInput
              value={item.cantidad}
              formula={item.formulaCantidad}
              onChange={(val, form) => onUpdateItemQuantity(index, val, form)}
              suffix={item.unidad}
              size="md"
              fallbackOnBlur={1}
              min={0.01}
              step={0.1}
            />
          </div>

          {/* Unidad */}
          <div className="flex flex-col gap-1 w-18 sm:w-24">
            <span className="text-xs sm:text-sm font-bold text-on-surface-variant text-center">Unidad</span>
            <input
              type="text"
              value={item.unidad}
              onChange={(e) => onUpdateItemUnit(index, e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-2.5 py-2 text-sm sm:text-base text-on-surface text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-2xs min-h-[44px]"
              title="Unidad de medida (ej: u, boca, m, gl)"
            />
          </div>

          {/* Condición de Obra */}
          <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
            <span className="text-xs sm:text-sm font-bold text-on-surface-variant">Condición</span>
            <select
              value={item.condicionTrabajo || 'normal'}
              onChange={(e) => onUpdateItemCondicion(index, e.target.value as any)}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-3 pr-8 py-2 text-sm sm:text-base text-on-surface font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-2xs min-h-[44px]"
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

        {/* Bloque Económico: Costo Base y Precio de Venta */}
        <div className="flex items-center justify-between sm:justify-end gap-3.5 sm:gap-5 pt-2.5 lg:pt-0 border-t lg:border-t-0 lg:border-l border-outline-variant/20 lg:pl-5 shrink-0">
          {/* Costo Directo / Insumos / Mano de Obra */}
          <div className="flex flex-col gap-1 min-w-[120px]">
            <span className="text-xs sm:text-sm font-bold text-on-surface-variant">Costo Base</span>
            {isItemLibre ? (
              hasSnapshots ? (
                <div className="flex flex-col gap-1 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="font-bold text-on-surface-variant">Insumos:</span>
                    <span className="font-bold text-primary">{formatARS(calcItem.costoInsumos || item.costoInsumos || 0)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-on-surface-variant">M. Obra:</span>
                    {item.manoObraSnapshot && item.manoObraSnapshot.length > 0 ? (
                      <span className="font-bold text-primary font-mono text-sm" title="Calculado por horas en el desglose de roles">
                        {formatARS(item.costoManoObra || 0)}
                      </span>
                    ) : (
                      <div className="w-28 sm:w-32" title="Mano de obra o adicionales directos para esta partida">
                        <MathInput
                          value={item.costoManoObra}
                          onChange={(val) => onUpdateItemManoObraCost ? onUpdateItemManoObraCost(index, val) : onUpdateItemUnitDirectCost(index, val)}
                          prefix="$"
                          size="md"
                          min={0}
                          step={100}
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-32 sm:w-36">
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
                    size="md"
                    min={0}
                    step={1}
                  />
                </div>
              )
            ) : (
              <div className="font-mono text-xs sm:text-sm">
                <span className="font-bold text-on-surface-variant block">Directo:</span>
                <span className="font-bold text-on-surface text-sm sm:text-base">{formatARS(calcItem.costoDirectoTotal ?? item.costoDirectoTotal)}</span>
              </div>
            )}
          </div>

          {/* Total Venta Partida */}
          <div className="bg-primary/10 border border-primary/25 px-4 py-2.5 rounded-2xl flex flex-col items-end text-right shrink-0">
            <span className="text-xs sm:text-sm font-bold text-primary tracking-wider uppercase">Venta Total</span>
            <div className="font-mono font-black text-xl sm:text-2xl text-primary leading-tight">
              {formatARS(calcItem.precioVentaClienteTotal ?? item.precioVentaTotal)}
            </div>
            <span className="text-xs sm:text-sm font-mono text-primary/80">
              ({formatARS(calcItem.precioVentaClienteUnitario ?? item.precioVentaUnitario)}/{item.unidad || 'u'})
            </span>
          </div>
        </div>
      </div>

      {/* 4. Acordeón de Desglose Técnico (Progressive Disclosure) */}
      {(hasSnapshots || isExpanded) && (
        <div className="pt-1.5 border-t border-outline-variant/15">
          <button
            type="button"
            onClick={() => onToggleExpand(item.id)}
            className="w-full flex items-center justify-between p-3 rounded-xl text-sm sm:text-base text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <div className="flex items-center gap-2.5">
              {item.naturaleza === 'servicio_profesional' ? (
                <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              ) : (
                <Layers className="w-5 h-5 text-primary" />
              )}
              <span className="font-semibold">
                {item.naturaleza === 'servicio_profesional' ? (
                  `Honorarios: ${formatARS(item.costoServicios || 0)}${item.insumosSnapshot?.length ? ` · ${item.insumosSnapshot.length} insumos` : ''}${item.manoObraSnapshot?.length ? ` · ${item.manoObraSnapshot.length} roles MO` : ''}`
                ) : (
                  `Desglose: ${item.insumosSnapshot?.length || 0} materiales · ${item.manoObraSnapshot?.length || 0} categorías MO`
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono font-medium">
              <span>{isExpanded ? 'Ocultar' : 'Ver detalle'}</span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isExpanded && (
            <div className="mt-2 bg-surface-container-lowest p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-outline-variant/25 space-y-3.5 text-sm animate-in fade-in-50 duration-150">
              {/* Barra de Acceso Rápido a Edición Técnica */}
              {onOpenInSituEditor && (
                <div className="flex items-center justify-between pb-2.5 border-b border-outline-variant/15 flex-wrap gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-on-surface-variant flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <span>{isItemLibre ? 'Estructura técnica de partida libre' : 'Estructura técnica de partida'}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenInSituEditor(index)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 rounded-xl transition shadow-2xs min-h-[38px]"
                      title="Editar fórmulas matemáticas, lista de materiales y categorías de mano de obra"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Editar Fórmulas y Materiales</span>
                    </button>
                    {isParametric && onOpenParametricModal && (
                      <button
                        type="button"
                        onClick={() => onOpenParametricModal(index)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 rounded-xl transition shadow-2xs min-h-[38px]"
                        title="Reajustar parámetros de cómputo"
                      >
                        <Sliders className="w-4 h-4" />
                        <span>Parámetros</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Honorarios / Servicios Tercerizados / APU Stats */}
              <ItemServicesSection item={item} calcItem={calcItem} />

              {/* Insumos Snapshot */}
              <ItemMaterialsSection
                item={item}
                index={index}
                onOpenMaterialBrandModal={onOpenMaterialBrandModal}
                onUpdateItemMaterialQuantity={onUpdateItemMaterialQuantity}
                onRemoveItemMaterial={onRemoveItemMaterial}
                onOpenMaterialPicker={onOpenMaterialPicker}
              />

              {/* Mano de Obra Snapshot & Inline Adder */}
              <ItemLaborSection
                item={item}
                index={index}
                isItemLibre={isItemLibre}
                categoriasManoObra={categoriasManoObra}
                onUpdateItemLaborHours={onUpdateItemLaborHours}
                onRemoveItemLabor={onRemoveItemLabor}
                onAddLaborRole={onAddLaborRole}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

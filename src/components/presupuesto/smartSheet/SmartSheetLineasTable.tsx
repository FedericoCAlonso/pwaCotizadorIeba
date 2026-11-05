import React, { useState } from 'react';
import { Layers, Briefcase, ClipboardPaste } from 'lucide-react';
import {
  ItemPresupuesto,
  InsumoSnapshot,
  ManoObraSnapshot,
  ServicioTercerizado,
  TareaTipo,
  Insumo,
  CategoriaManoDeObra
} from '../../../core/types';
import {
  useSmartSheetLinesViewModel,
  UnifiedLineaRow
} from '../../../viewmodels/useSmartSheetLinesViewModel';
import { MaterialCatalogSuggestion } from '../../../core/materialSuggestions';
import { SmartSheetLineaRow } from './SmartSheetLineaRow';
import { SmartSheetGhostRow } from './SmartSheetGhostRow';
import { InsertarTrabajoTipoModal } from './InsertarTrabajoTipoModal';
import { SmartSheetPasteModal } from './SmartSheetPasteModal';

// Re-exportar UnifiedLineaRow para compatibilidad con código existente
export type { UnifiedLineaRow };

/**
 * Propiedades de la tabla de Líneas del ítem seleccionado (Zona 2).
 */
export interface SmartSheetLineasTableProps {
  /** Ítem seleccionado en el itemizado */
  selectedItem: ItemPresupuesto | null;
  /** Ítem con valores calculados por el motor de cálculo */
  calculatedItem: ItemPresupuesto | null;
  /** Callback para actualizar los snapshots del ítem (persistencia y recálculo) */
  onUpdateItemLines?: (
    itemId: string,
    updatedSnapshots: {
      insumosSnapshot?: InsumoSnapshot[];
      manoObraSnapshot?: ManoObraSnapshot[];
      serviciosTercerizados?: ServicioTercerizado[];
    }
  ) => void;
  /** Variables de la obra para el motor de fórmulas */
  calculosVariables?: Record<string, number | string>;
  /** Mapa de insumos y materiales del catálogo */
  insumosMap?: Map<string, Insumo>;
  /** Mapa de mano de obra del catálogo */
  manoObraMap?: Map<string, CategoriaManoDeObra>;
  /** Lista de tareas tipo disponibles en catálogo */
  tareasTipo?: TareaTipo[];
  /** Sugerencias precalculadas de materiales del catálogo */
  materialSuggestions?: MaterialCatalogSuggestion[];
}

/**
 * SmartSheetLineasTable: Zona 2 (en el medio) de la planilla inteligente.
 * Muestra y permite editar las líneas detalladas del ítem seleccionado:
 * Materiales, Mano de Obra y Servicios Tercerizados.
 *
 * Características en Fase 3:
 * - (a) Sugerencias automáticas por función del catálogo con mejor oferta y marca.
 * - (b) "Insertar trabajo tipo" expandido en líneas editables dentro del ítem.
 * - (c) Pegado multilínea / TSV con una línea creada por renglón.
 */
export const SmartSheetLineasTable: React.FC<SmartSheetLineasTableProps> = ({
  selectedItem,
  calculatedItem,
  onUpdateItemLines,
  calculosVariables,
  insumosMap,
  manoObraMap,
  tareasTipo = [],
  materialSuggestions = []
}) => {
  const [showInsertModal, setShowInsertModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);

  const {
    lineas,
    editingCell,
    editingValue,
    setEditingValue,
    evalError,
    setEvalError,
    handleStartEdit,
    handleCancelEdit,
    handleCommitEdit,
    handleNavigateCell,
    handleRequestRemoveLine,
    ghostRow,
    setGhostRow,
    ghostEvalError,
    setGhostEvalError,
    handleCommitGhostRow,
    handleSelectMaterialSuggestion,
    handleInsertTrabajoTipo,
    handlePasteLines
  } = useSmartSheetLinesViewModel({
    selectedItem,
    calculatedItem,
    onUpdateItemLines,
    calculosVariables,
    insumosMap,
    manoObraMap,
    materialSuggestions,
    tareasTipo
  });

  const activeItem = calculatedItem || selectedItem;

  // Interceptar pegado en el contenedor si contiene múltiples renglones o tabuladores
  const handleContainerPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!activeItem) return;
    const text = e.clipboardData.getData('text');
    if (!text) return;

    // Si tiene saltos de línea o tabuladores, procesarlo como pegado de renglones
    if (text.includes('\n') || text.includes('\t')) {
      e.preventDefault();
      handlePasteLines(text);
    }
  };

  return (
    <div
      onPaste={handleContainerPaste}
      className="flex-1 min-h-0 flex flex-col bg-surface border-t border-outline-variant/30 overflow-hidden"
      role="region"
      aria-label="Zona 2: Líneas del ítem seleccionado"
    >
      {/* ─── Cabecera de la sección Líneas con Acciones de Fase 3 ─── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-container-high border-b border-outline-variant/30 text-xs font-bold text-on-surface-variant uppercase tracking-wider select-none shrink-0">
        <div className="flex items-center gap-1.5 text-secondary">
          <Layers className="w-3.5 h-3.5" />
          <span>Zona 2 · Líneas del Ítem</span>
          {activeItem && (
            <span className="text-on-surface font-semibold truncate max-w-xs normal-case">
              — {activeItem.descripcion}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 normal-case font-normal">
          {/* Botón (b): Insertar Trabajo Tipo */}
          <button
            type="button"
            disabled={!activeItem}
            onClick={() => setShowInsertModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-container text-on-surface hover:bg-surface-container-highest border border-outline-variant/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            title="Insertar un trabajo tipo y expandirlo en líneas editables dentro de este ítem"
          >
            <Briefcase className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Insertar trabajo tipo</span>
            <span className="sm:hidden">+ Trabajo</span>
          </button>

          {/* Botón (c): Pegar texto con múltiples renglones */}
          <button
            type="button"
            disabled={!activeItem}
            onClick={() => setShowPasteModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-container text-on-surface hover:bg-surface-container-highest border border-outline-variant/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            title="Pegar texto de varias líneas (Excel, Sheets o texto plano)"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-secondary" />
            <span className="hidden sm:inline">Pegar líneas</span>
            <span className="sm:hidden">Pegar</span>
          </button>

          <span className="text-[10px] font-mono text-on-surface-variant/70 ml-1">
            {lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'}
          </span>
        </div>
      </div>

      {/* ─── Cabecera de Columnas ─── */}
      <div className="sticky top-0 z-10 flex items-center px-3 py-1.5 bg-surface-container border-b border-outline-variant/20 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider select-none shrink-0 shadow-2xs">
        <div className="w-10 sm:w-12 shrink-0 text-center">Tipo</div>
        <div className="flex-1 min-w-0 px-2">Función / Descripción</div>
        <div className="w-28 sm:w-36 shrink-0 px-2">Marca / Modelo</div>
        <div className="w-32 sm:w-44 shrink-0 px-2 text-right">Cantidad</div>
        <div className="w-24 sm:w-28 shrink-0 px-2 text-right">Unitario</div>
        <div className="w-28 sm:w-32 shrink-0 pr-2 text-right font-bold text-on-surface">Subtotal</div>
        <div className="w-8 shrink-0 text-center" title="Acciones"></div>
      </div>

      {/* ─── Cuerpo de la tabla de líneas ─── */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-outline-variant/10">
        {!activeItem ? (
          <div className="p-8 text-center text-xs text-on-surface-variant/60">
            Hacé clic en un ítem del itemizado superior para inspeccionar y editar sus líneas.
          </div>
        ) : (
          <>
            {/* Lista de Líneas Existentes */}
            {lineas.map((linea) => (
              <SmartSheetLineaRow
                key={linea.id}
                linea={linea}
                editingCell={editingCell}
                editingValue={editingValue}
                setEditingValue={setEditingValue}
                evalError={evalError}
                setEvalError={setEvalError}
                onStartEdit={handleStartEdit}
                onCancelEdit={handleCancelEdit}
                onCommitEdit={handleCommitEdit}
                onNavigateCell={handleNavigateCell}
                onRemoveLine={handleRequestRemoveLine}
                materialSuggestions={materialSuggestions}
                onSelectSuggestion={(sug, target) => handleSelectMaterialSuggestion(sug, target)}
              />
            ))}

            {/* Mensaje sutil si el ítem no tiene ninguna línea previa */}
            {lineas.length === 0 && (
              <div className="px-4 py-3 text-center text-xs text-on-surface-variant/60 italic">
                El ítem aún no tiene líneas de insumos o mano de obra. Escribí en la fila inferior para agregar una, o usá "Insertar trabajo tipo" / "Pegar líneas".
              </div>
            )}

            {/* Última fila vacía (Ghost Row) para agregar nuevas líneas de forma continua */}
            <SmartSheetGhostRow
              ghostRow={ghostRow}
              setGhostRow={setGhostRow}
              ghostEvalError={ghostEvalError}
              setGhostEvalError={setGhostEvalError}
              onCommitGhostRow={handleCommitGhostRow}
              materialSuggestions={materialSuggestions}
              onSelectSuggestion={(sug) => handleSelectMaterialSuggestion(sug, 'ghost')}
            />
          </>
        )}
      </div>

      {/* ─── Modal para Insertar Trabajo Tipo (Fase 3 - Inciso b) ─── */}
      {showInsertModal && (
        <InsertarTrabajoTipoModal
          isOpen={showInsertModal}
          onClose={() => setShowInsertModal(false)}
          tareasTipo={tareasTipo}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          onInsertTrabajoTipo={(tarea, mult) => {
            handleInsertTrabajoTipo(tarea, mult);
          }}
        />
      )}

      {/* ─── Modal para Pegar Líneas (Fase 3 - Inciso c) ─── */}
      {showPasteModal && (
        <SmartSheetPasteModal
          isOpen={showPasteModal}
          onClose={() => setShowPasteModal(false)}
          materialSuggestions={materialSuggestions}
          onConfirmPaste={(text) => {
            handlePasteLines(text);
          }}
        />
      )}
    </div>
  );
};

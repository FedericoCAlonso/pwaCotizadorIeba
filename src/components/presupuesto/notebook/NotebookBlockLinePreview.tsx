import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Lock, Package, Wrench } from 'lucide-react';
import { formatARS } from '../../../core/calculations';
import { TERMINOLOGY } from '../../../config/terminology';
import {
  NotebookDocumentContext,
  NotebookErrorDocumento,
  NotebookUnitNote,
  SubtotalBloqueInfo
} from '../../../core/notebookDocument';
import { NotebookBlock } from '../../../core/notebookParser';
import { ItemPresupuesto, VariableCotizacion } from '../../../core/types';
import {
  buildChipsForBlock,
  buildChipsForSubline,
  CHIP_TONE_CLASSES,
  formatComputedValue
} from './notebookPreviewHelpers';

export interface NotebookBlockLinePreviewProps {
  lines?: string[];
  linesCount: number;
  activeLine: number;
  bloques: NotebookBlock[];
  blockLineNumbers: number[];
  subtotalesPorBloque: Record<number, SubtotalBloqueInfo>;
  items: ItemPresupuesto[];
  variablesCotizacion?: VariableCotizacion[];
  notasUnidadesPorLinea?: Record<number, NotebookUnitNote>;
  contexto: NotebookDocumentContext;
  errores: NotebookErrorDocumento[];
  onSelectLine: (linea: number) => void;
  onValorizarItem: (itemId: string) => void;
}

/**
 * Margen derecho sincronizado fila a fila con el editor de notebook (estilo outputs de Jupyter).
 * Muestra subtotales, chips resueltos (material, marca, unidad) por bloque y sublínea, estado y errores.
 */
export const NotebookBlockLinePreview: React.FC<NotebookBlockLinePreviewProps> = ({
  lines,
  linesCount,
  activeLine,
  bloques,
  blockLineNumbers,
  subtotalesPorBloque,
  items,
  variablesCotizacion = [],
  notasUnidadesPorLinea = {},
  contexto,
  errores,
  onSelectLine,
  onValorizarItem
}) => {
  const blockByLine = new Map<number, NotebookBlock>();
  bloques.forEach((b, idx) => {
    const ln = blockLineNumbers[idx];
    if (ln !== undefined) blockByLine.set(ln, b);
  });

  const errorByLine = new Map<number, NotebookErrorDocumento>();
  for (const err of errores) {
    if (err.codigo === 'exceso_advertencias') continue;
    if (!errorByLine.has(err.linea)) errorByLine.set(err.linea, err);
  }

  const itemById = new Map<string, ItemPresupuesto>();
  for (const it of items) itemById.set(it.id, it);

  const varById = new Map<string, VariableCotizacion>();
  for (const v of variablesCotizacion) varById.set(v.id, v);

  const lineArray = Array.from({ length: Math.max(linesCount, 1) }, (_, idx) => idx + 1);
  let currentEnclosingBlock: NotebookBlock | undefined;
  let currentEnclosingItem: ItemPresupuesto | undefined;
  let currentSubHeader: string | undefined;
  let currentSubIndent = 0;

  return (
    <div
      className="w-80 xl:w-96 shrink-0 border-l border-outline-variant/40 bg-surface-container-low/60 select-none overflow-hidden"
      aria-label="Resultados y chips por celda"
    >
      {lineArray.map(lineNum => {
        const block = blockByLine.get(lineNum);
        const rawLine = lines?.[lineNum - 1] ?? '';
        const subtotal = subtotalesPorBloque[lineNum];
        const err = errorByLine.get(lineNum);
        const isActive = lineNum === activeLine;
        const item = subtotal ? itemById.get(subtotal.itemId) : undefined;
        const indentLen = rawLine.length - rawLine.trimStart().length;
        const trimmedLine = rawLine.trim();

        if (block) {
          currentEnclosingBlock = block;
          currentEnclosingItem = item;
          currentSubHeader = undefined;
          currentSubIndent = 0;
        } else if (trimmedLine === '' || (!/^\s/.test(rawLine) && !trimmedLine.startsWith('//'))) {
          currentEnclosingBlock = undefined;
          currentEnclosingItem = undefined;
          currentSubHeader = undefined;
          currentSubIndent = 0;
        } else if (indentLen > 0) {
          if (/^(?:mat:|mo:|serv:|\+)/i.test(trimmedLine)) {
            currentSubHeader = trimmedLine;
            currentSubIndent = indentLen;
          } else if (currentSubHeader && indentLen <= currentSubIndent) {
            currentSubHeader = undefined;
            currentSubIndent = 0;
          }
        }

        const varInfo = block?.tipo === 'variable' ? varById.get(block.id) : undefined;
        const variableEvalOutput =
          block?.tipo === 'variable' && !err && varInfo && !varInfo.error && varInfo.valorEvaluado !== undefined
            ? `= ${formatComputedValue(varInfo.valorEvaluado)}${varInfo.unidad ? ` ${varInfo.unidad}` : ''}`
            : undefined;

        const sublinePreview = !block && /^\s+\S/.test(rawLine)
          ? buildChipsForSubline(
              rawLine,
              currentEnclosingBlock,
              currentEnclosingItem,
              indentLen > currentSubIndent ? currentSubHeader : undefined,
              contexto
            )
          : { chips: [] };

        const chips = block ? buildChipsForBlock(block, item, contexto, varInfo) : sublinePreview.chips;
        const evalOutput = variableEvalOutput ?? sublinePreview.evalOutput;
        const unitNote = notasUnidadesPorLinea[lineNum];
        const unitWarning = unitNote?.advertencia ?? varInfo?.advertencia;
        const unitConvNote = unitNote?.nota;

        return (
          <div
            key={lineNum}
            onClick={() => onSelectLine(lineNum)}
            data-testid={`margin-line-${lineNum}`}
            className={`h-7 px-3 flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors ${
              isActive ? 'bg-primary-container/25' : 'hover:bg-surface-container/60'
            }`}
          >
            {/* Chips compactos reconocidos en esta línea */}
            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
              {err ? (
                <span
                  className="inline-flex items-center gap-1 text-error font-medium truncate"
                  title={err.mensaje}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{err.mensaje}</span>
                </span>
              ) : (
                chips.slice(0, 3).map(chip => (
                  <span
                    key={chip.key}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] leading-none whitespace-nowrap ${CHIP_TONE_CLASSES[chip.tone]}`}
                  >
                    {chip.icon === 'package' && <Package className="w-2.5 h-2.5 shrink-0" />}
                    {chip.icon === 'wrench' && <Wrench className="w-2.5 h-2.5 shrink-0" />}
                    {chip.icon === 'lock' && <Lock className="w-2.5 h-2.5 shrink-0" />}
                    <span className="truncate max-w-[120px]">{chip.label}</span>
                  </span>
                ))
              )}
            </div>

            {/* Output de celda: subtotal en margen derecho, valor evaluado de variable/fórmula o costo de sublínea */}
            {subtotal && !err ? (
              <div className="shrink-0 flex items-center gap-1.5">
                {subtotal.estadoValorizacion === 'sin_valorizar' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onValorizarItem(subtotal.itemId);
                    }}
                    title="Clic para valorizar esta partida (Ctrl+Enter)"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 text-[11px] font-medium"
                  >
                    <Clock className="w-3 h-3" />
                    <span>{TERMINOLOGY.estadoSinValorizar}</span>
                  </button>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 font-mono font-semibold text-on-surface tabular-nums"
                    title={`Costo directo: ${formatARS(subtotal.costoDirecto)}`}
                  >
                    <CheckCircle2 className="w-3 h-3 text-tertiary" />
                    <span>{formatARS(subtotal.precioVenta)}</span>
                  </span>
                )}
              </div>
            ) : evalOutput && !err ? (
              <span
                className="shrink-0 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-primary tabular-nums max-w-[190px]"
                title={
                  unitWarning
                    ? `${evalOutput} · ${unitWarning}`
                    : unitConvNote
                      ? `${evalOutput} (${unitConvNote})`
                      : evalOutput
                }
              >
                {unitWarning && (
                  <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                <span className="truncate">{evalOutput}</span>
                {unitConvNote && (
                  <span className="text-[10px] font-normal text-on-surface-variant shrink-0">
                    {unitConvNote}
                  </span>
                )}
              </span>
            ) : (
              sublinePreview.sublineCost !== undefined &&
              !err && (
                <span className="shrink-0 font-mono text-[11px] text-on-surface-variant tabular-nums">
                  {formatARS(sublinePreview.sublineCost)}
                </span>
              )
            )}
          </div>
        );
      })}
    </div>
  );
};

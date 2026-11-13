import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Lock, Package, Wrench } from 'lucide-react';
import { formatARS } from '../../../core/calculations';
import { TERMINOLOGY } from '../../../config/terminology';
import {
  NotebookDocumentContext,
  NotebookErrorDocumento,
  SubtotalBloqueInfo
} from '../../../core/notebookDocument';
import { NotebookBlock } from '../../../core/notebookParser';
import { ItemPresupuesto } from '../../../core/types';

export interface NotebookBlockLinePreviewProps {
  lines?: string[];
  linesCount: number;
  activeLine: number;
  bloques: NotebookBlock[];
  blockLineNumbers: number[];
  subtotalesPorBloque: Record<number, SubtotalBloqueInfo>;
  items: ItemPresupuesto[];
  contexto: NotebookDocumentContext;
  errores: NotebookErrorDocumento[];
  onSelectLine: (linea: number) => void;
  onValorizarItem: (itemId: string) => void;
}

interface ResolvedChip {
  key: string;
  label: string;
  tone: 'material' | 'marca' | 'unidad' | 'param' | 'ajuste' | 'variable' | 'nota';
  icon?: 'package' | 'wrench' | 'lock';
}

const CHIP_TONE_CLASSES: Record<ResolvedChip['tone'], string> = {
  material: 'bg-primary-container/70 text-on-primary-container border-primary/20',
  marca: 'bg-secondary-container/80 text-on-secondary-container border-secondary/20',
  unidad: 'bg-surface-container-high text-on-surface-variant border-outline-variant/60',
  param: 'bg-tertiary-container/60 text-on-tertiary-container border-tertiary/20',
  ajuste: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  variable: 'bg-surface-container-highest text-on-surface border-outline-variant/60',
  nota: 'bg-surface-container-high text-on-surface-variant border-outline-variant/50 italic'
};

function buildChipsForBlock(
  block: NotebookBlock,
  item: ItemPresupuesto | undefined,
  contexto: NotebookDocumentContext
): ResolvedChip[] {
  const chips: ResolvedChip[] = [];

  if (block.tipo === 'variable') {
    chips.push({ key: `var-${block.id}`, label: `var ${block.id}`, tone: 'variable' });
    return chips;
  }

  if (block.tipo === 'supuesto') {
    chips.push({ key: `sup-${block.clave}`, label: `${TERMINOLOGY.supuestoSingular}: ${block.clave} = ${block.valor}`, tone: 'param' });
    return chips;
  }

  if (block.tipo === 'nota_interna') {
    chips.push({ key: 'nota-priv', label: `${TERMINOLOGY.notaInterna} (oculta al cliente)`, tone: 'nota', icon: 'lock' });
    return chips;
  }

  if (block.tipo === 'capitulo') {
    chips.push({ key: `cap-${block.nombre}`, label: `${TERMINOLOGY.agrupadorSingular}: ${block.nombre}`, tone: 'variable' });
    return chips;
  }

  if (item) {
    for (const ins of item.insumosSnapshot.slice(0, 3)) {
      chips.push({
        key: `ins-${ins.insumoId}-${chips.length}`,
        label: ins.nombre,
        tone: 'material',
        icon: 'package'
      });
      if (ins.marca) {
        chips.push({
          key: `mrc-${ins.insumoId}-${chips.length}`,
          label: ins.marca,
          tone: 'marca'
        });
      }
      chips.push({
        key: `uni-${ins.insumoId}-${chips.length}`,
        label: `${ins.cantidadTotal}${ins.unidad}`,
        tone: 'unidad'
      });
    }
    if (item.insumosSnapshot.length > 3) {
      chips.push({
        key: 'more-ins',
        label: `+${item.insumosSnapshot.length - 3} materiales`,
        tone: 'unidad'
      });
    }
    for (const mo of item.manoObraSnapshot.slice(0, 1)) {
      chips.push({
        key: `mo-${mo.categoriaId}`,
        label: `${mo.nombreCategoria} ${mo.horasTotales}hs`,
        tone: 'param',
        icon: 'wrench'
      });
    }
  }

  if (block.tipo === 'tarea_tipo') {
    const tt = contexto.tareasTipo.find(t => t.id === block.tareaTipoId);
    if (tt && chips.length === 0) {
      chips.push({ key: `tt-u-${tt.id}`, label: tt.unidad || 'u', tone: 'unidad' });
    }
    for (const [k, v] of Object.entries(block.overridesParametros)) {
      chips.push({ key: `ov-${k}`, label: `${k}=${v}`, tone: 'param' });
    }
    for (const q of block.quitados) {
      chips.push({ key: `q-${q}`, label: `-${q}`, tone: 'ajuste' });
    }
    for (const ag of block.agregados) {
      chips.push({ key: `ag-${ag.referencia}`, label: `+${ag.referencia}`, tone: 'ajuste' });
    }
  }

  return chips;
}

function buildChipsForSubline(
  rawLine: string,
  enclosingBlock: NotebookBlock | undefined,
  enclosingItem: ItemPresupuesto | undefined,
  contexto: NotebookDocumentContext
): { chips: ResolvedChip[]; sublineCost?: number } {
  const trimmed = rawLine.trim();
  if (!trimmed || trimmed.startsWith('//') || !enclosingBlock) {
    return { chips: [] };
  }

  const paramMatch = trimmed.match(/^([a-zA-Z_][\w-]*)\s*=\s*(.+)$/);
  if (paramMatch) {
    const paramKey = paramMatch[1];
    if (enclosingBlock.tipo === 'tarea_tipo') {
      const tt = contexto.tareasTipo.find(t => t.id === enclosingBlock.tareaTipoId);
      const paramDef = tt?.parametros?.find(
        p => p.id === paramKey || p.nombre.toLowerCase() === paramKey.toLowerCase()
      );
      if (paramDef) {
        return {
          chips: [
            {
              key: `subp-${paramKey}`,
              label: paramDef.unidad ? `${paramDef.nombre} (${paramDef.unidad})` : paramDef.nombre,
              tone: 'param'
            }
          ]
        };
      }
    }
    return {
      chips: [{ key: `subp-${paramKey}`, label: paramKey, tone: 'param' }]
    };
  }

  if (trimmed.startsWith('-')) {
    return {
      chips: [{ key: `subq-${trimmed}`, label: trimmed, tone: 'ajuste' }]
    };
  }

  if (trimmed.startsWith('+') || enclosingBlock.tipo === 'item_libre' || enclosingBlock.tipo === 'tarea_tipo') {
    const lower = trimmed.replace(/^[+]\s*/, '').toLowerCase();
    const matMatch = enclosingItem?.insumosSnapshot.find(ins =>
      lower.includes(ins.nombre.toLowerCase().slice(0, Math.min(8, ins.nombre.length)))
    );
    if (matMatch) {
      const chips: ResolvedChip[] = [
        {
          key: `subm-${matMatch.insumoId}`,
          label: matMatch.nombre,
          tone: 'material',
          icon: 'package'
        }
      ];
      if (matMatch.marca) {
        chips.push({ key: `submk-${matMatch.insumoId}`, label: matMatch.marca, tone: 'marca' });
      }
      chips.push({
        key: `subu-${matMatch.insumoId}`,
        label: `${matMatch.cantidadTotal}${matMatch.unidad}`,
        tone: 'unidad'
      });
      return { chips, sublineCost: matMatch.subtotalInsumoFinal ?? matMatch.subtotalInsumo };
    }

    if (lower.startsWith('mo:') || lower.startsWith('mano:') || lower.startsWith('mano_obra:')) {
      const moMatch = enclosingItem?.manoObraSnapshot.find(mo =>
        lower.includes(mo.nombreCategoria.toLowerCase().slice(0, Math.min(6, mo.nombreCategoria.length)))
      );
      if (moMatch) {
        return {
          chips: [
            {
              key: `submo-${moMatch.categoriaId}`,
              label: `${moMatch.nombreCategoria} ${moMatch.horasTotales}hs`,
              tone: 'param',
              icon: 'wrench'
            }
          ],
          sublineCost: moMatch.subtotalManoObra
        };
      }
    }
  }

  return { chips: [] };
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

  const lineArray = Array.from({ length: Math.max(linesCount, 1) }, (_, idx) => idx + 1);
  let currentEnclosingBlock: NotebookBlock | undefined;
  let currentEnclosingItem: ItemPresupuesto | undefined;

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

        if (block) {
          currentEnclosingBlock = block;
          currentEnclosingItem = item;
        } else if (rawLine.trim() === '' || (!/^\s/.test(rawLine) && !rawLine.trim().startsWith('//'))) {
          currentEnclosingBlock = undefined;
          currentEnclosingItem = undefined;
        }

        const sublinePreview = !block && /^\s+\S/.test(rawLine)
          ? buildChipsForSubline(rawLine, currentEnclosingBlock, currentEnclosingItem, contexto)
          : { chips: [] };

        const chips = block ? buildChipsForBlock(block, item, contexto) : sublinePreview.chips;

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
                    <span className="truncate max-w-[96px]">{chip.label}</span>
                  </span>
                ))
              )}
            </div>

            {/* Output de celda: subtotal en margen derecho, costo de sublínea o badge Sin valorizar */}
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

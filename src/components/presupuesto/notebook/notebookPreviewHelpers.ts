import { formatARS } from '../../../core/calculations';
import { TERMINOLOGY } from '../../../config/terminology';
import { NotebookDocumentContext } from '../../../core/notebookDocument';
import { NotebookBlock } from '../../../core/notebookParser';
import { ItemPresupuesto, VariableCotizacion } from '../../../core/types';

export interface ResolvedChip {
  key: string;
  label: string;
  tone: 'material' | 'marca' | 'unidad' | 'param' | 'ajuste' | 'variable' | 'nota';
  icon?: 'package' | 'wrench' | 'lock';
}

export const CHIP_TONE_CLASSES: Record<ResolvedChip['tone'], string> = {
  material: 'bg-primary-container/70 text-on-primary-container border-primary/20',
  marca: 'bg-secondary-container/80 text-on-secondary-container border-secondary/20',
  unidad: 'bg-surface-container-high text-on-surface-variant border-outline-variant/60',
  param: 'bg-tertiary-container/60 text-on-tertiary-container border-tertiary/20',
  ajuste: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  variable: 'bg-surface-container-highest text-on-surface border-outline-variant/60',
  nota: 'bg-surface-container-high text-on-surface-variant border-outline-variant/50 italic'
};

export function formatComputedValue(val: number): string {
  const rounded = Math.round(val * 100) / 100;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString('es-AR')
    : rounded.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function buildChipsForBlock(
  block: NotebookBlock,
  item: ItemPresupuesto | undefined,
  contexto: NotebookDocumentContext,
  varInfo?: VariableCotizacion
): ResolvedChip[] {
  const chips: ResolvedChip[] = [];

  if (block.tipo === 'variable') {
    const isFormula =
      (varInfo?.dependencias && varInfo.dependencias.length > 0) ||
      /[+\-*/^%()?:<>]/.test(block.expresion);
    chips.push({
      key: `var-${block.id}`,
      label: isFormula ? `fx ${block.id}` : `var ${block.id}`,
      tone: 'variable'
    });
    return chips;
  }

  if (block.tipo === 'supuesto') {
    chips.push({
      key: `sup-${block.clave}`,
      label: `${TERMINOLOGY.supuestoSingular}: ${block.clave} = ${block.valor}`,
      tone: 'param'
    });
    return chips;
  }

  if (block.tipo === 'nota_interna') {
    chips.push({
      key: 'nota-priv',
      label: `${TERMINOLOGY.notaInterna} (oculta al cliente)`,
      tone: 'nota',
      icon: 'lock'
    });
    return chips;
  }

  if (block.tipo === 'capitulo') {
    chips.push({
      key: `cap-${block.nombre}`,
      label: `${TERMINOLOGY.agrupadorSingular}: ${block.nombre}`,
      tone: 'variable'
    });
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

export function buildChipsForSubline(
  rawLine: string,
  enclosingBlock: NotebookBlock | undefined,
  enclosingItem: ItemPresupuesto | undefined,
  enclosingSubHeader: string | undefined,
  contexto: NotebookDocumentContext
): { chips: ResolvedChip[]; sublineCost?: number; evalOutput?: string } {
  const trimmed = rawLine.trim();
  if (!trimmed || trimmed.startsWith('//') || !enclosingBlock) {
    return { chips: [] };
  }

  const paramMatch = trimmed.match(/^([a-zA-Z_][\w-]*)\s*=\s*(.+)$/);
  if (paramMatch) {
    const paramKey = paramMatch[1];
    const paramKeyLower = paramKey.toLowerCase();
    const paramVal = paramMatch[2].trim();

    if (paramKeyLower === 'marca' || paramKeyLower === 'producto') {
      return {
        chips: [{ key: `submk-${paramKey}`, label: paramVal, tone: 'marca' }]
      };
    }

    if (paramKeyLower === 'cantidad') {
      let evalOutput: string | undefined;
      if (enclosingSubHeader && enclosingItem) {
        const subClean = enclosingSubHeader.replace(/^(?:mat:|serv:|\+)\s*/i, '').toLowerCase();
        if (/^serv:/i.test(enclosingSubHeader)) {
          const srv = enclosingItem.serviciosTercerizados?.find(
            s => s.descripcion.toLowerCase() === subClean
          );
          if (srv?.formulaCantidad && srv.cantidad !== undefined) {
            evalOutput = `= ${formatComputedValue(srv.cantidad)} ${srv.unidad || 'gl'}`;
          }
        } else {
          const ins = enclosingItem.insumosSnapshot.find(s =>
            subClean.includes(s.nombre.toLowerCase().slice(0, Math.min(8, s.nombre.length)))
          );
          if (ins?.formulaCantidad) {
            evalOutput = `= ${formatComputedValue(ins.cantidadTotal)} ${ins.unidad}`;
          }
        }
      } else if (enclosingItem?.formulaCantidad) {
        evalOutput = `= ${formatComputedValue(enclosingItem.cantidad)} ${enclosingItem.unidad || 'u'}`;
      }
      return {
        chips: [{ key: `subqty-${paramKey}`, label: paramVal, tone: 'unidad' }],
        evalOutput
      };
    }

    if (paramKeyLower === 'horas') {
      let evalOutput: string | undefined;
      if (enclosingSubHeader && enclosingItem) {
        const subClean = enclosingSubHeader.replace(/^mo:\s*/i, '').toLowerCase();
        const mo = enclosingItem.manoObraSnapshot.find(m =>
          subClean.includes(m.nombreCategoria.toLowerCase().slice(0, Math.min(6, m.nombreCategoria.length)))
        );
        if (mo?.formulaHoras) {
          evalOutput = `= ${formatComputedValue(mo.horasTotales)} hs`;
        }
      }
      return {
        chips: [{ key: `subhrs-${paramKey}`, label: paramVal, tone: 'param', icon: 'wrench' }],
        evalOutput
      };
    }

    if (paramKeyLower === 'costo' || paramKeyLower === 'precio') {
      let evalOutput: string | undefined;
      if (enclosingSubHeader && /^serv:/i.test(enclosingSubHeader) && enclosingItem) {
        const subClean = enclosingSubHeader.replace(/^serv:\s*/i, '').toLowerCase();
        const srv = enclosingItem.serviciosTercerizados?.find(
          s => s.descripcion.toLowerCase() === subClean
        );
        if (srv?.formulaCosto) {
          evalOutput = `= ${formatARS(srv.costo)}`;
        }
      } else if (enclosingItem?.formulaPrecio && enclosingItem.precioManual !== undefined) {
        evalOutput = `= ${formatARS(enclosingItem.precioManual)}`;
      }
      return {
        chips: [{ key: `subcost-${paramKey}`, label: `${paramKey}: ${paramVal}`, tone: 'param' }],
        evalOutput
      };
    }

    if (enclosingBlock.tipo === 'tarea_tipo') {
      const tt = contexto.tareasTipo.find(t => t.id === enclosingBlock.tareaTipoId);
      const paramDef = tt?.parametros?.find(
        p => p.id === paramKey || p.nombre.toLowerCase() === paramKeyLower
      );
      const evalVal = enclosingItem?.valoresParametros?.[paramKey];

      if (paramDef) {
        let evalOutput: string | undefined;
        if (evalVal !== undefined) {
          if (paramDef.tipo === 'boolean') {
            evalOutput = evalVal >= 1 ? 'Sí' : 'No';
          } else if (paramDef.tipo === 'select' && paramDef.opciones?.length) {
            const matchedOpt = paramDef.opciones.find(o => o.valor === evalVal);
            evalOutput = matchedOpt ? matchedOpt.label : `= ${formatComputedValue(evalVal)}`;
          } else {
            evalOutput = `= ${formatComputedValue(evalVal)}${paramDef.unidad ? ` ${paramDef.unidad}` : ''}`;
          }
        }
        return {
          chips: [
            {
              key: `subp-${paramKey}`,
              label: paramDef.unidad ? `${paramDef.nombre} (${paramDef.unidad})` : paramDef.nombre,
              tone: 'param'
            }
          ],
          evalOutput
        };
      }
    }

    // Parámetro local en tarea: o item:
    const localParam = enclosingItem?.parametros?.find(p => p.id === paramKey);
    const localEvalOutput =
      localParam !== undefined
        ? `= ${formatComputedValue(localParam.valor)}${localParam.unidad ? ` ${localParam.unidad}` : ''}`
        : undefined;
    return {
      chips: [{ key: `subp-${paramKey}`, label: paramKey, tone: 'param' }],
      evalOutput: localEvalOutput
    };
  }

  if (trimmed.startsWith('-')) {
    return {
      chips: [{ key: `subq-${trimmed}`, label: trimmed, tone: 'ajuste' }]
    };
  }

  if (trimmed.startsWith('+') || enclosingBlock.tipo === 'item_libre' || enclosingBlock.tipo === 'tarea_tipo') {
    const lower = trimmed.replace(/^(?:mat:|\+)\s*/i, '').toLowerCase();
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

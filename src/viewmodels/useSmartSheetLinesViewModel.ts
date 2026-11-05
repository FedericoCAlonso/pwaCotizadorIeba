import { useState, useCallback, useMemo, useRef } from 'react';
import {
  ItemPresupuesto,
  InsumoSnapshot,
  ManoObraSnapshot,
  ServicioTercerizado,
  TareaTipo,
  CategoriaManoDeObra,
  Insumo
} from '../core/types';
import { safeNum, roundMoney, calcularCostoTareaTipo } from '../core/calculations';
import { evaluateMathExpression } from '../core/mathEvaluator';
import { generateUUID } from '../core/uuid';
import { useConfirm, ConfirmOptions } from '../contexts/ConfirmContext';
import { MaterialCatalogSuggestion } from '../core/materialSuggestions';
import { parsePastedLines } from '../core/smartSheetPasteParser';

/**
 * Fila unificada de línea dentro de un ítem (Material, Mano de Obra o Servicio).
 */
export interface UnifiedLineaRow {
  id: string;
  sourceType: 'material' | 'mano_obra' | 'servicio';
  sourceIndex: number;
  tipoLabel: string;
  funcion: string;
  marcaModelo: string | null;
  cantidadCalculada: number;
  unidad: string;
  formula?: string;
  precioUnitario: number;
  subtotal: number;
}

/**
 * Campos editables en cada celda de la tabla de líneas.
 */
export type EditableLineField = 'tipo' | 'funcion' | 'marcaModelo' | 'cantidad' | 'precioUnitario';

/**
 * Estado de la celda actualmente en edición.
 */
export interface EditingLineCellState {
  lineId: string;
  field: EditableLineField;
  initialValue: string;
}

/**
 * Estado del borrador de la última fila vacía (ghost row).
 */
export interface GhostRowDraft {
  tipo: 'material' | 'mano_obra' | 'servicio';
  funcion: string;
  marcaModelo: string;
  cantidad: string;
  precioUnitario: string;
  unidad?: string;
}

/**
 * Propiedades del hook useSmartSheetLinesViewModel.
 */
export interface UseSmartSheetLinesViewModelProps {
  selectedItem: ItemPresupuesto | null;
  calculatedItem: ItemPresupuesto | null;
  onUpdateItemLines?: (
    itemId: string,
    updatedSnapshots: {
      insumosSnapshot?: InsumoSnapshot[];
      manoObraSnapshot?: ManoObraSnapshot[];
      serviciosTercerizados?: ServicioTercerizado[];
    }
  ) => void;
  calculosVariables?: Record<string, number | string>;
  confirm?: (options: ConfirmOptions | string) => Promise<boolean>;
  insumosMap?: Map<string, Insumo>;
  manoObraMap?: Map<string, CategoriaManoDeObra>;
  materialSuggestions?: MaterialCatalogSuggestion[];
  tareasTipo?: TareaTipo[];
}

/**
 * Helper para evaluar expresiones numéricas o fórmulas en celdas de cantidad.
 * Retorna si es válida, el número calculado, la fórmula limpia y el error si existiese.
 */
export function evaluateQuantityInput(
  rawInput: string,
  scope: Record<string, number>
): {
  isValid: boolean;
  numericValue: number;
  formula?: string;
  error?: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { isValid: false, numericValue: 0, error: 'Ingresá una cantidad o fórmula' };
  }

  // Número simple ej: "10", "2.5", "2,5"
  const normalizedNum = Number(trimmed.replace(',', '.'));
  if (!isNaN(normalizedNum) && !trimmed.startsWith('=')) {
    if (normalizedNum < 0) {
      return { isValid: false, numericValue: 0, error: 'La cantidad no puede ser negativa' };
    }
    return { isValid: true, numericValue: normalizedNum };
  }

  // Expresión matemática o fórmula tipo "=bocas * 1.5"
  const evalRes = evaluateMathExpression(trimmed, scope);
  if (!evalRes.isValid || evalRes.value === null || isNaN(evalRes.value)) {
    return {
      isValid: false,
      numericValue: 0,
      formula: trimmed,
      error: evalRes.error || 'Fórmula matemática inválida o variable no definida'
    };
  }

  if (evalRes.value < 0) {
    return {
      isValid: false,
      numericValue: 0,
      formula: trimmed,
      error: 'El resultado de la fórmula no puede ser negativo'
    };
  }

  return {
    isValid: true,
    numericValue: roundMoney(evalRes.value),
    formula: trimmed.startsWith('=') ? trimmed : `=${trimmed}`
  };
}

/**
 * useSmartSheetLinesViewModel: Orquesta la edición en el lugar, validación de fórmulas,
 * navegación por teclado y creación automática desde la última fila vacía.
 */
export function useSmartSheetLinesViewModel({
  selectedItem,
  calculatedItem,
  onUpdateItemLines,
  calculosVariables = {},
  confirm: customConfirm,
  insumosMap,
  manoObraMap,
  materialSuggestions = [],
  tareasTipo = []
}: UseSmartSheetLinesViewModelProps) {
  // Intentar obtener confirmación modal desde ConfirmContext
  let contextConfirm: ((opts: ConfirmOptions | string) => Promise<boolean>) | undefined;
  try {
    contextConfirm = useConfirm();
  } catch {
    contextConfirm = undefined;
  }
  const confirmFn = customConfirm || contextConfirm;

  // Celda actualmente en edición
  const [editingCell, setEditingCell] = useState<EditingLineCellState | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [evalError, setEvalError] = useState<string | null>(null);

  // Borrador de la última fila vacía (Ghost Row)
  const [ghostRow, setGhostRow] = useState<GhostRowDraft>({
    tipo: 'material',
    funcion: '',
    marcaModelo: '',
    cantidad: '',
    precioUnitario: ''
  });
  const [ghostEvalError, setGhostEvalError] = useState<string | null>(null);

  const activeItem = calculatedItem || selectedItem;

  // Scope consolidado de variables para evaluación de fórmulas
  const scope = useMemo<Record<string, number>>(() => {
    const s: Record<string, number> = {};
    if (calculosVariables) {
      Object.entries(calculosVariables).forEach(([k, v]) => {
        const num = typeof v === 'number' ? v : Number(v);
        if (!isNaN(num)) s[k] = num;
      });
    }
    if (activeItem?.parametros) {
      activeItem.parametros.forEach((p) => {
        s[p.id] = safeNum(p.valor);
        if (p.nombre) s[p.nombre] = safeNum(p.valor);
      });
    }
    return s;
  }, [calculosVariables, activeItem]);

  // Lista unificada de líneas del ítem
  const lineas = useMemo<UnifiedLineaRow[]>(() => {
    if (!activeItem) return [];
    const result: UnifiedLineaRow[] = [];

    (activeItem.insumosSnapshot || []).forEach((ins, idx) => {
      result.push({
        id: `mat-${idx}`,
        sourceType: 'material',
        sourceIndex: idx,
        tipoLabel: 'Material',
        funcion: ins.nombre || '',
        marcaModelo: ins.marca?.trim() || null,
        cantidadCalculada: safeNum(ins.cantidadTotal),
        unidad: ins.unidad || 'u',
        formula: ins.formulaCantidad?.trim() || undefined,
        precioUnitario: safeNum(ins.precioUnitarioCongelado),
        subtotal: safeNum(ins.subtotalInsumo)
      });
    });

    (activeItem.manoObraSnapshot || []).forEach((mo, idx) => {
      result.push({
        id: `mo-${idx}`,
        sourceType: 'mano_obra',
        sourceIndex: idx,
        tipoLabel: 'Mano de Obra',
        funcion: mo.nombreCategoria || '',
        marcaModelo: null,
        cantidadCalculada: safeNum(mo.horasTotales),
        unidad: 'hs',
        formula: mo.formulaHoras?.trim() || undefined,
        precioUnitario: safeNum(mo.costoHoraCongelado),
        subtotal: safeNum(mo.subtotalManoObra)
      });
    });

    (activeItem.serviciosTercerizados || []).forEach((serv, idx) => {
      const cant = safeNum(serv.cantidad) > 0 ? safeNum(serv.cantidad) : 1;
      const costo = safeNum(serv.costo);
      result.push({
        id: `serv-${idx}`,
        sourceType: 'servicio',
        sourceIndex: idx,
        tipoLabel: 'Servicio',
        funcion: serv.descripcion || '',
        marcaModelo: serv.nombreProveedor?.trim() || null,
        cantidadCalculada: cant,
        unidad: 'gl',
        formula: serv.formulaCantidad?.trim() || serv.formulaCosto?.trim() || undefined,
        precioUnitario: costo,
        subtotal: costo * cant
      });
    });

    return result;
  }, [activeItem]);

  // Iniciar edición de una celda
  const handleStartEdit = useCallback(
    (lineId: string, field: EditableLineField, initialVal: string) => {
      setEditingCell({ lineId, field, initialValue: initialVal });
      setEditingValue(initialVal);
      setEvalError(null);
    },
    []
  );

  // Cancelar edición (Escape)
  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditingValue('');
    setEvalError(null);
  }, []);

  // Confirmar y persistir edición de celda
  const handleCommitEdit = useCallback(
    (lineId: string, field: EditableLineField, valueToCommit?: string): boolean => {
      if (!activeItem || !onUpdateItemLines) return false;
      const finalVal = (valueToCommit !== undefined ? valueToCommit : editingValue).trim();

      const targetLinea = lineas.find((l) => l.id === lineId);
      if (!targetLinea) return false;

      const insumos = [...(activeItem.insumosSnapshot || [])];
      const manoObra = [...(activeItem.manoObraSnapshot || [])];
      const servicios = [...(activeItem.serviciosTercerizados || [])];

      if (field === 'cantidad') {
        const evalResult = evaluateQuantityInput(finalVal, scope);
        if (!evalResult.isValid) {
          // Si la fórmula es inválida, se retiene el error sin descartar lo escrito por el usuario
          setEvalError(evalResult.error || 'Fórmula inválida');
          return false;
        }

        if (targetLinea.sourceType === 'material') {
          const cur = { ...insumos[targetLinea.sourceIndex] };
          cur.cantidadTotal = evalResult.numericValue;
          cur.cantidadUnitaria = roundMoney(evalResult.numericValue / (activeItem.cantidad || 1));
          cur.formulaCantidad = evalResult.formula;
          cur.subtotalInsumo = roundMoney(evalResult.numericValue * cur.precioUnitarioCongelado);
          insumos[targetLinea.sourceIndex] = cur;
        } else if (targetLinea.sourceType === 'mano_obra') {
          const cur = { ...manoObra[targetLinea.sourceIndex] };
          cur.horasTotales = evalResult.numericValue;
          cur.horasUnitarias = roundMoney(evalResult.numericValue / (activeItem.cantidad || 1));
          cur.formulaHoras = evalResult.formula;
          cur.subtotalManoObra = roundMoney(evalResult.numericValue * cur.costoHoraCongelado);
          manoObra[targetLinea.sourceIndex] = cur;
        } else if (targetLinea.sourceType === 'servicio') {
          const cur = { ...servicios[targetLinea.sourceIndex] };
          cur.cantidad = evalResult.numericValue;
          cur.formulaCantidad = evalResult.formula;
          servicios[targetLinea.sourceIndex] = cur;
        }
      } else if (field === 'funcion') {
        if (!finalVal) return false;
        if (targetLinea.sourceType === 'material') {
          insumos[targetLinea.sourceIndex] = { ...insumos[targetLinea.sourceIndex], nombre: finalVal };
        } else if (targetLinea.sourceType === 'mano_obra') {
          manoObra[targetLinea.sourceIndex] = { ...manoObra[targetLinea.sourceIndex], nombreCategoria: finalVal };
        } else if (targetLinea.sourceType === 'servicio') {
          servicios[targetLinea.sourceIndex] = { ...servicios[targetLinea.sourceIndex], descripcion: finalVal };
        }
      } else if (field === 'marcaModelo') {
        if (targetLinea.sourceType === 'material') {
          insumos[targetLinea.sourceIndex] = { ...insumos[targetLinea.sourceIndex], marca: finalVal || undefined };
        } else if (targetLinea.sourceType === 'servicio') {
          servicios[targetLinea.sourceIndex] = { ...servicios[targetLinea.sourceIndex], nombreProveedor: finalVal || undefined };
        }
      } else if (field === 'precioUnitario') {
        const num = Math.max(0, Number(finalVal.replace(',', '.')) || 0);
        if (targetLinea.sourceType === 'material') {
          const cur = { ...insumos[targetLinea.sourceIndex] };
          cur.precioUnitarioCongelado = num;
          cur.subtotalInsumo = roundMoney(cur.cantidadTotal * num);
          insumos[targetLinea.sourceIndex] = cur;
        } else if (targetLinea.sourceType === 'mano_obra') {
          const cur = { ...manoObra[targetLinea.sourceIndex] };
          cur.costoHoraCongelado = num;
          cur.subtotalManoObra = roundMoney(cur.horasTotales * num);
          manoObra[targetLinea.sourceIndex] = cur;
        } else if (targetLinea.sourceType === 'servicio') {
          const cur = { ...servicios[targetLinea.sourceIndex] };
          cur.costo = num;
          servicios[targetLinea.sourceIndex] = cur;
        }
      } else if (field === 'tipo') {
        // Conversión de tipo de línea
        const newType = finalVal as 'material' | 'mano_obra' | 'servicio';
        if (newType !== targetLinea.sourceType) {
          if (targetLinea.sourceType === 'material') insumos.splice(targetLinea.sourceIndex, 1);
          else if (targetLinea.sourceType === 'mano_obra') manoObra.splice(targetLinea.sourceIndex, 1);
          else if (targetLinea.sourceType === 'servicio') servicios.splice(targetLinea.sourceIndex, 1);

          if (newType === 'material') {
            insumos.push({
              insumoId: `ins-conv-${generateUUID().slice(0, 6)}`,
              nombre: targetLinea.funcion,
              marca: targetLinea.marcaModelo || undefined,
              unidad: targetLinea.unidad === 'hs' ? 'u' : targetLinea.unidad,
              cantidadTotal: targetLinea.cantidadCalculada,
              formulaCantidad: targetLinea.formula,
              precioUnitarioCongelado: targetLinea.precioUnitario,
              subtotalInsumo: roundMoney(targetLinea.cantidadCalculada * targetLinea.precioUnitario)
            });
          } else if (newType === 'mano_obra') {
            manoObra.push({
              categoriaId: `mo-conv-${generateUUID().slice(0, 6)}`,
              nombreCategoria: targetLinea.funcion,
              horasTotales: targetLinea.cantidadCalculada,
              formulaHoras: targetLinea.formula,
              costoHoraCongelado: targetLinea.precioUnitario,
              subtotalManoObra: roundMoney(targetLinea.cantidadCalculada * targetLinea.precioUnitario)
            });
          } else {
            servicios.push({
              id: `serv-conv-${generateUUID().slice(0, 6)}`,
              descripcion: targetLinea.funcion,
              nombreProveedor: targetLinea.marcaModelo || undefined,
              cantidad: targetLinea.cantidadCalculada,
              formulaCantidad: targetLinea.formula,
              costo: targetLinea.precioUnitario
            });
          }
        }
      }

      onUpdateItemLines(activeItem.id, {
        insumosSnapshot: insumos,
        manoObraSnapshot: manoObra,
        serviciosTercerizados: servicios
      });

      setEditingCell(null);
      setEditingValue('');
      setEvalError(null);
      return true;
    },
    [activeItem, onUpdateItemLines, editingValue, lineas, scope]
  );

  // Navegación secuencial por celdas (Tab / Shift+Tab)
  const editableFields: EditableLineField[] = ['funcion', 'marcaModelo', 'cantidad', 'precioUnitario'];

  const handleNavigateCell = useCallback(
    (direction: 'next' | 'prev') => {
      if (!editingCell) return;
      const { lineId, field } = editingCell;

      // Primero confirmamos la celda actual; si es inválida, se detiene
      const ok = handleCommitEdit(lineId, field);
      if (!ok) return;

      const currentFieldIdx = editableFields.indexOf(field);
      const currentLineIdx = lineas.findIndex((l) => l.id === lineId);
      if (currentLineIdx === -1) return;

      if (direction === 'next') {
        if (currentFieldIdx < editableFields.length - 1) {
          let nextField = editableFields[currentFieldIdx + 1];
          const targetLine = lineas[currentLineIdx];
          // Si es mano de obra, se saltea marcaModelo que no aplica
          if (targetLine.sourceType === 'mano_obra' && nextField === 'marcaModelo') {
            nextField = 'cantidad';
          }
          const val =
            nextField === 'funcion'
              ? targetLine.funcion
              : nextField === 'marcaModelo'
              ? targetLine.marcaModelo || ''
              : nextField === 'cantidad'
              ? targetLine.formula || String(targetLine.cantidadCalculada)
              : String(targetLine.precioUnitario);
          handleStartEdit(lineId, nextField, val);
        } else if (currentLineIdx < lineas.length - 1) {
          // Siguiente fila, primer campo
          const nextLine = lineas[currentLineIdx + 1];
          handleStartEdit(nextLine.id, 'funcion', nextLine.funcion);
        }
      } else {
        if (currentFieldIdx > 0) {
          let prevField = editableFields[currentFieldIdx - 1];
          const targetLine = lineas[currentLineIdx];
          // Si es mano de obra, se saltea marcaModelo que no aplica
          if (targetLine.sourceType === 'mano_obra' && prevField === 'marcaModelo') {
            prevField = 'funcion';
          }
          const val =
            prevField === 'funcion'
              ? targetLine.funcion
              : prevField === 'marcaModelo'
              ? targetLine.marcaModelo || ''
              : prevField === 'cantidad'
              ? targetLine.formula || String(targetLine.cantidadCalculada)
              : String(targetLine.precioUnitario);
          handleStartEdit(lineId, prevField, val);
        } else if (currentLineIdx > 0) {
          // Fila anterior, último campo
          const prevLine = lineas[currentLineIdx - 1];
          handleStartEdit(prevLine.id, 'precioUnitario', String(prevLine.precioUnitario));
        }
      }
    },
    [editingCell, editableFields, lineas, handleCommitEdit, handleStartEdit]
  );

  // Eliminar línea
  const handleRemoveLine = useCallback(
    (line: UnifiedLineaRow) => {
      if (!activeItem || !onUpdateItemLines) return;
      const insumos = [...(activeItem.insumosSnapshot || [])];
      const manoObra = [...(activeItem.manoObraSnapshot || [])];
      const servicios = [...(activeItem.serviciosTercerizados || [])];

      if (line.sourceType === 'material') {
        insumos.splice(line.sourceIndex, 1);
      } else if (line.sourceType === 'mano_obra') {
        manoObra.splice(line.sourceIndex, 1);
      } else if (line.sourceType === 'servicio') {
        servicios.splice(line.sourceIndex, 1);
      }

      onUpdateItemLines(activeItem.id, {
        insumosSnapshot: insumos,
        manoObraSnapshot: manoObra,
        serviciosTercerizados: servicios
      });
    },
    [activeItem, onUpdateItemLines]
  );

  // Eliminar línea solicitando confirmación modal (con fallback a confirmación estándar)
  const handleRequestRemoveLine = useCallback(
    async (line: UnifiedLineaRow) => {
      if (!activeItem || !onUpdateItemLines) return;
      const confirmed = confirmFn
        ? await confirmFn({
            title: 'Eliminar línea',
            message: `¿Estás seguro de que deseás eliminar la línea "${line.funcion}" del ítem? Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            isDestructive: true
          })
        : window.confirm(`¿Estás seguro de que deseás eliminar la línea "${line.funcion}"?`);

      if (confirmed) {
        handleRemoveLine(line);
      }
    },
    [confirmFn, handleRemoveLine, activeItem, onUpdateItemLines]
  );

  // Crear línea nueva desde la última fila vacía (Ghost Row)
  const handleCommitGhostRow = useCallback(
    (fieldOverride?: Partial<GhostRowDraft>): boolean => {
      if (!activeItem || !onUpdateItemLines) return false;
      const draft = { ...ghostRow, ...fieldOverride };
      const nombre = draft.funcion.trim();
      if (!nombre) return false;

      // Evaluar cantidad
      const qtyRaw = draft.cantidad.trim() || '1';
      const evalRes = evaluateQuantityInput(qtyRaw, scope);
      if (!evalRes.isValid) {
        setGhostEvalError(evalRes.error || 'Fórmula inválida');
        return false;
      }

      const unitPrice = Math.max(0, Number(draft.precioUnitario.replace(',', '.')) || 0);
      const insumos = [...(activeItem.insumosSnapshot || [])];
      const manoObra = [...(activeItem.manoObraSnapshot || [])];
      const servicios = [...(activeItem.serviciosTercerizados || [])];

      if (draft.tipo === 'material') {
        insumos.push({
          insumoId: `ins-adhoc-${generateUUID().slice(0, 8)}`,
          nombre,
          marca: draft.marcaModelo.trim() || 'sin definir',
          unidad: draft.unidad || 'u',
          cantidadTotal: evalRes.numericValue,
          cantidadUnitaria: roundMoney(evalRes.numericValue / (activeItem.cantidad || 1)),
          formulaCantidad: evalRes.formula,
          precioUnitarioCongelado: unitPrice,
          subtotalInsumo: roundMoney(evalRes.numericValue * unitPrice)
        });
      } else if (draft.tipo === 'mano_obra') {
        manoObra.push({
          categoriaId: `mo-adhoc-${generateUUID().slice(0, 8)}`,
          nombreCategoria: nombre,
          horasTotales: evalRes.numericValue,
          horasUnitarias: roundMoney(evalRes.numericValue / (activeItem.cantidad || 1)),
          formulaHoras: evalRes.formula,
          costoHoraCongelado: unitPrice,
          subtotalManoObra: roundMoney(evalRes.numericValue * unitPrice)
        });
      } else {
        servicios.push({
          id: `serv-adhoc-${generateUUID().slice(0, 8)}`,
          descripcion: nombre,
          nombreProveedor: draft.marcaModelo.trim() || undefined,
          cantidad: evalRes.numericValue,
          formulaCantidad: evalRes.formula,
          costo: unitPrice
        });
      }

      onUpdateItemLines(activeItem.id, {
        insumosSnapshot: insumos,
        manoObraSnapshot: manoObra,
        serviciosTercerizados: servicios
      });

      // Limpiar fila vacía
      setGhostRow({
        tipo: 'material',
        funcion: '',
        marcaModelo: '',
        cantidad: '',
        precioUnitario: '',
        unidad: 'u'
      });
      setGhostEvalError(null);
      return true;
    },
    [activeItem, onUpdateItemLines, ghostRow, scope]
  );

  // Seleccionar sugerencia de material del catálogo
  const handleSelectMaterialSuggestion = useCallback(
    (
      suggestion: MaterialCatalogSuggestion,
      target: 'ghost' | { lineId: string }
    ) => {
      if (target === 'ghost') {
        setGhostRow((prev) => ({
          ...prev,
          tipo: 'material',
          funcion: suggestion.nombre,
          marcaModelo: suggestion.marcaModelo || 'sin definir',
          precioUnitario: suggestion.precioVigente > 0 ? String(suggestion.precioVigente) : (prev.precioUnitario || '0'),
          unidad: suggestion.unidad || 'u'
        }));
      } else {
        if (!activeItem || !onUpdateItemLines) return;
        const targetLinea = lineas.find((l) => l.id === target.lineId);
        if (!targetLinea) return;

        const insumos = [...(activeItem.insumosSnapshot || [])];
        if (targetLinea.sourceType === 'material') {
          const cur = { ...insumos[targetLinea.sourceIndex] };
          cur.nombre = suggestion.nombre;
          cur.marca = suggestion.marcaModelo || 'sin definir';
          cur.unidad = suggestion.unidad || cur.unidad || 'u';
          if (suggestion.precioVigente > 0) {
            cur.precioUnitarioCongelado = suggestion.precioVigente;
            cur.subtotalInsumo = roundMoney(cur.cantidadTotal * suggestion.precioVigente);
          }
          insumos[targetLinea.sourceIndex] = cur;
          onUpdateItemLines(activeItem.id, { insumosSnapshot: insumos });
        }
      }
    },
    [activeItem, onUpdateItemLines, lineas]
  );

  // Insertar trabajo tipo expandido en líneas editables dentro del ítem
  const handleInsertTrabajoTipo = useCallback(
    (tarea: TareaTipo, multiplier = 1): boolean => {
      if (!activeItem || !onUpdateItemLines) return false;

      const iMap = insumosMap || new Map();
      const moMap = manoObraMap || new Map();
      const costData = calcularCostoTareaTipo(tarea, iMap, moMap);

      const existingInsumos = [...(activeItem.insumosSnapshot || [])];
      const existingManoObra = [...(activeItem.manoObraSnapshot || [])];
      const itemQty = safeNum(activeItem.cantidad) > 0 ? safeNum(activeItem.cantidad) : 1;
      const factor = Math.max(0.001, multiplier);

      // Expandir insumos en snapshots editables
      const newInsumos: InsumoSnapshot[] = costData.insumosSnapshotUnitario.map((ins) => {
        const cantTotal = roundMoney(ins.cantidadTotal * factor);
        const unitPrice = safeNum(ins.precioUnitarioCongelado);
        return {
          ...ins,
          insumoId: ins.insumoId || `ins-exp-${generateUUID().slice(0, 8)}`,
          marca: ins.marca?.trim() || 'sin definir',
          unidad: ins.unidad || 'u',
          cantidadTotal: cantTotal,
          cantidadUnitaria: roundMoney(cantTotal / itemQty),
          precioUnitarioCongelado: unitPrice,
          subtotalInsumo: roundMoney(cantTotal * unitPrice),
          subtotalInsumoFinal: roundMoney((ins.subtotalInsumoFinal ?? unitPrice) * cantTotal)
        };
      });

      // Expandir mano de obra en snapshots editables
      const newManoObra: ManoObraSnapshot[] = costData.manoObraSnapshotUnitario.map((mo) => {
        const hsTotal = roundMoney(mo.horasTotales * factor);
        const costHora = safeNum(mo.costoHoraCongelado);
        return {
          ...mo,
          categoriaId: mo.categoriaId || `mo-exp-${generateUUID().slice(0, 8)}`,
          nombreCategoria: mo.nombreCategoria,
          horasTotales: hsTotal,
          horasUnitarias: roundMoney(hsTotal / itemQty),
          costoHoraCongelado: costHora,
          subtotalManoObra: roundMoney(hsTotal * costHora)
        };
      });

      onUpdateItemLines(activeItem.id, {
        insumosSnapshot: [...existingInsumos, ...newInsumos],
        manoObraSnapshot: [...existingManoObra, ...newManoObra]
      });

      return true;
    },
    [activeItem, onUpdateItemLines, insumosMap, manoObraMap]
  );

  // Pegar texto multilínea separado por tabuladores o saltos de línea
  const handlePasteLines = useCallback(
    (rawText: string): number => {
      if (!activeItem || !onUpdateItemLines) return 0;
      const parsedDrafts = parsePastedLines(rawText, materialSuggestions);
      if (parsedDrafts.length === 0) return 0;

      const insumos = [...(activeItem.insumosSnapshot || [])];
      const manoObra = [...(activeItem.manoObraSnapshot || [])];
      const servicios = [...(activeItem.serviciosTercerizados || [])];
      const itemQty = safeNum(activeItem.cantidad) > 0 ? safeNum(activeItem.cantidad) : 1;

      parsedDrafts.forEach((draft) => {
        if (draft.tipo === 'material') {
          const cant = draft.cantidad;
          const unitPrice = draft.precioUnitario;
          insumos.push({
            insumoId: `ins-paste-${generateUUID().slice(0, 8)}`,
            nombre: draft.funcion,
            marca: draft.marcaModelo?.trim() || 'sin definir',
            unidad: draft.unidad || 'u',
            cantidadTotal: cant,
            cantidadUnitaria: roundMoney(cant / itemQty),
            formulaCantidad: draft.formula,
            precioUnitarioCongelado: unitPrice,
            subtotalInsumo: roundMoney(cant * unitPrice)
          });
        } else if (draft.tipo === 'mano_obra') {
          const hs = draft.cantidad;
          const costHora = draft.precioUnitario;
          manoObra.push({
            categoriaId: `mo-paste-${generateUUID().slice(0, 8)}`,
            nombreCategoria: draft.funcion,
            horasTotales: hs,
            horasUnitarias: roundMoney(hs / itemQty),
            formulaHoras: draft.formula,
            costoHoraCongelado: costHora,
            subtotalManoObra: roundMoney(hs * costHora)
          });
        } else {
          servicios.push({
            id: `serv-paste-${generateUUID().slice(0, 8)}`,
            descripcion: draft.funcion,
            nombreProveedor: draft.marcaModelo?.trim() || undefined,
            cantidad: draft.cantidad,
            formulaCantidad: draft.formula,
            costo: draft.precioUnitario
          });
        }
      });

      onUpdateItemLines(activeItem.id, {
        insumosSnapshot: insumos,
        manoObraSnapshot: manoObra,
        serviciosTercerizados: servicios
      });

      return parsedDrafts.length;
    },
    [activeItem, onUpdateItemLines, materialSuggestions]
  );

  return {
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
    handleRemoveLine,
    handleRequestRemoveLine,
    ghostRow,
    setGhostRow,
    ghostEvalError,
    setGhostEvalError,
    handleCommitGhostRow,
    handleSelectMaterialSuggestion,
    handleInsertTrabajoTipo,
    handlePasteLines
  };
}

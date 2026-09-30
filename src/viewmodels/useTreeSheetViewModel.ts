import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ItemPresupuesto,
  CapituloPresupuesto,
  GastoPresupuestoConfig,
  CalculatedCell,
  TareaTipo,
  Insumo,
  CategoriaManoDeObra,
  ParametroItem,
  InsumoSnapshot,
  ManoObraSnapshot,
  ServicioTercerizado
} from '../core/types';
import {
  evaluarParametrosYLineasItem,
  roundMoney,
  safeNum,
  calcularCostoTareaTipo,
  TotalesPresupuestoResultado
} from '../core/calculations';
import { generateUUID } from '../core/uuid';


export interface UseTreeSheetViewModelProps {
  items: ItemPresupuesto[];
  setItems: React.Dispatch<React.SetStateAction<ItemPresupuesto[]>>;
  capitulos: CapituloPresupuesto[];
  setCapitulos: React.Dispatch<React.SetStateAction<CapituloPresupuesto[]>>;
  calculosVariables?: Record<string, number | string>;
  setCalculosVariables?: (vars: Record<string, number | string>) => void;
  calculatedCells?: CalculatedCell[];
  setCalculatedCells?: (cells: CalculatedCell[]) => void;
  gastosConfig?: GastoPresupuestoConfig[];
  setGastosConfig?: (gastos: GastoPresupuestoConfig[]) => void;
  totales: TotalesPresupuestoResultado;
  tareasTipo?: TareaTipo[];
  insumosMap?: Map<string, Insumo>;
  manoObraMap?: Map<string, CategoriaManoDeObra>;
  onSaveAsTareaTipo?: (item: ItemPresupuesto) => void;
  onOpenTextMode?: () => void;
}

export interface EditingCellState {
  itemId: string;
  field: 'descripcion' | 'cantidad';
  value: string;
}

export interface TreeSheetRowItem {
  type: 'chapter' | 'item';
  id: string;
  chapterId?: string;
  item?: ItemPresupuesto;
  capitulo?: CapituloPresupuesto;
}

export function useTreeSheetViewModel(props: UseTreeSheetViewModelProps) {
  const {
    items,
    setItems,
    capitulos,
    setCapitulos,
    calculosVariables = {},
    totales,
    tareasTipo = [],
    insumosMap = new Map(),
    manoObraMap = new Map(),
    onSaveAsTareaTipo,
    onOpenTextMode
  } = props;

  // Estados de navegación y selección
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [materialPickerItemId, setMaterialPickerItemId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCellState | null>(null);
  const editingCellRef = useRef<EditingCellState | null>(null);

  // Estados de paneles y modales
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuoteParametersOpen, setIsQuoteParametersOpen] = useState(false);
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);
  const [catalogPickerTargetChapterId, setCatalogPickerTargetChapterId] = useState<string | undefined>(undefined);
  const [quickParamModalItemId, setQuickParamModalItemId] = useState<string | null>(null);
  const [isCreateItemModalOpen, setIsCreateItemModalOpen] = useState(false);
  const [createItemModalTargetChapterId, setCreateItemModalTargetChapterId] = useState<string | undefined>(undefined);

  const handleOpenQuickParamModal = useCallback((itemId: string) => {
    setQuickParamModalItemId(itemId);
  }, []);

  const handleCloseQuickParamModal = useCallback(() => {
    setQuickParamModalItemId(null);
  }, []);

  const handleOpenCreateItemModal = useCallback((chapterId?: string) => {
    setCreateItemModalTargetChapterId(chapterId || selectedChapterId || capitulos[0]?.id);
    setIsCreateItemModalOpen(true);
  }, [selectedChapterId, capitulos]);

  const handleCloseCreateItemModal = useCallback(() => {
    setIsCreateItemModalOpen(false);
    setCreateItemModalTargetChapterId(undefined);
  }, []);

  // Seleccionar ítem activo
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return items.find((it) => it.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  // Lista aplanada de filas visibles (para navegación con flechas de teclado)
  const visibleRows = useMemo<TreeSheetRowItem[]>(() => {
    const rows: TreeSheetRowItem[] = [];

    // Rubros con sus ítems asignados (no se permiten ítems huérfanos sin rubro)
    capitulos.forEach((cap) => {
      rows.push({ type: 'chapter', id: cap.id, capitulo: cap });
      if (!collapsedChapters.has(cap.id)) {
        const capItems = items.filter((it) => it.capituloId === cap.id);
        capItems.forEach((item) => {
          rows.push({ type: 'item', id: item.id, chapterId: cap.id, item });
        });
      }
    });

    return rows;
  }, [items, capitulos, collapsedChapters]);

  // Alternar colapso de capítulo
  const toggleChapterCollapse = useCallback((chapterId: string) => {
    setCollapsedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }, []);

  // Alternar expansión de ítem para ver sus componentes hijos
  const toggleItemExpand = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // Alternar colapso del panel inspector derecho (Opción 1)
  const toggleInspectorCollapsed = useCallback(() => {
    setIsInspectorCollapsed((prev) => !prev);
  }, []);

  const handleOpenMaterialPicker = useCallback((itemId: string) => {
    setMaterialPickerItemId(itemId);
  }, []);

  const handleCloseMaterialPicker = useCallback(() => {
    setMaterialPickerItemId(null);
  }, []);

  // Seleccionar fila
  const handleSelectRow = useCallback((itemId: string | null, chapterId: string | null = null) => {
    setSelectedItemId(itemId);
    setSelectedChapterId(chapterId);
    if (itemId) {
      setIsDetailPanelOpen(true);
    }
  }, []);

  // Iniciar edición en celda
  const handleStartEditCell = useCallback((itemId: string, field: 'descripcion' | 'cantidad', initialValue?: string) => {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    const initialVal = initialValue !== undefined ? initialValue : (field === 'descripcion' ? item.descripcion : String(item.formulaCantidad || item.cantidad || 1));
    const next: EditingCellState = { itemId, field, value: initialVal };
    editingCellRef.current = next;
    setEditingCell(next);
    setSelectedItemId(itemId);
    setSelectedChapterId(item.capituloId || null);
  }, [items]);

  // Actualizar valor temporal durante la edición
  const handleUpdateEditingCellValue = useCallback((value: string) => {
    if (editingCellRef.current) {
      editingCellRef.current = { ...editingCellRef.current, value };
    }
    setEditingCell((prev) => (prev ? { ...prev, value } : null));
  }, []);

  // Cancelar edición en celda
  const handleCancelEditCell = useCallback(() => {
    editingCellRef.current = null;
    setEditingCell(null);
  }, []);

  // Helper para reevaluar un ítem con el motor matemático
  const reevaluarItem = useCallback(
    (item: ItemPresupuesto): ItemPresupuesto => {
      const cap = capitulos.find((c) => c.id === item.capituloId);
      const tt = item.tareaTipoId ? tareasTipo.find((t) => t.id === item.tareaTipoId) : undefined;
      const res = evaluarParametrosYLineasItem(item, {
        capitulo: cap,
        tareaTipo: tt,
        calculosVariables
      });
      return res.item;
    },
    [capitulos, tareasTipo, calculosVariables]
  );

  // Confirmar edición en celda
  const handleCommitEditCell = useCallback(
    (itemId?: string, field?: 'descripcion' | 'cantidad', finalValue?: string) => {
      const targetItemId = itemId || editingCellRef.current?.itemId || editingCell?.itemId;
      const targetField = field || editingCellRef.current?.field || editingCell?.field;
      if (!targetItemId || !targetField) {
        editingCellRef.current = null;
        setEditingCell(null);
        return;
      }

      const item = items.find((it) => it.id === targetItemId);
      if (!item) {
        editingCellRef.current = null;
        setEditingCell(null);
        return;
      }

      // Priorizar finalValue si fue provisto; si no, solo leer de la ref si coincide el campo
      let val = '';
      if (finalValue !== undefined) {
        val = finalValue;
      } else if (editingCellRef.current && editingCellRef.current.field === targetField) {
        val = editingCellRef.current.value ?? '';
      } else if (editingCell && editingCell.field === targetField) {
        val = editingCell.value ?? '';
      }

      editingCellRef.current = null;
      setEditingCell(null);

      if (targetField === 'descripcion') {
        const trimmed = val.trim() || 'Nuevo Ítem';
        setItems((prev) =>
          prev.map((it) => (it.id === targetItemId ? { ...it, descripcion: trimmed } : it))
        );
      } else if (targetField === 'cantidad') {
        const trimmed = val.trim();
        let nuevaCantidad: number | undefined;
        let formulaCantidad: string | undefined = undefined;

        if (trimmed.startsWith('=')) {
          formulaCantidad = trimmed;
        } else {
          const num = Number(trimmed.replace(',', '.'));
          nuevaCantidad = isNaN(num) || num <= 0 ? 1 : num;
        }

        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== targetItemId) return it;
            const itemActualizado: ItemPresupuesto = {
              ...it,
              cantidad: nuevaCantidad !== undefined ? nuevaCantidad : it.cantidad,
              formulaCantidad
            };
            return reevaluarItem(itemActualizado);
          })
        );
      }
    },
    [items, editingCell, setItems, reevaluarItem]
  );

  // Crear nuevo ítem en un capítulo o hermano (siempre dentro de un rubro)
  const handleCreateItem = useCallback(
    (
      chapterId?: string,
      position: 'after' | 'end' = 'after',
      referenceItemId?: string,
      initialData?: { descripcion?: string; unidad?: string; cantidad?: number }
    ): string => {
      let targetChapter = chapterId || selectedChapterId || capitulos[0]?.id;
      if (!targetChapter) {
        // Si la cotización no tiene ningún rubro, creamos uno inicial por defecto
        const newCapId = `cap-${generateUUID().slice(0, 8)}`;
        const newCap: CapituloPresupuesto = {
          id: newCapId,
          nombre: 'Instalaciones Generales',
          orden: 1
        };
        setCapitulos([newCap]);
        targetChapter = newCapId;
      }

      const newItemId = `it-${generateUUID().slice(0, 8)}`;
      const desc = initialData?.descripcion?.trim() || 'Nuevo Ítem';
      const unidad = initialData?.unidad?.trim() || 'u';
      const cant = initialData?.cantidad && initialData.cantidad > 0 ? initialData.cantidad : 1;

      const newItem: ItemPresupuesto = reevaluarItem({
        id: newItemId,
        capituloId: targetChapter,
        descripcion: desc,
        cantidad: cant,
        unidad: unidad,
        costoInsumos: 0,
        costoManoObra: 0,
        costoDirectoTotal: 0,
        precioVentaUnitario: 0,
        precioVentaTotal: 0,
        insumosSnapshot: [],
        manoObraSnapshot: []
      });

      setItems((prev) => {
        if (position === 'after' && referenceItemId) {
          const idx = prev.findIndex((it) => it.id === referenceItemId);
          if (idx !== -1) {
            const next = [...prev];
            next.splice(idx + 1, 0, newItem);
            return next;
          }
        }
        return [...prev, newItem];
      });

      setSelectedItemId(newItemId);
      setSelectedChapterId(targetChapter);

      if (!initialData?.descripcion) {
        const nextCell: EditingCellState = { itemId: newItemId, field: 'descripcion', value: desc };
        editingCellRef.current = nextCell;
        setEditingCell(nextCell);
      } else {
        editingCellRef.current = null;
        setEditingCell(null);
      }
      setIsDetailPanelOpen(true);

      return newItemId;
    },
    [selectedChapterId, capitulos, setCapitulos, reevaluarItem, setItems]
  );

  const handleConfirmCreateItem = useCallback(
    (data: { descripcion: string; unidad: string; cantidad: number }) => {
      handleCreateItem(createItemModalTargetChapterId, 'end', undefined, data);
      setIsCreateItemModalOpen(false);
      setCreateItemModalTargetChapterId(undefined);
    },
    [handleCreateItem, createItemModalTargetChapterId]
  );

  // Crear nuevo capítulo / rubro
  const handleCreateChapter = useCallback(
    (nombreDefault?: string) => {
      const nextNum = capitulos.length + 1;
      const capId = `cap-${generateUUID().slice(0, 8)}`;
      const newCap: CapituloPresupuesto = {
        id: capId,
        nombre: nombreDefault?.trim() || `Rubro ${nextNum}`,
        orden: nextNum
      };

      setCapitulos((prev) => [...prev, newCap]);
      setSelectedChapterId(capId);
      setSelectedItemId(null);
      return capId;
    },
    [capitulos, setCapitulos]
  );

  // Renombrar capítulo
  const handleRenameChapter = useCallback(
    (chapterId: string, nombre: string) => {
      const trimmed = nombre.trim() || 'Capítulo';
      setCapitulos((prev) =>
        prev.map((c) => (c.id === chapterId ? { ...c, nombre: trimmed } : c))
      );
    },
    [setCapitulos]
  );

  // Eliminar capítulo (y eliminar o reasignar sus ítems al rubro restante, nunca dejarlos huérfanos)
  const handleRemoveChapter = useCallback(
    (chapterId: string, deleteItems = true) => {
      const remainingCapitulos = capitulos.filter((c) => c.id !== chapterId);
      setCapitulos(remainingCapitulos);

      if (deleteItems || remainingCapitulos.length === 0) {
        // Eliminar los ítems contenidos en el rubro
        setItems((prev) => prev.filter((it) => it.capituloId !== chapterId));
      } else {
        // Reasignar al primer rubro restante
        const fallbackChapterId = remainingCapitulos[0].id;
        setItems((prev) =>
          prev.map((it) => (it.capituloId === chapterId ? { ...it, capituloId: fallbackChapterId } : it))
        );
      }
      if (selectedChapterId === chapterId) {
        setSelectedChapterId(remainingCapitulos[0]?.id || null);
      }
    },
    [selectedChapterId, capitulos, setCapitulos, setItems]
  );

  // Eliminar ítem
  const handleRemoveItem = useCallback(
    (itemId: string) => {
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      if (selectedItemId === itemId) {
        setSelectedItemId(null);
        setIsDetailPanelOpen(false);
      }
    },
    [selectedItemId, setItems]
  );

  // Mover ítem arriba / abajo
  const handleMoveItem = useCallback(
    (itemId: string, direction: 'up' | 'down') => {
      setItems((prev) => {
        const idx = prev.findIndex((it) => it.id === itemId);
        if (idx === -1) return prev;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= prev.length) return prev;
        const copy = [...prev];
        const [moved] = copy.splice(idx, 1);
        copy.splice(targetIdx, 0, moved);
        return copy;
      });
    },
    [setItems]
  );

  // Mover ítem a otro capítulo
  const handleMoveItemToChapter = useCallback(
    (itemId: string, targetChapterId: string | undefined) => {
      if (!targetChapterId) return; // Nunca mover a huérfano sin rubro
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? reevaluarItem({ ...it, capituloId: targetChapterId }) : it))
      );
    },
    [setItems, reevaluarItem]
  );

  // Indentar / Desanidar ítem entre rubros con Alt+Flecha
  const handleIndentItem = useCallback(
    (itemId: string) => {
      const currentItem = items.find((it) => it.id === itemId);
      if (!currentItem || !currentItem.capituloId) return;
      const currentCapIdx = capitulos.findIndex((c) => c.id === currentItem.capituloId);
      if (currentCapIdx !== -1 && currentCapIdx < capitulos.length - 1) {
        handleMoveItemToChapter(itemId, capitulos[currentCapIdx + 1].id);
      }
    },
    [items, capitulos, handleMoveItemToChapter]
  );

  const handleUnindentItem = useCallback(
    (itemId: string) => {
      const currentItem = items.find((it) => it.id === itemId);
      if (!currentItem || !currentItem.capituloId) return;
      const currentCapIdx = capitulos.findIndex((c) => c.id === currentItem.capituloId);
      if (currentCapIdx > 0) {
        handleMoveItemToChapter(itemId, capitulos[currentCapIdx - 1].id);
      }
    },
    [items, capitulos, handleMoveItemToChapter]
  );

  // Navegación fluida de celda en celda (Tab, Shift+Tab, Enter)
  const handleNavigateCell = useCallback(
    (direction: 'next' | 'prev', fromField: 'descripcion' | 'cantidad') => {
      const currentCell = editingCellRef.current || editingCell;
      const targetItemId = currentCell?.itemId || selectedItemId;
      if (!targetItemId) return;

      // Confirmar valor actual antes de cambiar de celda
      handleCommitEditCell(targetItemId, fromField);

      // Obtener secuencia de partidas visibles
      const visibleItemRows = visibleRows.filter((r) => r.type === 'item');
      const currentIndex = visibleItemRows.findIndex((r) => r.id === targetItemId);
      if (currentIndex === -1) return;

      if (direction === 'next') {
        if (fromField === 'descripcion') {
          // De descripción a cantidad en la misma partida
          handleStartEditCell(targetItemId, 'cantidad');
        } else {
          // De cantidad a descripción en la siguiente partida
          if (currentIndex + 1 < visibleItemRows.length) {
            const nextItem = visibleItemRows[currentIndex + 1];
            handleStartEditCell(nextItem.id, 'descripcion');
          } else {
            // Última partida: crear una nueva automáticamente
            const currentItem = items.find((it) => it.id === targetItemId);
            handleCreateItem(currentItem?.capituloId, 'after', targetItemId);
          }
        }
      } else {
        // Dirección 'prev' (Shift+Tab)
        if (fromField === 'cantidad') {
          // De cantidad a descripción en la misma partida
          handleStartEditCell(targetItemId, 'descripcion');
        } else {
          // De descripción a cantidad en la partida anterior
          if (currentIndex - 1 >= 0) {
            const prevItem = visibleItemRows[currentIndex - 1];
            handleStartEditCell(prevItem.id, 'cantidad');
          }
        }
      }
    },
    [editingCell, selectedItemId, handleCommitEditCell, visibleRows, handleStartEditCell, items, handleCreateItem]
  );

  // Manejador global de teclado en el Árbol-Planilla
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Si está en paleta de comandos, no interceptar
      if (isCommandPaletteOpen) return;

      // Ctrl+K / Cmd+K: abrir paleta de comandos
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Si está editando activamente una celda
      if (editingCell) {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCancelEditCell();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleCommitEditCell(editingCell.itemId, editingCell.field);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          handleNavigateCell(e.shiftKey ? 'prev' : 'next', editingCell.field);
        }
        return;
      }

      // Si NO está editando una celda: navegación en el árbol
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const curIdx = visibleRows.findIndex((r) => {
          if (selectedItemId) return r.type === 'item' && r.id === selectedItemId;
          if (selectedChapterId) return r.type === 'chapter' && r.id === selectedChapterId;
          return false;
        });
        const nextIdx = curIdx + 1 < visibleRows.length ? curIdx + 1 : 0;
        const target = visibleRows[nextIdx];
        if (target) {
          if (target.type === 'item') {
            handleSelectRow(target.id, target.chapterId || null);
          } else {
            handleSelectRow(null, target.id);
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const curIdx = visibleRows.findIndex((r) => {
          if (selectedItemId) return r.type === 'item' && r.id === selectedItemId;
          if (selectedChapterId) return r.type === 'chapter' && r.id === selectedChapterId;
          return false;
        });
        const prevIdx = curIdx - 1 >= 0 ? curIdx - 1 : visibleRows.length - 1;
        const target = visibleRows[prevIdx];
        if (target) {
          if (target.type === 'item') {
            handleSelectRow(target.id, target.chapterId || null);
          } else {
            handleSelectRow(null, target.id);
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedItemId) {
          // Crear ítem hermano
          handleCreateItem(selectedItem?.capituloId, 'after', selectedItemId);
        } else if (selectedChapterId) {
          // Crear ítem en el capítulo seleccionado
          handleCreateItem(selectedChapterId, 'end');
        } else {
          // Crear nuevo ítem general
          handleCreateItem();
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (selectedItemId) {
          handleStartEditCell(selectedItemId, 'descripcion');
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (selectedItemId) {
          handleStartEditCell(selectedItemId, 'descripcion');
        }
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        if (selectedItemId) handleIndentItem(selectedItemId);
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (selectedItemId) handleUnindentItem(selectedItemId);
      } else if (e.key === 'ArrowRight') {
        if (selectedChapterId && collapsedChapters.has(selectedChapterId)) {
          toggleChapterCollapse(selectedChapterId);
        } else if (selectedItemId && !expandedItems.has(selectedItemId)) {
          toggleItemExpand(selectedItemId);
        }
      } else if (e.key === 'ArrowLeft') {
        if (selectedChapterId && !collapsedChapters.has(selectedChapterId)) {
          toggleChapterCollapse(selectedChapterId);
        } else if (selectedItemId && expandedItems.has(selectedItemId)) {
          toggleItemExpand(selectedItemId);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItemId && !editingCell) {
          e.preventDefault();
          handleRemoveItem(selectedItemId);
        }
      }
    },
    [
      isCommandPaletteOpen,
      editingCell,
      handleCancelEditCell,
      handleNavigateCell,
      handleStartEditCell,
      handleCreateItem,
      selectedItem,
      visibleRows,
      selectedItemId,
      selectedChapterId,
      handleSelectRow,
      handleUnindentItem,
      handleIndentItem,
      handleRemoveItem,
      collapsedChapters,
      toggleChapterCollapse,
      expandedItems,
      toggleItemExpand
    ]
  );

  // ─── Operaciones de Edición y Composición de Ítems ───

  // Actualizar cualquier propiedad del ítem de forma general y reevaluar
  const handleUpdateItem = useCallback(
    (itemId: string, updates: Partial<ItemPresupuesto>) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it;

          let desacoplado = it.desacoplado;
          if (it.tareaTipoId && !desacoplado) {
            const linesChanged =
              (updates.insumosSnapshot && JSON.stringify(updates.insumosSnapshot) !== JSON.stringify(it.insumosSnapshot)) ||
              (updates.manoObraSnapshot && JSON.stringify(updates.manoObraSnapshot) !== JSON.stringify(it.manoObraSnapshot)) ||
              (updates.serviciosTercerizados && JSON.stringify(updates.serviciosTercerizados) !== JSON.stringify(it.serviciosTercerizados));
            if (linesChanged) {
              desacoplado = true;
            }
          }

          const updated: ItemPresupuesto = {
            ...it,
            ...updates,
            desacoplado
          };
          return reevaluarItem(updated);
        })
      );
    },
    [setItems, reevaluarItem]
  );

  // Actualizar unidad de medida del ítem
  const handleUpdateItemUnidad = useCallback(
    (itemId: string, unidad: string) => {
      const cleanUnidad = unidad?.trim() || 'u';
      handleUpdateItem(itemId, { unidad: cleanUnidad });
    },
    [handleUpdateItem]
  );

  // Duplicar ítem con todos sus componentes (materiales, mano de obra, servicios, parámetros)
  const handleDuplicateItem = useCallback(
    (itemId: string): string | null => {
      const target = items.find((it) => it.id === itemId);
      if (!target) return null;

      const newItemId = `it-${generateUUID().slice(0, 8)}`;
      const duplicatedItem: ItemPresupuesto = reevaluarItem({
        ...target,
        id: newItemId,
        descripcion: `${target.descripcion} (copia)`,
        insumosSnapshot: (target.insumosSnapshot || []).map((ins) => ({ ...ins })),
        manoObraSnapshot: (target.manoObraSnapshot || []).map((mo) => ({ ...mo })),
        serviciosTercerizados: (target.serviciosTercerizados || []).map((serv) => ({
          ...serv,
          id: `serv-${generateUUID().slice(0, 8)}`
        })),
        parametros: (target.parametros || []).map((p) => ({ ...p })),
        valoresParametros: target.valoresParametros ? { ...target.valoresParametros } : undefined,
        valoresVariables: target.valoresVariables ? { ...target.valoresVariables } : undefined
      });

      setItems((prev) => {
        const idx = prev.findIndex((it) => it.id === itemId);
        if (idx !== -1) {
          const next = [...prev];
          next.splice(idx + 1, 0, duplicatedItem);
          return next;
        }
        return [...prev, duplicatedItem];
      });

      setSelectedItemId(newItemId);
      setSelectedChapterId(target.capituloId || null);
      return newItemId;
    },
    [items, setItems, reevaluarItem]
  );

  // Actualizar parámetros del ítem
  const handleUpdateItemParametros = useCallback(
    (itemId: string, parametros: ParametroItem[]) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it;
          const updated = { ...it, parametros };
          return reevaluarItem(updated);
        })
      );
    },
    [setItems, reevaluarItem]
  );

  // Actualizar cantidad del ítem desde el panel
  const handleUpdateItemCantidad = useCallback(
    (itemId: string, cantidad: number, formulaCantidad?: string) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it;
          const updated = { ...it, cantidad, formulaCantidad };
          return reevaluarItem(updated);
        })
      );
    },
    [setItems, reevaluarItem]
  );

  // Actualizar líneas del ítem (desacopla automáticamente si está vinculado a tarea tipo)
  const handleUpdateItemLines = useCallback(
    (
      itemId: string,
      updates: {
        insumosSnapshot?: InsumoSnapshot[];
        manoObraSnapshot?: ManoObraSnapshot[];
        serviciosTercerizados?: ServicioTercerizado[];
        condicionTrabajo?: 'normal' | 'dificultosa' | 'favorable';
        precioManual?: number;
      }
    ) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it;

          let desacoplado = it.desacoplado;
          if (it.tareaTipoId && !desacoplado) {
            const linesChanged =
              (updates.insumosSnapshot && JSON.stringify(updates.insumosSnapshot) !== JSON.stringify(it.insumosSnapshot)) ||
              (updates.manoObraSnapshot && JSON.stringify(updates.manoObraSnapshot) !== JSON.stringify(it.manoObraSnapshot)) ||
              (updates.serviciosTercerizados && JSON.stringify(updates.serviciosTercerizados) !== JSON.stringify(it.serviciosTercerizados));
            if (linesChanged) {
              desacoplado = true;
            }
          }

          const updated: ItemPresupuesto = {
            ...it,
            ...updates,
            desacoplado
          };

          return reevaluarItem(updated);
        })
      );
    },
    [setItems, reevaluarItem]
  );

  // Agregar material a un ítem
  const handleAddMaterialToItem = useCallback(
    (itemId: string, material: Insumo, cantidad: number, formula?: string) => {
      const target = items.find((it) => it.id === itemId);
      if (!target) return;

      const existingSnapshots = [...(target.insumosSnapshot || [])];
      const unitPrice = roundMoney(
        safeNum(material.precioActual ?? material.precioNeto ?? material.precioFinal)
      );
      const qtyTotal = roundMoney(safeNum(cantidad) || 1);
      const subtotal = roundMoney(unitPrice * qtyTotal);

      const existingIdx = existingSnapshots.findIndex(
        (s) => s.insumoId === material.id || s.materialId === material.id
      );

      if (existingIdx >= 0 && !formula) {
        const cur = existingSnapshots[existingIdx];
        const newQty = roundMoney(cur.cantidadTotal + qtyTotal);
        existingSnapshots[existingIdx] = {
          ...cur,
          cantidadTotal: newQty,
          cantidadUnitaria: roundMoney(newQty / (target.cantidad || 1)),
          subtotalInsumo: roundMoney(cur.precioUnitarioCongelado * newQty)
        };
      } else {
        existingSnapshots.push({
          insumoId: material.id,
          materialId: material.id,
          nombre: material.nombre,
          marca: material.marca,
          unidad: material.unidadVenta || material.unidad || 'u',
          cantidadUnitaria: roundMoney(qtyTotal / (target.cantidad || 1)),
          cantidadTotal: qtyTotal,
          precioUnitarioCongelado: unitPrice,
          subtotalInsumo: subtotal,
          formulaCantidad: formula
        });
      }

      handleUpdateItemLines(itemId, { insumosSnapshot: existingSnapshots });
    },
    [items, handleUpdateItemLines]
  );

  // Eliminar material de un ítem
  const handleRemoveMaterialFromItem = useCallback(
    (itemId: string, index: number) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId || !it.insumosSnapshot) return it;
          const filtered = it.insumosSnapshot.filter((_, idx) => idx !== index);
          const desacoplado = it.tareaTipoId ? true : it.desacoplado;
          return reevaluarItem({
            ...it,
            insumosSnapshot: filtered,
            desacoplado
          });
        })
      );
    },
    [setItems, reevaluarItem]
  );

  // Actualizar fórmula o cantidad de material
  const handleUpdateMaterialFormula = useCallback(
    (itemId: string, index: number, formulaStr: string) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId || !it.insumosSnapshot) return it;

          const trimmed = formulaStr.trim();
          const copy = [...it.insumosSnapshot];
          const ins = { ...copy[index] };
          if (!ins) return it;

          if (trimmed.startsWith('=')) {
            ins.formulaCantidad = trimmed;
          } else {
            ins.formulaCantidad = undefined;
            const parsed = Number(trimmed.replace(',', '.'));
            ins.cantidadUnitaria = isNaN(parsed) ? 1 : parsed;
            ins.cantidadTotal = roundMoney(ins.cantidadUnitaria * (it.cantidad || 1));
            ins.subtotalInsumo = roundMoney(ins.cantidadTotal * ins.precioUnitarioCongelado);
          }

          copy[index] = ins;
          const desacoplado = it.tareaTipoId ? true : it.desacoplado;
          return reevaluarItem({
            ...it,
            insumosSnapshot: copy,
            desacoplado
          });
        })
      );
    },
    [setItems, reevaluarItem]
  );

  // Agregar mano de obra a un ítem
  const handleAddLaborToItem = useCallback(
    (itemId: string, categoriaId: string, horas: number, formula?: string) => {
      const target = items.find((it) => it.id === itemId);
      if (!target) return;

      const catMO = manoObraMap.get(categoriaId);
      if (!catMO) return;

      const existingSnapshots = [...(target.manoObraSnapshot || [])];
      const rate = roundMoney(safeNum(catMO.costoHora));
      const hsTotal = roundMoney(safeNum(horas) || 1);
      const subtotal = roundMoney(rate * hsTotal);

      const existingIdx = existingSnapshots.findIndex((s) => s.categoriaId === categoriaId);
      if (existingIdx >= 0 && !formula) {
        const cur = existingSnapshots[existingIdx];
        const newHs = roundMoney(cur.horasTotales + hsTotal);
        existingSnapshots[existingIdx] = {
          ...cur,
          horasTotales: newHs,
          horasUnitarias: roundMoney(newHs / (target.cantidad || 1)),
          subtotalManoObra: roundMoney(cur.costoHoraCongelado * newHs)
        };
      } else {
        existingSnapshots.push({
          categoriaId: catMO.id,
          nombreCategoria: catMO.nombre,
          horasUnitarias: roundMoney(hsTotal / (target.cantidad || 1)),
          horasTotales: hsTotal,
          costoHoraCongelado: rate,
          subtotalManoObra: subtotal,
          formulaHoras: formula
        });
      }

      handleUpdateItemLines(itemId, { manoObraSnapshot: existingSnapshots });
    },
    [items, manoObraMap, handleUpdateItemLines]
  );

  // Eliminar mano de obra de un ítem
  const handleRemoveLaborFromItem = useCallback(
    (itemId: string, index: number) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId || !it.manoObraSnapshot) return it;
          const filtered = it.manoObraSnapshot.filter((_, idx) => idx !== index);
          const desacoplado = it.tareaTipoId ? true : it.desacoplado;
          return reevaluarItem({
            ...it,
            manoObraSnapshot: filtered,
            desacoplado
          });
        })
      );
    },
    [setItems, reevaluarItem]
  );

  // Actualizar fórmula u horas de mano de obra
  const handleUpdateLaborFormula = useCallback(
    (itemId: string, index: number, formulaStr: string) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId || !it.manoObraSnapshot) return it;

          const trimmed = formulaStr.trim();
          const copy = [...it.manoObraSnapshot];
          const mo = { ...copy[index] };
          if (!mo) return it;

          if (trimmed.startsWith('=')) {
            mo.formulaHoras = trimmed;
          } else {
            mo.formulaHoras = undefined;
            const parsed = Number(trimmed.replace(',', '.'));
            mo.horasUnitarias = isNaN(parsed) ? 1 : parsed;
            mo.horasTotales = roundMoney(mo.horasUnitarias * (it.cantidad || 1));
            mo.subtotalManoObra = roundMoney(mo.horasTotales * mo.costoHoraCongelado);
          }

          copy[index] = mo;
          const desacoplado = it.tareaTipoId ? true : it.desacoplado;
          return reevaluarItem({
            ...it,
            manoObraSnapshot: copy,
            desacoplado
          });
        })
      );
    },
    [setItems, reevaluarItem]
  );

  // Agregar servicio tercerizado
  const handleAddServiceToItem = useCallback(
    (itemId: string, descripcion: string, costo: number) => {
      const newServ: ServicioTercerizado = {
        id: `serv-${generateUUID().slice(0, 8)}`,
        descripcion,
        cantidad: 1,
        costo: roundMoney(costo)
      };

      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it;
          const existingServices = [...(it.serviciosTercerizados || []), newServ];
          const desacoplado = it.tareaTipoId ? true : it.desacoplado;
          return reevaluarItem({
            ...it,
            serviciosTercerizados: existingServices,
            desacoplado
          });
        })
      );
    },
    [setItems, reevaluarItem]
  );

  // Eliminar servicio tercerizado
  const handleRemoveServiceFromItem = useCallback(
    (itemId: string, index: number) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId || !it.serviciosTercerizados) return it;
          const filtered = it.serviciosTercerizados.filter((_, idx) => idx !== index);
          const desacoplado = it.tareaTipoId ? true : it.desacoplado;
          return reevaluarItem({
            ...it,
            serviciosTercerizados: filtered,
            desacoplado
          });
        })
      );
    },
    [setItems, reevaluarItem]
  );

  // Desacoplar ítem explícitamente
  const handleDesacoplarItem = useCallback(
    (itemId: string) => {
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, desacoplado: true } : it))
      );
    },
    [setItems]
  );

  // Actualizar a la versión más reciente de la Tarea Tipo
  const handleActualizarVersionTareaTipo = useCallback(
    (itemId: string) => {
      const it = items.find((i) => i.id === itemId);
      if (!it || !it.tareaTipoId) return;

      const tt = tareasTipo.find((t) => t.id === it.tareaTipoId);
      if (!tt) return;

      // Actualizar snapshots desde la nueva versión de la tarea tipo
      const currentQty = it.cantidad || 1;
      const costData = calcularCostoTareaTipo(tt, insumosMap, manoObraMap);
      const updatedInsumos: InsumoSnapshot[] = costData.insumosSnapshotUnitario.map((ins, idx) => {
        const uQty = safeNum(ins.cantidadUnitaria);
        const uPrice = safeNum(ins.precioUnitarioCongelado);
        return {
          ...ins,
          formulaCantidad: tt.insumos?.[idx]?.formula,
          cantidadTotal: roundMoney(uQty * currentQty),
          subtotalInsumo: roundMoney(uQty * currentQty * uPrice)
        };
      });

      const updatedMo: ManoObraSnapshot[] = costData.manoObraSnapshotUnitario.map((mo, idx) => {
        const uHs = safeNum(mo.horasUnitarias);
        const uRate = safeNum(mo.costoHoraCongelado);
        return {
          ...mo,
          formulaHoras: tt.manoObra?.[idx]?.formula,
          horasTotales: roundMoney(uHs * currentQty),
          subtotalManoObra: roundMoney(uHs * currentQty * uRate)
        };
      });

      const updatedItem: ItemPresupuesto = {
        ...it,
        tareaTipoVersion: tt.version || 1,
        desacoplado: false,
        insumosSnapshot: updatedInsumos,
        manoObraSnapshot: updatedMo
      };

      const reevaluado = reevaluarItem(updatedItem);
      setItems((prev) => prev.map((item) => (item.id === itemId ? reevaluado : item)));
    },
    [items, tareasTipo, insumosMap, manoObraMap, reevaluarItem, setItems]
  );

  // Abrir selector de catálogo de tareas tipo
  const handleOpenCatalogPicker = useCallback((targetChapterId?: string) => {
    setCatalogPickerTargetChapterId(targetChapterId);
    setIsCatalogPickerOpen(true);
  }, []);

  // Insertar tarea tipo desde catálogo
  const handleInsertTareaTipo = useCallback(
    (tarea: TareaTipo, overrideChapterId?: string) => {
      const currentQty = 1;
      const costData = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);
      const insumosSnapshot: InsumoSnapshot[] = costData.insumosSnapshotUnitario.map((ins, idx) => {
        const uQty = safeNum(ins.cantidadUnitaria);
        const uPrice = safeNum(ins.precioUnitarioCongelado);
        return {
          ...ins,
          formulaCantidad: tarea.insumos?.[idx]?.formula,
          cantidadTotal: roundMoney(uQty * currentQty),
          subtotalInsumo: roundMoney(uQty * currentQty * uPrice)
        };
      });

      const manoObraSnapshot: ManoObraSnapshot[] = costData.manoObraSnapshotUnitario.map((mo, idx) => {
        const uHs = safeNum(mo.horasUnitarias);
        const uRate = safeNum(mo.costoHoraCongelado);
        return {
          ...mo,
          formulaHoras: tarea.manoObra?.[idx]?.formula,
          horasTotales: roundMoney(uHs * currentQty),
          subtotalManoObra: roundMoney(uHs * currentQty * uRate)
        };
      });

      const parametros: ParametroItem[] = (tarea.parametros || []).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        unidad: p.unidad,
        valor: safeNum(p.valorDefault),
        origen: 'tarea_tipo'
      }));

      const newItemId = `it-${generateUUID().slice(0, 8)}`;
      let targetChapter = overrideChapterId || catalogPickerTargetChapterId || selectedChapterId || capitulos[0]?.id;
      if (!targetChapter) {
        const newCapId = `cap-${generateUUID().slice(0, 8)}`;
        const newCap: CapituloPresupuesto = {
          id: newCapId,
          nombre: tarea.categoria ? tarea.categoria.charAt(0).toUpperCase() + tarea.categoria.slice(1) : 'Instalaciones Generales',
          orden: 1
        };
        setCapitulos([newCap]);
        targetChapter = newCapId;
      }

      const rawItem: ItemPresupuesto = {
        id: newItemId,
        capituloId: targetChapter,
        tipoItem: 'tarea_tipo',
        tareaTipoId: tarea.id,
        tareaTipoVersion: tarea.version || 1,
        desacoplado: false,
        descripcion: tarea.nombre,
        cantidad: currentQty,
        unidad: tarea.unidad || 'u',
        parametros,
        insumosSnapshot,
        manoObraSnapshot,
        costoInsumos: 0,
        costoManoObra: 0,
        costoDirectoTotal: 0,
        precioVentaUnitario: 0,
        precioVentaTotal: 0
      };

      const reevaluado = reevaluarItem(rawItem);

      setItems((prev) => [...prev, reevaluado]);
      setSelectedItemId(newItemId);
      setSelectedChapterId(targetChapter);
      setIsDetailPanelOpen(true);
      setIsCatalogPickerOpen(false);
      setCatalogPickerTargetChapterId(undefined);
    },
    [catalogPickerTargetChapterId, selectedChapterId, capitulos, setCapitulos, reevaluarItem, setItems]
  );

  // Auto-normalización defensiva: garantizar que ningún ítem quede huérfano sin rubro asignado
  useEffect(() => {
    const orphanItems = items.filter((it) => !it.capituloId);
    if (orphanItems.length === 0) return;

    if (capitulos.length === 0) {
      const newCapId = `cap-${generateUUID().slice(0, 8)}`;
      const newCap: CapituloPresupuesto = {
        id: newCapId,
        nombre: 'Instalaciones Generales',
        orden: 1
      };
      setCapitulos([newCap]);
      setItems((prev) =>
        prev.map((it) => (!it.capituloId ? { ...it, capituloId: newCapId } : it))
      );
    } else {
      const fallbackCapId = capitulos[0].id;
      setItems((prev) =>
        prev.map((it) => (!it.capituloId ? { ...it, capituloId: fallbackCapId } : it))
      );
    }
  }, [items, capitulos, setCapitulos, setItems]);

  return {
    // Estados principales
    selectedItemId,
    selectedChapterId,
    selectedItem,
    collapsedChapters,
    expandedItems,
    isInspectorCollapsed,
    materialPickerItemId,
    editingCell,
    visibleRows,

    // Estados de modales y paneles
    isDetailPanelOpen,
    setIsDetailPanelOpen,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    isQuoteParametersOpen,
    setIsQuoteParametersOpen,
    isCatalogPickerOpen,
    setIsCatalogPickerOpen,
    catalogPickerTargetChapterId,
    setCatalogPickerTargetChapterId,
    handleOpenCatalogPicker,
    handleInsertTareaTipo,
    isCreateItemModalOpen,
    createItemModalTargetChapterId,
    handleOpenCreateItemModal,
    handleCloseCreateItemModal,
    handleConfirmCreateItem,
    quickParamModalItemId,
    handleOpenQuickParamModal,
    handleCloseQuickParamModal,

    // Acciones de UI y teclado
    handleSelectRow,
    toggleChapterCollapse,
    toggleItemExpand,
    toggleInspectorCollapsed,
    handleOpenMaterialPicker,
    handleCloseMaterialPicker,
    handleStartEditCell,
    handleUpdateEditingCellValue,
    handleCommitEditCell,
    handleCancelEditCell,
    handleNavigateCell,
    handleKeyDown,

    // Acciones sobre árbol e ítems
    handleCreateItem,
    handleCreateChapter,
    handleRenameChapter,
    handleRemoveChapter,
    handleRemoveItem,
    handleMoveItem,
    handleMoveItemToChapter,
    handleIndentItem,
    handleUnindentItem,

    // Acciones del panel de detalle y rubros hijos
    handleUpdateItem,
    handleUpdateItemUnidad,
    handleDuplicateItem,
    handleUpdateItemParametros,
    handleUpdateItemCantidad,
    handleUpdateItemLines,
    handleAddMaterialToItem,
    handleRemoveMaterialFromItem,
    handleUpdateMaterialFormula,
    handleAddLaborToItem,
    handleRemoveLaborFromItem,
    handleUpdateLaborFormula,
    handleAddServiceToItem,
    handleRemoveServiceFromItem,
    handleDesacoplarItem,
    handleActualizarVersionTareaTipo,
    onSaveAsTareaTipo,
    onOpenTextMode
  };
}

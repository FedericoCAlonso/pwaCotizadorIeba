import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Package,
  Plus,
  Trash2,
  Layers,
  FolderOpen
} from 'lucide-react';
import {
  ItemPresupuesto,
  CapituloPresupuesto,
  InsumoSnapshot,
  ManoObraSnapshot,
  ServicioTercerizado
} from '../../../core/types';
import { TotalesPresupuestoResultado, formatARS, safeNum, roundMoney } from '../../../core/calculations';
import { generateUUID } from '../../../core/uuid';
import { MaterialCatalogSuggestion, searchMaterialCatalogSuggestions } from '../../../core/materialSuggestions';
import {
  useSmartSheetLinesViewModel,
  UnifiedLineaRow
} from '../../../viewmodels/useSmartSheetLinesViewModel';
import { SmartSheetMaterialAutocomplete } from './SmartSheetMaterialAutocomplete';
import { SmartSheetNarrowCascada } from './SmartSheetNarrowCascada';

export interface SmartSheetNarrowViewProps {
  items: ItemPresupuesto[];
  capitulos: CapituloPresupuesto[];
  totales: TotalesPresupuestoResultado;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onUpdateItemLines?: (
    itemId: string,
    updatedSnapshots: {
      insumosSnapshot?: InsumoSnapshot[];
      manoObraSnapshot?: ManoObraSnapshot[];
      serviciosTercerizados?: ServicioTercerizado[];
    }
  ) => void;
  materialSuggestions?: MaterialCatalogSuggestion[];
}

/**
 * SmartSheetNarrowView: Vista optimizada para pantallas angostas (< 700 px) - Fase 4.
 * Flujo: Lista de ítems → al tocar uno, detalle de líneas en dos renglones.
 * - Renglón 1: Función arriba.
 * - Renglón 2: Marca y cantidad abajo en gris.
 * - A la derecha: Subtotal.
 * - Sin fórmulas ni cascada visibles; la cascada es un bloque plegable.
 * - Control único fijo abajo "+ Agregar línea…" con autocompletado y cantidad numérica directa.
 */
export const SmartSheetNarrowView: React.FC<SmartSheetNarrowViewProps> = ({
  items,
  capitulos,
  totales,
  selectedItemId,
  onSelectItem,
  onUpdateItemLines,
  materialSuggestions = []
}) => {
  // Navegación local: 'items' (lista de ítems) o 'detail' (líneas del ítem seleccionado)
  const [activeView, setActiveView] = useState<'items' | 'detail'>('items');

  // Estado del control fijo inferior "Agregar línea…"
  const [newFuncion, setNewFuncion] = useState('');
  const [newMarca, setNewMarca] = useState('sin definir');
  const [newUnidad, setNewUnidad] = useState('u');
  const [newPrecio, setNewPrecio] = useState(0);
  const [newCantidad, setNewCantidad] = useState('1');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Mapa de ítems calculados determinísticamente
  const calculatedItemsMap = useMemo(() => {
    const map = new Map<string, ItemPresupuesto>();
    (totales?.itemsCalculados || []).forEach((ci) => {
      map.set(ci.id, ci);
    });
    return map;
  }, [totales?.itemsCalculados]);

  // Mapa de capítulos por id
  const capitulosMap = useMemo(() => {
    const map = new Map<string, string>();
    capitulos.forEach((c) => map.set(c.id, c.nombre));
    return map;
  }, [capitulos]);

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return items.find((it) => it.id === selectedItemId) || null;
  }, [selectedItemId, items]);

  const calculatedSelectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return calculatedItemsMap.get(selectedItemId) || null;
  }, [selectedItemId, calculatedItemsMap]);

  // ViewModel de líneas del ítem seleccionado
  const {
    lineas,
    handleRequestRemoveLine
  } = useSmartSheetLinesViewModel({
    selectedItem,
    calculatedItem: calculatedSelectedItem,
    onUpdateItemLines,
    materialSuggestions
  });

  // Sugerencias filtradas en tiempo real para el control inferior
  const filteredSuggestions = useMemo(() => {
    if (!newFuncion.trim()) return [];
    return searchMaterialCatalogSuggestions(newFuncion, materialSuggestions, 8);
  }, [newFuncion, materialSuggestions]);

  // Agregar nueva línea de material directamente (cantidad numérica, sin fórmulas)
  const handleAddLine = () => {
    if (!selectedItem || !onUpdateItemLines) return;
    const nombre = newFuncion.trim();
    if (!nombre) return;

    const qty = Math.max(0.001, Number(newCantidad.replace(',', '.')) || 1);
    const unitPrice = Math.max(0, newPrecio);
    const itemQty = safeNum(selectedItem.cantidad) > 0 ? safeNum(selectedItem.cantidad) : 1;

    const insumos = [...(selectedItem.insumosSnapshot || [])];
    insumos.push({
      insumoId: `ins-narrow-${generateUUID().slice(0, 8)}`,
      nombre,
      marca: newMarca?.trim() || 'sin definir',
      unidad: newUnidad || 'u',
      cantidadTotal: qty,
      cantidadUnitaria: roundMoney(qty / itemQty),
      precioUnitarioCongelado: unitPrice,
      subtotalInsumo: roundMoney(qty * unitPrice)
    });

    onUpdateItemLines(selectedItem.id, {
      insumosSnapshot: insumos
    });

    // Resetear formulario
    setNewFuncion('');
    setNewMarca('sin definir');
    setNewUnidad('u');
    setNewPrecio(0);
    setNewCantidad('1');
    setShowAutocomplete(false);
  };

  const handleSelectSuggestion = (sug: MaterialCatalogSuggestion) => {
    setNewFuncion(sug.nombre);
    setNewMarca(sug.marcaModelo || 'sin definir');
    setNewUnidad(sug.unidad || 'u');
    setNewPrecio(sug.precioVigente > 0 ? sug.precioVigente : 0);
    setShowAutocomplete(false);
  };

  // ─── VISTA 1: LISTA DE ÍTEMS (Master) ───
  if (activeView === 'items' || !selectedItem) {
    return (
      <div className="flex-1 min-h-0 flex flex-col bg-surface font-sans select-none overflow-hidden" role="region" aria-label="Lista de Ítems (Móvil)">
        {/* Cabecera de Ítems */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-surface-container-high border-b border-outline-variant/30 text-xs font-bold text-on-surface shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <Layers className="w-4 h-4" />
            <span>Ítems del Presupuesto ({items.length})</span>
          </div>
          <span className="font-mono text-xs font-extrabold text-secondary">
            Total: {formatARS(totales?.precioFinalGlobal ?? totales?.totalARS ?? 0)}
          </span>
        </div>

        {/* Lista de Tarjetas de Ítems */}
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-outline-variant/15 p-2 space-y-1.5">
          {items.length === 0 ? (
            <div className="text-center py-12 text-xs text-on-surface-variant/60 italic">
              No hay ítems en esta cotización.
            </div>
          ) : (
            items.map((item, idx) => {
              const calcItem = calculatedItemsMap.get(item.id) || item;
              const capNombre = item.capituloId ? capitulosMap.get(item.capituloId) : undefined;
              const lineasCount =
                (item.insumosSnapshot?.length || 0) +
                (item.manoObraSnapshot?.length || 0) +
                (item.serviciosTercerizados?.length || 0);

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectItem(item.id);
                    setActiveView('detail');
                  }}
                  className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/25 hover:bg-surface-container-high/60 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="w-5 h-5 rounded-md bg-surface-container text-on-surface-variant text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-xs text-on-surface truncate">
                        {item.descripcion}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-on-surface-variant/70 mt-1 flex-wrap">
                      {capNombre && (
                        <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium text-[10px]">
                          {capNombre}
                        </span>
                      )}
                      <span>
                        {item.cantidad} {item.unidad || 'u'}
                      </span>
                      <span>·</span>
                      <span className="text-secondary font-medium">
                        {lineasCount} {lineasCount === 1 ? 'línea' : 'líneas'}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-mono font-bold text-xs text-primary">
                        {formatARS(safeNum(calcItem.precioFinalItem || calcItem.precioVentaTotal || calcItem.costoDirectoTotal))}
                      </span>
                      <span className="text-[10px] text-on-surface-variant/60 font-mono">
                        {formatARS(safeNum(calcItem.precioVentaUnitario || calcItem.costoUnitario))}/{item.unidad || 'u'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-variant/60" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ─── VISTA 2: DETALLE DE LÍNEAS DEL ÍTEM (Detail) ───
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-surface font-sans select-none overflow-hidden" role="region" aria-label={`Líneas de ${selectedItem.descripcion}`}>
      {/* Barra Superior con Botón Volver a Ítems */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-container-high border-b border-outline-variant/30 text-xs shrink-0">
        <button
          type="button"
          onClick={() => setActiveView('items')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-highest text-primary font-semibold transition-colors cursor-pointer shadow-2xs"
          aria-label="Volver a la lista de ítems"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Ítems</span>
        </button>

        <div className="flex-1 min-w-0 mx-2 text-center">
          <div className="font-bold text-xs text-on-surface truncate">
            {selectedItem.descripcion}
          </div>
          <div className="text-[10px] text-on-surface-variant/70 font-mono">
            {selectedItem.cantidad} {selectedItem.unidad || 'u'} · {lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'}
          </div>
        </div>

        <div className="shrink-0 text-right font-mono font-bold text-xs text-primary">
          {formatARS(safeNum(calculatedSelectedItem?.costoDirectoTotal ?? selectedItem.costoDirectoTotal))}
        </div>
      </div>

      {/* Lista de Líneas en dos renglones */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-outline-variant/15">
        {lineas.length === 0 ? (
          <div className="text-center py-10 px-4 text-xs text-on-surface-variant/60 italic">
            El ítem aún no tiene líneas. Agregá una con el control inferior.
          </div>
        ) : (
          lineas.map((linea) => (
            <div
              key={linea.id}
              className="flex items-center justify-between p-3 bg-surface-container-lowest hover:bg-surface-container-high/40 transition-colors"
            >
              {/* Renglón 1 (arriba) y Renglón 2 (abajo en gris) */}
              <div className="flex-1 min-w-0 pr-3">
                {/* Renglón 1: Función */}
                <div className="text-xs font-semibold text-on-surface truncate">
                  {linea.funcion}
                </div>
                {/* Renglón 2: Marca y cantidad abajo en gris */}
                <div className="text-[11px] text-on-surface-variant/70 flex items-center gap-1.5 mt-0.5 truncate">
                  <span className={linea.marcaModelo === 'sin definir' ? 'italic' : 'font-medium'}>
                    {linea.marcaModelo || 'sin definir'}
                  </span>
                  <span>·</span>
                  <span className="font-mono">
                    {linea.cantidadCalculada} {linea.unidad}
                  </span>
                  {linea.precioUnitario > 0 && (
                    <>
                      <span>·</span>
                      <span className="font-mono text-on-surface-variant/50">
                        {formatARS(linea.precioUnitario)}/u
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* A la derecha: Subtotal y Eliminar */}
              <div className="text-right shrink-0 flex items-center gap-2">
                <span className="font-mono font-bold text-xs sm:text-sm text-secondary">
                  {formatARS(linea.subtotal)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRequestRemoveLine(linea)}
                  className="p-1.5 text-on-surface-variant/40 hover:text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer"
                  title="Eliminar línea"
                  aria-label={`Eliminar ${linea.funcion}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bloque Plegable de la Cascada APU (Fase 4: sin fórmulas ni cascada visibles salvo expandir) */}
      <SmartSheetNarrowCascada
        selectedItem={selectedItem}
        calculatedItem={calculatedSelectedItem}
      />

      {/* Control Único "Agregar línea…" Fijo Abajo (Sticky Bottom) */}
      <div className="sticky bottom-0 z-20 bg-surface-container-high border-t border-outline-variant/30 p-2 sm:p-2.5 shadow-lg flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {/* Input de Función con Autocompletado del Catálogo */}
          <div className="flex-1 min-w-0 relative">
            <input
              type="text"
              value={newFuncion}
              onChange={(e) => {
                setNewFuncion(e.target.value);
                setShowAutocomplete(true);
                setHighlightedIndex(-1);
              }}
              onFocus={() => {
                if (newFuncion.trim()) setShowAutocomplete(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLine();
                }
              }}
              placeholder="+ Agregar línea (material)..."
              className="w-full px-2.5 py-1.5 text-xs bg-surface-container-lowest border border-outline-variant/40 rounded-xl outline-hidden focus:border-primary text-on-surface placeholder:text-on-surface-variant/50 shadow-2xs font-sans"
            />

            {/* Popover de Autocompletado */}
            <SmartSheetMaterialAutocomplete
              suggestions={filteredSuggestions}
              isOpen={showAutocomplete && filteredSuggestions.length > 0}
              onSelect={handleSelectSuggestion}
              onClose={() => setShowAutocomplete(false)}
              highlightedIndex={highlightedIndex}
            />
          </div>

          {/* Cantidad Numérica Directa (Sin fórmulas) */}
          <div className="w-16 shrink-0">
            <input
              type="number"
              min="0.01"
              step="any"
              value={newCantidad}
              onChange={(e) => setNewCantidad(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLine();
                }
              }}
              placeholder="Cant"
              className="w-full px-2 py-1.5 text-xs text-right font-mono bg-surface-container-lowest border border-outline-variant/40 rounded-xl outline-hidden focus:border-primary text-on-surface shadow-2xs"
            />
          </div>

          {/* Botón Agregar */}
          <button
            type="button"
            disabled={!newFuncion.trim()}
            onClick={handleAddLine}
            className="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-semibold text-xs shadow-xs hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1 shrink-0"
            title="Agregar línea al ítem"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Agregar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

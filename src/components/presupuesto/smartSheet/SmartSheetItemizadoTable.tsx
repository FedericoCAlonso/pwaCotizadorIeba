import React from 'react';
import { Folder, Layers } from 'lucide-react';
import { ItemPresupuesto, CapituloPresupuesto } from '../../../core/types';
import { formatARS } from '../../../core/calculations';

/**
 * Propiedades de la tabla de Itemizado (Zona 1).
 */
export interface SmartSheetItemizadoTableProps {
  /** Lista de ítems del presupuesto */
  items: ItemPresupuesto[];
  /** Capítulos de agrupación */
  capitulos: CapituloPresupuesto[];
  /** Mapa de ítems calculados determinísticamente por el motor de cálculo */
  calculatedItemsMap: Map<string, ItemPresupuesto>;
  /** ID del ítem actualmente seleccionado para inspeccionar sus líneas y cascada */
  selectedItemId: string | null;
  /** Callback al hacer clic sobre un ítem */
  onSelectItem: (itemId: string) => void;
}

/**
 * SmartSheetItemizadoTable: Zona 1 (arriba) de la planilla inteligente.
 * Muestra el itemizado general con columnas: Número, Descripción, Costo Directo y Precio Final.
 * Los capítulos actúan como filas de agrupación visual, no como un nivel de edición aparte.
 */
export const SmartSheetItemizadoTable: React.FC<SmartSheetItemizadoTableProps> = ({
  items,
  capitulos,
  calculatedItemsMap,
  selectedItemId,
  onSelectItem
}) => {
  // Construir la estructura agrupada por capítulos preservando el orden
  const groupedStructure = React.useMemo(() => {
    // Si no hay capítulos pero hay ítems, usamos un capítulo virtual
    const activeCapitulos = capitulos.length > 0
      ? capitulos
      : [{ id: 'sin_capitulo', nombre: 'Ítems Generales', orden: 1 }];

    let globalItemCounter = 0;

    return activeCapitulos.map((cap, capIdx) => {
      const capItems = items.filter((it) => {
        if (!it.capituloId || it.capituloId === 'sin_capitulo') {
          return cap.id === 'sin_capitulo' || (capitulos.length === 0 && capIdx === 0);
        }
        return it.capituloId === cap.id;
      });

      const numberedItems = capItems.map((item, itemIdx) => {
        globalItemCounter++;
        const calcItem = calculatedItemsMap.get(item.id) || item;
        return {
          item,
          calcItem,
          itemNumber: `${capIdx + 1}.${itemIdx + 1}`,
          globalNumber: globalItemCounter
        };
      });

      const capCostoDirecto = numberedItems.reduce(
        (acc, curr) => acc + (curr.calcItem.costoDirectoTotal || 0),
        0
      );
      const capPrecioFinal = numberedItems.reduce(
        (acc, curr) => acc + (curr.calcItem.precioFinalItem || 0),
        0
      );

      return {
        capitulo: cap,
        capIndex: capIdx + 1,
        items: numberedItems,
        totalCostoDirecto: capCostoDirecto,
        totalPrecioFinal: capPrecioFinal
      };
    }).filter(group => group.items.length > 0 || capitulos.length > 0);
  }, [items, capitulos, calculatedItemsMap]);

  return (
    <div
      className="flex-1 min-h-0 flex flex-col bg-surface overflow-hidden"
      role="region"
      aria-label="Zona 1: Itemizado"
    >
      {/* Cabecera de la sección Itemizado */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-container-high border-b border-outline-variant/30 text-xs font-bold text-on-surface-variant uppercase tracking-wider select-none shrink-0">
        <div className="flex items-center gap-1.5 text-primary">
          <Layers className="w-3.5 h-3.5" />
          <span>Zona 1 · Itemizado</span>
        </div>
        <span className="text-[10px] font-mono text-on-surface-variant/70 normal-case">
          {items.length} {items.length === 1 ? 'ítem' : 'ítems'} en {capitulos.length || 1} {capitulos.length === 1 ? 'capítulo' : 'capítulos'}
        </span>
      </div>

      {/* Cabecera de Columnas */}
      <div className="sticky top-0 z-10 flex items-center px-3 py-1.5 bg-surface-container border-b border-outline-variant/20 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider select-none shrink-0 shadow-2xs">
        <div className="w-16 shrink-0 text-center font-mono">Número</div>
        <div className="flex-1 min-w-0 px-3">Descripción</div>
        <div className="w-28 sm:w-36 shrink-0 text-right px-2">Costo Directo</div>
        <div className="w-28 sm:w-36 shrink-0 text-right pr-2 text-primary font-bold">Precio Final</div>
      </div>

      {/* Cuerpo de la tabla con scroll vertical */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-outline-variant/10">
        {items.length === 0 ? (
          <div className="p-8 text-center text-xs text-on-surface-variant/60">
            No hay ítems en esta cotización.
          </div>
        ) : (
          groupedStructure.map((group) => (
            <div key={group.capitulo.id} className="border-b border-outline-variant/20 last:border-b-0">
              {/* Fila de Agrupación de Capítulo */}
              <div className="flex items-center justify-between px-3 py-1 bg-surface-container-low text-xs font-bold text-on-surface select-none border-t border-outline-variant/15">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">
                    Capítulo {group.capIndex}: {group.capitulo.nombre}
                  </span>
                  <span className="text-[10px] font-mono text-on-surface-variant/70 shrink-0">
                    ({group.items.length} {group.items.length === 1 ? 'ítem' : 'ítems'})
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-mono shrink-0 pl-2">
                  <span className="text-on-surface-variant hidden sm:inline">
                    Subtotal CD: {formatARS(group.totalCostoDirecto)}
                  </span>
                  <span className="text-primary font-semibold">
                    Final: {formatARS(group.totalPrecioFinal)}
                  </span>
                </div>
              </div>

              {/* Filas de Ítems dentro del Capítulo */}
              <div className="divide-y divide-outline-variant/10">
                {group.items.map(({ item, calcItem, itemNumber }) => {
                  const isSelected = item.id === selectedItemId;
                  const costoDirecto = calcItem.costoDirectoTotal ?? calcItem.costoTotal ?? 0;
                  const precioFinal = calcItem.precioFinalItem ?? calcItem.precioVentaTotal ?? 0;

                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectItem(item.id)}
                      role="row"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectItem(item.id);
                        }
                      }}
                      className={`flex items-center px-3 py-2 text-xs transition-colors cursor-pointer outline-none select-none ${
                        isSelected
                          ? 'bg-primary/10 border-l-4 border-primary text-primary font-medium'
                          : 'hover:bg-surface-container-high/60 text-on-surface border-l-4 border-transparent'
                      }`}
                      title="Clic para seleccionar ítem y ver sus líneas y cascada de costos"
                    >
                      {/* Número de ítem */}
                      <div className="w-16 shrink-0 text-center font-mono text-xs font-semibold">
                        {itemNumber}
                      </div>

                      {/* Descripción del ítem */}
                      <div className="flex-1 min-w-0 px-3 flex items-baseline gap-2">
                        <span className="truncate font-medium">{item.descripcion}</span>
                        <span className="text-[10px] text-on-surface-variant/70 font-mono shrink-0">
                          ({item.cantidad} {item.unidad || 'u'})
                        </span>
                      </div>

                      {/* Costo Directo */}
                      <div className="w-28 sm:w-36 shrink-0 text-right px-2 font-mono text-on-surface-variant">
                        {formatARS(costoDirecto)}
                      </div>

                      {/* Precio Final */}
                      <div className="w-28 sm:w-36 shrink-0 text-right pr-2 font-mono font-bold text-primary">
                        {formatARS(precioFinal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

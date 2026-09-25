import React, { useState } from 'react';
import { Layers, Folder, ChevronDown, CheckCircle2, Sliders, Wrench, DollarSign, Package } from 'lucide-react';
import { CapituloPresupuesto, ItemPresupuesto } from '../../../core/types';
import { formatARS } from '../../../core/calculations';

interface ExpertInspectorCapitulosSectionProps {
  capitulos: CapituloPresupuesto[];
  items: ItemPresupuesto[];
  itemsCalculados?: ItemPresupuesto[];
}

export const ExpertInspectorCapitulosSection: React.FC<ExpertInspectorCapitulosSectionProps> = ({
  capitulos,
  items,
  itemsCalculados
}) => {
  const [expandedCaps, setExpandedCaps] = useState<Record<string, boolean>>(() => {
    // Por defecto expandir todos los capítulos si hay <= 3, o el primero
    const initial: Record<string, boolean> = {};
    capitulos.forEach((c, idx) => {
      initial[c.id] = idx < 3;
    });
    return initial;
  });

  const toggleCap = (capId: string) => {
    setExpandedCaps((prev) => ({
      ...prev,
      [capId]: !prev[capId]
    }));
  };

  const effectiveItems = React.useMemo(() => {
    if (itemsCalculados && itemsCalculados.length > 0) {
      return itemsCalculados;
    }
    return items;
  }, [items, itemsCalculados]);

  // Agrupar ítems por capítulo (o huérfanos sin capítulo)
  const itemsByCap = React.useMemo(() => {
    const map = new Map<string, ItemPresupuesto[]>();
    capitulos.forEach((c) => map.set(c.id, []));
    const sinCapitulo: ItemPresupuesto[] = [];

    effectiveItems.forEach((it) => {
      if (it.capituloId && map.has(it.capituloId)) {
        map.get(it.capituloId)!.push(it);
      } else {
        sinCapitulo.push(it);
      }
    });

    return { map, sinCapitulo };
  }, [capitulos, effectiveItems]);

  const catalogItemsCount = items.filter((it) => Boolean(it.tareaTipoId)).length;
  const customItemsCount = items.filter((it) => !it.tareaTipoId).length;

  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
            Capítulos & Partidas ({capitulos.length} / {items.length})
          </h4>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-bold">
          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md">
            {catalogItemsCount} catálogo
          </span>
          {customItemsCount > 0 && (
            <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md">
              {customItemsCount} libres
            </span>
          )}
        </div>
      </div>

      {capitulos.length === 0 && items.length === 0 ? (
        <div className="p-3 text-center rounded-2xl bg-surface-container-high/40 text-xs text-on-surface-variant">
          No se detectaron capítulos ni partidas. Agregá un encabezado de capítulo (ej. <span className="font-mono text-primary font-bold">Capítulo 1: Iluminación</span>) y partidas debajo.
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {capitulos.map((cap, cIdx) => {
            const capItems = itemsByCap.map.get(cap.id) || [];
            const isExpanded = expandedCaps[cap.id] ?? true;
            const capTotal = capItems.reduce((acc, it) => acc + (it.precioVentaTotal || it.costoTotal || 0), 0);

            return (
              <div
                key={cap.id}
                className="rounded-2xl border border-outline-variant/20 bg-surface/60 overflow-hidden text-xs transition hover:border-outline-variant/40"
              >
                {/* Cabecera del Capítulo */}
                <button
                  type="button"
                  onClick={() => toggleCap(cap.id)}
                  className="w-full flex items-center justify-between p-2.5 bg-surface-container-high/40 hover:bg-surface-container-high/70 transition text-left cursor-pointer gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-bold text-on-surface truncate">
                      {cap.nombre}
                    </span>
                    <span className="text-[10px] font-mono bg-surface-container-highest px-1.5 py-0.2 rounded-md text-on-surface-variant shrink-0">
                      {capItems.length} {capItems.length === 1 ? 'partida' : 'partidas'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-on-surface text-[11px]">
                      {formatARS(capTotal)}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-on-surface-variant transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {/* Lista de Partidas del Capítulo */}
                {isExpanded && (
                  <div className="p-2 space-y-1.5 divide-y divide-outline-variant/10">
                    {capItems.length === 0 ? (
                      <div className="text-[11px] text-on-surface-variant text-center py-1.5 italic">
                        Sin partidas asignadas
                      </div>
                    ) : (
                      capItems.map((it, iIdx) => {
                        const isCatalog = Boolean(it.tareaTipoId);
                        const isAdHoc = it.esAdHoc || (it.insumosSnapshot && it.insumosSnapshot.length > 0);
                        const isParam = Boolean(it.valoresParametros && Object.keys(it.valoresParametros).length > 0);
                        const totalItem = it.precioVentaTotal || it.costoTotal || 0;

                        return (
                          <div
                            key={it.id || `item-${iIdx}`}
                            className="pt-1.5 first:pt-0 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-on-surface truncate">
                                  {it.cantidad} {it.unidad} {it.descripcion}
                                </span>

                                {isCatalog ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded shrink-0">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    {isParam ? 'Paramétrica' : 'Catálogo'}
                                  </span>
                                ) : isAdHoc ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.2 rounded shrink-0">
                                    <Wrench className="w-2.5 h-2.5" />
                                    A Medida
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded shrink-0">
                                    <DollarSign className="w-2.5 h-2.5" />
                                    Directa
                                  </span>
                                )}
                              </div>

                              {it.condicionTrabajo && it.condicionTrabajo !== 'normal' && (
                                <span className="text-[10px] text-on-surface-variant block">
                                  Condición: {it.condicionTrabajo}
                                </span>
                              )}

                              {/* Parámetros de la partida paramétrica */}
                              {it.valoresParametros && Object.keys(it.valoresParametros).length > 0 && (
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  <span className="text-[9px] font-semibold text-on-surface-variant uppercase tracking-wider">
                                    Parámetros:
                                  </span>
                                  {Object.entries(it.valoresParametros).map(([pKey, pVal]) => (
                                    <span
                                      key={pKey}
                                      className="inline-flex items-center gap-1 text-[10px] font-mono bg-surface-container-highest px-1.5 py-0.5 rounded-md text-on-surface border border-outline-variant/30"
                                      title={`Parámetro: ${pKey} = ${pVal}`}
                                    >
                                      <span className="text-primary font-semibold">{pKey}:</span>
                                      <span>{typeof pVal === 'number' ? pVal : String(pVal)}</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Variables locales calculadas */}
                              {it.valoresVariables && Object.keys(it.valoresVariables).length > 0 && (
                                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                  <span className="text-[9px] font-semibold text-secondary uppercase tracking-wider">
                                    Variables:
                                  </span>
                                  {Object.entries(it.valoresVariables).map(([vKey, vVal]) => (
                                    <span
                                      key={vKey}
                                      className="inline-flex items-center gap-1 text-[10px] font-mono bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-md border border-secondary/20"
                                      title={`Variable calculada: ${vKey} = ${vVal}`}
                                    >
                                      <span className="font-semibold">{vKey}:</span>
                                      <span>{typeof vVal === 'number' ? Math.round(vVal * 100) / 100 : String(vVal)}</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Cláusula técnica de exclusiones / protección */}
                              {it.clausulaExclusiones && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 block mt-0.5 truncate" title={it.clausulaExclusiones}>
                                  ⚠️ {it.clausulaExclusiones}
                                </span>
                              )}
                            </div>

                            <div className="text-right shrink-0 font-mono text-xs font-bold text-on-surface">
                              {formatARS(totalItem)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Partidas sin capítulo (si existieran) */}
          {itemsByCap.sinCapitulo.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-2 space-y-1.5 text-xs">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block">
                Partidas sin capítulo ({itemsByCap.sinCapitulo.length}):
              </span>
              {itemsByCap.sinCapitulo.map((it, idx) => (
                <div key={it.id || idx} className="space-y-0.5 py-1 first:pt-0 border-b border-outline-variant/10 last:border-b-0">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="truncate text-on-surface font-semibold">
                      {it.cantidad} {it.unidad} {it.descripcion}
                    </span>
                    <span className="font-mono font-bold text-on-surface ml-2">
                      {formatARS(it.precioVentaTotal || it.costoTotal || 0)}
                    </span>
                  </div>
                  {it.valoresParametros && Object.keys(it.valoresParametros).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      {Object.entries(it.valoresParametros).map(([pKey, pVal]) => (
                        <span
                          key={pKey}
                          className="inline-flex items-center gap-1 text-[9px] font-mono bg-surface-container-highest px-1 py-0.2 rounded text-on-surface"
                        >
                          <span className="text-primary font-semibold">{pKey}:</span> {pVal}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

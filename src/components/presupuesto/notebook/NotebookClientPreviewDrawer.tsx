import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, FileText, X } from 'lucide-react';
import { formatARS, safeNum, TotalesPresupuestoResultado } from '../../../core/calculations';
import { ResultadoAlcanceYAdvertencias } from '../../../core/notebookDomain';
import { AppConfig, Presupuesto } from '../../../core/types';
import { TERMINOLOGY } from '../../../config/terminology';

export interface NotebookClientPreviewDrawerProps {
  isOpen: boolean;
  presupuesto: Presupuesto;
  totales: TotalesPresupuestoResultado;
  alcanceYAdvertencias: ResultadoAlcanceYAdvertencias;
  esTotalParcial: boolean;
  cantidadSinValorizar: number;
  config: AppConfig;
  onClose: () => void;
}

/**
 * Vista previa del documento orientado al cliente.
 * Cumple estrictamente las reglas de alcance y advertencias:
 * - "Alcance y supuestos" se ubica ANTES del total (nunca como letra chica al final).
 * - Máximo 3 advertencias visibles; el resto plegado bajo "Ver condiciones".
 * - Las notas internas nunca se muestran aquí.
 */
export const NotebookClientPreviewDrawer: React.FC<NotebookClientPreviewDrawerProps> = ({
  isOpen,
  presupuesto,
  totales,
  alcanceYAdvertencias,
  esTotalParcial,
  cantidadSinValorizar,
  config,
  onClose
}) => {
  const [condicionesExpandidas, setCondicionesExpandidas] = useState(false);

  if (!isOpen) return null;

  const hasAlcance =
    alcanceYAdvertencias.inclusiones.length > 0 ||
    alcanceYAdvertencias.exclusiones.length > 0 ||
    alcanceYAdvertencias.todasLasAdvertencias.length > 0;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-scrim/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa del documento al cliente"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface text-on-surface h-full shadow-2xl border-l border-outline-variant flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-outline-variant/50 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold">Vista previa al cliente · {presupuesto.numero}</h2>
              <p className="text-xs text-on-surface-variant">
                {config.nombreEmpresa} · Emisión {presupuesto.fechaEmision} · Validez {presupuesto.validezDias} días
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa"
            className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Detalle de ítems */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Detalle de {TERMINOLOGY.elementoPlural}
            </h3>
            {presupuesto.items.length === 0 ? (
              <p className="text-sm text-on-surface-variant italic">
                Aún no hay {TERMINOLOGY.elementoPlural.toLowerCase()} cargados en esta cotización.
              </p>
            ) : (
              <div className="rounded-xl border border-outline-variant/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface-container text-on-surface-variant text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">{TERMINOLOGY.elementoSingular}</th>
                      <th className="text-right px-3 py-2 font-medium">Cant.</th>
                      <th className="text-right px-3 py-2 font-medium">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {presupuesto.items.map(it => (
                      <tr key={it.id} className="hover:bg-surface-container-low/60">
                        <td className="px-3 py-2 font-medium">{it.descripcion}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-on-surface-variant">
                          {it.cantidad} {it.unidad}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium">
                          {it.estadoValorizacion === 'sin_valorizar' ? (
                            <span className="text-xs text-amber-700 dark:text-amber-300">
                              {TERMINOLOGY.estadoSinValorizar}
                            </span>
                          ) : (
                            formatARS(safeNum(it.precioFinalItem ?? it.precioVentaTotal ?? it.costoDirectoTotal))
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* SECCIÓN OBLIGATORIA ANTES DEL TOTAL: Alcance y supuestos */}
          {hasAlcance && (
            <section
              data-testid="alcance-antes-del-total"
              className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-on-surface">
                  {TERMINOLOGY.seccionAlcanceYSupuestos}
                </h3>
                {alcanceYAdvertencias.excedePresupuestoAdvertencias && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-3 h-3" />
                    Revisar cantidad de advertencias
                  </span>
                )}
              </div>

              {alcanceYAdvertencias.inclusiones.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-tertiary mb-1">
                    {TERMINOLOGY.alcanceIncluye}
                  </p>
                  <ul className="list-disc pl-5 text-sm space-y-1 text-on-surface">
                    {alcanceYAdvertencias.inclusiones.map(inc => (
                      <li key={inc.id}>{inc.texto}</li>
                    ))}
                  </ul>
                </div>
              )}

              {alcanceYAdvertencias.exclusiones.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-on-surface-variant mb-1">
                    {TERMINOLOGY.alcanceExcluye}
                  </p>
                  <ul className="list-disc pl-5 text-sm space-y-1 text-on-surface-variant">
                    {alcanceYAdvertencias.exclusiones.map(exc => (
                      <li key={exc.id}>{exc.texto}</li>
                    ))}
                  </ul>
                </div>
              )}

              {alcanceYAdvertencias.advertenciasVisibles.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {alcanceYAdvertencias.advertenciasVisibles.map(adv => (
                    <p
                      key={adv.id}
                      className="text-sm px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-on-surface"
                    >
                      {adv.texto}
                    </p>
                  ))}
                </div>
              )}

              {alcanceYAdvertencias.advertenciasPlegadas.length > 0 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setCondicionesExpandidas(v => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    {condicionesExpandidas ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {TERMINOLOGY.verCondiciones} ({alcanceYAdvertencias.advertenciasPlegadas.length})
                    </span>
                  </button>
                  {condicionesExpandidas && (
                    <div className="mt-2 space-y-1.5">
                      {alcanceYAdvertencias.advertenciasPlegadas.map(adv => (
                        <p
                          key={adv.id}
                          className="text-xs px-3 py-2 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface-variant"
                        >
                          {adv.texto}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* TOTAL FINAL (siempre después de Alcance y supuestos) */}
          <section
            data-testid="total-documento-cliente"
            className="rounded-xl border border-primary/30 bg-primary-container/30 p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-on-primary-container/80">
                {esTotalParcial ? 'Total parcial estimado' : 'Total final'}
              </p>
              {esTotalParcial && (
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                  Quedan {cantidadSinValorizar} {TERMINOLOGY.elementoPlural.toLowerCase()} sin valorizar.
                </p>
              )}
            </div>
            <p className="text-2xl font-bold font-mono text-on-primary-container tabular-nums">
              {formatARS(totales.precioFinalGlobal)}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

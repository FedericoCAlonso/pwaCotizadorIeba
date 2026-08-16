import React from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { TareaTipo, Insumo, CategoriaManoDeObra, AppConfig } from '../../core/types';
import { auditarRentabilidadTareaTipo, formatARS } from '../../core/calculations';

interface AuditoriaSubmoduloProps {
  tareas: TareaTipo[];
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  config?: AppConfig;
  onEdit: (tarea: TareaTipo) => void;
}

export const AuditoriaSubmodulo: React.FC<AuditoriaSubmoduloProps> = ({
  tareas,
  insumosMap,
  manoObraMap,
  config,
  onEdit,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/20 space-y-2">
        <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <span>Auditoría de Rentabilidad & Materiales Discontinuados</span>
        </h3>
        <p className="text-xs text-on-surface-variant">
          Semáforo de salud técnica. Detecta automáticamente tareas con insumos obsoletos (`activo: false`) o cuyo margen proyectado cayó por debajo del {config?.umbralMargenMinimoAdvertencia || 20}%.
        </p>
      </div>

      <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-on-surface">
            <thead className="bg-surface-container text-xs text-on-surface-variant border-b border-outline-variant/30">
              <tr>
                <th className="px-5 py-3.5 font-medium">Estado Semáforo</th>
                <th className="px-5 py-3.5 font-medium">Tarea Tipo</th>
                <th className="px-5 py-3.5 text-right font-medium">Costo Directo</th>
                <th className="px-5 py-3.5 text-right font-medium">Precio Venta</th>
                <th className="px-5 py-3.5 text-center font-medium">Margen Proyectado</th>
                <th className="px-5 py-3.5 font-medium">Alertas / Diagnóstico</th>
                <th className="px-5 py-3.5 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {tareas.map((tarea) => {
                const audit = auditarRentabilidadTareaTipo(tarea, insumosMap, manoObraMap, config);

                return (
                  <tr key={tarea.id} className="hover:bg-surface-container-highest/50 transition-colors">
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold capitalize ${
                          audit.estado === 'verde'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : audit.estado === 'amarillo'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            audit.estado === 'verde'
                              ? 'bg-emerald-500'
                              : audit.estado === 'amarillo'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        {audit.estado === 'verde' ? 'Sana' : audit.estado === 'amarillo' ? 'Alerta' : 'Riesgo Crítico'}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-bold text-on-surface">{tarea.nombre}</div>
                      <span className="text-xs text-on-surface-variant font-mono">[{tarea.categoria}]</span>
                    </td>

                    <td className="px-5 py-4 text-right font-mono font-bold text-primary">
                      {formatARS(audit.costoDirecto)}
                    </td>

                    <td className="px-5 py-4 text-right font-mono font-bold text-on-surface">
                      {formatARS(audit.precioVentaSugerido)}
                    </td>

                    <td className="px-5 py-4 text-center font-mono font-bold">
                      <span
                        className={
                          audit.margenPorcentajeProyectado < (config?.umbralMargenMinimoAdvertencia || 20)
                            ? 'text-rose-500 font-extrabold'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {audit.margenPorcentajeProyectado}%
                      </span>
                    </td>

                    <td className="px-5 py-4 text-xs space-y-1">
                      {audit.alertas.length === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ficha y margen en regla
                        </span>
                      ) : (
                        audit.alertas.map((alt, idx) => (
                          <div key={idx} className="text-rose-600 dark:text-rose-400 font-medium flex items-start gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{alt}</span>
                          </div>
                        ))
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => onEdit(tarea)}
                        className="px-3 py-1.5 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container rounded-xl text-xs font-semibold transition-colors"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

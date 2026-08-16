import React from 'react';
import { BarChart3 } from 'lucide-react';
import { TareaTipo, RegistroTrabajo, AppConfig } from '../../core/types';
import { calcularDispersionHorasTarea } from '../../core/calculations';

interface CalibracionEmaSubmoduloProps {
  tareas: TareaTipo[];
  registrosTrabajo: RegistroTrabajo[];
  config?: AppConfig;
  onCalibrarEma: (tareaId: string, factorSugerido: number) => void;
}

export const CalibracionEmaSubmodulo: React.FC<CalibracionEmaSubmoduloProps> = ({
  tareas,
  registrosTrabajo,
  config,
  onCalibrarEma,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/20 space-y-2">
        <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <span>Calibración Estadística EMA (Media Móvil Exponencial)</span>
        </h3>
        <p className="text-xs text-on-surface-variant">
          Compara el tiempo teórico de catálogo contra el historial real registrado en obra. El factor EMA ajusta dinámicamente las estimaciones futuras.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tareas.map((tarea) => {
          const disp = calcularDispersionHorasTarea(tarea, registrosTrabajo, config?.alphaEmaManoObra || 0.3);

          return (
            <div key={tarea.id} className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-on-tertiary-container bg-tertiary-container px-2 py-0.5 rounded-full uppercase">
                    {tarea.categoria}
                  </span>
                  <h4 className="font-bold text-on-surface text-base mt-1">{tarea.nombre}</h4>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary-container text-on-primary-container shrink-0">
                  {disp.factorEMAActual.toFixed(2)}x EMA
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Muestras de obra:</span>
                  <span className="font-mono font-bold text-on-surface">{disp.nMuestras} registros</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Horas Base Catálogo:</span>
                  <span className="font-mono text-on-surface">{disp.horasEstimadasBase} hs/{tarea.unidad}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Mínimo / Máximo Real:</span>
                  <span className="font-mono text-on-surface">
                    {disp.nMuestras > 0 ? `${disp.minHorasUnidad}h — ${disp.maxHorasUnidad}h` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Promedio Real:</span>
                  <span className="font-mono text-primary font-bold">
                    {disp.nMuestras > 0 ? `${disp.promedioHorasUnidad} hs` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Desviación Estándar (σ):</span>
                  <span className="font-mono text-on-surface">
                    {disp.nMuestras > 0 ? `±${disp.desviacionEstandar} hs` : '—'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase block">Factor Sugerido EMA</span>
                  <span className="font-mono text-sm font-bold text-primary">{disp.factorEmaSugerido.toFixed(2)}x</span>
                </div>

                <button
                  onClick={() => onCalibrarEma(tarea.id, disp.factorEmaSugerido)}
                  disabled={disp.nMuestras === 0}
                  className="px-3.5 py-2 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-40 rounded-xl text-xs font-semibold transition-colors shadow-xs"
                >
                  Aplicar EMA
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

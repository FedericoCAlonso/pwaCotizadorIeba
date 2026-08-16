import React from 'react';
import { Sliders, RefreshCw, Sparkles } from 'lucide-react';
import { TareaTipo, Insumo, CategoriaManoDeObra, AppConfig } from '../../core/types';
import { calcularCostoTareaTipo, formatARS, roundMoney } from '../../core/calculations';

interface SimulacionWhatIfSubmoduloProps {
  tareas: TareaTipo[];
  selectedTareaId: string;
  onSelectTareaId: (id: string) => void;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  manoObraList: CategoriaManoDeObra[];
  config?: AppConfig;
  simMaterialesPct: number;
  setSimMaterialesPct: (val: number) => void;
  simManoObraPct: number;
  setSimManoObraPct: (val: number) => void;
  simHorasExtra: number;
  setSimHorasExtra: (val: number) => void;
  simMargenPct: number;
  setSimMargenPct: (val: number) => void;
}

export const SimulacionWhatIfSubmodulo: React.FC<SimulacionWhatIfSubmoduloProps> = ({
  tareas,
  selectedTareaId,
  onSelectTareaId,
  insumosMap,
  manoObraMap,
  manoObraList,
  config,
  simMaterialesPct,
  setSimMaterialesPct,
  simManoObraPct,
  setSimManoObraPct,
  simHorasExtra,
  setSimHorasExtra,
  simMargenPct,
  setSimMargenPct,
}) => {
  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] transition-shadow";

  const selectedSimTarea = tareas.find((t) => t.id === (selectedTareaId || tareas[0]?.id));
  const baseCostData = selectedSimTarea ? calcularCostoTareaTipo(selectedSimTarea, insumosMap, manoObraMap) : null;

  const simCostInsumos = baseCostData ? roundMoney(baseCostData.costoInsumosUnitario * (1 + simMaterialesPct / 100)) : 0;
  const baseHorasMo = baseCostData ? baseCostData.manoObraSnapshotUnitario.reduce((acc, m) => acc + m.horasTotales, 0) : 0;
  const simHorasTotalesMo = baseHorasMo + simHorasExtra;
  const costoHoraPromedio = baseHorasMo > 0 && baseCostData ? baseCostData.costoManoObraUnitario / baseHorasMo : (manoObraList[0]?.costoHora || 9500);
  const simCostManoObra = roundMoney(simHorasTotalesMo * costoHoraPromedio * (1 + simManoObraPct / 100));

  const simCostDirectoTotal = roundMoney(simCostInsumos + simCostManoObra);
  const factorMargen = 1 - (simMargenPct / 100);
  const simPrecioVenta = factorMargen > 0 ? roundMoney(simCostDirectoTotal / factorMargen) : roundMoney(simCostDirectoTotal * 1.35);
  const simGanancia = roundMoney(simPrecioVenta - simCostDirectoTotal);

  const baseCostoDirecto = baseCostData ? baseCostData.costoDirectoUnitario : 0;
  const variacionCostoDirectoPct = baseCostoDirecto > 0 ? roundMoney(((simCostDirectoTotal - baseCostoDirecto) / baseCostoDirecto) * 100) : 0;

  if (!selectedSimTarea) {
    return (
      <div className="text-center py-12 bg-surface-container-low border border-dashed border-outline-variant/30 rounded-3xl p-6">
        <p className="text-sm text-on-surface-variant">No hay tareas tipo disponibles para simular.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de Tarea para simular */}
      <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs text-primary font-bold uppercase tracking-wider">Escenario What-If</span>
          <h3 className="text-lg font-bold text-on-surface">Simulación de Variación de Costos & Márgenes</h3>
        </div>

        <select
          value={selectedTareaId}
          onChange={(e) => onSelectTareaId(e.target.value)}
          className={`${inputCls} sm:w-72 font-semibold`}
        >
          {tareas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} ({formatARS(calcularCostoTareaTipo(t, insumosMap, manoObraMap).costoDirectoUnitario)})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sliders Control Panel */}
        <div className="lg:col-span-2 bg-surface-container-low rounded-3xl p-6 border border-outline-variant/20 space-y-6 shadow-sm">
          <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <span>Parámetros de Variación Temp</span>
          </h4>

          {/* Slider 1: Materiales % */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-on-surface">Aumento en Costo de Materiales (%):</label>
              <span className={`font-mono font-bold text-sm px-2.5 py-0.5 rounded-full ${simMaterialesPct > 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : simMaterialesPct < 0 ? 'bg-emerald-500/20 text-emerald-600' : 'bg-surface-variant text-on-surface'}`}>
                {simMaterialesPct > 0 ? `+${simMaterialesPct}%` : `${simMaterialesPct}%`}
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="100"
              step="5"
              value={simMaterialesPct}
              onChange={(e) => setSimMaterialesPct(parseInt(e.target.value) || 0)}
              className="w-full accent-primary h-2 bg-surface-container-highest rounded-lg cursor-pointer"
            />
          </div>

          {/* Slider 2: Mano de Obra % */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-on-surface">Aumento en Costo Hora Mano de Obra (%):</label>
              <span className={`font-mono font-bold text-sm px-2.5 py-0.5 rounded-full ${simManoObraPct > 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : simManoObraPct < 0 ? 'bg-emerald-500/20 text-emerald-600' : 'bg-surface-variant text-on-surface'}`}>
                {simManoObraPct > 0 ? `+${simManoObraPct}%` : `${simManoObraPct}%`}
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="100"
              step="5"
              value={simManoObraPct}
              onChange={(e) => setSimManoObraPct(parseInt(e.target.value) || 0)}
              className="w-full accent-primary h-2 bg-surface-container-highest rounded-lg cursor-pointer"
            />
          </div>

          {/* Slider 3: Horas Adicionales */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-on-surface">Horas Adicionales / Ayudante Extra:</label>
              <span className="font-mono font-bold text-sm text-primary px-2.5 py-0.5 bg-primary/10 rounded-full">
                +{simHorasExtra} hs
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="8"
              step="0.5"
              value={simHorasExtra}
              onChange={(e) => setSimHorasExtra(parseFloat(e.target.value) || 0)}
              className="w-full accent-primary h-2 bg-surface-container-highest rounded-lg cursor-pointer"
            />
          </div>

          {/* Slider 4: Margen Objetivo % */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-on-surface">Margen de Ganancia Objetivo (%):</label>
              <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 bg-emerald-500/10 rounded-full">
                {simMargenPct}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="70"
              step="1"
              value={simMargenPct}
              onChange={(e) => setSimMargenPct(parseInt(e.target.value) || 35)}
              className="w-full accent-emerald-500 h-2 bg-surface-container-highest rounded-lg cursor-pointer"
            />
          </div>

          <div className="pt-3 border-t border-outline-variant/30 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSimMaterialesPct(0);
                setSimManoObraPct(0);
                setSimHorasExtra(0);
                setSimMargenPct(config?.margenPorDefectoPct || 35);
              }}
              className="px-4 py-2 bg-surface-variant hover:bg-surface-container-highest rounded-full text-xs font-semibold text-on-surface-variant flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restablecer Simulación</span>
            </button>
          </div>
        </div>

        {/* Results Dashboard Panel */}
        <div className="bg-surface-container border border-outline-variant/30 rounded-3xl p-6 space-y-5 shadow-md flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Resultados Proyectados</span>
            </h4>

            <div className="space-y-3">
              <div className="flex justify-between text-xs py-1 border-b border-outline-variant/20">
                <span className="text-on-surface-variant">Insumos Simulados:</span>
                <span className="font-mono font-semibold text-on-surface">{formatARS(simCostInsumos)}</span>
              </div>

              <div className="flex justify-between text-xs py-1 border-b border-outline-variant/20">
                <span className="text-on-surface-variant">Mano de Obra Simulado ({simHorasTotalesMo}h):</span>
                <span className="font-mono font-semibold text-on-surface">{formatARS(simCostManoObra)}</span>
              </div>

              <div className="flex justify-between text-sm py-2 border-b border-outline-variant/30 font-bold">
                <span className="text-on-surface">Costo Directo Simulado:</span>
                <span className="font-mono text-primary">{formatARS(simCostDirectoTotal)}</span>
              </div>

              <div className="flex justify-between text-xs py-1 text-emerald-600 dark:text-emerald-400">
                <span>Ganancia Proyectada ({simMargenPct}%):</span>
                <span className="font-mono font-bold">{formatARS(simGanancia)}</span>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-primary-container/40 border border-primary/20 text-center">
              <span className="text-xs text-on-surface-variant uppercase font-semibold block">Precio Venta Sugerido</span>
              <div className="font-mono text-2xl font-extrabold text-primary mt-1">
                {formatARS(simPrecioVenta)}
              </div>
              <span className="text-[10px] text-on-surface-variant block mt-0.5">por {selectedSimTarea.unidad}</span>
            </div>
          </div>

          {/* Variación vs Base */}
          <div className="pt-3 border-t border-outline-variant/30 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant">Variación Costo vs Base:</span>
              <span className={`font-mono font-bold ${variacionCostoDirectoPct > 0 ? 'text-rose-500' : variacionCostoDirectoPct < 0 ? 'text-emerald-500' : 'text-on-surface-variant'}`}>
                {variacionCostoDirectoPct > 0 ? `+${variacionCostoDirectoPct}%` : `${variacionCostoDirectoPct}%`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  Ruler,
  X,
  Sparkles,
  Calculator,
  Percent,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  HelpCircle,
  Zap,
  Building
} from 'lucide-react';
import {
  ModeloEstimacionMaterial,
  ParametrosEstimacionMaterial
} from '../../core/types';
import {
  calcularEstimacionParametricaMaterial,
  obtenerPresentacionesSugeridas,
  formatARS
} from '../../core/calculations';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ParametricMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialNombre: string;
  unidad?: string;
  initialParametros?: Partial<ParametrosEstimacionMaterial>;
  initialCantidad?: number;
  onConfirm: (resultado: {
    cantidad: number;
    formula: string;
    parametrosEstimacion: ParametrosEstimacionMaterial;
  }) => void;
}

export const ParametricMaterialModal: React.FC<ParametricMaterialModalProps> = ({
  isOpen,
  onClose,
  materialNombre,
  unidad = 'm',
  initialParametros,
  initialCantidad = 1,
  onConfirm
}) => {
  useEscapeKey(isOpen, onClose);

  // Model Selection
  const [modelo, setModelo] = useState<ModeloEstimacionMaterial>(
    initialParametros?.modelo || 'superficie_m2'
  );

  // 1. Superficie (m²)
  const [superficieM2, setSuperficieM2] = useState<number>(
    initialParametros?.superficieM2 ?? 70
  );
  const [factorDensidadM2, setFactorDensidadM2] = useState<number>(
    initialParametros?.factorDensidadM2 ?? 3.5
  );

  // 2. Trazado de Cañería
  const [longitudCaneriaM, setLongitudCaneriaM] = useState<number>(
    initialParametros?.longitudCaneriaM ?? 30
  );
  const [conductoresPorCaneria, setConductoresPorCaneria] = useState<number>(
    initialParametros?.conductoresPorCaneria ?? 3
  );
  const [adicionalBajadasPct, setAdicionalBajadasPct] = useState<number>(
    initialParametros?.adicionalBajadasPct ?? 15
  );

  // 3. Bocas y Distancia
  const [cantidadBocas, setCantidadBocas] = useState<number>(
    initialParametros?.cantidadBocas ?? 10
  );
  const [distanciaPromedioBocasM, setDistanciaPromedioBocasM] = useState<number>(
    initialParametros?.distanciaPromedioBocasM ?? 4.0
  );

  // 4. Margen de Error / Desperdicio / Tolerancia
  const [margenDesperdicioErrorPct, setMargenDesperdicioErrorPct] = useState<number>(
    initialParametros?.margenDesperdicioErrorPct ?? 10
  );

  // 5. Desperdicio Simple
  const [cantidadBaseDirecta, setCantidadBaseDirecta] = useState<number>(
    initialCantidad || 100
  );

  // Real-time calculation
  const resultadoCalculo: ParametrosEstimacionMaterial = useMemo(() => {
    return calcularEstimacionParametricaMaterial(
      {
        modelo,
        superficieM2,
        factorDensidadM2,
        longitudCaneriaM,
        conductoresPorCaneria,
        adicionalBajadasPct,
        cantidadBocas,
        distanciaPromedioBocasM,
        margenDesperdicioErrorPct,
        cantidadEstimadaTotal: cantidadBaseDirecta
      },
      unidad
    );
  }, [
    modelo,
    superficieM2,
    factorDensidadM2,
    longitudCaneriaM,
    conductoresPorCaneria,
    adicionalBajadasPct,
    cantidadBocas,
    distanciaPromedioBocasM,
    margenDesperdicioErrorPct,
    cantidadBaseDirecta,
    unidad
  ]);

  if (!isOpen) return null;

  const handleApply = () => {
    onConfirm({
      cantidad: resultadoCalculo.cantidadEstimadaTotal,
      formula: resultadoCalculo.formulaGenerada || String(resultadoCalculo.cantidadEstimadaTotal),
      parametrosEstimacion: resultadoCalculo
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-surface-container border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] text-on-surface animate-in fade-in zoom-in-95 duration-200 pb-safe">
        
        {/* Mobile drag bar */}
        <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />

        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-outline-variant/20 bg-surface-container-low flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-primary/10 text-primary rounded-2xl shrink-0">
              <Ruler className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[10px] font-bold text-on-primary-container bg-primary-container px-2 py-0.5 rounded-full uppercase truncate">
                  Cómputo Paramétrico
                </span>
                <span className="text-xs text-on-surface-variant font-mono shrink-0">
                  Unidad: {unidad}
                </span>
              </div>
              <h3 className="font-bold text-on-surface text-sm sm:text-base leading-tight mt-0.5 truncate">
                {materialNombre}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-2 rounded-full hover:bg-surface-variant transition shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 text-xs">
          
          {/* Method Selector Tabs */}
          <div>
            <label className="text-xs font-bold text-on-surface uppercase tracking-wide block mb-2">
              Selecciona el Modelo de Estimación:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setModelo('superficie_m2')}
                className={`p-2.5 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                  modelo === 'superficie_m2'
                    ? 'bg-primary/15 border-primary text-primary font-bold shadow-xs'
                    : 'bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/40'
                }`}
              >
                <Building className="w-4 h-4" />
                <span className="text-[11px] leading-tight">Por Superficie (m²)</span>
              </button>

              <button
                type="button"
                onClick={() => setModelo('longitud_caneria_fases')}
                className={`p-2.5 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                  modelo === 'longitud_caneria_fases'
                    ? 'bg-primary/15 border-primary text-primary font-bold shadow-xs'
                    : 'bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/40'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span className="text-[11px] leading-tight">Por Cañería & Hilos</span>
              </button>

              <button
                type="button"
                onClick={() => setModelo('bocas_distancia')}
                className={`p-2.5 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                  modelo === 'bocas_distancia'
                    ? 'bg-primary/15 border-primary text-primary font-bold shadow-xs'
                    : 'bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/40'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span className="text-[11px] leading-tight">Por Cant. Bocas</span>
              </button>

              <button
                type="button"
                onClick={() => setModelo('desperdicio_simple')}
                className={`p-2.5 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                  modelo === 'desperdicio_simple'
                    ? 'bg-primary/15 border-primary text-primary font-bold shadow-xs'
                    : 'bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/40'
                }`}
              >
                <Percent className="w-4 h-4" />
                <span className="text-[11px] leading-tight">Base + Desperdicio</span>
              </button>
            </div>
          </div>

          {/* Configuration Form by Model */}
          {modelo === 'superficie_m2' && (
            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-on-surface uppercase tracking-wide">
                  1. Estimación por Superficie Cubierta (m²)
                </span>
                <span className="text-[11px] text-primary font-mono font-bold">
                  {(superficieM2 * factorDensidadM2).toFixed(1)} {unidad} base
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-on-surface-variant block mb-1 font-medium">
                    Superficie de la Propiedad / Sector (m²):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      step={5}
                      value={superficieM2}
                      onChange={(e) => setSuperficieM2(parseFloat(e.target.value) || 0)}
                      className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <span className="text-xs font-bold text-on-surface-variant">m²</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-on-surface-variant block mb-1 font-medium">
                    Densidad de Material ({unidad}/m²):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0.1}
                      step={0.5}
                      value={factorDensidadM2}
                      onChange={(e) => setFactorDensidadM2(parseFloat(e.target.value) || 0)}
                      className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <span className="text-xs font-bold text-on-surface-variant">{unidad}/m²</span>
                  </div>
                </div>
              </div>

              {/* Presets de Densidad */}
              <div>
                <span className="text-[10px] text-on-surface-variant block mb-1.5 font-semibold">
                  Valores típicos de ingeniería eléctrica recomendados:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFactorDensidadM2(3.0)}
                    className={`p-2 rounded-xl border text-center transition ${
                      factorDensidadM2 === 3.0
                        ? 'bg-primary/10 border-primary text-primary font-bold'
                        : 'bg-surface-container-highest border-outline-variant/20 text-on-surface-variant'
                    }`}
                  >
                    <span className="block text-[11px] font-bold">3.0 {unidad}/m²</span>
                    <span className="text-[9px] opacity-80">Vivienda Estándar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFactorDensidadM2(4.0)}
                    className={`p-2 rounded-xl border text-center transition ${
                      factorDensidadM2 === 4.0
                        ? 'bg-primary/10 border-primary text-primary font-bold'
                        : 'bg-surface-container-highest border-outline-variant/20 text-on-surface-variant'
                    }`}
                  >
                    <span className="block text-[11px] font-bold">4.0 {unidad}/m²</span>
                    <span className="text-[9px] opacity-80">Electrificación Media</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFactorDensidadM2(5.5)}
                    className={`p-2 rounded-xl border text-center transition ${
                      factorDensidadM2 === 5.5
                        ? 'bg-primary/10 border-primary text-primary font-bold'
                        : 'bg-surface-container-highest border-outline-variant/20 text-on-surface-variant'
                    }`}
                  >
                    <span className="block text-[11px] font-bold">5.5 {unidad}/m²</span>
                    <span className="text-[9px] opacity-80">Elevada / Comercial</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {modelo === 'longitud_caneria_fases' && (
            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-4">
              <span className="font-bold text-xs text-on-surface uppercase tracking-wide block">
                2. Estimación por Longitud de Cañería & Hilos de Conductor
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-on-surface-variant block mb-1 font-medium">
                    Metros de Canalización:
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={longitudCaneriaM}
                    onChange={(e) => setLongitudCaneriaM(parseFloat(e.target.value) || 0)}
                    className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-on-surface-variant block mb-1 font-medium">
                    Conductores por Tubo:
                  </label>
                  <select
                    value={conductoresPorCaneria}
                    onChange={(e) => setConductoresPorCaneria(parseInt(e.target.value) || 1)}
                    className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:outline-none"
                  >
                    <option value={1}>1 Conductor (Polo Simple)</option>
                    <option value={2}>2 Conductores (Fase + Neutro)</option>
                    <option value={3}>3 Conductores (Fase + Neutro + PE)</option>
                    <option value={4}>4 Conductores (Trifásica 3F + N)</option>
                    <option value={5}>5 Conductores (3F + N + PE)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-on-surface-variant block mb-1 font-medium">
                    Bajadas a Llaves/Tomas:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={adicionalBajadasPct}
                      onChange={(e) => setAdicionalBajadasPct(parseFloat(e.target.value) || 0)}
                      className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none"
                    />
                    <span className="text-xs font-bold text-on-surface-variant">%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {modelo === 'bocas_distancia' && (
            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-4">
              <span className="font-bold text-xs text-on-surface uppercase tracking-wide block">
                3. Estimación por Cantidad de Bocas & Distancia Media
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-on-surface-variant block mb-1 font-medium">
                    Cantidad de Bocas:
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={cantidadBocas}
                    onChange={(e) => setCantidadBocas(parseFloat(e.target.value) || 0)}
                    className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-on-surface-variant block mb-1 font-medium">
                    Distancia Media entre Bocas:
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={0.5}
                    value={distanciaPromedioBocasM}
                    onChange={(e) => setDistanciaPromedioBocasM(parseFloat(e.target.value) || 0)}
                    className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-on-surface-variant block mb-1 font-medium">
                    Hilos por Tramo:
                  </label>
                  <select
                    value={conductoresPorCaneria}
                    onChange={(e) => setConductoresPorCaneria(parseInt(e.target.value) || 1)}
                    className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:outline-none"
                  >
                    <option value={1}>1 Hilo</option>
                    <option value={2}>2 Hilos</option>
                    <option value={3}>3 Hilos (F+N+PE)</option>
                    <option value={4}>4 Hilos</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {modelo === 'desperdicio_simple' && (
            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-4">
              <span className="font-bold text-xs text-on-surface uppercase tracking-wide block">
                4. Cantidad Base Neta Requerida
              </span>

              <div>
                <label className="text-[11px] text-on-surface-variant block mb-1 font-medium">
                  Cantidad Neta Exacta ({unidad}):
                </label>
                <input
                  type="number"
                  min={0.1}
                  value={cantidadBaseDirecta}
                  onChange={(e) => setCantidadBaseDirecta(parseFloat(e.target.value) || 0)}
                  className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Margen de Desperdicio / Tolerancia de Corte */}
          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wide flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-amber-500" />
                <span>Margen de Desperdicio & Error de Trazado (Corte / Curvas / Colas)</span>
              </label>
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                +{margenDesperdicioErrorPct}%
              </span>
            </div>

            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              El trazado real nunca es una línea recta perfecta. Incluye un margen de tolerancia para las curvas de cañería, colas de empalme en cajas y cortes.
            </p>

            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setMargenDesperdicioErrorPct(pct)}
                  className={`py-2 rounded-xl border text-center transition ${
                    margenDesperdicioErrorPct === pct
                      ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-300 font-bold'
                      : 'bg-surface-container-highest border-outline-variant/20 text-on-surface-variant'
                  }`}
                >
                  +{pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Live Formula Explanation Card */}
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-1.5">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wide flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5" />
              <span>Memoria de Cálculo & Fórmula Resultante:</span>
            </span>
            <div className="font-mono text-sm font-bold text-on-surface">
              {resultadoCalculo.formulaGenerada} = <span className="text-primary font-black text-base">{resultadoCalculo.cantidadEstimadaTotal} {unidad}</span>
            </div>
            <p className="text-[11px] text-on-surface-variant italic">
              {resultadoCalculo.explicacionCalculo}
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-outline-variant/20 bg-surface-container-low flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center justify-between sm:block text-left">
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold sm:block">
              Cantidad Total:
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-primary">
              {resultadoCalculo.cantidadEstimadaTotal} {unidad}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 sm:py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-xl transition text-center min-h-[42px] flex items-center justify-center"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 sm:py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 active:scale-95 min-h-[42px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Aplicar Cómputo ({resultadoCalculo.cantidadEstimadaTotal} {unidad})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

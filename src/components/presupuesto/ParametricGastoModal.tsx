import React, { useState, useEffect } from 'react';
import { Sliders, X, Check, Calculator, Sparkles, HelpCircle } from 'lucide-react';
import { GastoPresupuestoConfig, ParametroTrabajoTipo } from '../../core/types';
import { formatARS, roundMoney } from '../../core/calculations';
import { evaluateMathExpression } from '../../core/mathEvaluator';
import { ModalContainer } from '../ModalContainer';

interface ParametricGastoModalProps {
  isOpen: boolean;
  onClose: () => void;
  gasto: GastoPresupuestoConfig | null;
  baseMateriales?: number;
  baseManoObra?: number;
  baseServicios?: number;
  baseCostoDirecto?: number;
  onConfirm: (gastoId: string, valoresParametros: Record<string, number>) => void;
}

export const ParametricGastoModal: React.FC<ParametricGastoModalProps> = ({
  isOpen,
  onClose,
  gasto,
  baseMateriales = 0,
  baseManoObra = 0,
  baseServicios = 0,
  baseCostoDirecto = 0,
  onConfirm
}) => {
  const [valores, setValores] = useState<Record<string, number>>({});

  useEffect(() => {
    if (gasto) {
      const initial: Record<string, number> = {};
      (gasto.parametros || []).forEach((p) => {
        initial[p.id] = gasto.valoresParametros?.[p.id] !== undefined
          ? gasto.valoresParametros[p.id]
          : p.valorDefault;
      });
      setValores(initial);
    } else {
      setValores({});
    }
  }, [gasto, isOpen]);

  if (!gasto) return null;

  const parametros: ParametroTrabajoTipo[] = gasto.parametros || [];

  // Determinar base de imputación
  let baseActual = baseCostoDirecto;
  if (gasto.destino === 'materiales') baseActual = baseMateriales;
  else if (gasto.destino === 'mano_obra') baseActual = baseManoObra;
  else if (gasto.destino === 'servicios') baseActual = baseServicios;

  // Evaluación en tiempo real
  let montoCalculado = 0;
  let formulaError: string | null = null;

  if (gasto.formula) {
    try {
      const evalRes = evaluateMathExpression(gasto.formula, {
        base: baseActual,
        materiales: baseMateriales,
        mano_obra: baseManoObra,
        servicios: baseServicios,
        costo_directo_base: baseCostoDirecto,
        ...valores
      });
      if (evalRes.error) {
        formulaError = evalRes.error;
      } else {
        montoCalculado = roundMoney(Math.max(0, evalRes.value ?? 0));
      }
    } catch (err: any) {
      formulaError = err.message || 'Error en la fórmula';
    }
  }

  const handleValueChange = (paramId: string, val: number) => {
    setValores((prev) => ({
      ...prev,
      [paramId]: val
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(gasto.id, valores);
    onClose();
  };

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      title={`Configurar Parámetros: ${gasto.nombre}`}
      subtitle="Ajusta las variables específicas de obra para calcular este gasto o contingencia"
      icon={<Sliders className="w-5 h-5 text-primary" />}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-variant rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-xl shadow-xs transition-all"
          >
            <Check className="w-4 h-4" />
            Aplicar al Presupuesto
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Parámetros Dinámicos */}
        <div className="space-y-3">
          {parametros.map((p) => {
            const currentVal = valores[p.id] !== undefined ? valores[p.id] : p.valorDefault;

            return (
              <div
                key={p.id}
                className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-3.5 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <label className="block text-xs font-bold text-on-surface">
                      {p.nombre}
                    </label>
                    {p.descripcion && (
                      <p className="text-[11px] text-on-surface-variant mt-0.5">{p.descripcion}</p>
                    )}
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-surface-container-highest px-2 py-0.5 rounded text-on-surface-variant">
                    {p.id}
                  </span>
                </div>

                {/* Switch Boolean */}
                {p.tipo === 'boolean' && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleValueChange(p.id, 1)}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        currentVal === 1
                          ? 'border-primary bg-primary/10 text-primary shadow-2xs'
                          : 'border-outline-variant/30 bg-surface hover:bg-surface-variant/40 text-on-surface-variant'
                      }`}
                    >
                      Sí / Cumple (1)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleValueChange(p.id, 0)}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        currentVal === 0
                          ? 'border-error bg-error/10 text-error shadow-2xs'
                          : 'border-outline-variant/30 bg-surface hover:bg-surface-variant/40 text-on-surface-variant'
                      }`}
                    >
                      No / No Cumple (0)
                    </button>
                  </div>
                )}

                {/* Select con Opciones */}
                {p.tipo === 'select' && (
                  <select
                    value={currentVal}
                    onChange={(e) => handleValueChange(p.id, parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/50 focus:border-primary rounded-xl text-xs text-on-surface outline-none transition-colors"
                  >
                    {(p.opciones || []).map((opt) => (
                      <option key={opt.id} value={opt.valor}>
                        {opt.label} ({opt.valor})
                      </option>
                    ))}
                  </select>
                )}

                {/* Número / Cantidad */}
                {p.tipo === 'numero' && (
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={currentVal}
                      onChange={(e) => handleValueChange(p.id, parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2 bg-surface-container border border-outline-variant/50 focus:border-primary rounded-xl text-xs font-mono font-bold text-primary outline-none"
                    />
                    {p.unidad && (
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant font-medium">
                        {p.unidad}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Banner de Fórmula & Cálculo Resultante */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface">Monto Calculado Resultante:</span>
            <span className="font-mono text-lg font-black text-primary">
              +{formatARS(montoCalculado)}
            </span>
          </div>

          <div className="text-[11px] text-on-surface-variant flex flex-wrap items-center gap-1.5 pt-1 border-t border-primary/10">
            <span className="font-semibold">Fórmula evaluada:</span>
            <code className="font-mono text-[10px] bg-surface-container-highest px-2 py-0.5 rounded text-on-surface">
              {gasto.formula}
            </code>
          </div>

          {formulaError && (
            <p className="text-xs text-error font-medium">{formulaError}</p>
          )}
        </div>
      </form>
    </ModalContainer>
  );
};

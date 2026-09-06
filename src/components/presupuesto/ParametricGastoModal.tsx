import React, { useState, useEffect, useMemo } from 'react';
import { Sliders, X, Check, Calculator, Sparkles, HelpCircle, CornerDownRight } from 'lucide-react';
import { GastoPresupuestoConfig, ParametroTrabajoTipo } from '../../core/types';
import { formatARS, roundMoney, safeNum } from '../../core/calculations';
import { evaluateMathExpression, evaluateCondition } from '../../core/mathEvaluator';
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

  // Cargar valores por defecto
  useEffect(() => {
    if (gasto && isOpen) {
      const initial: Record<string, number> = {};
      (gasto.parametros || []).forEach((p) => {
        initial[p.id] = p.valorDefault;
      });
      setValores(initial);
    } else {
      setValores({});
    }
  }, [gasto, isOpen]);

  // Determinar base de imputación
  let baseActual = baseCostoDirecto;
  if (gasto?.destino === 'materiales') baseActual = baseMateriales;
  else if (gasto?.destino === 'mano_obra') baseActual = baseManoObra;
  else if (gasto?.destino === 'servicios') baseActual = baseServicios;

  // Agrupar parámetros para renderizado jerárquico Material 3 (Progressive Disclosure)
  const groupedParametros = useMemo(() => {
    if (!gasto?.parametros || gasto.parametros.length === 0) return [];

    const currentScope: Record<string, number> = {
      base: baseActual,
      materiales: baseMateriales,
      mano_obra: baseManoObra,
      servicios: baseServicios,
      costo_directo_base: baseCostoDirecto
    };
    const evalMap = new Map<string, { isVisible: boolean; isConditional: boolean }>();

    gasto.parametros.forEach((p) => {
      let isVisible = true;
      const isConditional = Boolean(p.condicion && p.condicion.trim());

      if (isConditional) {
        isVisible = evaluateCondition(p.condicion, currentScope);
      }

      const rawVal = valores[p.id] !== undefined
        ? valores[p.id]
        : p.valorDefault;

      const effectiveVal = isVisible ? rawVal : 0;
      currentScope[p.id] = effectiveVal;
      evalMap.set(p.id, { isVisible, isConditional });
    });

    type ParamGroup = {
      root: ParametroTrabajoTipo;
      rootMeta: { isVisible: boolean; isConditional: boolean };
      children: Array<{ parametro: ParametroTrabajoTipo; meta: { isVisible: boolean; isConditional: boolean } }>;
    };

    const groups: ParamGroup[] = [];
    let currentGroup: ParamGroup | null = null;

    gasto.parametros.forEach((p) => {
      const meta = evalMap.get(p.id)!;
      if (!meta.isConditional) {
        currentGroup = {
          root: p,
          rootMeta: meta,
          children: []
        };
        groups.push(currentGroup);
      } else {
        if (currentGroup) {
          currentGroup.children.push({ parametro: p, meta });
        } else {
          currentGroup = {
            root: p,
            rootMeta: meta,
            children: []
          };
          groups.push(currentGroup);
        }
      }
    });

    return groups;
  }, [gasto?.parametros, valores, baseActual, baseMateriales, baseManoObra, baseServicios, baseCostoDirecto]);

  if (!gasto) return null;

  // Evaluación en tiempo real
  let montoCalculado = 0;
  let formulaError: string | null = null;

  if (gasto.formula) {
    try {
      const evalScope: Record<string, number> = {
        base: baseActual,
        materiales: baseMateriales,
        mano_obra: baseManoObra,
        servicios: baseServicios,
        costo_directo_base: baseCostoDirecto
      };

      (gasto.parametros || []).forEach((p) => {
        let isVisible = true;
        if (p.condicion && p.condicion.trim()) {
          isVisible = evaluateCondition(p.condicion, evalScope);
        }
        const rawVal = valores[p.id] !== undefined ? valores[p.id] : p.valorDefault;
        evalScope[p.id] = isVisible ? rawVal : 0;
      });

      const evalRes = evaluateMathExpression(gasto.formula, evalScope);
      if (evalRes.error) {
        formulaError = evalRes.error;
      } else {
        montoCalculado = roundMoney(Math.max(0, evalRes.value ?? 0));
      }
    } catch (err: any) {
      formulaError = err.message || 'Error en la fórmula';
    }
  }

  const handleValueChange = (paramId: string, val: any) => {
    setValores((prev) => ({
      ...prev,
      [paramId]: val
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedValores: Record<string, number> = {};
    const evalScope: Record<string, number> = {
      base: baseActual,
      materiales: baseMateriales,
      mano_obra: baseManoObra,
      servicios: baseServicios,
      costo_directo_base: baseCostoDirecto
    };

    (gasto.parametros || []).forEach((p) => {
      let isVisible = true;
      if (p.condicion && p.condicion.trim()) {
        isVisible = evaluateCondition(p.condicion, evalScope);
      }
      const rawVal = valores[p.id] !== undefined ? safeNum(valores[p.id]) : p.valorDefault;
      const val = isVisible ? rawVal : 0;
      sanitizedValores[p.id] = val;
      evalScope[p.id] = val;
    });

    onConfirm(gasto.id, sanitizedValores);
    onClose();
  };

  const renderParamField = (p: ParametroTrabajoTipo, isInsideGroup: boolean) => {
    const currentVal = valores[p.id] !== undefined ? valores[p.id] : p.valorDefault;

    return (
      <div
        key={p.id}
        className={`border rounded-2xl p-3.5 space-y-2 transition-all ${
          isInsideGroup
            ? 'bg-surface-container-highest/60 border-outline-variant/20'
            : 'bg-surface-container-low border-outline-variant/30'
        }`}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1.5">
              {isInsideGroup && (
                <span className="text-xs font-bold text-primary">↳</span>
              )}
              <label className="block text-xs font-bold text-on-surface">
                {p.nombre}
              </label>
            </div>
            {p.descripcion && (
              <p className="text-xs text-on-surface-variant mt-0.5">{p.descripcion}</p>
            )}
          </div>
          <span className="text-xs font-mono font-bold bg-surface-container-highest px-2 py-0.5 rounded text-on-surface-variant">
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
              value={currentVal ?? ''}
              onChange={(e) => handleValueChange(p.id, e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0)}
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
        {/* Parámetros Dinámicos Jerárquicos M3 */}
        <div className="space-y-3.5">
          {groupedParametros.map((group) => {
            if (!group.rootMeta.isVisible) return null;

            const visibleChildren = group.children.filter((c) => c.meta.isVisible);

            return (
              <div key={group.root.id} className="space-y-2.5">
                {/* Parámetro Principal */}
                {renderParamField(group.root, false)}

                {/* Sub-panel M3 Único para todos los dependientes */}
                {visibleChildren.length > 0 && (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-container border border-outline-variant/30 border-l-4 border-l-primary space-y-3 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wide">
                      <CornerDownRight className="w-3.5 h-3.5" />
                      <span>Opciones de {group.root.nombre}</span>
                    </div>

                    <div className="space-y-2.5">
                      {visibleChildren.map(({ parametro }) => renderParamField(parametro, true))}
                    </div>
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

          <div className="text-xs text-on-surface-variant flex flex-wrap items-center gap-1.5 pt-1 border-t border-primary/10">
            <span className="font-semibold">Fórmula evaluada:</span>
            <code className="font-mono text-xs bg-surface-container-highest px-2 py-0.5 rounded text-on-surface">
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

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { ParametroTrabajoTipo } from '../../../core/types';
import { MathInput } from '../../common/MathInput';

interface MobileSchemaParameterFieldProps {
  param: ParametroTrabajoTipo;
  value: number;
  formula?: string;
  scope?: Record<string, number>;
  onChange: (nextVal: number, nextFormula?: string) => void;
  idPrefix?: string;
}

function clampParamValue(param: ParametroTrabajoTipo, raw: number): number {
  let next = Number.isFinite(raw) ? raw : Number(param.valorDefault) || 0;
  if (param.min !== undefined && next < param.min) next = param.min;
  if (param.max !== undefined && next > param.max) next = param.max;
  return Math.round(next * 1000) / 1000;
}

/**
 * Campo auto-generado a partir del esquema `ParametroTrabajoTipo` para modo Ejecutar móvil.
 * Soporta stepper numérico + MathInput (fórmulas/variables), selector (`select`) e interruptor (`boolean`).
 */
export const MobileSchemaParameterField: React.FC<MobileSchemaParameterFieldProps> = ({
  param,
  value,
  formula,
  scope,
  onChange,
  idPrefix = 'mobile-param'
}) => {
  const inputId = `${idPrefix}-${param.id}`;

  if (param.tipo === 'boolean') {
    const active = value >= 1;
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/60 bg-surface px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="block text-sm font-medium text-on-surface">
            {param.nombre}
          </label>
          {param.descripcion && (
            <p className="text-xs text-on-surface-variant line-clamp-2">{param.descripcion}</p>
          )}
        </div>
        <button
          id={inputId}
          type="button"
          role="switch"
          aria-checked={active}
          onClick={() => onChange(active ? 0 : 1)}
          className={`min-h-[44px] min-w-[76px] shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${
            active
              ? 'bg-primary text-on-primary shadow-sm'
              : 'border border-outline bg-surface-container-high text-on-surface-variant'
          }`}
        >
          {active ? 'Sí' : 'No'}
        </button>
      </div>
    );
  }

  if (param.tipo === 'select' && param.opciones && param.opciones.length > 0) {
    return (
      <div className="space-y-1.5 rounded-xl border border-outline-variant/60 bg-surface px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-on-surface">{param.nombre}</span>
          {param.unidad && (
            <span className="text-xs text-on-surface-variant">{param.unidad}</span>
          )}
        </div>
        {param.descripcion && (
          <p className="text-xs text-on-surface-variant">{param.descripcion}</p>
        )}
        <div className="grid grid-cols-2 gap-2 pt-1" role="radiogroup" aria-label={param.nombre}>
          {param.opciones.map(op => {
            const selected = value === op.valor;
            return (
              <button
                key={`${param.id}-${op.id || op.valor}`}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(op.valor)}
                className={`min-h-[44px] rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {op.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const step = param.step && param.step > 0 ? param.step : 1;
  const hasScopeVars = Boolean(scope && Object.keys(scope).length > 0);

  return (
    <div className="space-y-1.5 rounded-xl border border-outline-variant/60 bg-surface px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-on-surface">
          {param.nombre}
        </label>
        {param.unidad && (
          <span className="text-xs font-medium text-on-surface-variant">{param.unidad}</span>
        )}
      </div>
      {param.descripcion && (
        <p className="text-xs text-on-surface-variant">{param.descripcion}</p>
      )}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          aria-label={`Disminuir ${param.nombre}`}
          onClick={() => onChange(clampParamValue(param, value - step), undefined)}
          disabled={param.min !== undefined && value <= param.min}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-high text-on-surface active:scale-95 disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <MathInput
            id={inputId}
            value={value}
            formula={formula}
            allowFormula
            scope={scope}
            inputMode={hasScopeVars || Boolean(formula) ? 'text' : 'decimal'}
            min={param.min}
            max={param.max}
            step={step}
            decimals={3}
            fallbackOnBlur={value}
            ariaLabel={param.nombre}
            onChange={(nextVal, nextFormula) => {
              if (nextVal !== null && Number.isFinite(nextVal)) {
                onChange(clampParamValue(param, nextVal), nextFormula);
              }
            }}
            className="h-11 bg-surface-container-lowest text-center text-base font-semibold"
          />
        </div>

        <button
          type="button"
          aria-label={`Aumentar ${param.nombre}`}
          onClick={() => onChange(clampParamValue(param, value + step), undefined)}
          disabled={param.max !== undefined && value >= param.max}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-high text-on-surface active:scale-95 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {formula && (
        <p className="text-[11px] font-mono text-primary truncate" title={`Fórmula: ${formula}`}>
          ƒx = {formula}
        </p>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  Layers,
  X,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Package,
  Clock,
  Calculator
} from 'lucide-react';
import {
  TareaTipo,
  Insumo,
  CategoriaManoDeObra,
  TipoFactura
} from '../../core/types';
import {
  formatARS,
  calcularConsumosTareaTipo,
  ConsumosCalculadosResultado,
  DEFAULT_CLAUSULA_OBRA_EXISTENTE
} from '../../core/calculations';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ParametricJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  tarea: TareaTipo;
  initialVariables?: Record<string, number>;
  initialClausula?: string;
  initialIncluirClausula?: boolean;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  tipoFactura?: TipoFactura;
  onConfirm: (resultado: {
    variables: Record<string, number>;
    calculos: ConsumosCalculadosResultado;
    clausulaExclusiones?: string;
    incluirClausula: boolean;
  }) => void;
}

export const ParametricJobModal: React.FC<ParametricJobModalProps> = ({
  isOpen,
  onClose,
  tarea,
  initialVariables,
  initialClausula,
  initialIncluirClausula = true,
  insumosMap,
  manoObraMap,
  tipoFactura,
  onConfirm
}) => {
  useEscapeKey(isOpen, onClose);

  // Variables State
  const [variablesValues, setVariablesValues] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    if (tarea.variables && tarea.variables.length > 0) {
      tarea.variables.forEach(v => {
        defaults[v.id] = initialVariables?.[v.id] ?? v.valorDefault ?? 1;
      });
    } else {
      defaults['cantidad'] = initialVariables?.['cantidad'] ?? 1;
    }
    return defaults;
  });

  // Cláusula de Exclusiones
  const [incluirClausula, setIncluirClausula] = useState<boolean>(
    initialIncluirClausula ?? true
  );
  const [clausulaTexto, setClausulaTexto] = useState<string>(
    initialClausula || tarea.clausulaExclusiones || tarea.clausulaTecnicaDefault || DEFAULT_CLAUSULA_OBRA_EXISTENTE
  );

  // Actualizar valores de variable
  const handleVariableChange = (varId: string, value: number) => {
    setVariablesValues(prev => ({
      ...prev,
      [varId]: value
    }));
  };

  // Live evaluation of material and labor formulas
  const calculosResultado: ConsumosCalculadosResultado = useMemo(() => {
    return calcularConsumosTareaTipo(
      tarea,
      variablesValues,
      insumosMap,
      manoObraMap,
      { tipoFactura }
    );
  }, [tarea, variablesValues, insumosMap, manoObraMap, tipoFactura]);

  if (!isOpen) return null;

  const handleApply = () => {
    onConfirm({
      variables: variablesValues,
      calculos: calculosResultado,
      clausulaExclusiones: incluirClausula ? clausulaTexto : undefined,
      incluirClausula
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-on-surface animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-2xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-on-primary-container bg-primary-container px-2 py-0.5 rounded-full uppercase">
                  {tarea.categoria || 'Trabajo Tipo'}
                </span>
                <span className="text-xs text-on-surface-variant font-mono">
                  /{tarea.unidad || 'u'}
                </span>
              </div>
              <h3 className="font-bold text-on-surface text-base leading-tight mt-0.5">
                {tarea.nombre}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-full hover:bg-surface-variant transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">

          {/* 1. Formulario de Variables del Trabajo Tipo */}
          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-on-surface uppercase tracking-wide flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-primary" />
                <span>Parámetros de la Obra</span>
              </span>
              <span className="text-[11px] text-on-surface-variant">
                Completa los datos para calcular materiales y mano de obra
              </span>
            </div>

            {(!tarea.variables || tarea.variables.length === 0) ? (
              <div>
                <label className="text-[11px] text-on-surface-variant block mb-1 font-medium">
                  Cantidad de {tarea.unidad || 'Unidades'}:
                </label>
                <input
                  type="number"
                  min={0.1}
                  step={1}
                  value={variablesValues['cantidad'] ?? 1}
                  onChange={(e) => handleVariableChange('cantidad', parseFloat(e.target.value) || 1)}
                  className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {tarea.variables.map((variable) => {
                  const currentValue = variablesValues[variable.id] ?? variable.valorDefault ?? 1;

                  if (variable.tipo === 'select' && variable.opciones && variable.opciones.length > 0) {
                    return (
                      <div key={variable.id} className="sm:col-span-2">
                        <label className="text-[11px] font-bold text-on-surface block mb-1">
                          {variable.nombre}:
                        </label>
                        {variable.descripcion && (
                          <p className="text-[10px] text-on-surface-variant mb-1.5">{variable.descripcion}</p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {variable.opciones.map((opc) => (
                            <button
                              key={opc.id}
                              type="button"
                              onClick={() => handleVariableChange(variable.id, opc.valor)}
                              className={`p-2.5 rounded-xl border text-left text-xs transition ${
                                currentValue === opc.valor
                                  ? 'bg-primary/15 border-primary text-primary font-bold shadow-xs'
                                  : 'bg-surface-container-highest border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/40'
                              }`}
                            >
                              <div className="truncate">{opc.label}</div>
                              <span className="text-[10px] font-mono opacity-80 mt-0.5 block">
                                Factor: {opc.valor.toFixed(2)}x
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={variable.id}>
                      <label className="text-[11px] font-bold text-on-surface block mb-1">
                        {variable.nombre} {variable.unidad ? `(${variable.unidad})` : ''}:
                      </label>
                      {variable.descripcion && (
                        <p className="text-[10px] text-on-surface-variant mb-1">{variable.descripcion}</p>
                      )}
                      <input
                        type="number"
                        step="any"
                        value={currentValue}
                        onChange={(e) => handleVariableChange(variable.id, parseFloat(e.target.value) || 0)}
                        className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Consumos Calculados Automáticamente (Live Breakdown) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Insumos */}
            <div className="bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/20 space-y-2">
              <div className="flex items-center justify-between border-b border-outline-variant/15 pb-1.5">
                <span className="font-bold text-xs text-primary uppercase flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />
                  <span>Materiales Calculados ({calculosResultado.insumosSnapshot.length})</span>
                </span>
                <span className="font-mono font-bold text-on-surface">
                  {formatARS(calculosResultado.costoInsumosTotal)}
                </span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {calculosResultado.insumosSnapshot.map((ins, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] py-1 border-b border-outline-variant/10">
                    <div className="truncate flex-1 pr-2">
                      <span className="font-medium text-on-surface block truncate">{ins.nombre}</span>
                      <span className="text-[10px] text-on-surface-variant font-mono">
                        {ins.cantidadTotal} {ins.unidad} a {formatARS(ins.precioUnitarioCongelado)}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-on-surface shrink-0">
                      {formatARS(ins.subtotalInsumo)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mano de Obra */}
            <div className="bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/20 space-y-2">
              <div className="flex items-center justify-between border-b border-outline-variant/15 pb-1.5">
                <span className="font-bold text-xs text-primary uppercase flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Mano de Obra ({calculosResultado.manoObraSnapshot.length})</span>
                </span>
                <span className="font-mono font-bold text-on-surface">
                  {formatARS(calculosResultado.costoManoObraTotal)}
                </span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {calculosResultado.manoObraSnapshot.map((mo, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] py-1 border-b border-outline-variant/10">
                    <div className="truncate flex-1 pr-2">
                      <span className="font-medium text-on-surface block truncate">{mo.nombreCategoria}</span>
                      <span className="text-[10px] text-on-surface-variant font-mono">
                        {mo.horasTotales} hs a {formatARS(mo.costoHoraCongelado)}/h
                      </span>
                    </div>
                    <span className="font-mono font-bold text-on-surface shrink-0">
                      {formatARS(mo.subtotalManoObra)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Cláusula Técnica & Exclusiones de Obra */}
          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirClausula}
                  onChange={(e) => setIncluirClausula(e.target.checked)}
                  className="rounded text-primary focus:ring-primary w-4 h-4"
                />
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span>Incluir Cláusula Técnica & Exclusiones en el Presupuesto</span>
              </label>
            </div>

            {incluirClausula && (
              <textarea
                rows={3}
                value={clausulaTexto}
                onChange={(e) => setClausulaTexto(e.target.value)}
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs leading-relaxed text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Texto legal / técnico de resguardo constructivo..."
              />
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/20 bg-surface-container-low flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase block font-semibold">
              Costo Directo Total:
            </span>
            <span className="text-lg font-black font-mono text-primary">
              {formatARS(calculosResultado.costoDirectoTotal)}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-xl shadow-sm transition flex items-center gap-1.5 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Insertar en Presupuesto</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

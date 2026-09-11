import React from 'react';
import {
  X,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Package,
  Clock,
  GraduationCap,
  CornerDownRight,
  Smartphone
} from 'lucide-react';
import {
  TareaTipo,
  ParametroTrabajoTipo
} from '../../core/types';
import {
  formatARS,
  ConsumosCalculadosResultado
} from '../../core/calculations';

interface ClassicParametricModalProps {
  tarea: TareaTipo;
  parametrosValues: Record<string, number>;
  onParametroChange: (paramId: string, value: any) => void;
  groupedParametros: Array<{
    root: ParametroTrabajoTipo;
    rootMeta: { isVisible: boolean; isConditional: boolean };
    children: Array<{ parametro: ParametroTrabajoTipo; meta: { isVisible: boolean; isConditional: boolean } }>;
  }>;
  calculosResultado: ConsumosCalculadosResultado;
  clausulaTexto: string;
  setClausulaTexto: (text: string) => void;
  incluirClausula: boolean;
  setIncluirClausula: (incluir: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
  onSwitchToGesture: () => void;
}

export const ClassicParametricModal: React.FC<ClassicParametricModalProps> = ({
  tarea,
  parametrosValues,
  onParametroChange,
  groupedParametros,
  calculosResultado,
  clausulaTexto,
  setClausulaTexto,
  incluirClausula,
  setIncluirClausula,
  onConfirm,
  onClose,
  onSwitchToGesture
}) => {
  const renderParamField = (parametro: ParametroTrabajoTipo, isInsideGroup: boolean) => {
    const currentValue = parametrosValues[parametro.id] ?? parametro.valorDefault ?? 1;

    if (parametro.tipo === 'boolean') {
      const isTrue = currentValue === 1;
      return (
        <div
          key={parametro.id}
          className={`sm:col-span-2 flex items-center justify-between p-3 rounded-2xl border transition-all ${
            isInsideGroup
              ? 'bg-surface-container-highest/60 border-outline-variant/30'
              : 'bg-surface-container-highest border-outline-variant/30'
          }`}
        >
          <div className="pr-3">
            <div className="flex items-center gap-1.5">
              {isInsideGroup && (
                <span className="text-xs font-bold text-primary">↳</span>
              )}
              <label className="text-xs font-bold text-on-surface block">
                {parametro.nombre}
              </label>
            </div>
            {parametro.descripcion && (
              <p className="text-xs text-on-surface-variant mt-0.5">{parametro.descripcion}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onParametroChange(parametro.id, isTrue ? 0 : 1)}
            className={`w-12 h-7 rounded-full transition-colors relative p-0.5 shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              isTrue ? 'bg-primary' : 'bg-surface-variant'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full bg-white shadow-xs transition-transform transform ${
                isTrue ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      );
    }

    if (parametro.tipo === 'select' && parametro.opciones && parametro.opciones.length > 0) {
      return (
        <div
          key={parametro.id}
          className={`sm:col-span-2 ${
            isInsideGroup ? 'p-2.5 bg-surface-container-highest/40 border border-outline-variant/20 rounded-2xl' : ''
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            {isInsideGroup && (
              <span className="text-xs font-bold text-primary">↳</span>
            )}
            <label className="text-xs font-bold text-on-surface block">
              {parametro.nombre}:
            </label>
          </div>
          {parametro.descripcion && (
            <p className="text-xs text-on-surface-variant mb-1.5">{parametro.descripcion}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {parametro.opciones.map((opc) => (
              <button
                key={opc.id}
                type="button"
                onClick={() => onParametroChange(parametro.id, opc.valor)}
                className={`p-2.5 rounded-xl border text-left text-xs transition ${
                  currentValue === opc.valor
                    ? 'bg-primary/15 border-primary text-primary font-bold shadow-xs'
                    : 'bg-surface-container-highest border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/40'
                }`}
              >
                <div className="font-semibold text-xs leading-snug">{opc.label}</div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        key={parametro.id}
        className={
          isInsideGroup
            ? 'p-2.5 bg-surface-container-highest/40 border border-outline-variant/20 rounded-2xl'
            : ''
        }
      >
        <div className="flex items-center gap-1.5 mb-1">
          {isInsideGroup && (
            <span className="text-xs font-bold text-primary">↳</span>
          )}
          <label className="text-xs font-bold text-on-surface block">
            {parametro.nombre} {parametro.unidad ? `(${parametro.unidad})` : ''}:
          </label>
        </div>
        {parametro.descripcion && (
          <p className="text-xs text-on-surface-variant mb-1">{parametro.descripcion}</p>
        )}
        <input
          type="number"
          step="any"
          value={currentValue ?? ''}
          onChange={(e) => onParametroChange(parametro.id, e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0)}
          className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-surface-container border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] text-on-surface animate-in fade-in zoom-in-95 duration-200 pb-safe">

        {/* Mobile drag bar */}
        <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />

        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-outline-variant/20 bg-surface-container-low flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className={`p-2 sm:p-2.5 rounded-2xl shrink-0 ${
              tarea.naturaleza === 'servicio_profesional'
                ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                : 'bg-primary/10 text-primary'
            }`}>
              {tarea.naturaleza === 'servicio_profesional' ? (
                <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Sliders className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase truncate ${
                  tarea.naturaleza === 'servicio_profesional'
                    ? 'text-purple-800 dark:text-purple-200 bg-purple-500/20'
                    : 'text-on-primary-container bg-primary-container'
                }`}>
                  {tarea.naturaleza === 'servicio_profesional' ? '🎓 Servicio Profesional' : (tarea.categoria || 'Trabajo Tipo')}
                </span>
                <span className="text-xs text-on-surface-variant font-mono shrink-0">
                  /{tarea.unidad || 'u'}
                </span>
              </div>
              <h3 className="font-bold text-on-surface text-sm sm:text-base leading-tight mt-0.5 truncate">
                {tarea.nombre}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Botón de acceso a modo gestual móvil */}
            <button
              type="button"
              onClick={onSwitchToGesture}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 transition flex items-center gap-1.5 shadow-xs"
              title="Probar control táctil para una mano"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">📱 Modo Gestual</span>
              <span className="sm:hidden">📱 Gestos</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 rounded-xl transition"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          {/* 1. Entradas y Parámetros */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-primary" />
                <span>Parámetros de Entrada</span>
              </h4>
              <span className="text-xs text-on-surface-variant">
                Valores para dimensionar consumos
              </span>
            </div>

            {(!tarea.parametros || tarea.parametros.length === 0) ? (
              <div>
                <label className="text-xs text-on-surface-variant block mb-1 font-medium">
                  Cantidad de {tarea.unidad || 'Unidades'}:
                </label>
                <input
                  type="number"
                  min={0.1}
                  step={1}
                  value={parametrosValues['cantidad'] ?? ''}
                  onChange={(e) => onParametroChange('cantidad', e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0)}
                  className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none"
                />
              </div>
            ) : (
              <div className="space-y-3.5">
                {groupedParametros.map((group) => {
                  if (!group.rootMeta.isVisible) return null;
                  const visibleChildren = group.children.filter((c) => c.meta.isVisible);

                  return (
                    <div key={group.root.id} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {renderParamField(group.root, false)}
                      </div>

                      {visibleChildren.length > 0 && (
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-container border border-outline-variant/30 border-l-4 border-l-primary space-y-3 animate-in fade-in slide-in-from-top-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wide">
                            <CornerDownRight className="w-3.5 h-3.5" />
                            <span>Opciones de {group.root.nombre}</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {visibleChildren.map(({ parametro }) => renderParamField(parametro, true))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Resumen de Variables Calculadas Internas */}
            {tarea.variables && tarea.variables.length > 0 && (
              <div className="bg-surface-container-highest/60 p-3 rounded-2xl border border-emerald-500/20 space-y-1.5 mt-3">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1">
                  <span>⚡ Cálculos Internos Derivados</span>
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {tarea.variables.map((v) => {
                    const val = calculosResultado.valoresVariables[v.id] ?? 0;
                    return (
                      <div key={v.id} className="bg-surface-container px-2.5 py-1 rounded-xl border border-outline-variant/20 flex items-center gap-1.5 text-xs">
                        <span className="text-on-surface-variant font-medium">{v.nombre}:</span>
                        <strong className="font-mono text-emerald-700 dark:text-emerald-300 font-bold">{val} {v.unidad}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Consumos y Honorarios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {calculosResultado.costoServiciosTotal !== undefined && calculosResultado.costoServiciosTotal > 0 && (
              <div className="sm:col-span-2 bg-purple-500/10 p-3.5 rounded-2xl border border-purple-500/25 space-y-1.5">
                <div className="flex items-center justify-between border-b border-purple-500/20 pb-1.5">
                  <span className="font-bold text-xs text-purple-700 dark:text-purple-300 uppercase flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Honorarios Profesionales</span>
                  </span>
                  <span className="font-mono font-bold text-purple-700 dark:text-purple-300 text-sm">
                    {formatARS(calculosResultado.costoServiciosTotal)}
                  </span>
                </div>
              </div>
            )}

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
                {calculosResultado.insumosSnapshot.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic py-1">Sin materiales requeridos</p>
                ) : (
                  calculosResultado.insumosSnapshot.map((ins, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-outline-variant/10">
                      <div className="truncate flex-1 pr-2">
                        <span className="font-medium text-on-surface block truncate">{ins.nombre}</span>
                        <span className="text-xs text-on-surface-variant font-mono">
                          {ins.cantidadTotal} {ins.unidad} a {formatARS(ins.precioUnitarioCongelado)}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-on-surface shrink-0">
                        {formatARS(ins.subtotalInsumo)}
                      </span>
                    </div>
                  ))
                )}
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
                {calculosResultado.manoObraSnapshot.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic py-1">Sin mano de obra adicional</p>
                ) : (
                  calculosResultado.manoObraSnapshot.map((mo, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-outline-variant/10">
                      <div className="truncate flex-1 pr-2">
                        <span className="font-medium text-on-surface block truncate">{mo.nombreCategoria}</span>
                        <span className="text-xs text-on-surface-variant font-mono">
                          {mo.horasTotales} hs a {formatARS(mo.costoHoraCongelado)}/h
                        </span>
                      </div>
                      <span className="font-mono font-bold text-on-surface shrink-0">
                        {formatARS(mo.subtotalManoObra)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 3. Cláusula Técnica */}
          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-2.5">
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
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-outline-variant/20 bg-surface-container-low flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center justify-between sm:block">
            <span className="text-xs text-on-surface-variant uppercase font-semibold sm:block">
              Costo Directo Total:
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-primary">
              {formatARS(calculosResultado.costoDirectoTotal)}
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
              onClick={onConfirm}
              className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 sm:py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 active:scale-95 min-h-[42px]"
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

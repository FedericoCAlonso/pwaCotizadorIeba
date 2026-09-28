import React, { useState } from 'react';
import {
  X,
  Sliders,
  Variable,
  Briefcase,
  ShieldAlert,
  Percent,
  Plus,
  Trash2,
  Check
} from 'lucide-react';
import {
  GastoPresupuestoConfig,
  CalculatedCell,
  CapituloPresupuesto,
  TipoFactura,
  ImpuestoItem,
  NivelMargenRiesgo
} from '../../../core/types';
import { generateUUID } from '../../../core/uuid';

interface QuoteParametersModalProps {
  isOpen: boolean;
  onClose: () => void;
  calculosVariables?: Record<string, number | string>;
  onUpdateCalculosVariables?: (vars: Record<string, number | string>) => void;
  gastosConfig?: GastoPresupuestoConfig[];
  onUpdateGastosConfig?: (gastos: GastoPresupuestoConfig[]) => void;
  capitulos?: CapituloPresupuesto[];
  margenPorcentaje?: number | null;
  onUpdateMargenPorcentaje?: (margen: number) => void;
  nivelMargenRiesgo?: NivelMargenRiesgo;
  margenRiesgoPorcentaje?: number;
  onUpdateMargenRiesgo?: (nivel: NivelMargenRiesgo, pct: number) => void;
  tipoFactura?: TipoFactura;
  onUpdateTipoFactura?: (tipo: TipoFactura) => void;
  impuestosDetalle?: ImpuestoItem[];
  onToggleTax?: (index: number) => void;
  onUpdateTaxPct?: (index: number, pct: number) => void;
}

type TabKey = 'variables' | 'gastos' | 'riesgo' | 'comercial';

export const QuoteParametersModal: React.FC<QuoteParametersModalProps> = ({
  isOpen,
  onClose,
  calculosVariables = {},
  onUpdateCalculosVariables,
  gastosConfig = [],
  onUpdateGastosConfig,
  capitulos = [],
  margenPorcentaje = 30,
  onUpdateMargenPorcentaje,
  nivelMargenRiesgo = 'medio',
  margenRiesgoPorcentaje = 10,
  onUpdateMargenRiesgo,
  tipoFactura = 'Factura C',
  onUpdateTipoFactura,
  impuestosDetalle = [],
  onToggleTax,
  onUpdateTaxPct
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('variables');

  // Formulario rápido para nueva variable
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  if (!isOpen) return null;

  const handleAddVariable = () => {
    const raw = newVarName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!raw) return;
    const val = newVarValue.trim();
    const num = Number(val);
    const finalVal = isNaN(num) || val.startsWith('=') ? val : num;

    onUpdateCalculosVariables?.({
      ...calculosVariables,
      [raw]: finalVal
    });

    setNewVarName('');
    setNewVarValue('');
  };

  const handleRemoveVariable = (key: string) => {
    const copy = { ...calculosVariables };
    delete copy[key];
    onUpdateCalculosVariables?.(copy);
  };

  const handleAddGasto = () => {
    const nombre = window.prompt('Nombre del gasto operativo o indirecto:');
    if (!nombre) return;
    const valStr = window.prompt('Valor (% o monto fijo en $):', '5');
    const valor = Number(valStr) || 0;

    const newGasto: GastoPresupuestoConfig = {
      id: `gasto-${generateUUID().slice(0, 8)}`,
      nombre: nombre.trim(),
      destino: 'costo_indirecto',
      modalidad: 'porcentual',
      valor,
      aplica: true
    };

    onUpdateGastosConfig?.([...gastosConfig, newGasto]);
  };

  const handleToggleGasto = (idx: number) => {
    const copy = [...gastosConfig];
    copy[idx] = { ...copy[idx], aplica: !copy[idx].aplica };
    onUpdateGastosConfig?.(copy);
  };

  const handleRemoveGasto = (idx: number) => {
    onUpdateGastosConfig?.(gastosConfig.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 select-none backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-surface rounded-2xl border border-outline-variant/30 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant/30 bg-surface-container-low">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-on-surface">
              Parámetros de la Cotización
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pestañas de configuración */}
        <div className="flex border-b border-outline-variant/30 bg-surface-container-lowest px-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('variables')}
            className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'variables'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Variable className="w-3.5 h-3.5" />
            <span>Variables ({Object.keys(calculosVariables).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gastos')}
            className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'gastos'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Gastos Indirectos ({gastosConfig.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('riesgo')}
            className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'riesgo'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Margen de Riesgo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('comercial')}
            className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'comercial'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Beneficio & Factura</span>
          </button>
        </div>

        {/* Contenido de la pestaña activa */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 1. Variables de Cotización */}
          {activeTab === 'variables' && (
            <div className="space-y-3">
              <p className="text-xs text-on-surface-variant">
                Las variables globales pueden usarse directamente en las fórmulas de ítems e insumos (ej: <code className="font-mono bg-surface-container px-1 rounded">=superficie * 1.5</code>).
              </p>

              {/* Formulario para agregar variable */}
              <div className="flex items-center gap-2 p-2 bg-surface-container rounded-xl border border-outline-variant/30">
                <input
                  type="text"
                  placeholder="Nombre variable (ej: superficie)"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  className="flex-1 px-2.5 py-1 text-xs bg-surface border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Valor o fórmula"
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  className="w-36 px-2.5 py-1 text-xs font-mono bg-surface border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddVariable}
                  className="p-1.5 bg-primary text-on-primary rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                  title="Agregar variable"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Lista de variables */}
              <div className="space-y-1.5">
                {Object.entries(calculosVariables).length === 0 ? (
                  <p className="text-xs text-on-surface-variant/70 italic text-center py-4">
                    Sin variables definidas en esta cotización.
                  </p>
                ) : (
                  Object.entries(calculosVariables).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/20 text-xs"
                    >
                      <span className="font-mono font-semibold text-primary">{k}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-on-surface">{String(v)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariable(k)}
                          className="p-1 text-on-surface-variant hover:text-error rounded hover:bg-error-container/20 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 2. Reglas de Gastos */}
          {activeTab === 'gastos' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-on-surface-variant">
                  Reglas de recargos directos e indirectos (Gastos Generales, fletes, etc.).
                </p>
                <button
                  type="button"
                  onClick={handleAddGasto}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-container/40 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Gasto</span>
                </button>
              </div>

              <div className="space-y-2">
                {gastosConfig.length === 0 ? (
                  <p className="text-xs text-on-surface-variant/70 italic text-center py-4">
                    Sin gastos configurados.
                  </p>
                ) : (
                  gastosConfig.map((g, idx) => (
                    <div
                      key={g.id || idx}
                      className="p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/20 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={g.aplica !== false}
                          onChange={() => handleToggleGasto(idx)}
                          className="rounded text-primary focus:ring-0 cursor-pointer"
                        />
                        <div>
                          <span className="font-semibold text-on-surface block">{g.nombre}</span>
                          <span className="text-[10px] text-on-surface-variant">
                            {g.modalidad} sobre {g.destino || 'costo_indirecto'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-on-surface">
                          {g.modalidad === 'porcentual' ? `${g.valor}%` : `$ ${g.valor}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGasto(idx)}
                          className="p-1 text-on-surface-variant hover:text-error rounded hover:bg-error-container/20 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 3. Margen de Riesgo Global */}
          {activeTab === 'riesgo' && (
            <div className="space-y-4">
              <p className="text-xs text-on-surface-variant">
                Porcentaje de contingencia técnica aplicado sobre los costos directos totales de la obra.
              </p>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { nivel: 'bajo' as const, pct: 10, label: 'Bajo (10%)' },
                  { nivel: 'medio' as const, pct: 20, label: 'Medio (20%)' },
                  { nivel: 'alto' as const, pct: 35, label: 'Alto (35%)' },
                  { nivel: 'personalizado' as const, pct: margenRiesgoPorcentaje, label: 'Personalizado' }
                ].map((opt) => (
                  <button
                    key={opt.nivel}
                    type="button"
                    onClick={() => onUpdateMargenRiesgo?.(opt.nivel, opt.pct)}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl border text-center transition-all cursor-pointer ${
                      nivelMargenRiesgo === opt.nivel
                        ? 'bg-primary-container text-on-primary-container border-primary shadow-xs'
                        : 'bg-surface text-on-surface-variant border-outline-variant/30 hover:bg-surface-container'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {nivelMargenRiesgo === 'personalizado' && (
                <div className="flex items-center gap-2 p-3 bg-surface-container rounded-xl border border-primary/40">
                  <label className="text-xs font-medium text-on-surface">Porcentaje exacto de riesgo (%):</label>
                  <input
                    type="number"
                    value={margenRiesgoPorcentaje}
                    onChange={(e) => onUpdateMargenRiesgo?.('personalizado', Number(e.target.value))}
                    className="w-24 px-2.5 py-1 text-xs font-mono bg-surface border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* 4. Beneficio e Impuestos */}
          {activeTab === 'comercial' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Beneficio / Ganancia Neta (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={margenPorcentaje ?? 30}
                    onChange={(e) => onUpdateMargenPorcentaje?.(Number(e.target.value))}
                    className="w-32 px-3 py-1.5 text-xs font-mono bg-surface border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none"
                  />
                  <span className="text-xs text-on-surface-variant">% sobre (Costo Directo + GG)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Tipo de Facturación
                </label>
                <select
                  value={tipoFactura}
                  onChange={(e) => onUpdateTipoFactura?.(e.target.value as TipoFactura)}
                  className="w-full px-3 py-1.5 text-xs bg-surface border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none"
                >
                  <option value="Factura A">Factura A (IVA discriminado 21%)</option>
                  <option value="Factura B">Factura B (Consumidor Final)</option>
                  <option value="Factura C">Factura C (Monotributo - IVA al costo)</option>
                  <option value="Presupuesto X (Sin Factura)">Presupuesto X (Sin Factura)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-2">
                  Detalle Impositivo
                </label>
                <div className="space-y-1.5">
                  {impuestosDetalle.map((imp, idx) => (
                    <div
                      key={imp.id}
                      className="flex items-center justify-between p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/20 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={imp.aplica}
                          onChange={() => onToggleTax?.(idx)}
                          className="rounded text-primary focus:ring-0 cursor-pointer"
                        />
                        <span className="font-medium text-on-surface">{imp.nombre}</span>
                      </div>
                      <span className="font-mono font-semibold text-on-surface">{imp.porcentaje}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="px-5 py-3 border-t border-outline-variant/30 bg-surface-container-low flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-primary text-on-primary rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

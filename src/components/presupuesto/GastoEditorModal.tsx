import React, { useState, useEffect } from 'react';
import { Plus, Trash2, HelpCircle, Calculator, Percent, DollarSign, Layers, Check } from 'lucide-react';
import { ModalContainer } from '../ModalContainer';
import { GastoPresupuestoConfig, DestinoGasto, ModalidadGasto, CapituloPresupuesto } from '../../core/types';
import { formatARS, roundMoney } from '../../core/calculations';
import { evaluateMathExpression } from '../../core/mathEvaluator';

interface GastoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  gastoToEdit?: GastoPresupuestoConfig | null;
  capitulos?: CapituloPresupuesto[];
  showIncluirPorDefecto?: boolean;
  onSave: (gasto: GastoPresupuestoConfig) => void;
  onDelete?: (id: string) => void;
  baseMateriales?: number;
  baseManoObra?: number;
  baseServicios?: number;
  baseCostoDirecto?: number;
}

export const GastoEditorModal: React.FC<GastoEditorModalProps> = ({
  isOpen,
  onClose,
  gastoToEdit,
  capitulos = [],
  showIncluirPorDefecto = false,
  onSave,
  onDelete,
  baseMateriales = 0,
  baseManoObra = 0,
  baseServicios = 0,
  baseCostoDirecto = 0
}) => {
  const [nombre, setNombre] = useState('');
  const [destino, setDestino] = useState<DestinoGasto>('mano_obra');
  const [modalidad, setModalidad] = useState<ModalidadGasto>('porcentual');
  const [valor, setValor] = useState<number>(0);
  const [formula, setFormula] = useState('');
  const [capituloId, setCapituloId] = useState<string>('');
  const [incluirPorDefecto, setIncluirPorDefecto] = useState<boolean>(true);
  const [errorFormula, setErrorFormula] = useState<string | null>(null);

  useEffect(() => {
    if (gastoToEdit) {
      setNombre(gastoToEdit.nombre || '');
      setDestino(gastoToEdit.destino || 'costo_indirecto');
      setModalidad(gastoToEdit.modalidad || (gastoToEdit.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo'));
      setValor(gastoToEdit.valor || 0);
      setFormula(gastoToEdit.formula || '');
      setCapituloId(gastoToEdit.capituloId || '');
      setIncluirPorDefecto(gastoToEdit.incluirPorDefecto ?? true);
    } else {
      setNombre('');
      setDestino('mano_obra');
      setModalidad('porcentual');
      setValor(0);
      setFormula('');
      setCapituloId('');
      setIncluirPorDefecto(true);
    }
    setErrorFormula(null);
  }, [gastoToEdit, isOpen]);

  // Cálculo en vivo de vista previa (si estamos en catálogo y base=0, usamos base de referencia $100.000)
  const isCatalogMode = baseMateriales === 0 && baseManoObra === 0 && baseServicios === 0 && baseCostoDirecto === 0;
  const refMat = isCatalogMode ? 100000 : baseMateriales;
  const refMO = isCatalogMode ? 100000 : baseManoObra;
  const refServ = isCatalogMode ? 50000 : baseServicios;
  const refDirecto = isCatalogMode ? 250000 : baseCostoDirecto;

  let baseActual = 0;
  if (destino === 'materiales') baseActual = refMat;
  else if (destino === 'mano_obra') baseActual = refMO;
  else if (destino === 'servicios') baseActual = refServ;
  else baseActual = refDirecto;

  let montoSimulado = 0;
  if (modalidad === 'porcentual') {
    montoSimulado = roundMoney(baseActual * (valor / 100));
  } else if (modalidad === 'monto_fijo') {
    montoSimulado = roundMoney(valor);
  } else if (modalidad === 'parametrico') {
    if (formula.trim()) {
      try {
        const res = evaluateMathExpression(formula, {
          materiales: baseMateriales,
          mano_obra: baseManoObra,
          servicios: baseServicios,
          costo_directo_base: baseCostoDirecto,
          base: baseActual
        });
        if (res.error) {
          setErrorFormula(res.error);
        } else {
          setErrorFormula(null);
          montoSimulado = roundMoney(Math.max(0, res.value ?? 0));
        }
      } catch (err: any) {
        setErrorFormula(err.message || 'Error en la fórmula');
      }
    }
  }

  const handleInsertVariable = (varName: string) => {
    setFormula((prev) => (prev ? `${prev} * ${varName}` : varName));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    const id = gastoToEdit?.id || `gasto-${Date.now()}`;
    const newGasto: GastoPresupuestoConfig = {
      id,
      nombre: nombre.trim(),
      destino,
      modalidad,
      valor: modalidad === 'parametrico' ? 0 : valor,
      formula: modalidad === 'parametrico' ? formula.trim() : undefined,
      capituloId: capituloId || undefined,
      incluirPorDefecto,
      aplica: gastoToEdit?.aplica !== undefined ? gastoToEdit.aplica : true
    };

    onSave(newGasto);
    onClose();
  };

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      title={gastoToEdit ? 'Editar Gasto' : 'Nuevo Gasto'}
      subtitle="Configuración de modificadores directos de rubro o costos indirectos"
      icon={<Plus className="w-5 h-5 text-primary" />}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          {gastoToEdit && onDelete ? (
            <button
              type="button"
              onClick={() => {
                onDelete(gastoToEdit.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-error hover:bg-error-container/40 rounded-xl transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
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
              disabled={!nombre.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl shadow-xs transition-all"
            >
              <Check className="w-4 h-4" />
              {gastoToEdit ? 'Guardar Cambios' : 'Crear Gasto'}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nombre del Gasto */}
        <div>
          <label className="block text-xs font-bold text-on-surface mb-1.5">
            Nombre del Gasto *
          </label>
          <input
            type="text"
            required
            placeholder="ej: Cargas Sociales y ART, Garantía de Insumos, Flete General"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/50 focus:border-primary rounded-xl text-xs text-on-surface outline-none transition-colors"
          />
        </div>

        {/* Destino de Aplicación (Materiales, MO, Servicios, Costos Indirectos) */}
        <div>
          <label className="block text-xs font-bold text-on-surface mb-1.5">
            Aplicar Sobre (Destino de Imputación)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setDestino('mano_obra')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                destino === 'mano_obra'
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                  : 'border-outline-variant/40 bg-surface hover:bg-surface-variant/40 text-on-surface-variant'
              }`}
            >
              <span className="block text-[11px] font-bold">👷 Mano de Obra</span>
              <span className="block text-[10px] opacity-75">Costo Directo MO</span>
            </button>

            <button
              type="button"
              onClick={() => setDestino('materiales')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                destino === 'materiales'
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                  : 'border-outline-variant/40 bg-surface hover:bg-surface-variant/40 text-on-surface-variant'
              }`}
            >
              <span className="block text-[11px] font-bold">📦 Materiales</span>
              <span className="block text-[10px] opacity-75">Costo Directo Insumos</span>
            </button>

            <button
              type="button"
              onClick={() => setDestino('servicios')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                destino === 'servicios'
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                  : 'border-outline-variant/40 bg-surface hover:bg-surface-variant/40 text-on-surface-variant'
              }`}
            >
              <span className="block text-[11px] font-bold">🚜 Servicios</span>
              <span className="block text-[10px] opacity-75">Equipos & Terceros</span>
            </button>

            <button
              type="button"
              onClick={() => setDestino('costo_indirecto')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                destino === 'costo_indirecto'
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                  : 'border-outline-variant/40 bg-surface hover:bg-surface-variant/40 text-on-surface-variant'
              }`}
            >
              <span className="block text-[11px] font-bold">🌐 Costo Indirecto</span>
              <span className="block text-[10px] opacity-75">Sobre Costo Total (C)</span>
            </button>
          </div>
        </div>

        {/* Alcance (Global o Capítulo Específico) */}
        {capitulos.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              Alcance de Aplicación
            </label>
            <select
              value={capituloId}
              onChange={(e) => setCapituloId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/50 focus:border-primary rounded-xl text-xs text-on-surface outline-none transition-colors"
            >
              <option value="">Toda la Cotización (Alcance Global)</option>
              {capitulos.map((c) => (
                <option key={c.id} value={c.id}>
                  Solo en Capítulo: {c.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Modalidad de Cálculo (Porcentual, Fijo, Paramétrico) */}
        <div>
          <label className="block text-xs font-bold text-on-surface mb-1.5">
            Modalidad de Cálculo
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setModalidad('porcentual')}
              className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs transition-all ${
                modalidad === 'porcentual'
                  ? 'border-primary bg-primary/10 text-primary font-bold'
                  : 'border-outline-variant/40 bg-surface hover:bg-surface-variant/40 text-on-surface-variant'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              Porcentaje (%)
            </button>

            <button
              type="button"
              onClick={() => setModalidad('monto_fijo')}
              className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs transition-all ${
                modalidad === 'monto_fijo'
                  ? 'border-primary bg-primary/10 text-primary font-bold'
                  : 'border-outline-variant/40 bg-surface hover:bg-surface-variant/40 text-on-surface-variant'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Monto Fijo ($)
            </button>

            <button
              type="button"
              onClick={() => setModalidad('parametrico')}
              className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs transition-all ${
                modalidad === 'parametrico'
                  ? 'border-primary bg-primary/10 text-primary font-bold'
                  : 'border-outline-variant/40 bg-surface hover:bg-surface-variant/40 text-on-surface-variant'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Fórmula ⚡
            </button>
          </div>
        </div>

        {/* Input según Modalidad */}
        {modalidad === 'porcentual' && (
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1.5">
              Porcentaje a aplicar sobre {destino === 'mano_obra' ? 'Mano de Obra' : destino === 'materiales' ? 'Materiales' : destino === 'servicios' ? 'Servicios' : 'Costo Directo (C)'}
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                value={valor || ''}
                onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
                placeholder="ej: 45 para 45%"
                className="w-full pl-3.5 pr-10 py-2.5 bg-surface-container border border-outline-variant/50 focus:border-primary rounded-xl text-xs text-on-surface font-mono outline-none"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">%</span>
            </div>
          </div>
        )}

        {modalidad === 'monto_fijo' && (
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1.5">
              Monto Absoluto en Pesos ($ ARS)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">$</span>
              <input
                type="number"
                step="100"
                min="0"
                value={valor || ''}
                onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
                placeholder="ej: 25000"
                className="w-full pl-8 pr-3.5 py-2.5 bg-surface-container border border-outline-variant/50 focus:border-primary rounded-xl text-xs text-on-surface font-mono outline-none"
              />
            </div>
          </div>
        )}

        {modalidad === 'parametrico' && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-on-surface">
              Expresión o Fórmula Matemática
            </label>
            <input
              type="text"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="ej: base * 0.15 + 5000"
              className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/50 focus:border-primary rounded-xl text-xs text-on-surface font-mono outline-none"
            />
            {errorFormula && (
              <p className="text-[11px] text-error font-medium">{errorFormula}</p>
            )}

            {/* Variable insertion chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-on-surface-variant">Variables:</span>
              <button
                type="button"
                onClick={() => handleInsertVariable('base')}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface-container-high border border-outline-variant/30 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                base ({formatARS(baseActual)})
              </button>
              <button
                type="button"
                onClick={() => handleInsertVariable('materiales')}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface-container-high border border-outline-variant/30 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                materiales
              </button>
              <button
                type="button"
                onClick={() => handleInsertVariable('mano_obra')}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface-container-high border border-outline-variant/30 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                mano_obra
              </button>
              <button
                type="button"
                onClick={() => handleInsertVariable('servicios')}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface-container-high border border-outline-variant/30 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                servicios
              </button>
            </div>
          </div>
        )}

        {/* Incluir por Defecto (Catálogo Global) */}
        {showIncluirPorDefecto && (
          <div className="bg-surface-container-highest/60 p-3.5 rounded-2xl border border-outline-variant/20">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirPorDefecto}
                onChange={(e) => setIncluirPorDefecto(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-primary rounded border-outline focus:ring-primary"
              />
              <div className="text-xs">
                <span className="font-semibold text-on-surface block">
                  Incluir por defecto en nuevas cotizaciones
                </span>
                <span className="text-on-surface-variant text-[11px] block mt-0.5">
                  Si está marcado, este gasto se aplicará automáticamente activado al crear un nuevo presupuesto.
                </span>
              </div>
            </label>
          </div>
        )}

        {/* Live Calculation Preview Banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-on-surface-variant block">
              {isCatalogMode ? 'Ejemplo de Impacto (Base de referencia):' : 'Impacto en esta Cotización:'}
            </span>
            <span className="text-sm font-bold font-mono text-primary">
              +{formatARS(montoSimulado)}
            </span>
          </div>
          <span className="text-[10px] font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {destino === 'costo_indirecto' ? 'Costos Indirectos (GG)' : `Costo Directo (${destino})`}
          </span>
        </div>
      </form>
    </ModalContainer>
  );
};

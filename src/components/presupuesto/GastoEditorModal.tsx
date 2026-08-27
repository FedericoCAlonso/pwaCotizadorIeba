import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  HelpCircle,
  Calculator,
  Percent,
  DollarSign,
  Layers,
  Check,
  Sliders,
  Sparkles,
  Zap,
  ChevronUp,
  ChevronDown,
  BookOpen
} from 'lucide-react';
import { ModalContainer } from '../ModalContainer';
import {
  GastoPresupuestoConfig,
  DestinoGasto,
  ModalidadGasto,
  CapituloPresupuesto,
  ParametroTrabajoTipo,
  CostoIndirecto
} from '../../core/types';
import { formatARS, roundMoney } from '../../core/calculations';
import { evaluateMathExpression } from '../../core/mathEvaluator';

interface GastoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  gastoToEdit?: GastoPresupuestoConfig | null;
  capitulos?: CapituloPresupuesto[];
  costosIndirectosCatalog?: CostoIndirecto[];
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
  costosIndirectosCatalog = [],
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
  const [parametros, setParametros] = useState<ParametroTrabajoTipo[]>([]);
  const [testParamValues, setTestParamValues] = useState<Record<string, number>>({});
  const [showAddParamForm, setShowAddParamForm] = useState(false);
  const [newParamForm, setNewParamForm] = useState<{
    id: string;
    nombre: string;
    tipo: 'numero' | 'boolean' | 'select';
    valorDefault: number;
    unidad: string;
    descripcion: string;
  }>({
    id: '',
    nombre: '',
    tipo: 'numero',
    valorDefault: 1,
    unidad: '',
    descripcion: ''
  });
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

      const loadedParams = gastoToEdit.parametros || [];
      setParametros(loadedParams);

      const defaults: Record<string, number> = {};
      loadedParams.forEach((p) => {
        defaults[p.id] = gastoToEdit.valoresParametros?.[p.id] !== undefined
          ? gastoToEdit.valoresParametros[p.id]
          : p.valorDefault;
      });
      setTestParamValues(defaults);
    } else {
      setNombre('');
      setDestino('mano_obra');
      setModalidad('porcentual');
      setValor(0);
      setFormula('');
      setCapituloId('');
      setIncluirPorDefecto(true);
      setParametros([]);
      setTestParamValues({});
    }
    setShowAddParamForm(false);
    setErrorFormula(null);
  }, [gastoToEdit, isOpen]);

  const handleApplyTemplate = (template: CostoIndirecto) => {
    setNombre(template.nombre || '');
    setDestino(template.destino || (template.tipo === 'porcentual_sobre_costo' ? 'costo_indirecto' : 'costo_indirecto'));
    setModalidad(template.modalidad || (template.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo'));
    setValor(template.valor || 0);
    setFormula(template.formula || '');
    setIncluirPorDefecto(template.incluirPorDefecto ?? true);

    const loadedParams = template.parametros || [];
    setParametros(loadedParams);

    const defaults: Record<string, number> = {};
    loadedParams.forEach((p) => {
      defaults[p.id] = template.valoresParametrosDefault?.[p.id] !== undefined
        ? template.valoresParametrosDefault[p.id]
        : p.valorDefault;
    });
    setTestParamValues(defaults);
    setErrorFormula(null);
  };

  // Cálculo en vivo de vista previa (si base=0, usamos base de referencia para el simulador)
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
          materiales: refMat,
          mano_obra: refMO,
          servicios: refServ,
          costo_directo_base: refDirecto,
          base: baseActual,
          ...testParamValues
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

  const handleAddPresetParam = (param: ParametroTrabajoTipo) => {
    if (parametros.some((p) => p.id === param.id)) return;
    setParametros((prev) => [...prev, param]);
    setTestParamValues((prev) => ({ ...prev, [param.id]: param.valorDefault }));
  };

  const handleSaveCustomParam = () => {
    if (!newParamForm.id.trim() || !newParamForm.nombre.trim()) return;
    const cleanId = newParamForm.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const param: ParametroTrabajoTipo = {
      id: cleanId,
      nombre: newParamForm.nombre.trim(),
      tipo: newParamForm.tipo,
      valorDefault: newParamForm.valorDefault,
      unidad: newParamForm.unidad.trim() || undefined,
      descripcion: newParamForm.descripcion.trim() || undefined,
      opciones: newParamForm.tipo === 'select' ? [
        { id: 'opt-1', label: 'Bajo / Normal', valor: 1.0 },
        { id: 'opt-2', label: 'Medio / Moderado', valor: 1.25 },
        { id: 'opt-3', label: 'Alto / Crítico', valor: 1.5 }
      ] : undefined
    };

    setParametros((prev) => [...prev.filter((p) => p.id !== cleanId), param]);
    setTestParamValues((prev) => ({ ...prev, [cleanId]: param.valorDefault }));
    setShowAddParamForm(false);
    setNewParamForm({
      id: '',
      nombre: '',
      tipo: 'numero',
      valorDefault: 1,
      unidad: '',
      descripcion: ''
    });
  };

  const handleRemoveParam = (paramId: string) => {
    setParametros((prev) => prev.filter((p) => p.id !== paramId));
    setTestParamValues((prev) => {
      const next = { ...prev };
      delete next[paramId];
      return next;
    });
  };

  // Encuentra el índice del parámetro raíz (sin condición) del cual desciende el parámetro en 'index'
  const getParametroRootIndex = (list: ParametroTrabajoTipo[], index: number) => {
    let rootIdx = index;
    while (rootIdx > 0 && list[rootIdx].condicion) {
      rootIdx--;
    }
    return rootIdx;
  };

  // Encuentra el rango [startIndex, endIndex] del bloque / sub-árbol familiar a partir de un índice
  const getParametroBlockRange = (list: ParametroTrabajoTipo[], index: number) => {
    const blockIds = new Set<string>([list[index].id]);
    let endIndex = index;
    for (let i = index + 1; i < list.length; i++) {
      const p = list[i];
      if (p.condicion && Array.from(blockIds).some(id => p.condicion!.includes(id))) {
        blockIds.add(p.id);
        endIndex = i;
      } else {
        break;
      }
    }
    return { startIndex: index, endIndex };
  };

  // Verifica si el parámetro en 'index' puede moverse hacia arriba o hacia abajo
  const canMoveParametro = (list: ParametroTrabajoTipo[], index: number, direction: 'up' | 'down') => {
    if (index < 0 || index >= list.length) return false;
    const currentParam = list[index];
    const isChild = Boolean(currentParam.condicion && currentParam.condicion.trim());

    if (direction === 'up') {
      if (index === 0) return false;

      if (isChild) {
        const rootIdx = getParametroRootIndex(list, index);
        // Un hijo nunca puede subir a la posición del padre raíz o antes de él
        if (index - 1 <= rootIdx) return false;

        // Tampoco puede subir antes de cualquier parámetro del que dependa directamente
        for (let i = 0; i < index; i++) {
          if (currentParam.condicion!.includes(list[i].id) && index - 1 <= i) {
            return false;
          }
        }
        return true;
      } else {
        // Es parámetro raíz: puede subir si hay otro bloque raíz antes de él
        return index > 0;
      }
    } else {
      // direction === 'down'
      const { endIndex } = getParametroBlockRange(list, index);

      if (isChild) {
        const rootIdx = getParametroRootIndex(list, index);
        const { endIndex: familyEnd } = getParametroBlockRange(list, rootIdx);
        // Un hijo NO puede salir del bloque de su padre hacia abajo
        if (endIndex >= familyEnd) return false;
        return true;
      } else {
        // Es parámetro raíz: no puede bajar si su bloque ya llega al final de la lista
        if (endIndex >= list.length - 1) return false;
        return true;
      }
    }
  };

  const handleMoveParam = (index: number, direction: 'up' | 'down') => {
    setParametros((prev) => {
      const list = [...prev];
      if (!canMoveParametro(list, index, direction)) return prev;

      const currentParam = list[index];
      const isChild = Boolean(currentParam.condicion && currentParam.condicion.trim());
      const { startIndex, endIndex } = getParametroBlockRange(list, index);
      const blockSize = endIndex - startIndex + 1;

      if (direction === 'up') {
        const prevItemIdx = startIndex - 1;
        let targetInsertIdx = prevItemIdx;

        if (!isChild) {
          // Si es raíz, salta el bloque raíz anterior completo
          let prevBlockStart = prevItemIdx;
          while (prevBlockStart > 0 && list[prevBlockStart].condicion) {
            prevBlockStart--;
          }
          targetInsertIdx = prevBlockStart;
        } else {
          // Si es hijo, salta el bloque del hermano anterior (sin superar al padre)
          const rootIdx = getParametroRootIndex(list, index);
          let prevSiblingStart = prevItemIdx;
          while (
            prevSiblingStart > rootIdx + 1 &&
            list[prevSiblingStart].condicion &&
            !currentParam.condicion!.includes(list[prevSiblingStart - 1]?.id)
          ) {
            prevSiblingStart--;
          }
          targetInsertIdx = Math.max(rootIdx + 1, prevSiblingStart);
        }

        const block = list.splice(startIndex, blockSize);
        list.splice(targetInsertIdx, 0, ...block);
      } else {
        // direction === 'down'
        const nextBlockIdx = endIndex + 1;
        const nextRange = getParametroBlockRange(list, nextBlockIdx);

        const block = list.splice(startIndex, blockSize);
        const insertIdx = nextRange.endIndex - blockSize + 1;
        list.splice(insertIdx, 0, ...block);
      }

      return list;
    });
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
      parametros: modalidad === 'parametrico' && parametros.length > 0 ? parametros : undefined,
      valoresParametros: modalidad === 'parametrico' && Object.keys(testParamValues).length > 0 ? testParamValues : undefined,
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
      subtitle="Configuración de modificadores directos de rubro o costos indirectos paramétricos"
      icon={<Plus className="w-5 h-5 text-primary" />}
      maxWidth="lg"
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
        {/* Plantilla desde catálogo si es un gasto nuevo */}
        {!gastoToEdit && costosIndirectosCatalog && costosIndirectosCatalog.length > 0 && (
          <div className="p-3 bg-surface-container/60 border border-outline-variant/30 rounded-2xl space-y-1.5">
            <label className="block text-xs font-bold text-on-surface flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span>Cargar desde una plantilla del catálogo</span>
            </label>
            <select
              onChange={(e) => {
                const sel = costosIndirectosCatalog.find((c) => c.id === e.target.value);
                if (sel) {
                  handleApplyTemplate(sel);
                }
              }}
              defaultValue=""
              className="w-full text-xs bg-surface border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="" disabled>
                -- Selecciona un gasto estándar para autorrellenar --
              </option>
              {costosIndirectosCatalog.filter(c => !c.deleted).map((c) => {
                const modalidad = c.modalidad || (c.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo');
                const valStr = modalidad === 'porcentual' ? `${c.valor}%` : modalidad === 'parametrico' ? 'Fórmula' : formatARS(c.valor);
                return (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({valStr})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Nombre del Gasto */}
        <div>
          <label className="block text-xs font-bold text-on-surface mb-1.5">
            Nombre del Gasto *
          </label>
          <input
            type="text"
            required
            placeholder="ej: Contingencia por Antigüedad/AEA, Cargas Sociales y ART, Garantía de Insumos"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/50 focus:border-primary rounded-xl text-xs text-on-surface outline-none transition-colors"
          />
        </div>

        {/* Destino de Aplicación */}
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
              <Zap className="w-3.5 h-3.5" />
              Paramétrico ⚡
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
          <div className="space-y-4 pt-1">
            {/* SECCIÓN: Parámetros del Gasto */}
            <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-primary" />
                    <span>Parámetros y Preguntas de Obra</span>
                  </h4>
                  <p className="text-[11px] text-on-surface-variant">
                    Variables que el presupuestador completará al cotizar (antigüedad, normas AEA, dificultad).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddParamForm(!showAddParamForm)}
                  className="px-3 py-1.5 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddParamForm ? 'Cerrar' : 'Agregar Parámetro'}</span>
                </button>
              </div>

              {/* Presets Rápidos de Parámetros */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-on-surface-variant font-medium">Sugeridos:</span>
                <button
                  type="button"
                  onClick={() => handleAddPresetParam({
                    id: 'antiguedad_anos',
                    nombre: 'Antigüedad de la Vivienda',
                    tipo: 'numero',
                    valorDefault: 20,
                    unidad: 'años',
                    descripcion: 'Años desde la construcción original de la instalación'
                  })}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-container border border-outline-variant/30 hover:bg-primary/10 hover:text-primary transition"
                >
                  + 🏠 Antigüedad (años)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddPresetParam({
                    id: 'cumple_aea',
                    nombre: '¿Cumple Normas AEA 90364?',
                    tipo: 'boolean',
                    valorDefault: 1,
                    descripcion: '1 = Sí cumple, 0 = No cumple (requiere adecuación o contingencia)'
                  })}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-container border border-outline-variant/30 hover:bg-primary/10 hover:text-primary transition"
                >
                  + ⚡ Cumple AEA (Sí/No)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddPresetParam({
                    id: 'factor_riesgo',
                    nombre: 'Nivel de Riesgo / Complejidad',
                    tipo: 'select',
                    valorDefault: 1.0,
                    opciones: [
                      { id: 'opt-bajo', label: 'Bajo / Estándar', valor: 1.0 },
                      { id: 'opt-medio', label: 'Medio / Cañería Mixta', valor: 1.25 },
                      { id: 'opt-alto', label: 'Alto / Cañería Hierro Antigua', valor: 1.6 }
                    ],
                    descripcion: 'Multiplicador según el estado de cañerías existentes'
                  })}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-container border border-outline-variant/30 hover:bg-primary/10 hover:text-primary transition"
                >
                  + ⚠️ Factor de Riesgo (Select)
                </button>
              </div>

              {/* Formulario de Alta de Parámetro Personalizado */}
              {showAddParamForm && (
                <div className="bg-surface-container-high p-3.5 rounded-xl border border-primary/30 space-y-3 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface mb-1">Nombre Visible</label>
                      <input
                        type="text"
                        placeholder="ej: Antigüedad de la Vivienda"
                        value={newParamForm.nombre}
                        onChange={(e) => {
                          const val = e.target.value;
                          const autoId = val.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
                          setNewParamForm({
                            ...newParamForm,
                            nombre: val,
                            id: newParamForm.id ? newParamForm.id : autoId
                          });
                        }}
                        className="w-full px-3 py-1.5 bg-surface-container border border-outline-variant/40 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface mb-1">Variable ID (en fórmulas)</label>
                      <input
                        type="text"
                        placeholder="ej: antiguedad_anos"
                        value={newParamForm.id}
                        onChange={(e) => setNewParamForm({ ...newParamForm, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                        className="w-full px-3 py-1.5 bg-surface-container border border-outline-variant/40 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface mb-1">Tipo</label>
                      <select
                        value={newParamForm.tipo}
                        onChange={(e) => setNewParamForm({ ...newParamForm, tipo: e.target.value as any })}
                        className="w-full px-3 py-1.5 bg-surface-container border border-outline-variant/40 rounded-lg text-xs"
                      >
                        <option value="numero">Número</option>
                        <option value="boolean">Sí / No (Boolean)</option>
                        <option value="select">Lista de Selección</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface mb-1">Valor por Defecto</label>
                      <input
                        type="number"
                        step="any"
                        value={newParamForm.valorDefault}
                        onChange={(e) => setNewParamForm({ ...newParamForm, valorDefault: parseFloat(e.target.value) || 0 })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newParamForm.id.trim() && newParamForm.nombre.trim()) {
                            e.preventDefault();
                            handleSaveCustomParam();
                          }
                        }}
                        className="w-full px-3 py-1.5 bg-surface-container border border-outline-variant/40 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface mb-1">Unidad (Opcional)</label>
                      <input
                        type="text"
                        placeholder="ej: años, m, %"
                        value={newParamForm.unidad}
                        onChange={(e) => setNewParamForm({ ...newParamForm, unidad: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newParamForm.id.trim() && newParamForm.nombre.trim()) {
                            e.preventDefault();
                            handleSaveCustomParam();
                          }
                        }}
                        className="w-full px-3 py-1.5 bg-surface-container border border-outline-variant/40 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddParamForm(false)}
                      className="px-3 py-1 text-xs text-on-surface-variant"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCustomParam}
                      disabled={!newParamForm.id.trim() || !newParamForm.nombre.trim()}
                      className="px-4 py-1 bg-primary text-on-primary font-bold rounded-lg text-xs disabled:opacity-50"
                    >
                      Guardar Parámetro
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de Parámetros Configurados */}
              {parametros.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {parametros.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container border border-outline-variant/20 gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Botones Reordenar */}
                        <div className="flex items-center gap-0.5 bg-surface-container-highest rounded-lg p-0.5 border border-outline-variant/20 shrink-0">
                          <button
                            type="button"
                            disabled={!canMoveParametro(parametros, idx, 'up')}
                            onClick={() => handleMoveParam(idx, 'up')}
                            className="p-1 text-on-surface-variant hover:text-primary disabled:opacity-25 disabled:pointer-events-none rounded transition"
                            title="Mover arriba"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={!canMoveParametro(parametros, idx, 'down')}
                            onClick={() => handleMoveParam(idx, 'down')}
                            className="p-1 text-on-surface-variant hover:text-primary disabled:opacity-25 disabled:pointer-events-none rounded transition"
                            title="Mover abajo"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="min-w-0">
                          <span className="text-xs font-bold text-on-surface block truncate">{p.nombre}</span>
                          <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant font-mono flex-wrap">
                            <span className="bg-surface-container-highest px-1.5 py-0.5 rounded text-primary font-bold">{p.id}</span>
                            <span>Tipo: {p.tipo}</span>
                            <span>Default: {p.valorDefault}{p.unidad ? ` ${p.unidad}` : ''}</span>
                            {p.condicion && (
                              <span className="text-amber-800 dark:text-amber-300 font-semibold">↳ {p.condicion}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveParam(p.id)}
                        className="p-1 text-on-surface-variant hover:text-error rounded-md shrink-0"
                        title="Eliminar parámetro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-on-surface-variant italic py-1">
                  No hay parámetros definidos aún. Puedes agregar variables arriba o usar directamente <code>base</code>, <code>materiales</code>, <code>mano_obra</code> o <code>servicios</code>.
                </p>
              )}

              {/* Botón Cómodo al Pie de la Lista */}
              {!showAddParamForm && (
                <button
                  type="button"
                  onClick={() => setShowAddParamForm(true)}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs transition flex items-center justify-center gap-1.5 active:scale-[0.99] shadow-2xs mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar variable personalizada</span>
                </button>
              )}
            </div>

            {/* SECCIÓN: Editor de Fórmula */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface">
                Expresión o Fórmula Matemática ⚡
              </label>
              <input
                type="text"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="ej: base * (cumple_aea == 1 ? 0.05 : 0.20) + (antiguedad_anos > 30 ? 15000 : 0)"
                className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/50 focus:border-primary rounded-xl text-xs text-on-surface font-mono outline-none"
              />
              {errorFormula && (
                <p className="text-[11px] text-error font-medium">{errorFormula}</p>
              )}

              {/* Chips de Inserción de Variables y Parámetros */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-on-surface-variant font-bold">Insertar:</span>
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

                {/* Parámetros definidos por el usuario */}
                {parametros.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleInsertVariable(p.id)}
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
                  >
                    ⚡ {p.id}
                  </button>
                ))}
              </div>
            </div>

            {/* SECCIÓN: Simulador / Test Interactivo en Vivo */}
            {parametros.length > 0 && (
              <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/30 space-y-2">
                <span className="text-[11px] font-bold text-on-surface block">
                  🧪 Probador / Simulador de Parámetros:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {parametros.map((p) => {
                    const currentVal = testParamValues[p.id] !== undefined ? testParamValues[p.id] : p.valorDefault;
                    return (
                      <div key={p.id} className="bg-surface-container-low p-2 rounded-xl border border-outline-variant/20">
                        <label className="block text-[10px] font-bold text-on-surface mb-1 truncate">
                          {p.nombre} ({p.id})
                        </label>
                        {p.tipo === 'boolean' ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setTestParamValues({ ...testParamValues, [p.id]: 1 })}
                              className={`flex-1 py-1 rounded text-[10px] font-bold ${currentVal === 1 ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}
                            >
                              Sí (1)
                            </button>
                            <button
                              type="button"
                              onClick={() => setTestParamValues({ ...testParamValues, [p.id]: 0 })}
                              className={`flex-1 py-1 rounded text-[10px] font-bold ${currentVal === 0 ? 'bg-error text-on-error' : 'bg-surface-container-highest text-on-surface-variant'}`}
                            >
                              No (0)
                            </button>
                          </div>
                        ) : p.tipo === 'select' ? (
                          <select
                            value={currentVal}
                            onChange={(e) => setTestParamValues({ ...testParamValues, [p.id]: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 bg-surface-container border border-outline-variant/40 rounded text-xs"
                          >
                            {(p.opciones || []).map((opt) => (
                              <option key={opt.id} value={opt.valor}>{opt.label} ({opt.valor})</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="number"
                            value={currentVal}
                            onChange={(e) => setTestParamValues({ ...testParamValues, [p.id]: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 bg-surface-container border border-outline-variant/40 rounded text-xs font-mono"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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

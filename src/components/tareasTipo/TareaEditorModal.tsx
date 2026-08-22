import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Package,
  Clock,
  Save,
  Sliders,
  ShieldAlert,
  Sparkles,
  HelpCircle,
  Check,
  X,
  Calculator,
  ChevronDown,
  ChevronUp,
  Variable as VariableIcon
} from 'lucide-react';
import {
  TareaTipo,
  Insumo,
  CategoriaManoDeObra,
  InsumoEnTarea,
  ManoObraEnTarea,
  ParametroTrabajoTipo,
  VariableCalculadaTrabajoTipo,
  OpcionVariableTrabajo,
  FiltroMaterialEnTarea,
  CuadrillaRecomendada
} from '../../core/types';
import {
  calcularConsumosTareaTipo,
  resolverMaterialPorFiltro,
  formatARS,
  DEFAULT_CLAUSULA_OBRA_EXISTENTE
} from '../../core/calculations';
import { evaluateMathExpression, evaluateCondition } from '../../core/mathEvaluator';
import { ModalContainer } from '../ModalContainer';
import { useToast } from '../../contexts/ToastContext';
import { MaterialPickerModal } from './MaterialPickerModal';
import { CategoryFilterMaterialModal } from './CategoryFilterMaterialModal';
import { FormulaInput } from '../common/FormulaInput';

export interface TareaFormData {
  nombre: string;
  categoria: string;
  unidad: string;
  notasTecnicas: string;
  clausulaExclusiones?: string;
  costoFijoOperativo?: number;
  descripcionCostoFijo?: string;
  horasSetupTotal?: number;
  cuadrillaRecomendada?: CuadrillaRecomendada;
  parametros: ParametroTrabajoTipo[];
  variables: VariableCalculadaTrabajoTipo[];
  insumos: InsumoEnTarea[];
  manoObra: ManoObraEnTarea[];
}

interface TareaEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTarea: TareaTipo | null;
  categoriasList: string[];
  insumosMap: Map<string, Insumo>;
  manoObraList: CategoriaManoDeObra[];
  manoObraMap: Map<string, CategoriaManoDeObra>;
  onSave: (data: TareaFormData) => Promise<void>;
  titleOverride?: string;
  submitButtonText?: string;
}

export const TareaEditorModal: React.FC<TareaEditorModalProps> = ({
  isOpen,
  onClose,
  editingTarea,
  categoriasList,
  insumosMap,
  manoObraList,
  manoObraMap,
  onSave,
  titleOverride,
  submitButtonText,
}) => {
  const { toast } = useToast();
  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] transition-shadow";

  const [formData, setFormData] = useState<TareaFormData>({
    nombre: '',
    categoria: categoriasList[0] || 'Bocas',
    unidad: 'punto',
    notasTecnicas: '',
    clausulaExclusiones: '',
    costoFijoOperativo: 0,
    descripcionCostoFijo: '',
    parametros: [],
    variables: [],
    insumos: [],
    manoObra: [],
  });

  const [isMaterialPickerOpen, setIsMaterialPickerOpen] = useState(false);
  const [isCategoryFilterModalOpen, setIsCategoryFilterModalOpen] = useState(false);
  const [editingCategoryFilterIdx, setEditingCategoryFilterIdx] = useState<number | null>(null);

  const handleSaveCategoryFilter = (payload: {
    nombreSlot: string;
    filtroMaterial: FiltroMaterialEnTarea;
    cantidad: number;
    formula?: string;
  }) => {
    setFormData((prev) => {
      const nextInsumos = [...prev.insumos];
      if (editingCategoryFilterIdx !== null && editingCategoryFilterIdx >= 0 && editingCategoryFilterIdx < nextInsumos.length) {
        nextInsumos[editingCategoryFilterIdx] = {
          ...nextInsumos[editingCategoryFilterIdx],
          nombreSlot: payload.nombreSlot,
          filtroMaterial: payload.filtroMaterial,
          cantidad: payload.cantidad,
          formula: payload.formula
        };
      } else {
        nextInsumos.push({
          nombreSlot: payload.nombreSlot,
          filtroMaterial: payload.filtroMaterial,
          cantidad: payload.cantidad,
          formula: payload.formula
        });
      }
      return {
        ...prev,
        insumos: nextInsumos
      };
    });
    setEditingCategoryFilterIdx(null);
  };

  useEffect(() => {
    if (editingTarea) {
      const params: ParametroTrabajoTipo[] = editingTarea.parametros && editingTarea.parametros.length > 0
        ? editingTarea.parametros.map(p => ({ ...p, opciones: p.opciones ? [...p.opciones] : undefined }))
        : [
            {
              id: 'cantidad',
              nombre: `Cantidad de ${editingTarea.unidad || 'Unidades'}`,
              tipo: 'numero',
              valorDefault: 1,
              unidad: editingTarea.unidad || 'u'
            }
          ];

      const vars: VariableCalculadaTrabajoTipo[] = editingTarea.variables && editingTarea.variables.length > 0
        ? editingTarea.variables.map(v => ({ ...v }))
        : [];

      setFormData({
        nombre: editingTarea.nombre,
        categoria: editingTarea.categoria || categoriasList[0] || 'Bocas',
        unidad: editingTarea.unidad || 'punto',
        notasTecnicas: editingTarea.notasTecnicas || '',
        clausulaExclusiones: editingTarea.clausulaExclusiones || editingTarea.clausulaTecnicaDefault || '',
        costoFijoOperativo: editingTarea.costoFijoOperativo || 0,
        descripcionCostoFijo: editingTarea.descripcionCostoFijo || '',
        horasSetupTotal: editingTarea.horasSetupTotal ?? 1.0,
        cuadrillaRecomendada: editingTarea.cuadrillaRecomendada || { oficiales: 1, ayudantes: 1 },
        parametros: params,
        variables: vars,
        insumos: editingTarea.insumos ? editingTarea.insumos.map((i) => ({
          ...i,
          formula: i.formula || String(i.cantidad)
        })) : [],
        manoObra: editingTarea.manoObra ? editingTarea.manoObra.map((m) => ({
          ...m,
          formula: m.formula || String(m.horas)
        })) : [],
      });
    } else if (isOpen) {
      setFormData({
        nombre: '',
        categoria: categoriasList[0] || 'Bocas',
        unidad: 'boca',
        notasTecnicas: '',
        clausulaExclusiones: '',
        costoFijoOperativo: 0,
        descripcionCostoFijo: '',
        horasSetupTotal: 1.0,
        cuadrillaRecomendada: { oficiales: 1, ayudantes: 1 },
        parametros: [
          {
            id: 'bocas',
            nombre: 'Cantidad de Bocas',
            tipo: 'numero',
            valorDefault: 1,
            unidad: 'bocas'
          }
        ],
        variables: [],
        insumos: [],
        manoObra: [],
      });
    }
  }, [editingTarea, isOpen, categoriasList]);

  // Scope consolidado: primero parámetros, luego variables evaluadas en cascada
  const currentScope = useMemo(() => {
    const scope: Record<string, number> = {};
    formData.parametros.forEach(p => {
      scope[p.id] = p.valorDefault ?? 1;
    });
    formData.variables.forEach(v => {
      if (v.id) {
        const evalRes = evaluateMathExpression(v.formula || '0', scope);
        scope[v.id] = (evalRes.isValid && evalRes.value !== null) ? evalRes.value : 0;
      }
    });
    return scope;
  }, [formData.parametros, formData.variables]);

  // Helper calculation for live preview
  const liveEvaluation = useMemo(() => {
    const tareaTemp: TareaTipo = {
      id: 'temp-preview',
      nombre: formData.nombre || 'Vista Previa',
      categoria: formData.categoria,
      unidad: formData.unidad,
      parametros: formData.parametros,
      variables: formData.variables,
      costoFijoOperativo: formData.costoFijoOperativo,
      descripcionCostoFijo: formData.descripcionCostoFijo,
      insumos: formData.insumos,
      manoObra: formData.manoObra,
      clausulaExclusiones: formData.clausulaExclusiones
    };

    return calcularConsumosTareaTipo(tareaTemp, currentScope, insumosMap, manoObraMap);
  }, [formData, currentScope, insumosMap, manoObraMap]);

  // Manejo de Insumos desde el Catálogo
  const handleAddMaterialFromPicker = (material: Insumo, cantidad: number, formula?: string) => {
    setFormData((prev) => {
      const targetId = material.id;
      const existingIdx = prev.insumos.findIndex((i) => (i.materialId || i.insumoId) === targetId);
      const defaultParamId = prev.parametros[0]?.id || 'cantidad';
      const formulaGenerada = formula || (cantidad > 0 ? `${defaultParamId} * ${cantidad}` : `${defaultParamId} * 1`);

      if (existingIdx >= 0) {
        const next = [...prev.insumos];
        next[existingIdx] = {
          ...next[existingIdx],
          cantidad: next[existingIdx].cantidad + (cantidad > 0 ? cantidad : 1),
          formula: formulaGenerada
        };
        return { ...prev, insumos: next };
      }

      return {
        ...prev,
        insumos: [
          ...prev.insumos,
          {
            materialId: targetId,
            insumoId: targetId,
            productoId: material.id,
            cantidad: cantidad > 0 ? cantidad : 1,
            formula: formulaGenerada
          }
        ]
      };
    });
    toast.success(`"${material.nombre}" añadido al despiece`);
  };

  const handleAddMultipleMaterialsFromPicker = (materialsWithQty: { material: Insumo; cantidad: number }[]) => {
    setFormData((prev) => {
      const defaultParamId = prev.parametros[0]?.id || 'cantidad';
      const nextInsumos = [...prev.insumos];

      materialsWithQty.forEach(({ material, cantidad }) => {
        const targetId = material.id;
        const existingIdx = nextInsumos.findIndex((i) => (i.materialId || i.insumoId) === targetId);
        const formulaGenerada = `${defaultParamId} * ${cantidad}`;

        if (existingIdx >= 0) {
          nextInsumos[existingIdx] = {
            ...nextInsumos[existingIdx],
            cantidad: nextInsumos[existingIdx].cantidad + cantidad,
            formula: formulaGenerada
          };
        } else {
          nextInsumos.push({
            materialId: targetId,
            insumoId: targetId,
            productoId: material.id,
            cantidad,
            formula: formulaGenerada
          });
        }
      });

      return { ...prev, insumos: nextInsumos };
    });
    toast.success(`${materialsWithQty.length} materiales añadidos al despiece`);
  };

  const removeInsumoRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      insumos: prev.insumos.filter((_, i) => i !== index)
    }));
  };

  // Manejo de Mano de Obra
  const addManoObraRow = () => {
    const availableCat = manoObraList.find(
      (c) => !formData.manoObra.some((m) => m.categoriaId === c.id)
    );
    if (!availableCat) {
      toast.warning('Ya has asignado todas las categorías de mano de obra disponibles.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      manoObra: [
        ...prev.manoObra,
        {
          categoriaId: availableCat.id,
          horas: 1,
          formula: '1'
        }
      ]
    }));
  };

  const removeManoObraRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      manoObra: prev.manoObra.filter((_, i) => i !== index)
    }));
  };

  // Manejo de Parámetros de Entrada
  const addParametro = (preset?: Partial<ParametroTrabajoTipo>) => {
    const baseId = preset?.id || `param_${formData.parametros.length + 1}`;
    let uniqueId = baseId;
    let counter = 1;
    while (formData.parametros.some(p => p.id === uniqueId) || formData.variables.some(v => v.id === uniqueId)) {
      uniqueId = `${baseId}_${counter++}`;
    }

    const newParam: ParametroTrabajoTipo = {
      id: uniqueId,
      nombre: preset?.nombre || 'Nuevo Parámetro',
      tipo: preset?.tipo || 'numero',
      valorDefault: preset?.valorDefault ?? 1,
      unidad: preset?.unidad || '',
      descripcion: preset?.descripcion || '',
      opciones: preset?.opciones ? preset.opciones.map(o => ({ ...o })) : undefined
    };

    setFormData(prev => ({
      ...prev,
      parametros: [...prev.parametros, newParam]
    }));
  };

  const updateParametro = (index: number, updates: Partial<ParametroTrabajoTipo>) => {
    setFormData(prev => {
      const next = [...prev.parametros];
      next[index] = { ...next[index], ...updates };
      return { ...prev, parametros: next };
    });
  };

  const removeParametro = (index: number) => {
    if (formData.parametros.length <= 1) {
      toast.warning('El trabajo tipo debe tener al menos un parámetro de entrada.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      parametros: prev.parametros.filter((_, i) => i !== index)
    }));
  };

  // Manejo de Variables Calculadas Internas
  const addVariable = (preset?: Partial<VariableCalculadaTrabajoTipo>) => {
    const baseId = preset?.id || `var_${formData.variables.length + 1}`;
    let uniqueId = baseId;
    let counter = 1;
    while (formData.variables.some(v => v.id === uniqueId) || formData.parametros.some(p => p.id === uniqueId)) {
      uniqueId = `${baseId}_${counter++}`;
    }

    const defaultParamId = formData.parametros[0]?.id || 'cantidad';
    const newVar: VariableCalculadaTrabajoTipo = {
      id: uniqueId,
      nombre: preset?.nombre || 'Nueva Variable Calculada',
      formula: preset?.formula || `${defaultParamId} * 1`,
      unidad: preset?.unidad || '',
      descripcion: preset?.descripcion || ''
    };

    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, newVar]
    }));
  };

  const updateVariable = (index: number, updates: Partial<VariableCalculadaTrabajoTipo>) => {
    setFormData(prev => {
      const next = [...prev.variables];
      next[index] = { ...next[index], ...updates };
      return { ...prev, variables: next };
    });
  };

  const removeVariable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index)
    }));
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error('El nombre de la tarea es obligatorio');
      return;
    }
    if (formData.parametros.length === 0) {
      toast.error('Debes definir al menos un parámetro de entrada para el trabajo tipo.');
      return;
    }

    // Asegurar que las horas y cantidades reflejen el valor evaluado de sus fórmulas con currentScope
    const updatedManoObra = formData.manoObra.map(mo => {
      if (mo.formula && mo.formula.trim()) {
        const evalRes = evaluateMathExpression(mo.formula, currentScope);
        if (evalRes.isValid && evalRes.value !== null) {
          return { ...mo, horas: evalRes.value };
        }
      }
      return mo;
    });

    const updatedInsumos = formData.insumos.map(ins => {
      if (ins.formula && ins.formula.trim()) {
        const evalRes = evaluateMathExpression(ins.formula, currentScope);
        if (evalRes.isValid && evalRes.value !== null) {
          return { ...ins, cantidad: evalRes.value };
        }
      }
      return ins;
    });

    await onSave({
      ...formData,
      insumos: updatedInsumos,
      manoObra: updatedManoObra
    });
    onClose();
  };

  return (
    <>
      <ModalContainer
        isOpen={isOpen}
        onClose={onClose}
        title={titleOverride || (editingTarea ? 'Editar Trabajo Tipo Paramétrico' : 'Crear Nuevo Trabajo Tipo Paramétrico')}
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 1. Datos Generales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wide mb-1">
                Nombre de la Tarea / Trabajo Tipo *
              </label>
              <input
                type="text"
                required
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className={inputCls}
                placeholder="Ej: Recableado Integral de Circuito, Boca de Iluminación..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Categoría</label>
              <select
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className={`${inputCls} capitalize`}
              >
                {categoriasList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Unidad de Medida del Ítem (Presupuesto/Obra)
              </label>
              <input
                type="text"
                value={formData.unidad}
                onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                className={inputCls}
                placeholder="ej: depto, tablero, boca, m, global, u"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Notas / Especificaciones Técnicas</label>
              <input
                type="text"
                value={formData.notasTecnicas}
                onChange={(e) => setFormData({ ...formData, notasTecnicas: e.target.value })}
                className={inputCls}
                placeholder="Especificaciones norma IRAM o montaje"
              />
            </div>
          </div>

          {/* 2. Parámetros de Entrada (Inputs del Usuario) */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  <span>2. Parámetros de Entrada (Inputs del Usuario al Cotizar)</span>
                </h4>
                <p className="text-[11px] text-on-surface-variant">
                  Define los datos que se le solicitarán al usuario al cotizar en el presupuesto. Las usarás por su nombre (<code className="font-mono text-primary font-bold">bocas</code>, <code className="font-mono text-primary font-bold">circuitos</code>, etc.) en las fórmulas.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => addParametro()}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Agregar Parámetro</span>
                </button>
              </div>
            </div>

            {/* Listado de Parámetros */}
            <div className="space-y-3">
              {formData.parametros.map((parametro, idx) => (
                <div
                  key={idx}
                  className="p-3 sm:p-3.5 bg-surface-container-highest/60 border border-outline-variant/25 rounded-2xl space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-0.5">
                        Identificador
                      </label>
                      <div className="flex items-center gap-1 bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-primary/40">
                        <code className="text-xs font-mono font-bold text-primary">$</code>
                        <input
                          type="text"
                          required
                          value={parametro.id}
                          onChange={(e) => updateParametro(idx, { id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                          className="w-full bg-transparent text-xs font-mono font-bold text-primary focus:outline-none"
                          placeholder="ej: bocas, sup, k_estado"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-0.5">
                        Nombre Visible
                      </label>
                      <input
                        type="text"
                        required
                        value={parametro.nombre}
                        onChange={(e) => updateParametro(idx, { nombre: e.target.value })}
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="ej: Cantidad de Bocas"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:col-span-4 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-0.5">
                          Tipo
                        </label>
                        <select
                          value={parametro.tipo}
                          onChange={(e) => updateParametro(idx, {
                            tipo: e.target.value as any,
                            opciones: e.target.value === 'select' && (!parametro.opciones || parametro.opciones.length === 0)
                              ? [
                                  { id: 'opt-1', label: 'Estándar (1.00x)', valor: 1.0 },
                                  { id: 'opt-2', label: 'Complejo (1.25x)', valor: 1.25 }
                                ]
                              : parametro.opciones
                          })}
                          className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2 py-1.5 text-xs text-on-surface focus:outline-none"
                        >
                          <option value="numero">Número</option>
                          <option value="select">Opciones</option>
                          <option value="boolean">Switch (Sí/No)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-0.5">
                          Default
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={parametro.valorDefault}
                          onChange={(e) => updateParametro(idx, { valorDefault: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeParametro(idx)}
                        className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition"
                        title="Eliminar parámetro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Editor de Opciones si es Selector */}
                  {parametro.tipo === 'select' && (
                    <div className="p-2.5 bg-surface-container rounded-xl border border-outline-variant/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase">
                          Opciones y Multiplicadores de "{parametro.nombre}":
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const current = parametro.opciones || [];
                            updateParametro(idx, {
                              opciones: [
                                ...current,
                                { id: `opt-${current.length + 1}`, label: `Opción ${current.length + 1}`, valor: 1.0 }
                              ]
                            });
                          }}
                          className="text-[10px] text-primary font-bold hover:underline"
                        >
                          + Agregar Opción
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {(parametro.opciones || []).map((opc, opcIdx) => (
                          <div key={opcIdx} className="flex items-center gap-1 bg-surface-container-highest p-1.5 rounded-lg border border-outline-variant/20">
                            <input
                              type="text"
                              value={opc.label}
                              onChange={(e) => {
                                const nextOpc = [...(parametro.opciones || [])];
                                nextOpc[opcIdx] = { ...nextOpc[opcIdx], label: e.target.value };
                                updateParametro(idx, { opciones: nextOpc });
                              }}
                              className="w-full bg-transparent text-xs text-on-surface focus:outline-none"
                              placeholder="Etiqueta"
                            />
                            <input
                              type="number"
                              step="0.05"
                              value={opc.valor}
                              onChange={(e) => {
                                const nextOpc = [...(parametro.opciones || [])];
                                nextOpc[opcIdx] = { ...nextOpc[opcIdx], valor: parseFloat(e.target.value) || 0 };
                                updateParametro(idx, { opciones: nextOpc });
                              }}
                              className="w-16 bg-surface-container text-xs font-mono font-bold text-primary text-center rounded px-1 py-0.5 focus:outline-none"
                              title="Multiplicador numérico"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const nextOpc = (parametro.opciones || []).filter((_, i) => i !== opcIdx);
                                updateParametro(idx, { opciones: nextOpc });
                              }}
                              className="text-on-surface-variant hover:text-error p-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3. Variables de Cálculo Interno (Fórmulas Matemáticas) */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <VariableIcon className="w-4 h-4" />
                  <span>3. Variables de Cálculo Interno (Fórmulas Matemáticas)</span>
                </h4>
                <p className="text-[11px] text-on-surface-variant">
                  Cálculos automáticos con fórmulas y funciones (<code className="font-mono text-emerald-700 dark:text-emerald-300">ceil</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">floor</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">round</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">int</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">min</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">max</code>).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => addVariable()}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl transition flex items-center gap-1 border border-emerald-500/25"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Agregar Variable</span>
                </button>
              </div>
            </div>

            {/* Listado de Variables Calculadas */}
            {formData.variables.length === 0 ? (
              <div className="p-3 bg-surface-container-highest/30 border border-dashed border-outline-variant/30 rounded-2xl text-center">
                <p className="text-[11px] text-on-surface-variant">
                  No hay variables calculadas definidas. Puedes agregar fórmulas matemáticas para evitar repetir cálculos en los materiales o mano de obra.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.variables.map((variable, idx) => {
                  const evalRes = evaluateMathExpression(variable.formula, currentScope);
                  const valCalc = evalRes.isValid && evalRes.value !== null ? evalRes.value : 0;

                  return (
                    <div
                      key={idx}
                      className="p-3 sm:p-3.5 bg-surface-container-highest/60 border border-emerald-500/25 rounded-2xl space-y-2.5"
                    >
                      {/* Fila Superior: Identificador, Nombre, Unidad y Botón Eliminar */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                        {/* Identificador */}
                        <div className="w-full sm:w-44 shrink-0">
                          <label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block uppercase mb-0.5">
                            Identificador
                          </label>
                          <div className="flex items-center gap-1 bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/40">
                            <code className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-300">⚡$</code>
                            <input
                              type="text"
                              required
                              value={variable.id}
                              onChange={(e) => updateVariable(idx, { id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                              className="w-full bg-transparent text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 focus:outline-none"
                              placeholder="id_variable"
                            />
                          </div>
                        </div>

                        {/* Nombre Descriptivo */}
                        <div className="flex-1 min-w-[140px]">
                          <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-0.5">
                            Nombre Descriptivo
                          </label>
                          <input
                            type="text"
                            required
                            value={variable.nombre}
                            onChange={(e) => updateVariable(idx, { nombre: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                            placeholder="ej: Módulos DIN Requeridos"
                          />
                        </div>

                        {/* Unidad */}
                        <div className="w-20 shrink-0">
                          <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-0.5 text-center">
                            Unidad
                          </label>
                          <input
                            type="text"
                            value={variable.unidad || ''}
                            onChange={(e) => updateVariable(idx, { unidad: e.target.value })}
                            className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2 py-1.5 text-xs font-mono text-center text-on-surface focus:outline-none"
                            placeholder="m, u, hs"
                          />
                        </div>

                        {/* Botón Eliminar */}
                        <div className="self-end sm:self-center pt-3 sm:pt-4">
                          <button
                            type="button"
                            onClick={() => removeVariable(idx)}
                            className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition"
                            title="Eliminar variable calculada"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Fila Inferior: Editor de Fórmula de Ancho Completo */}
                      <div className="pt-1 border-t border-emerald-500/15">
                        <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-1 flex items-center justify-between">
                          <span>Fórmula Matemática / Condicional</span>
                          <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 normal-case hidden sm:inline">
                            Soporta +, -, *, /, %, ^, cond ? a : b, ==, !=, &lt;, &gt;, &lt;=, &gt;=, si, ceil, round...
                          </span>
                        </label>
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2 bg-surface-container border border-outline-variant/30 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-primary/50">
                          <FormulaInput
                            value={variable.formula}
                            onChange={(val) => updateVariable(idx, { formula: val })}
                            placeholder="ej: 4 + ceil(circuitos / 2) * 2"
                            parametros={formData.parametros}
                            variables={formData.variables.slice(0, idx)}
                            required
                          />
                          <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 px-1 border-t sm:border-t-0 border-outline-variant/15 pt-1 sm:pt-0 sm:mt-1">
                            <span className="text-[10px] text-on-surface-variant font-medium sm:hidden">Resultado:</span>
                            <span
                              className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                                evalRes.isValid
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-error/15 text-error'
                              }`}
                              title={evalRes.isValid ? "Resultado evaluado en tiempo real" : "Fórmula inválida o incompleta"}
                            >
                              {evalRes.isValid ? `= ${valCalc} ${variable.unidad || ''}` : '⚠️ Error sintaxis'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Despiece de Insumos & Materiales con Fórmulas */}
          <div className="space-y-3 border-t border-outline-variant/30 pt-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  <span>4. Despiece de Insumos & Materiales (con Fórmulas)</span>
                </h4>
                <p className="text-[11px] text-on-surface-variant">
                  Agrega materiales directos del catálogo o ranuras dinámicas que seleccionen automáticamente por categoría y parámetros.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMaterialPickerOpen(true)}
                  className="px-3 py-1.5 bg-surface-container-highest hover:bg-surface-container-highest/80 text-on-surface font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-outline-variant/30"
                  title="Seleccionar un material puntual fijo del catálogo"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Material Directo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategoryFilterIdx(null);
                    setIsCategoryFilterModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-primary/25 shadow-2xs"
                  title="Definir una ranura que elija materiales según categoría y parámetros/variables"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>+ Agregar por Categoría</span>
                </button>
              </div>
            </div>

            {/* Chips de variables disponibles para fórmulas */}
            {(formData.parametros.length > 0 || formData.variables.length > 0) && (
              <div className="flex flex-wrap items-center gap-1 px-1 text-[11px] text-on-surface-variant">
                <span className="font-semibold text-[10px] uppercase">Variables disponibles:</span>
                {formData.parametros.map((p) => (
                  <span key={p.id} className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    ${p.id}
                  </span>
                ))}
                {formData.variables.map((v) => (
                  <span key={v.id} className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    ⚡${v.id}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {formData.insumos.length === 0 ? (
                <div
                  onClick={() => setIsMaterialPickerOpen(true)}
                  className="text-center py-6 px-4 border-2 border-dashed border-outline-variant/30 rounded-2xl bg-surface-container-low cursor-pointer hover:border-primary/50 transition"
                >
                  <Package className="w-7 h-7 text-outline-variant mx-auto mb-1" />
                  <p className="text-xs font-bold text-on-surface">Sin materiales asignados</p>
                  <p className="text-[11px] text-primary mt-0.5">+ Toca para agregar materiales directos o por categoría</p>
                </div>
              ) : (
                formData.insumos.map((item, idx) => {
                  let resolvedId = item.materialId || item.insumoId || '';
                  let matchingRuleName = '';
                  const isDynamic = Boolean(item.reglasDinamicas && item.reglasDinamicas.length > 0);
                  const isCategoryFilter = Boolean(item.filtroMaterial);

                  if (isCategoryFilter && item.filtroMaterial) {
                    const resolved = resolverMaterialPorFiltro(item.filtroMaterial, currentScope, insumosMap);
                    if (resolved) {
                      resolvedId = resolved.id;
                      matchingRuleName = resolved.nombre;
                    } else {
                      resolvedId = '';
                    }
                  } else if (isDynamic && item.reglasDinamicas) {
                    const match = item.reglasDinamicas.find(r => !r.condicion || evaluateCondition(r.condicion, currentScope));
                    if (match) {
                      resolvedId = match.materialId;
                      matchingRuleName = match.descripcion || '';
                    } else {
                      resolvedId = '';
                    }
                  }

                  const selectedMat = insumosMap.get(resolvedId);
                  const unitPrice = selectedMat?.precioActual || 0;
                  const unit = selectedMat?.unidadVenta || selectedMat?.unidad || 'u';

                  // Live evaluation of formula
                  const formulaStr = item.formula || String(item.cantidad);
                  const evalRes = evaluateMathExpression(formulaStr, currentScope);
                  const cantEvaluada = evalRes.isValid && evalRes.value !== null ? evalRes.value : item.cantidad;
                  const isConditionMet = (!item.condicion || evaluateCondition(item.condicion, currentScope)) && ((isDynamic || isCategoryFilter) ? Boolean(resolvedId) : true);
                  const rowSubtotal = unitPrice * (isConditionMet ? cantEvaluada : 0);

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border transition space-y-2 ${
                        isConditionMet
                          ? 'bg-surface-container-low border-outline-variant/20 hover:border-outline-variant/40'
                          : 'bg-surface-container-low/40 border-dashed border-outline-variant/30 opacity-75'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-variant text-on-surface-variant font-mono">
                              #{idx + 1}
                            </span>
                            {isCategoryFilter ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono flex items-center gap-1">
                                <span>⚡ Por Categoría: {item.nombreSlot || item.filtroMaterial?.etiqueta || 'Dinámico'}</span>
                              </span>
                            ) : isDynamic ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-mono flex items-center gap-1">
                                <span>⚡ Slot: {item.nombreSlot || 'Dinámico'}</span>
                              </span>
                            ) : null}
                            <h5 className="text-xs font-bold text-on-surface truncate">
                              {selectedMat?.nombre || (isDynamic || isCategoryFilter ? '(Sin coincidencia para parámetros)' : resolvedId)}
                            </h5>
                          </div>
                          <div className="text-[11px] text-on-surface-variant font-mono flex items-center gap-2">
                            <span>Unit: {formatARS(unitPrice)}</span>
                            <span>•</span>
                            <span className={`font-bold ${isConditionMet ? 'text-primary' : 'text-on-surface-variant line-through'}`}>
                              Consumo: {cantEvaluada} {unit} = {formatARS(rowSubtotal)}
                            </span>
                          </div>
                        </div>

                        {/* Formula Input */}
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end min-w-0">
                          <div className="flex items-center gap-1.5 bg-surface-container-highest px-3 py-1.5 rounded-xl border border-outline-variant/30 flex-1 sm:flex-initial sm:w-64 min-w-0">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase shrink-0">Fórmula:</span>
                            <FormulaInput
                              value={item.formula || ''}
                              onChange={(newFormula) => {
                                const next = [...formData.insumos];
                                const res = evaluateMathExpression(newFormula, currentScope);
                                next[idx] = {
                                  ...next[idx],
                                  formula: newFormula,
                                  cantidad: res.isValid && res.value !== null ? res.value : next[idx].cantidad
                                };
                                setFormData({ ...formData, insumos: next });
                              }}
                              parametros={formData.parametros}
                              variables={formData.variables}
                              showChips={false}
                              placeholder="ej: bocas * 12"
                              className="w-full"
                            />
                            <span className="text-xs font-mono font-bold text-on-surface bg-surface-container px-2 py-0.5 rounded-md shrink-0">
                              = {cantEvaluada} {unit}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeInsumoRow(idx)}
                            className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition shrink-0"
                            title="Quitar material"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Regla Condicional de Inclusión Opcional o Info de Slot */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-outline-variant/15 text-[11px]">
                        {isCategoryFilter ? (
                          <div className="flex items-center justify-between gap-2 w-full flex-wrap">
                            <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant flex-wrap min-w-0">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300">Criterios:</span>
                              <span className="font-mono text-[10px] bg-surface-container px-2 py-0.5 rounded-md break-all">
                                {item.filtroMaterial?.criterios?.map(c => `${c.atributo} ${c.operador} ${c.valor}`).join(' • ')}
                              </span>
                              {matchingRuleName && (
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md truncate max-w-xs">
                                  ✓ {matchingRuleName}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryFilterIdx(idx);
                                setIsCategoryFilterModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-xl transition flex items-center gap-1.5 shrink-0 active:scale-95"
                              title="Editar reglas y criterios del material por categoría"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                              <span>Editar Criterios</span>
                            </button>
                          </div>
                        ) : isDynamic ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                            <span className="font-semibold text-primary">Reglas ({item.reglasDinamicas?.length || 0}):</span>
                            <span className="font-mono text-[10px] bg-surface-container px-2 py-0.5 rounded-md">
                              {matchingRuleName ? `Activo: ${matchingRuleName}` : 'Ninguna activa'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-surface-container-highest/80 px-2.5 py-1 rounded-xl border border-outline-variant/25 w-full sm:w-auto min-w-0 sm:min-w-[240px]">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase shrink-0">Condición:</span>
                            <FormulaInput
                              value={item.condicion || ''}
                              onChange={(newCond) => {
                                const next = [...formData.insumos];
                                next[idx] = { ...next[idx], condicion: newCond };
                                setFormData({ ...formData, insumos: next });
                              }}
                              parametros={formData.parametros}
                              variables={formData.variables}
                              showChips={false}
                              isCondition={true}
                              placeholder="Siempre (o ej: calibre_principal <= 25)"
                              className="w-full"
                            />
                          </div>
                        )}
                        {item.condicion !== undefined && item.condicion !== null && item.condicion.trim() !== '' && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isConditionMet
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}>
                            {isConditionMet ? '✓ Incluido' : '⚡ Omitido según parámetros'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 5. Mano de Obra con Fórmulas (Material Design 3 Card Layout) */}
          <div className="space-y-3.5 border-t border-outline-variant/30 pt-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>5. Horas de Mano de Obra (con Fórmulas)</span>
                </h4>
                <p className="text-[11px] text-on-surface-variant">
                  Escribe la fórmula para calcular las horas de cada categoría de mano de obra (ej: <code className="font-mono text-primary font-bold">horas_oficial</code> o <code className="font-mono text-primary font-bold">(bocas * 1.5) * k_complejidad</code>).
                </p>
              </div>
              <button
                type="button"
                onClick={addManoObraRow}
                className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-primary/25 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar Rol MO</span>
              </button>
            </div>

            {/* Configuración de Setup y Cuadrilla para Planificador de Sinergia */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/20">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Horas Alistamiento / Setup
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.horasSetupTotal ?? 1.0}
                  onChange={(e) => setFormData({ ...formData, horasSetupTotal: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-on-surface focus:ring-2 focus:ring-primary/50"
                  placeholder="ej: 1.0"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Cuadrilla: Oficiales
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.cuadrillaRecomendada?.oficiales ?? 1}
                  onChange={(e) => setFormData({
                    ...formData,
                    cuadrillaRecomendada: {
                      oficiales: parseInt(e.target.value) || 0,
                      ayudantes: formData.cuadrillaRecomendada?.ayudantes ?? 1
                    }
                  })}
                  className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-on-surface focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Cuadrilla: Ayudantes
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.cuadrillaRecomendada?.ayudantes ?? 1}
                  onChange={(e) => setFormData({
                    ...formData,
                    cuadrillaRecomendada: {
                      oficiales: formData.cuadrillaRecomendada?.oficiales ?? 1,
                      ayudantes: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-on-surface focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="space-y-3">
              {formData.manoObra.length === 0 ? (
                <div
                  onClick={addManoObraRow}
                  className="text-center py-8 px-4 border-2 border-dashed border-outline-variant/30 rounded-3xl bg-surface-container-low cursor-pointer hover:border-primary/50 transition-colors group"
                >
                  <Clock className="w-8 h-8 text-outline-variant mx-auto mb-2 group-hover:text-primary transition-colors" />
                  <p className="text-sm font-bold text-on-surface">Sin mano de obra asignada</p>
                  <p className="text-xs text-primary mt-1 font-medium">+ Toca aquí para agregar roles de mano de obra</p>
                </div>
              ) : (
                formData.manoObra.map((item, idx) => {
                  const cat = manoObraMap.get(item.categoriaId);
                  const rate = cat?.costoHora || 0;

                  // Live evaluation of formula
                  const formulaStr = item.formula && item.formula.trim() ? item.formula : String(item.horas);
                  const evalRes = evaluateMathExpression(formulaStr, currentScope);
                  const horasEvaluadas = evalRes.isValid && evalRes.value !== null
                    ? evalRes.value
                    : (parseFloat(formulaStr) || item.horas || 0);
                  const isConditionMet = !item.condicion || item.condicion.trim() === '' || evaluateCondition(item.condicion, currentScope);
                  const rowSubtotal = rate * (isConditionMet ? horasEvaluadas : 0);

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        isConditionMet
                          ? 'bg-surface-container-low border-outline-variant/30 hover:border-outline-variant/50 shadow-xs'
                          : 'bg-surface-container-low/40 border-dashed border-outline-variant/30 opacity-75'
                      }`}
                    >
                      {/* Header de la Tarjeta: Selector de Rol + Chip de Tarifa + Botón Eliminar */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 min-w-0">
                          <div className="flex-1 min-w-[180px]">
                            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                              Rol de Mano de Obra
                            </label>
                            <select
                              value={item.categoriaId}
                              onChange={(e) => {
                                const next = [...formData.manoObra];
                                next[idx] = { ...next[idx], categoriaId: e.target.value };
                                setFormData({ ...formData, manoObra: next });
                              }}
                              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                              {manoObraList.map((mo) => (
                                <option key={mo.id} value={mo.id}>
                                  {mo.nombre} ({formatARS(mo.costoHora)}/h)
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="shrink-0 pt-0 sm:pt-4">
                            <span className="inline-flex items-center px-2.5 py-1.5 rounded-xl bg-surface-container-highest border border-outline-variant/30 text-[11px] font-mono text-on-surface-variant">
                              Tarifa: <strong className="ml-1 text-on-surface">{formatARS(rate)}/h</strong>
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeManoObraRow(idx)}
                          className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition self-end sm:self-center shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center"
                          title="Quitar rol de mano de obra"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Input de Fórmula de Horas (Ancho Completo con Chips) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-on-surface flex items-center gap-1.5">
                            <Calculator className="w-3.5 h-3.5 text-primary" />
                            <span>Fórmula de cálculo de horas</span>
                          </label>
                          <span className="text-[10px] text-on-surface-variant font-mono">
                            Fórmula o valor numérico
                          </span>
                        </div>

                        <div className="bg-surface-container-highest rounded-xl p-2.5 border border-outline-variant/30 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                          <FormulaInput
                            value={item.formula || ''}
                            onChange={(newFormula) => {
                              const next = [...formData.manoObra];
                              const res = evaluateMathExpression(newFormula, currentScope);
                              next[idx] = {
                                ...next[idx],
                                formula: newFormula,
                                horas: res.isValid && res.value !== null ? res.value : (parseFloat(newFormula) || next[idx].horas)
                              };
                              setFormData({ ...formData, manoObra: next });
                            }}
                            parametros={formData.parametros}
                            variables={formData.variables}
                            showChips={true}
                            placeholder="ej: horas_oficial o 1.0 + bocas * 1.5"
                          />
                        </div>
                      </div>

                      {/* Footer: Live Evaluation & Regla Condicional Opcional */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/20">
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 min-w-0">
                          {item.condicion !== undefined && item.condicion !== null ? (
                            <div className="flex items-center gap-1.5 bg-surface-container-highest/80 px-2.5 py-1 rounded-xl border border-outline-variant/25 flex-1 max-w-md min-w-0">
                              <span className="text-[10px] font-bold text-on-surface-variant uppercase shrink-0">Condición:</span>
                              <FormulaInput
                                value={item.condicion || ''}
                                onChange={(newCond) => {
                                  const next = [...formData.manoObra];
                                  next[idx] = { ...next[idx], condicion: newCond };
                                  setFormData({ ...formData, manoObra: next });
                                }}
                                parametros={formData.parametros}
                                variables={formData.variables}
                                showChips={false}
                                isCondition={true}
                                placeholder="ej: requiere_certificacion == 1"
                                className="w-full"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...formData.manoObra];
                                  next[idx] = { ...next[idx], condicion: undefined };
                                  setFormData({ ...formData, manoObra: next });
                                }}
                                className="text-on-surface-variant hover:text-error p-1 rounded-lg transition shrink-0"
                                title="Quitar condición"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...formData.manoObra];
                                next[idx] = { ...next[idx], condicion: '' };
                                setFormData({ ...formData, manoObra: next });
                              }}
                              className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 transition"
                            >
                              <span>+ Añadir condición de inclusión</span>
                            </button>
                          )}

                          {item.condicion !== undefined && item.condicion !== null && item.condicion.trim() !== '' && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                              isConditionMet
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}>
                              {isConditionMet ? '✓ Incluido' : '⚡ Omitido según condición'}
                            </span>
                          )}
                        </div>

                        {/* Indicador de Horas y Subtotal en Vivo */}
                        <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-xl border border-outline-variant/30 shrink-0">
                          <span className="text-xs font-mono text-on-surface-variant">
                            Horas: <strong className="text-on-surface">{horasEvaluadas} hs</strong>
                          </span>
                          <span className="text-outline-variant">•</span>
                          <span className={`text-xs font-mono font-bold ${isConditionMet ? 'text-primary' : 'text-on-surface-variant line-through'}`}>
                            Subtotal: {formatARS(rowSubtotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 6. Cláusula Técnica & Exclusiones de Obra */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wide flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>6. Cláusula Técnica & Exclusiones de Obra (Sugerida para Presupuestos)</span>
              </label>
              {!formData.clausulaExclusiones && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, clausulaExclusiones: DEFAULT_CLAUSULA_OBRA_EXISTENTE })}
                  className="text-[10px] text-primary font-bold hover:underline"
                >
                  Insertar texto sugerido
                </button>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Texto que se insertará en el presupuesto para delimitar el alcance, exclusiones (ej: cañerías tapadas, losas) y resguardos legales.
            </p>
            <textarea
              rows={3}
              value={formData.clausulaExclusiones || ''}
              onChange={(e) => setFormData({ ...formData, clausulaExclusiones: e.target.value })}
              className={`${inputCls} text-xs leading-relaxed`}
              placeholder="Ej: La cotización contempla el reemplazo a través de canalizaciones transitables..."
            />
          </div>

          {/* Live Preview Cost Box */}
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-primary uppercase tracking-wide flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5" />
                <span>Costo Directo Calculado con Valores por Defecto</span>
              </span>
              <div className="text-xl font-black font-mono text-on-surface mt-0.5">
                {formatARS(liveEvaluation.costoDirectoTotal)}
              </div>
            </div>
            <div className="text-left sm:text-right font-mono text-[11px] text-on-surface-variant">
              <div>Insumos: <strong className="text-on-surface">{formatARS(liveEvaluation.costoInsumosTotal)}</strong></div>
              <div>
                Mano de Obra:{' '}
                <strong className="text-on-surface">
                  {liveEvaluation.manoObraSnapshot.reduce((acc, m) => acc + m.horasTotales, 0)} hs ({formatARS(liveEvaluation.costoManoObraTotal)})
                </strong>
              </div>
              {liveEvaluation.costoFijoOperativo > 0 && (
                <div>Base Fija Operativa: <strong className="text-primary">{formatARS(liveEvaluation.costoFijoOperativo)}</strong></div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-outline-variant/30 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-variant text-center min-h-[40px] flex items-center justify-center"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 sm:py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs shadow-sm active:scale-95 transition min-h-[40px]"
            >
              <Save className="w-4 h-4" />
              <span>{submitButtonText || 'Guardar Trabajo Tipo'}</span>
            </button>
          </div>
        </form>
      </ModalContainer>

      {/* Dedicated Material Picker Modal (M3) */}
      <MaterialPickerModal
        isOpen={isMaterialPickerOpen}
        onClose={() => setIsMaterialPickerOpen(false)}
        insumosMap={insumosMap}
        alreadySelectedIds={formData.insumos.map((i) => i.materialId || i.insumoId || '')}
        onAddMaterial={handleAddMaterialFromPicker}
        onAddMultipleMaterials={handleAddMultipleMaterialsFromPicker}
      />

      {/* Parametric Category Filter Material Modal */}
      <CategoryFilterMaterialModal
        isOpen={isCategoryFilterModalOpen}
        onClose={() => {
          setIsCategoryFilterModalOpen(false);
          setEditingCategoryFilterIdx(null);
        }}
        parametros={formData.parametros}
        variables={formData.variables}
        currentScope={currentScope}
        insumosMap={insumosMap}
        initialData={
          editingCategoryFilterIdx !== null &&
          formData.insumos[editingCategoryFilterIdx] &&
          formData.insumos[editingCategoryFilterIdx].filtroMaterial
            ? {
                nombreSlot: formData.insumos[editingCategoryFilterIdx].nombreSlot || '',
                filtroMaterial: formData.insumos[editingCategoryFilterIdx].filtroMaterial!,
                cantidad: formData.insumos[editingCategoryFilterIdx].cantidad,
                formula: formData.insumos[editingCategoryFilterIdx].formula
              }
            : null
        }
        onSaveCategoryFilter={handleSaveCategoryFilter}
      />
    </>
  );
};

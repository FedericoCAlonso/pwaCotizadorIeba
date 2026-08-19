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
  ChevronUp
} from 'lucide-react';
import {
  TareaTipo,
  Insumo,
  CategoriaManoDeObra,
  InsumoEnTarea,
  ManoObraEnTarea,
  VariableTrabajoTipo,
  OpcionVariableTrabajo
} from '../../core/types';
import {
  calcularConsumosTareaTipo,
  formatARS,
  DEFAULT_CLAUSULA_OBRA_EXISTENTE
} from '../../core/calculations';
import { evaluateMathExpression } from '../../core/mathEvaluator';
import { ModalContainer } from '../ModalContainer';
import { useToast } from '../../contexts/ToastContext';
import { MaterialPickerModal } from './MaterialPickerModal';

export interface TareaFormData {
  nombre: string;
  categoria: string;
  unidad: string;
  notasTecnicas: string;
  clausulaExclusiones?: string;
  costoFijoOperativo?: number;
  descripcionCostoFijo?: string;
  variables: VariableTrabajoTipo[];
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
    variables: [],
    insumos: [],
    manoObra: [],
  });

  const [isMaterialPickerOpen, setIsMaterialPickerOpen] = useState(false);
  const [editingVarIndex, setEditingVarIndex] = useState<number | null>(null);

  useEffect(() => {
    if (editingTarea) {
      // Si la tarea tenía variables las cargamos, o inferimos la variable básica si no las tenía
      const vars: VariableTrabajoTipo[] = editingTarea.variables && editingTarea.variables.length > 0
        ? editingTarea.variables.map(v => ({ ...v, opciones: v.opciones ? [...v.opciones] : undefined }))
        : [
            {
              id: 'cantidad',
              nombre: `Cantidad de ${editingTarea.unidad || 'Unidades'}`,
              tipo: 'numero',
              valorDefault: 1,
              unidad: editingTarea.unidad || 'u'
            }
          ];

      setFormData({
        nombre: editingTarea.nombre,
        categoria: editingTarea.categoria || categoriasList[0] || 'Bocas',
        unidad: editingTarea.unidad || 'punto',
        notasTecnicas: editingTarea.notasTecnicas || '',
        clausulaExclusiones: editingTarea.clausulaExclusiones || editingTarea.clausulaTecnicaDefault || '',
        costoFijoOperativo: editingTarea.costoFijoOperativo || 0,
        descripcionCostoFijo: editingTarea.descripcionCostoFijo || '',
        variables: vars,
        insumos: editingTarea.insumos ? editingTarea.insumos.map((i) => ({
          ...i,
          formula: i.formula || (vars[0] ? `${vars[0].id} * ${i.cantidad}` : String(i.cantidad))
        })) : [],
        manoObra: editingTarea.manoObra ? editingTarea.manoObra.map((m) => ({
          ...m,
          formula: m.formula || (vars[0] ? `${vars[0].id} * ${m.horas}` : String(m.horas))
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
        variables: [
          {
            id: 'bocas',
            nombre: 'Cantidad de Bocas',
            tipo: 'numero',
            valorDefault: 1,
            unidad: 'bocas'
          }
        ],
        insumos: [],
        manoObra: [],
      });
    }
  }, [editingTarea, isOpen, categoriasList]);

  // Current scope with default values for live evaluations
  const currentScope = useMemo(() => {
    const scope: Record<string, number> = {};
    formData.variables.forEach(v => {
      scope[v.id] = v.valorDefault ?? 1;
    });
    return scope;
  }, [formData.variables]);

  // Helper calculation for live preview
  const liveEvaluation = useMemo(() => {
    const tareaTemp: TareaTipo = {
      id: 'temp-preview',
      nombre: formData.nombre || 'Vista Previa',
      categoria: formData.categoria,
      unidad: formData.unidad,
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
      const defaultVarId = prev.variables[0]?.id || 'cantidad';
      const formulaGenerada = formula || (cantidad > 0 ? `${defaultVarId} * ${cantidad}` : `${defaultVarId} * 1`);

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
      const defaultVarId = prev.variables[0]?.id || 'cantidad';
      const nextInsumos = [...prev.insumos];

      materialsWithQty.forEach(({ material, cantidad }) => {
        const targetId = material.id;
        const existingIdx = nextInsumos.findIndex((i) => (i.materialId || i.insumoId) === targetId);
        const formulaGenerada = `${defaultVarId} * ${cantidad}`;

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
    const defaultVarId = formData.variables[0]?.id || 'cantidad';
    setFormData((prev) => ({
      ...prev,
      manoObra: [
        ...prev.manoObra,
        {
          categoriaId: availableCat.id,
          horas: 1,
          formula: `${defaultVarId} * 1`
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

  // Manejo de Variables
  const addVariable = (preset?: Partial<VariableTrabajoTipo>) => {
    const baseId = preset?.id || `var_${formData.variables.length + 1}`;
    let uniqueId = baseId;
    let counter = 1;
    while (formData.variables.some(v => v.id === uniqueId)) {
      uniqueId = `${baseId}_${counter++}`;
    }

    const newVar: VariableTrabajoTipo = {
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
      variables: [...prev.variables, newVar]
    }));
  };

  const updateVariable = (index: number, updates: Partial<VariableTrabajoTipo>) => {
    setFormData(prev => {
      const next = [...prev.variables];
      next[index] = { ...next[index], ...updates };
      return { ...prev, variables: next };
    });
  };

  const removeVariable = (index: number) => {
    if (formData.variables.length <= 1) {
      toast.warning('El trabajo tipo debe tener al menos una variable o parámetro.');
      return;
    }
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
    if (formData.variables.length === 0) {
      toast.error('Debes definir al menos una variable para el trabajo tipo.');
      return;
    }

    await onSave(formData);
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
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Unidad de Salida</label>
              <input
                type="text"
                value={formData.unidad}
                onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                className={inputCls}
                placeholder="boca, m, tablero, u"
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

          {/* 2. Parámetros / Variables de Entrada */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  <span>2. Parámetros & Variables de Entrada del Trabajo</span>
                </h4>
                <p className="text-[11px] text-on-surface-variant">
                  Define las variables que se ingresarán al cotizar. Las usarás por su nombre (<code className="font-mono text-primary font-bold">bocas</code>, <code className="font-mono text-primary font-bold">k_estado</code>, etc.) en las fórmulas de abajo.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => addVariable()}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Agregar Variable</span>
                </button>
              </div>
            </div>

            {/* Presets Rápidos de Variables */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-on-surface-variant font-semibold">Presets rápidos:</span>
              <button
                type="button"
                onClick={() => addVariable({ id: 'sup_m2', nombre: 'Superficie (m²)', tipo: 'numero', valorDefault: 70, unidad: 'm²' })}
                className="px-2 py-0.5 bg-surface-container-highest hover:bg-surface-variant text-[11px] text-on-surface rounded-lg border border-outline-variant/20 transition"
              >
                + Superficie (m²)
              </button>
              <button
                type="button"
                onClick={() => addVariable({
                  id: 'k_estado',
                  nombre: 'Antigüedad / Estado',
                  tipo: 'select',
                  valorDefault: 1.25,
                  opciones: [
                    { id: 'opt-1', label: 'Moderna (1.00x)', valor: 1.0 },
                    { id: 'opt-2', label: 'Intermedia (1.25x)', valor: 1.25 },
                    { id: 'opt-3', label: 'Antigua (1.60x)', valor: 1.6 }
                  ]
                })}
                className="px-2 py-0.5 bg-surface-container-highest hover:bg-surface-variant text-[11px] text-on-surface rounded-lg border border-outline-variant/20 transition"
              >
                + Coef. Antigüedad
              </button>
              <button
                type="button"
                onClick={() => addVariable({
                  id: 'k_altura',
                  nombre: 'Altura de Trabajo',
                  tipo: 'select',
                  valorDefault: 1.0,
                  opciones: [
                    { id: 'opt-h1', label: 'Estándar <2.8m (1.00x)', valor: 1.0 },
                    { id: 'opt-h2', label: 'Doble Altura (1.25x)', valor: 1.25 }
                  ]
                })}
                className="px-2 py-0.5 bg-surface-container-highest hover:bg-surface-variant text-[11px] text-on-surface rounded-lg border border-outline-variant/20 transition"
              >
                + Coef. Altura
              </button>
              <button
                type="button"
                onClick={() => addVariable({ id: 'desarmes', nombre: 'Ventiladores/Apliques a Desarmar', tipo: 'numero', valorDefault: 0, unidad: 'artefactos' })}
                className="px-2 py-0.5 bg-surface-container-highest hover:bg-surface-variant text-[11px] text-on-surface rounded-lg border border-outline-variant/20 transition"
              >
                + Desarmes Especiales
              </button>
            </div>

            {/* Listado de Variables */}
            <div className="space-y-3">
              {formData.variables.map((variable, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-surface-container-highest/60 border border-outline-variant/25 rounded-2xl space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-bold text-on-surface-variant block uppercase">
                        Identificador en Fórmula
                      </label>
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-mono font-bold text-primary">$</code>
                        <input
                          type="text"
                          required
                          value={variable.id}
                          onChange={(e) => updateVariable(idx, { id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                          className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-primary focus:outline-none"
                          placeholder="ej: bocas, sup, k_estado"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-bold text-on-surface-variant block uppercase">
                        Nombre Visible
                      </label>
                      <input
                        type="text"
                        required
                        value={variable.nombre}
                        onChange={(e) => updateVariable(idx, { nombre: e.target.value })}
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1 text-xs text-on-surface focus:outline-none"
                        placeholder="ej: Cantidad de Bocas"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-on-surface-variant block uppercase">
                        Tipo
                      </label>
                      <select
                        value={variable.tipo}
                        onChange={(e) => updateVariable(idx, {
                          tipo: e.target.value as any,
                          opciones: e.target.value === 'select' && (!variable.opciones || variable.opciones.length === 0)
                            ? [
                                { id: 'opt-1', label: 'Estándar (1.00x)', valor: 1.0 },
                                { id: 'opt-2', label: 'Complejo (1.25x)', valor: 1.25 }
                              ]
                            : variable.opciones
                        })}
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2 py-1 text-xs text-on-surface focus:outline-none"
                      >
                        <option value="numero">Número</option>
                        <option value="select">Opciones / Coeficientes</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-on-surface-variant block uppercase">
                        Valor Default
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={variable.valorDefault}
                        onChange={(e) => updateVariable(idx, { valorDefault: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-on-surface focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeVariable(idx)}
                        className="p-2 text-on-surface-variant hover:text-error rounded-xl transition"
                        title="Eliminar variable"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Editor de Opciones si es Selector */}
                  {variable.tipo === 'select' && (
                    <div className="p-2.5 bg-surface-container rounded-xl border border-outline-variant/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase">
                          Opciones y Multiplicadores de "{variable.nombre}":
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const current = variable.opciones || [];
                            updateVariable(idx, {
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
                        {(variable.opciones || []).map((opc, opcIdx) => (
                          <div key={opcIdx} className="flex items-center gap-1 bg-surface-container-highest p-1.5 rounded-lg border border-outline-variant/20">
                            <input
                              type="text"
                              value={opc.label}
                              onChange={(e) => {
                                const nextOpc = [...(variable.opciones || [])];
                                nextOpc[opcIdx] = { ...nextOpc[opcIdx], label: e.target.value };
                                updateVariable(idx, { opciones: nextOpc });
                              }}
                              className="w-full bg-transparent text-xs text-on-surface focus:outline-none"
                              placeholder="Etiqueta"
                            />
                            <input
                              type="number"
                              step="0.05"
                              value={opc.valor}
                              onChange={(e) => {
                                const nextOpc = [...(variable.opciones || [])];
                                nextOpc[opcIdx] = { ...nextOpc[opcIdx], valor: parseFloat(e.target.value) || 0 };
                                updateVariable(idx, { opciones: nextOpc });
                              }}
                              className="w-16 bg-surface-container text-xs font-mono font-bold text-primary text-center rounded px-1 py-0.5 focus:outline-none"
                              title="Multiplicador numérico"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const nextOpc = (variable.opciones || []).filter((_, i) => i !== opcIdx);
                                updateVariable(idx, { opciones: nextOpc });
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

          {/* 3. Despiece de Insumos & Materiales con Fórmulas */}
          <div className="space-y-3 border-t border-outline-variant/30 pt-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  <span>3. Despiece de Insumos & Materiales (con Fórmulas)</span>
                </h4>
                <p className="text-[11px] text-on-surface-variant">
                  Escribe la fórmula matemática usando las variables (ej: <code className="font-mono text-primary font-bold">bocas * 12 * 1.10</code>).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMaterialPickerOpen(true)}
                className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-primary/25"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar Material</span>
              </button>
            </div>

            <div className="space-y-2">
              {formData.insumos.length === 0 ? (
                <div
                  onClick={() => setIsMaterialPickerOpen(true)}
                  className="text-center py-6 px-4 border-2 border-dashed border-outline-variant/30 rounded-2xl bg-surface-container-low cursor-pointer hover:border-primary/50 transition"
                >
                  <Package className="w-7 h-7 text-outline-variant mx-auto mb-1" />
                  <p className="text-xs font-bold text-on-surface">Sin materiales asignados</p>
                  <p className="text-[11px] text-primary mt-0.5">+ Toca para agregar materiales del catálogo</p>
                </div>
              ) : (
                formData.insumos.map((item, idx) => {
                  const targetId = item.materialId || item.insumoId || '';
                  const selectedMat = insumosMap.get(targetId);
                  const unitPrice = selectedMat?.precioActual || 0;
                  const unit = selectedMat?.unidadVenta || selectedMat?.unidad || 'u';

                  // Live evaluation of formula
                  const formulaStr = item.formula || String(item.cantidad);
                  const evalRes = evaluateMathExpression(formulaStr, currentScope);
                  const cantEvaluada = evalRes.isValid && evalRes.value !== null ? evalRes.value : item.cantidad;
                  const rowSubtotal = unitPrice * cantEvaluada;

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-outline-variant/40 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-variant text-on-surface-variant font-mono">
                            #{idx + 1}
                          </span>
                          <h5 className="text-xs font-bold text-on-surface truncate">
                            {selectedMat?.nombre || targetId}
                          </h5>
                        </div>
                        <div className="text-[11px] text-on-surface-variant font-mono flex items-center gap-2">
                          <span>Unit: {formatARS(unitPrice)}</span>
                          <span>•</span>
                          <span className="font-bold text-primary">
                            Consumo: {cantEvaluada} {unit} = {formatARS(rowSubtotal)}
                          </span>
                        </div>
                      </div>

                      {/* Formula Input */}
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                        <div className="flex items-center gap-1.5 bg-surface-container-highest px-3 py-1.5 rounded-xl border border-outline-variant/30">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Fórmula:</span>
                          <input
                            type="text"
                            value={item.formula || ''}
                            onChange={(e) => {
                              const next = [...formData.insumos];
                              const newFormula = e.target.value;
                              const res = evaluateMathExpression(newFormula, currentScope);
                              next[idx] = {
                                ...next[idx],
                                formula: newFormula,
                                cantidad: res.isValid && res.value !== null ? res.value : next[idx].cantidad
                              };
                              setFormData({ ...formData, insumos: next });
                            }}
                            className="w-36 sm:w-44 bg-transparent font-mono text-xs font-bold text-primary focus:outline-none"
                            placeholder="ej: bocas * 12 * 1.10"
                          />
                          <span className="text-xs font-mono font-bold text-on-surface bg-surface-container px-2 py-0.5 rounded-md">
                            = {cantEvaluada} {unit}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeInsumoRow(idx)}
                          className="p-2 text-on-surface-variant hover:text-error rounded-xl transition shrink-0"
                          title="Quitar material"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. Mano de Obra con Fórmulas */}
          <div className="space-y-3 border-t border-outline-variant/30 pt-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>4. Horas de Mano de Obra (con Fórmulas)</span>
                </h4>
                <p className="text-[11px] text-on-surface-variant">
                  Escribe la fórmula de horas (ej: <code className="font-mono text-primary font-bold">(bocas * 1.5) * k_estado * k_altura</code>).
                </p>
              </div>
              <button
                type="button"
                onClick={addManoObraRow}
                className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-primary/25"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar Rol MO</span>
              </button>
            </div>

            <div className="space-y-2">
              {formData.manoObra.length === 0 ? (
                <div
                  onClick={addManoObraRow}
                  className="text-center py-6 px-4 border-2 border-dashed border-outline-variant/30 rounded-2xl bg-surface-container-low cursor-pointer hover:border-primary/50 transition"
                >
                  <Clock className="w-7 h-7 text-outline-variant mx-auto mb-1" />
                  <p className="text-xs font-bold text-on-surface">Sin mano de obra asignada</p>
                  <p className="text-[11px] text-primary mt-0.5">+ Toca para agregar roles de mano de obra</p>
                </div>
              ) : (
                formData.manoObra.map((item, idx) => {
                  const cat = manoObraMap.get(item.categoriaId);
                  const rate = cat?.costoHora || 0;

                  // Live evaluation of formula
                  const formulaStr = item.formula || String(item.horas);
                  const evalRes = evaluateMathExpression(formulaStr, currentScope);
                  const horasEvaluadas = evalRes.isValid && evalRes.value !== null ? evalRes.value : item.horas;
                  const rowSubtotal = rate * horasEvaluadas;

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-outline-variant/40 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <select
                          value={item.categoriaId}
                          onChange={(e) => {
                            const next = [...formData.manoObra];
                            next[idx] = { ...next[idx], categoriaId: e.target.value };
                            setFormData({ ...formData, manoObra: next });
                          }}
                          className="bg-surface-container-highest border border-outline-variant/30 rounded-xl px-2.5 py-1 text-xs font-bold text-on-surface focus:outline-none max-w-xs"
                        >
                          {manoObraList.map((mo) => (
                            <option key={mo.id} value={mo.id}>
                              {mo.nombre} ({formatARS(mo.costoHora)}/h)
                            </option>
                          ))}
                        </select>
                        <div className="text-[11px] text-on-surface-variant font-mono mt-1 flex items-center gap-2">
                          <span>Tarifa: {formatARS(rate)}/h</span>
                          <span>•</span>
                          <span className="font-bold text-primary">
                            Subtotal: {horasEvaluadas} hs = {formatARS(rowSubtotal)}
                          </span>
                        </div>
                      </div>

                      {/* Formula Input */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                        <div className="flex items-center gap-1.5 bg-surface-container-highest px-3 py-1.5 rounded-xl border border-outline-variant/30">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Fórmula:</span>
                          <input
                            type="text"
                            value={item.formula || ''}
                            onChange={(e) => {
                              const next = [...formData.manoObra];
                              const newFormula = e.target.value;
                              const res = evaluateMathExpression(newFormula, currentScope);
                              next[idx] = {
                                ...next[idx],
                                formula: newFormula,
                                horas: res.isValid && res.value !== null ? res.value : next[idx].horas
                              };
                              setFormData({ ...formData, manoObra: next });
                            }}
                            className="w-40 sm:w-52 bg-transparent font-mono text-xs font-bold text-primary focus:outline-none"
                            placeholder="ej: 1.0 + (bocas * 1.5) * k_estado"
                          />
                          <span className="text-xs font-mono font-bold text-on-surface bg-surface-container px-2 py-0.5 rounded-md">
                            = {horasEvaluadas} hs
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const next = [...formData.manoObra];
                            const cur = (item.formula || `${item.horas}`).trim();
                            const newForm = cur.startsWith('1 +') || cur.startsWith('1.0 +') || cur.includes('+ 1')
                              ? cur
                              : `1.0 + (${cur})`;
                            const res = evaluateMathExpression(newForm, currentScope);
                            next[idx] = {
                              ...next[idx],
                              formula: newForm,
                              horas: res.isValid && res.value !== null ? res.value : next[idx].horas
                            };
                            setFormData({ ...formData, manoObra: next });
                          }}
                          className="px-2 py-1 text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg border border-primary/20 transition shrink-0"
                          title="Sumar 1 hora base de Setup/Movilización a la fórmula"
                        >
                          +1h Setup
                        </button>

                        <button
                          type="button"
                          onClick={() => removeManoObraRow(idx)}
                          className="p-2 text-on-surface-variant hover:text-error rounded-xl transition shrink-0"
                          title="Quitar mano de obra"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 5. Cláusula Técnica & Exclusiones de Obra */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wide flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>5. Cláusula Técnica & Exclusiones de Obra (Sugerida para Presupuestos)</span>
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
              <div>Mano de Obra: <strong className="text-on-surface">{formatARS(liveEvaluation.costoManoObraTotal)}</strong></div>
              {liveEvaluation.costoFijoOperativo > 0 && (
                <div>Base Fija Operativa: <strong className="text-primary">{formatARS(liveEvaluation.costoFijoOperativo)}</strong></div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-variant"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs shadow-sm active:scale-95 transition"
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
    </>
  );
};

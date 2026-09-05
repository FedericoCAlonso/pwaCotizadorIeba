import { useState, useEffect, useMemo } from 'react';
import {
  TareaTipo,
  Insumo,
  CategoriaManoDeObra,
  InsumoEnTarea,
  ManoObraEnTarea,
  ParametroTrabajoTipo,
  VariableCalculadaTrabajoTipo,
  FiltroMaterialEnTarea,
  CuadrillaRecomendada,
  NaturalezaTrabajo
} from '../core/types';
import {
  calcularConsumosTareaTipo
} from '../core/calculations';
import { evaluateMathExpression } from '../core/mathEvaluator';
import { useToast } from '../contexts/ToastContext';

export interface TareaFormData {
  nombre: string;
  categoria: string;
  unidad: string;
  naturaleza?: NaturalezaTrabajo;
  honorarioBase?: number;
  formulaHonorarios?: string;
  costoServicioDirecto?: number;
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

export type TareaEditorTab = 'general' | 'parametros' | 'variables' | 'materiales' | 'mano_obra' | 'clausulas';

export interface UseTareaEditorModalViewModelProps {
  isOpen: boolean;
  onClose: () => void;
  editingTarea: TareaTipo | null;
  categoriasList: string[];
  insumosMap: Map<string, Insumo>;
  manoObraList: CategoriaManoDeObra[];
  manoObraMap: Map<string, CategoriaManoDeObra>;
  onSave: (data: TareaFormData) => Promise<void>;
}

export function useTareaEditorModalViewModel({
  isOpen,
  onClose,
  editingTarea,
  categoriasList,
  insumosMap,
  manoObraList,
  manoObraMap,
  onSave
}: UseTareaEditorModalViewModelProps) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TareaEditorTab>('general');

  const [formData, setFormData] = useState<TareaFormData>({
    nombre: '',
    categoria: categoriasList[0] || 'Bocas',
    unidad: 'punto',
    naturaleza: 'instalacion',
    honorarioBase: 0,
    formulaHonorarios: '',
    costoServicioDirecto: 0,
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
        naturaleza: editingTarea.naturaleza || 'instalacion',
        honorarioBase: editingTarea.honorarioBase || 0,
        formulaHonorarios: editingTarea.formulaHonorarios || '',
        costoServicioDirecto: editingTarea.costoServicioDirecto || 0,
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
      setActiveTab('general');
    } else if (isOpen) {
      setFormData({
        nombre: '',
        categoria: categoriasList[0] || 'Bocas',
        unidad: 'boca',
        naturaleza: 'instalacion',
        honorarioBase: 0,
        formulaHonorarios: '',
        costoServicioDirecto: 0,
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
      setActiveTab('general');
    }
  }, [editingTarea, isOpen, categoriasList]);

  // Scope consolidado
  const currentScope = useMemo(() => {
    const scope: Record<string, number> = {};

    if (manoObraMap) {
      manoObraMap.forEach((mo) => {
        const rate = Number(mo.costoHora) || 0;
        const safeId = mo.id.replace(/-/g, '_');
        scope[safeId] = rate;
        scope[`costo_hora_${safeId}`] = rate;
        scope[`tarifa_${safeId}`] = rate;

        const normalizedName = mo.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalizedName.includes('oficial') && !normalizedName.includes('ayudante')) {
          scope['costo_hora_oficial'] = rate;
          scope['tarifa_oficial'] = rate;
        } else if (normalizedName.includes('ayudante')) {
          scope['costo_hora_ayudante'] = rate;
          scope['tarifa_ayudante'] = rate;
        } else if (normalizedName.includes('tecnico') || normalizedName.includes('matriculado') || normalizedName.includes('profesional') || normalizedName.includes('proyectista')) {
          scope['costo_hora_tecnico'] = rate;
          scope['costo_hora_matriculado'] = rate;
          scope['costo_hora_profesional'] = rate;
          scope['tarifa_profesional'] = rate;
          scope['tarifa_tecnico'] = rate;
          scope['tarifa_matriculado'] = rate;
        }
      });
    }

    if (formData.honorarioBase !== undefined) {
      scope['honorario_base'] = formData.honorarioBase;
      scope['honorarioBase'] = formData.honorarioBase;
      scope['honorario'] = formData.honorarioBase;
    }
    if (formData.costoServicioDirecto !== undefined) {
      scope['costo_servicio'] = formData.costoServicioDirecto;
      scope['costoServicio'] = formData.costoServicioDirecto;
    }
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
  }, [formData.parametros, formData.variables, formData.honorarioBase, formData.costoServicioDirecto, manoObraMap]);

  // Live evaluation preview
  const liveEvaluation = useMemo(() => {
    const tareaTemp: TareaTipo = {
      id: 'temp-preview',
      nombre: formData.nombre || 'Vista Previa',
      categoria: formData.categoria,
      unidad: formData.unidad,
      naturaleza: formData.naturaleza,
      honorarioBase: formData.honorarioBase,
      formulaHonorarios: formData.formulaHonorarios,
      costoServicioDirecto: formData.costoServicioDirecto,
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

  // Insumos handlers
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

  const updateInsumoRow = (index: number, updates: Partial<InsumoEnTarea>) => {
    setFormData((prev) => {
      const next = [...prev.insumos];
      next[index] = { ...next[index], ...updates };
      return { ...prev, insumos: next };
    });
  };

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

  // Mano de obra handlers
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

  const updateManoObraRow = (index: number, updates: Partial<ManoObraEnTarea>) => {
    setFormData((prev) => {
      const next = [...prev.manoObra];
      next[index] = { ...next[index], ...updates };
      return { ...prev, manoObra: next };
    });
  };

  // Parametros handlers
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

    const targetIdx = formData.parametros.length;
    setFormData(prev => ({
      ...prev,
      parametros: [...prev.parametros, newParam]
    }));

    setTimeout(() => {
      if (typeof document !== 'undefined') {
        const el = document.getElementById(`param-id-${targetIdx}`) as HTMLInputElement;
        if (el) {
          el.focus();
          el.select();
        }
      }
    }, 60);
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

  const getParametroRootIndex = (list: ParametroTrabajoTipo[], index: number) => {
    let rootIdx = index;
    while (rootIdx > 0 && list[rootIdx].condicion) {
      rootIdx--;
    }
    return rootIdx;
  };

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

  const canMoveParametro = (list: ParametroTrabajoTipo[], index: number, direction: 'up' | 'down') => {
    if (index < 0 || index >= list.length) return false;
    const currentParam = list[index];
    const isChild = Boolean(currentParam.condicion && currentParam.condicion.trim());

    if (direction === 'up') {
      if (index === 0) return false;

      if (isChild) {
        const rootIdx = getParametroRootIndex(list, index);
        if (index - 1 <= rootIdx) return false;

        for (let i = 0; i < index; i++) {
          if (currentParam.condicion!.includes(list[i].id) && index - 1 <= i) {
            return false;
          }
        }
        return true;
      } else {
        return index > 0;
      }
    } else {
      const { endIndex } = getParametroBlockRange(list, index);

      if (isChild) {
        const rootIdx = getParametroRootIndex(list, index);
        const { endIndex: familyEnd } = getParametroBlockRange(list, rootIdx);
        if (endIndex >= familyEnd) return false;
        return true;
      } else {
        if (endIndex >= list.length - 1) return false;
        return true;
      }
    }
  };

  const moveParametro = (index: number, direction: 'up' | 'down') => {
    setFormData(prev => {
      const list = [...prev.parametros];
      if (!canMoveParametro(list, index, direction)) return prev;

      const currentParam = list[index];
      const isChild = Boolean(currentParam.condicion && currentParam.condicion.trim());
      const { startIndex, endIndex } = getParametroBlockRange(list, index);
      const blockSize = endIndex - startIndex + 1;

      if (direction === 'up') {
        const prevItemIdx = startIndex - 1;
        let targetInsertIdx = prevItemIdx;

        if (!isChild) {
          let prevBlockStart = prevItemIdx;
          while (prevBlockStart > 0 && list[prevBlockStart].condicion) {
            prevBlockStart--;
          }
          targetInsertIdx = prevBlockStart;
        } else {
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
        const nextBlockIdx = endIndex + 1;
        const nextRange = getParametroBlockRange(list, nextBlockIdx);

        const block = list.splice(startIndex, blockSize);
        const insertIdx = nextRange.endIndex - blockSize + 1;
        list.splice(insertIdx, 0, ...block);
      }

      return { ...prev, parametros: list };
    });
  };

  const setParametroDependency = (index: number, targetId: string) => {
    setFormData(prev => {
      const list = [...prev.parametros];
      const targetIdx = list.findIndex(p => p.id === targetId);
      if (targetIdx === -1) return prev;

      const targetP = list[targetIdx];
      const defaultCond = targetP.tipo === 'boolean'
        ? `${targetId} == 1`
        : targetP.tipo === 'select' && targetP.opciones?.length
        ? `${targetId} == ${targetP.opciones[0].valor}`
        : `${targetId} > 0`;

      const [item] = list.splice(index, 1);
      item.condicion = defaultCond;

      const newTargetIdx = list.findIndex(p => p.id === targetId);
      let insertIdx = newTargetIdx + 1;
      while (insertIdx < list.length && list[insertIdx].condicion && list[insertIdx].condicion?.includes(targetId)) {
        insertIdx++;
      }

      list.splice(insertIdx, 0, item);
      return { ...prev, parametros: list };
    });
  };

  // Variables handlers
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

    const targetIdx = formData.variables.length;
    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, newVar]
    }));

    setTimeout(() => {
      if (typeof document !== 'undefined') {
        const el = document.getElementById(`var-id-${targetIdx}`) as HTMLInputElement;
        if (el) {
          el.focus();
          el.select();
        }
      }
    }, 60);
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

  const moveVariable = (index: number, direction: 'up' | 'down') => {
    setFormData(prev => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.variables.length) return prev;
      const next = [...prev.variables];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return { ...prev, variables: next };
    });
  };

  // Field generic updater
  const updateFormField = <K extends keyof TareaFormData>(field: K, value: TareaFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Submit handler
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error('El nombre de la tarea es obligatorio');
      return;
    }
    if (formData.parametros.length === 0) {
      toast.error('Debes definir al menos un parámetro de entrada para el trabajo tipo.');
      return;
    }

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

  return {
    activeTab,
    setActiveTab,
    formData,
    setFormData,
    updateFormField,
    currentScope,
    liveEvaluation,
    // Material picker
    isMaterialPickerOpen,
    setIsMaterialPickerOpen,
    isCategoryFilterModalOpen,
    setIsCategoryFilterModalOpen,
    editingCategoryFilterIdx,
    setEditingCategoryFilterIdx,
    handleAddMaterialFromPicker,
    handleAddMultipleMaterialsFromPicker,
    removeInsumoRow,
    updateInsumoRow,
    handleSaveCategoryFilter,
    // Mano de obra
    addManoObraRow,
    removeManoObraRow,
    updateManoObraRow,
    // Parametros
    addParametro,
    updateParametro,
    removeParametro,
    moveParametro,
    canMoveParametro,
    setParametroDependency,
    // Variables
    addVariable,
    updateVariable,
    removeVariable,
    moveVariable,
    // Submit
    handleSubmit,
    // Badges / Counts
    parametrosCount: formData.parametros.length,
    variablesCount: formData.variables.length,
    insumosCount: formData.insumos.length,
    manoObraCount: formData.manoObra.length
  };
}

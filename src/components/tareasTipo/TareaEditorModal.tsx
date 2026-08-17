import React, { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, Package, Clock, Save, Search } from 'lucide-react';
import { TareaTipo, Insumo, CategoriaManoDeObra, InsumoEnTarea, ManoObraEnTarea } from '../../core/types';
import { calcularCostoTareaTipo, formatARS } from '../../core/calculations';
import { ModalContainer } from '../ModalContainer';
import { useToast } from '../../contexts/ToastContext';
import { MaterialPickerModal } from './MaterialPickerModal';
import { MathInput } from '../common/MathInput';

export interface TareaFormData {
  nombre: string;
  categoria: string;
  unidad: string;
  notasTecnicas: string;
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
}) => {
  const { toast } = useToast();
  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] transition-shadow";

  const [formData, setFormData] = useState<TareaFormData>({
    nombre: '',
    categoria: categoriasList[0] || 'Bocas',
    unidad: 'punto',
    notasTecnicas: '',
    insumos: [],
    manoObra: [],
  });

  const [isMaterialPickerOpen, setIsMaterialPickerOpen] = useState(false);

  useEffect(() => {
    if (editingTarea) {
      setFormData({
        nombre: editingTarea.nombre,
        categoria: editingTarea.categoria || categoriasList[0] || 'Bocas',
        unidad: editingTarea.unidad || 'punto',
        notasTecnicas: editingTarea.notasTecnicas || '',
        insumos: editingTarea.insumos ? editingTarea.insumos.map((i) => ({ ...i })) : [],
        manoObra: editingTarea.manoObra ? editingTarea.manoObra.map((m) => ({ ...m })) : [],
      });
    } else if (isOpen) {
      setFormData({
        nombre: '',
        categoria: categoriasList[0] || 'Bocas',
        unidad: 'punto',
        notasTecnicas: '',
        insumos: [],
        manoObra: [],
      });
    }
  }, [editingTarea, isOpen, categoriasList]);

  const handleAddMaterialFromPicker = (material: Insumo, cantidad: number, formula?: string) => {
    setFormData((prev) => {
      const targetId = material.id;
      const existingIdx = prev.insumos.findIndex((i) => (i.materialId || i.insumoId) === targetId);

      if (existingIdx >= 0) {
        const next = [...prev.insumos];
        next[existingIdx] = {
          ...next[existingIdx],
          cantidad: next[existingIdx].cantidad + (cantidad > 0 ? cantidad : 1),
          formula: formula || next[existingIdx].formula,
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
            cantidad: cantidad > 0 ? cantidad : 1,
            formula,
          },
        ],
      };
    });
  };

  const handleAddMultipleMaterialsFromPicker = (items: { material: Insumo; cantidad: number; formula?: string }[]) => {
    setFormData((prev) => {
      const nextInsumos = [...prev.insumos];
      items.forEach(({ material, cantidad, formula }) => {
        const targetId = material.id;
        const existingIdx = nextInsumos.findIndex((i) => (i.materialId || i.insumoId) === targetId);

        if (existingIdx >= 0) {
          nextInsumos[existingIdx] = {
            ...nextInsumos[existingIdx],
            cantidad: nextInsumos[existingIdx].cantidad + (cantidad > 0 ? cantidad : 1),
            formula: formula || nextInsumos[existingIdx].formula,
          };
        } else {
          nextInsumos.push({
            materialId: targetId,
            insumoId: targetId,
            cantidad: cantidad > 0 ? cantidad : 1,
            formula,
          });
        }
      });
      return { ...prev, insumos: nextInsumos };
    });
  };

  const removeInsumoRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      insumos: prev.insumos.filter((_, i) => i !== index),
    }));
  };

  const updateInsumoRow = (index: number, field: 'materialId' | 'insumoId' | 'cantidad' | 'formula', val: any) => {
    setFormData((prev) => {
      const next = [...prev.insumos];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, insumos: next };
    });
  };

  const addManoObraRow = () => {
    if (manoObraList.length === 0) {
      toast.warning('Primero debes cargar categorías de Mano de Obra.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      manoObra: [...prev.manoObra, { categoriaId: manoObraList[0].id, horas: 1 }],
    }));
  };

  const removeManoObraRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      manoObra: prev.manoObra.filter((_, i) => i !== index),
    }));
  };

  const updateManoObraRow = (index: number, field: 'categoriaId' | 'horas' | 'formula', val: any) => {
    setFormData((prev) => {
      const next = [...prev.manoObra];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, manoObra: next };
    });
  };

  const tempTareaForm: TareaTipo = {
    id: 'temp',
    nombre: formData.nombre,
    categoria: formData.categoria,
    unidad: formData.unidad,
    insumos: formData.insumos,
    manoObra: formData.manoObra,
    factorCorreccion: 1.0,
  };
  const tempCost = calcularCostoTareaTipo(tempTareaForm, insumosMap, manoObraMap);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return;
    await onSave(formData);
  };

  return (
    <>
      <ModalContainer
        isOpen={isOpen}
        onClose={onClose}
        title={editingTarea ? `Editar ${editingTarea.nombre}` : 'Diseñador de Tarea Tipo (Ensamble)'}
        subtitle="Despiece de materiales y horas por categoría de mano de obra"
        icon={<Layers className="w-5 h-5 text-primary" />}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* General Data */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Nombre de la Tarea</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className={inputCls}
                placeholder="Ej: Boca de Iluminación Completa (IUG)"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Categoría</label>
              <select
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className={inputCls}
              >
                {formData.categoria && !categoriasList.includes(formData.categoria) && (
                  <option value={formData.categoria}>
                    {formData.categoria} (Personalizada)
                  </option>
                )}
                {categoriasList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Unidad de Medida</label>
              <input
                type="text"
                value={formData.unidad}
                onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                className={inputCls}
                placeholder="punto, m, u"
                required
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

          {/* Section: Insumos / Materiales */}
          <div className="space-y-3 border-t border-outline-variant/30 pt-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  <span>Despiece de Insumos & Materiales</span>
                </h4>
                <span className="text-[11px] text-on-surface-variant">
                  {formData.insumos.length} {formData.insumos.length === 1 ? 'material asignado' : 'materiales asignados'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMaterialPickerOpen(true)}
                className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 border border-primary/25 shadow-2xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar Materiales</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-0.5">
              {formData.insumos.length === 0 ? (
                <div
                  onClick={() => setIsMaterialPickerOpen(true)}
                  className="text-center py-7 px-4 border-2 border-dashed border-outline-variant/30 hover:border-primary/50 rounded-2xl bg-surface-container-low/60 hover:bg-surface-container-low cursor-pointer transition-all group"
                >
                  <Package className="w-8 h-8 text-outline-variant group-hover:text-primary mx-auto mb-1.5 transition-colors" />
                  <p className="text-xs font-bold text-on-surface">Sin materiales asignados a esta tarea</p>
                  <p className="text-[11px] text-primary mt-1 font-medium">+ Toca aquí para abrir el Catálogo con búsqueda y filtros</p>
                </div>
              ) : (
                formData.insumos.map((item, idx) => {
                  const targetId = item.materialId || item.insumoId || '';
                  const selectedMat = insumosMap.get(targetId);
                  const unitPrice = selectedMat?.precioActual || 0;
                  const rowTotal = unitPrice * item.cantidad;
                  const unit = selectedMat?.unidadVenta || selectedMat?.unidad || 'u';

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 hover:border-outline-variant/40 transition-colors"
                    >
                      {/* Material Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-surface-variant text-on-surface-variant uppercase">
                            #{idx + 1}
                          </span>
                          {selectedMat?.categoria && (
                            <span className="text-[10px] text-on-surface-variant truncate">
                              {selectedMat.categoria}
                            </span>
                          )}
                        </div>
                        <h5 className="text-xs font-bold text-on-surface truncate">
                          {selectedMat?.nombre || targetId || 'Material no especificado'}
                        </h5>
                        <div className="text-[11px] text-on-surface-variant font-mono mt-0.5 flex items-center gap-2">
                          <span>P. Unit: {formatARS(unitPrice)}</span>
                          <span>•</span>
                          <span className="font-bold text-primary">Subtotal: {formatARS(rowTotal)}</span>
                        </div>
                      </div>

                      {/* Quantity Stepper & Remove Action */}
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-outline-variant/15">
                        <div className="w-28 shrink-0">
                          <MathInput
                            value={item.cantidad}
                            formula={item.formula}
                            onChange={(newVal, newForm) => {
                              setFormData((prev) => {
                                const next = [...prev.insumos];
                                next[idx] = { ...next[idx], cantidad: newVal, formula: newForm };
                                return { ...prev, insumos: next };
                              });
                            }}
                            suffix={unit}
                            size="sm"
                            min={0.01}
                            step={0.1}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeInsumoRow(idx)}
                          className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-xl transition-colors shrink-0"
                          title="Quitar material de la tarea"
                          aria-label="Quitar material"
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

          {/* Section: Mano de Obra */}
          <div className="space-y-3 border-t border-outline-variant/30 pt-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Horas por Categoría de Mano de Obra</span>
                </h4>
                <span className="text-[11px] text-on-surface-variant">
                  {formData.manoObra.length} {formData.manoObra.length === 1 ? 'categoría asignada' : 'categorías asignadas'}
                </span>
              </div>
              <button
                type="button"
                onClick={addManoObraRow}
                className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 border border-primary/25 shadow-2xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar Mano de Obra</span>
              </button>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-0.5">
              {formData.manoObra.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic py-2 text-center">Sin horas de mano de obra asignadas.</p>
              ) : (
                formData.manoObra.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-surface-container-low p-2 rounded-xl border border-outline-variant/20">
                    <select
                      value={item.categoriaId}
                      onChange={(e) => updateManoObraRow(idx, 'categoriaId', e.target.value)}
                      className={`${inputCls} flex-1 text-xs`}
                    >
                      {manoObraList.map((mo) => (
                        <option key={mo.id} value={mo.id}>
                          {mo.nombre} ({formatARS(mo.costoHora)}/h)
                        </option>
                      ))}
                    </select>

                    <div className="w-28 shrink-0">
                      <MathInput
                        value={item.horas}
                        formula={item.formula}
                        onChange={(newVal, newForm) => {
                          setFormData((prev) => {
                            const next = [...prev.manoObra];
                            next[idx] = { ...next[idx], horas: newVal, formula: newForm };
                            return { ...prev, manoObra: next };
                          });
                        }}
                        suffix="hs"
                        size="sm"
                        min={0.01}
                        step={0.1}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeManoObraRow(idx)}
                      className="p-1.5 text-on-surface-variant hover:text-error rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Live Cost Summary Preview */}
          <div className="p-3.5 rounded-2xl bg-surface-container-high border border-outline-variant/30 flex justify-between items-center text-xs">
            <div>
              <span className="text-on-surface-variant block">Costo Directo Estimado</span>
              <span className="font-mono font-bold text-primary text-base">{formatARS(tempCost.costoDirectoUnitario)}</span>
            </div>
            <div className="text-right font-mono text-on-surface-variant text-[11px]">
              <div>Insumos: {formatARS(tempCost.costoInsumosUnitario)}</div>
              <div>MO: {formatARS(tempCost.costoManoObraUnitario)}</div>
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
              className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs shadow-sm active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Tarea Tipo</span>
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


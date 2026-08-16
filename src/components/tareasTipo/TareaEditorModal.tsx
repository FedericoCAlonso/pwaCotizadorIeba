import React, { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, Package, Clock, Save } from 'lucide-react';
import { TareaTipo, Insumo, CategoriaManoDeObra, InsumoEnTarea, ManoObraEnTarea } from '../../core/types';
import { calcularCostoTareaTipo, formatARS } from '../../core/calculations';
import { ModalContainer } from '../ModalContainer';
import { useToast } from '../../contexts/ToastContext';

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

  const addInsumoRow = () => {
    const list = Array.from(insumosMap.values());
    if (list.length === 0) {
      toast.warning('Primero debes cargar insumos en el catálogo de Materiales.');
      return;
    }
    const defaultMat = list[0];
    setFormData((prev) => ({
      ...prev,
      insumos: [
        ...prev.insumos,
        {
          materialId: defaultMat.id,
          insumoId: defaultMat.id,
          cantidad: 1,
        },
      ],
    }));
  };

  const removeInsumoRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      insumos: prev.insumos.filter((_, i) => i !== index),
    }));
  };

  const updateInsumoRow = (index: number, field: 'materialId' | 'insumoId' | 'cantidad', val: any) => {
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

  const updateManoObraRow = (index: number, field: 'categoriaId' | 'horas', val: any) => {
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
        <div className="space-y-2 border-t border-outline-variant/30 pt-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              <span>Despiece de Insumos & Materiales</span>
            </h4>
            <button
              type="button"
              onClick={addInsumoRow}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar Insumo
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {formData.insumos.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic py-2">Sin materiales asignados a esta tarea.</p>
            ) : (
              formData.insumos.map((item, idx) => {
                const targetId = item.materialId || item.insumoId || '';
                const selectedMat = insumosMap.get(targetId);

                return (
                  <div key={idx} className="flex items-center gap-2 bg-surface-container-low p-2 rounded-xl border border-outline-variant/20">
                    <select
                      value={targetId}
                      onChange={(e) => {
                        updateInsumoRow(idx, 'materialId', e.target.value);
                        updateInsumoRow(idx, 'insumoId', e.target.value);
                      }}
                      className={`${inputCls} flex-1 text-xs`}
                    >
                      {Array.from(insumosMap.values()).map((ins) => (
                        <option key={ins.id} value={ins.id}>
                          {ins.nombre} {ins.precioActual ? `(${formatARS(ins.precioActual)})` : ''}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 w-28 shrink-0">
                      <input
                        type="number"
                        step="0.01"
                        value={item.cantidad}
                        onChange={(e) => updateInsumoRow(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                        className={`${inputCls} text-xs font-mono text-center px-1`}
                      />
                      <span className="text-[10px] text-on-surface-variant shrink-0">{selectedMat?.unidadVenta || 'u'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeInsumoRow(idx)}
                      className="p-1.5 text-on-surface-variant hover:text-error rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Section: Mano de Obra */}
        <div className="space-y-2 border-t border-outline-variant/30 pt-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>Horas por Categoría de Mano de Obra</span>
            </h4>
            <button
              type="button"
              onClick={addManoObraRow}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar Mano de Obra
            </button>
          </div>

          <div className="space-y-2 max-h-36 overflow-y-auto">
            {formData.manoObra.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic py-2">Sin horas de mano de obra asignadas.</p>
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

                  <div className="flex items-center gap-1 w-24 shrink-0">
                    <input
                      type="number"
                      step="0.1"
                      value={item.horas}
                      onChange={(e) => updateManoObraRow(idx, 'horas', parseFloat(e.target.value) || 0)}
                      className={`${inputCls} text-xs font-mono text-center px-1`}
                    />
                    <span className="text-[10px] text-on-surface-variant shrink-0">hs</span>
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
  );
};

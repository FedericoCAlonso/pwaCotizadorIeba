import React from 'react';
import { Sparkles, Trash2, Save, X } from 'lucide-react';
import { CategoriaMaterial, Material } from '../../core/types';

interface MaterialEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingMat: Material | null;
  categorias: CategoriaMaterial[];
  categoriasMap: Map<string, CategoriaMaterial>;
  formDataMat: Partial<Material>;
  setFormDataMat: React.Dispatch<React.SetStateAction<Partial<Material>>>;
  onCategoryChange: (catId: string) => void;
  onAttributeValueChange: (key: string, val: string) => void;
  onAddCustomAttribute: () => void;
  onUpdateCustomAttrKey: (index: number, newKey: string) => void;
  onRemoveAttribute: (key: string) => void;
  onAutoGenerateName: () => void;
  onOpenCreateCat: () => void;
  onRestoreDefaultCategories: () => void;
  onSave: (e: React.FormEvent) => void;
}

export const MaterialEditorModal: React.FC<MaterialEditorModalProps> = ({
  isOpen,
  onClose,
  editingMat,
  categorias,
  categoriasMap,
  formDataMat,
  setFormDataMat,
  onCategoryChange,
  onAttributeValueChange,
  onAddCustomAttribute,
  onUpdateCustomAttrKey,
  onRemoveAttribute,
  onAutoGenerateName,
  onOpenCreateCat,
  onRestoreDefaultCategories,
  onSave,
}) => {
  if (!isOpen) return null;

  const inputCls =
    'w-full px-3.5 py-2.5 text-base sm:text-xs rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]';

  const selectedCat = categoriasMap.get(formDataMat.categoriaId || '');
  const suggestedAttrs = selectedCat?.atributosSugeridos || [];
  const sugKeys = new Set(suggestedAttrs.map((s) => s.clave));
  const extraAttrs = (formDataMat.atributos || []).filter((a) => !sugKeys.has(a.clave));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-xl shadow-2xl p-6 text-on-surface max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3 shrink-0">
          <h3 className="text-base font-semibold text-on-surface">
            {editingMat ? 'Editar Ficha Técnica de Material' : 'Nuevo Material (Ficha Técnica Completa)'}
          </h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4 overflow-y-auto pr-1 flex-1">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-on-surface-variant">Familia / Categoría *</label>
              <button
                type="button"
                onClick={onOpenCreateCat}
                className="text-[11px] text-primary hover:underline font-semibold"
              >
                + Nueva Categoría
              </button>
            </div>
            {categorias.length === 0 ? (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center justify-between">
                <span>No hay categorías cargadas.</span>
                <button
                  type="button"
                  onClick={onRestoreDefaultCategories}
                  className="px-2.5 py-1 bg-amber-500 text-white font-semibold rounded-lg text-[10px]"
                >
                  Cargar iniciales
                </button>
              </div>
            ) : (
              <select
                value={formDataMat.categoriaId}
                onChange={(e) => onCategoryChange(e.target.value)}
                className={inputCls}
                required
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dynamic Suggested & Custom Attributes Section */}
          <div className="p-3.5 bg-surface-container-high border border-outline-variant/30 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Atributos del Material {selectedCat ? `(${selectedCat.nombre})` : ''}
              </span>
              <button
                type="button"
                onClick={onAddCustomAttribute}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                title="Agregar atributo adicional no sugerido en la categoría"
              >
                + Atributo Extra
              </button>
            </div>

            {suggestedAttrs.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {suggestedAttrs.map((attrTpl) => {
                  let isBlocked = false;
                  let blockedVal = '';
                  let availableOptions = attrTpl.opciones ? [...attrTpl.opciones] : [];

                  if (attrTpl.dependencias) {
                    for (const dep of attrTpl.dependencias) {
                      const parentVal = formDataMat.atributos?.find((a) => a.clave === dep.dependeVinculo)?.valor;
                      if (parentVal && parentVal.includes(dep.valorEsperado)) {
                        if (dep.bloqueado) {
                          isBlocked = true;
                          blockedVal = dep.valorFijo || '';
                        }
                        if (dep.opcionesFiltradas) {
                          availableOptions = dep.opcionesFiltradas;
                        }
                      }
                    }
                  }

                  const currentRawVal =
                    formDataMat.atributos?.find((a) => a.clave === attrTpl.clave)?.valor || '';
                  const attrVal = isBlocked ? blockedVal : currentRawVal;

                  return (
                    <div key={attrTpl.clave}>
                      <label className="block text-[11px] font-medium text-on-surface-variant mb-1 truncate">
                        {attrTpl.etiqueta} {attrTpl.unidad ? `(${attrTpl.unidad})` : ''}
                        {isBlocked && (
                          <span className="ml-1 text-[9px] text-amber-500 font-bold">(Fijo por norma)</span>
                        )}
                      </label>
                      {availableOptions.length > 0 ? (
                        <select
                          value={attrVal}
                          disabled={isBlocked}
                          onChange={(e) => onAttributeValueChange(attrTpl.clave, e.target.value)}
                          className={`${inputCls} text-xs`}
                        >
                          <option value="">-- Seleccionar {attrTpl.etiqueta} --</option>
                          {attrVal && !availableOptions.includes(attrVal) && (
                            <option value={attrVal}>{attrVal} (Actual)</option>
                          )}
                          {availableOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={attrTpl.tipo === 'numero' ? 'number' : 'text'}
                          step={attrTpl.tipo === 'numero' ? 'any' : undefined}
                          value={attrVal}
                          disabled={isBlocked}
                          onChange={(e) => onAttributeValueChange(attrTpl.clave, e.target.value)}
                          className={`${inputCls} text-xs`}
                          placeholder={attrTpl.unidad ? `Ej: 16 ${attrTpl.unidad}` : 'Valor...'}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {extraAttrs.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-outline-variant/20">
                <span className="block text-[11px] font-semibold text-on-surface-variant">Atributos Adicionales</span>
                {extraAttrs.map((attr, idx) => {
                  const actualIdx = (formDataMat.atributos || []).findIndex((a) => a.clave === attr.clave);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={attr.clave}
                        onChange={(e) => onUpdateCustomAttrKey(actualIdx, e.target.value)}
                        className={`${inputCls} w-1/3 text-[11px]`}
                        placeholder="Nombre Atributo..."
                      />
                      <input
                        type="text"
                        value={attr.valor}
                        onChange={(e) => onAttributeValueChange(attr.clave, e.target.value)}
                        className={`${inputCls} flex-1 text-[11px]`}
                        placeholder="Valor..."
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveAttribute(attr.clave)}
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Eliminar atributo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-on-surface-variant">
                Nombre Técnico (Generado automáticamente)
              </label>
              <button
                type="button"
                onClick={onAutoGenerateName}
                className="text-[11px] text-primary hover:underline font-semibold"
                title="Restablecer nombre formateado por defecto"
              >
                ✨ Restablecer Formato
              </button>
            </div>
            <input
              type="text"
              value={formDataMat.nombre || ''}
              onChange={(e) => setFormDataMat({ ...formDataMat, nombre: e.target.value })}
              className={inputCls}
              placeholder="Ej: Cables & Conductores | Sección = 2,5 mm² | Norma = IRAM 247-3"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Unidad Venta / Comercialización</label>
            <input
              type="text"
              value={formDataMat.unidadVenta || 'u'}
              onChange={(e) => setFormDataMat({ ...formDataMat, unidadVenta: e.target.value })}
              className={inputCls}
              placeholder="m, u, kg, rollo x100m"
              required
            />
          </div>

          <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Material</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

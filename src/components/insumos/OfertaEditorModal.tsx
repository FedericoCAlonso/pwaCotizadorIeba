import React, { useState, useEffect } from 'react';
import { Save, X, Tag } from 'lucide-react';
import { Oferta, Contacto, Producto } from '../../core/types';

interface OfertaEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingOferta: Oferta | null;
  proveedores: Contacto[];
  productos: Producto[];
  formDataOferta: Partial<Oferta>;
  setFormDataOferta: React.Dispatch<React.SetStateAction<Partial<Oferta>>>;
  onSave: (e: React.FormEvent) => void;
}

export const OfertaEditorModal: React.FC<OfertaEditorModalProps> = ({
  isOpen,
  onClose,
  editingOferta,
  proveedores,
  productos,
  formDataOferta,
  setFormDataOferta,
  onSave,
}) => {
  const [proveedorInput, setProveedorInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (formDataOferta.proveedorId) {
        const found = proveedores.find((p) => p.id === formDataOferta.proveedorId);
        setProveedorInput(found ? found.razonSocial || found.nombre || '' : formDataOferta.proveedorNombre || '');
      } else {
        setProveedorInput(formDataOferta.proveedorNombre || '');
      }
    }
  }, [isOpen, formDataOferta.proveedorId, formDataOferta.proveedorNombre, proveedores]);

  if (!isOpen) return null;

  const handleProveedorChange = (val: string) => {
    setProveedorInput(val);
    const matched = proveedores.find(
      (p) => (p.razonSocial || p.nombre || '').trim().toLowerCase() === val.trim().toLowerCase()
    );
    if (matched) {
      setFormDataOferta((prev) => ({
        ...prev,
        proveedorId: matched.id,
        proveedorNombre: matched.razonSocial || matched.nombre || val,
      }));
    } else {
      setFormDataOferta((prev) => ({
        ...prev,
        proveedorId: undefined,
        proveedorNombre: val,
      }));
    }
  };

  const inputCls =
    'w-full px-3.5 py-2.5 text-base sm:text-xs rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container rounded-2xl w-full max-w-md shadow-2xl p-6 text-on-surface">
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-container text-on-primary-container rounded-xl">
              <Tag className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-on-surface">
              {editingOferta ? 'Editar Oferta / Precio' : 'Cargar Oferta / Precio'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] p-2 text-on-surface-variant hover:text-on-surface rounded-full state-layer flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          {/* Marca / Producto Asociado */}
          {productos.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Marca / Modelo Asignado
              </label>
              <select
                value={formDataOferta.productoId || ''}
                onChange={(e) =>
                  setFormDataOferta({
                    ...formDataOferta,
                    productoId: e.target.value ? e.target.value : undefined,
                  })
                }
                className={inputCls}
              >
                <option value="">Precio Genérico (Aplica al material)</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.marca} {p.modelo ? `(${p.modelo})` : ''} {p.esPreferido ? '⭐ (Preferido)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-on-surface-variant mt-1">
                Indica si esta cotización corresponde a una marca puntual o al insumo general.
              </p>
            </div>
          )}

          {/* Proveedor (Agendado o Libre) */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Proveedor (Agendado u Ocasional)
            </label>
            <input
              type="text"
              list="proveedores-datalist"
              value={proveedorInput}
              onChange={(e) => handleProveedorChange(e.target.value)}
              placeholder="Escribe o elige un proveedor (ej: Dist. Oeste, Ferretería San Martín...)"
              className={inputCls}
              required
            />
            <datalist id="proveedores-datalist">
              {proveedores.map((p) => (
                <option key={p.id} value={p.razonSocial || p.nombre} />
              ))}
            </datalist>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {formDataOferta.proveedorId ? (
                <span className="text-primary font-medium">✓ Proveedor agendado en Directorio</span>
              ) : proveedorInput.trim() ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  ✎ Proveedor libre / no agendado
                </span>
              ) : (
                'Puedes seleccionar un contacto registrado o ingresar cualquier proveedor libre.'
              )}
            </p>
          </div>

          {/* Precio Unitario */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Precio Unitario ARS ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formDataOferta.precio || ''}
              onChange={(e) =>
                setFormDataOferta({ ...formDataOferta, precio: parseFloat(e.target.value) || 0 })
              }
              className={`${inputCls} font-mono text-primary font-bold text-base`}
              placeholder="0.00"
              required
            />
          </div>

          {/* Notas / Referencia de Cotización */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Notas / Plazo de entrega (Opcional)
            </label>
            <input
              type="text"
              value={formDataOferta.notas || ''}
              onChange={(e) => setFormDataOferta({ ...formDataOferta, notas: e.target.value })}
              placeholder="Ej: Contado efectivo, retiro inmediato, presupuesto #412..."
              className={inputCls}
            />
          </div>

          <div className="pt-3 border-t border-outline-variant/20 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-variant state-layer cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-xs state-layer shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Precio</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

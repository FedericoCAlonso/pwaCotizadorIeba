import React from 'react';
import { Save, X } from 'lucide-react';
import { Oferta, Contacto } from '../../core/types';

interface OfertaEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingOferta: Oferta | null;
  proveedores: Contacto[];
  formDataOferta: Partial<Oferta>;
  setFormDataOferta: React.Dispatch<React.SetStateAction<Partial<Oferta>>>;
  onSave: (e: React.FormEvent) => void;
}

export const OfertaEditorModal: React.FC<OfertaEditorModalProps> = ({
  isOpen,
  onClose,
  editingOferta,
  proveedores,
  formDataOferta,
  setFormDataOferta,
  onSave,
}) => {
  if (!isOpen) return null;

  const inputCls =
    'w-full px-3.5 py-2.5 text-base sm:text-xs rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-sm shadow-2xl p-6 text-on-surface">
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3">
          <h3 className="text-base font-semibold text-on-surface">
            {editingOferta ? 'Editar Oferta / Precio' : 'Cargar Oferta / Precio'}
          </h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Proveedor</label>
            <select
              value={formDataOferta.proveedorId}
              onChange={(e) => setFormDataOferta({ ...formDataOferta, proveedorId: e.target.value })}
              className={inputCls}
            >
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.razonSocial || p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Precio Unitario ARS</label>
            <input
              type="number"
              step="0.01"
              value={formDataOferta.precio || ''}
              onChange={(e) =>
                setFormDataOferta({ ...formDataOferta, precio: parseFloat(e.target.value) || 0 })
              }
              className={`${inputCls} font-mono text-primary font-bold`}
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
              <span>Guardar Precio</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

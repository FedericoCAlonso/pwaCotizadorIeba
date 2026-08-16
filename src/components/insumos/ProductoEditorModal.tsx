import React from 'react';
import { Save, X } from 'lucide-react';
import { Producto } from '../../core/types';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ProductoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  formDataProd: Partial<Producto>;
  setFormDataProd: React.Dispatch<React.SetStateAction<Partial<Producto>>>;
  onSave: (e: React.FormEvent) => void;
}

export const ProductoEditorModal: React.FC<ProductoEditorModalProps> = ({
  isOpen,
  onClose,
  formDataProd,
  setFormDataProd,
  onSave,
}) => {
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const inputCls =
    'w-full px-3.5 py-2.5 text-base sm:text-xs rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-sm shadow-2xl p-6 text-on-surface">
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3">
          <h3 className="text-base font-semibold text-on-surface">Agregar Producto / Marca</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Marca</label>
            <input
              type="text"
              value={formDataProd.marca || ''}
              onChange={(e) => setFormDataProd({ ...formDataProd, marca: e.target.value })}
              className={inputCls}
              placeholder="Prysmian, Schneider..."
              required
            />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Modelo / Serie</label>
            <input
              type="text"
              value={formDataProd.modelo || ''}
              onChange={(e) => setFormDataProd({ ...formDataProd, modelo: e.target.value })}
              className={inputCls}
              placeholder="Superastic, Easy9..."
            />
          </div>
          <div className="flex items-center pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-on-surface">
              <input
                type="checkbox"
                checked={formDataProd.esPreferido}
                onChange={(e) => setFormDataProd({ ...formDataProd, esPreferido: e.target.checked })}
                className="w-4 h-4 text-primary rounded"
              />
              <span>Marcar como marca preferida por defecto</span>
            </label>
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
              <span>Guardar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useRef } from 'react';
import { Zap, X, Plus } from 'lucide-react';
import { Contacto } from '../../core/types';

interface QuickCreateMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  formDataQuickMat: {
    nombre: string;
    unidadVenta: string;
    precio: number;
    proveedorId: string;
  };
  setFormDataQuickMat: React.Dispatch<
    React.SetStateAction<{
      nombre: string;
      unidadVenta: string;
      precio: number;
      proveedorId: string;
    }>
  >;
  proveedores: Contacto[];
  modoCargaContinua: boolean;
  setModoCargaContinua: (val: boolean) => void;
  onSave: (e: React.FormEvent) => void;
}

export const QuickCreateMaterialModal: React.FC<QuickCreateMaterialModalProps> = ({
  isOpen,
  onClose,
  formDataQuickMat,
  setFormDataQuickMat,
  proveedores,
  modoCargaContinua,
  setModoCargaContinua,
  onSave,
}) => {
  const quickMatNombreRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const inputCls =
    'w-full px-3.5 py-2.5 text-base sm:text-xs rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-md shadow-2xl p-6 text-on-surface">
        <div className="flex items-center justify-between mb-3 border-b border-outline-variant/30 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-on-surface">Alta Rápida de Material</h3>
              <p className="text-[11px] text-on-surface-variant">
                Crea insumos en segundos desde la obra. Luego completas la ficha técnica.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Nombre o Descripción del Material *
            </label>
            <input
              ref={quickMatNombreRef}
              type="text"
              value={formDataQuickMat.nombre}
              onChange={(e) => setFormDataQuickMat({ ...formDataQuickMat, nombre: e.target.value })}
              className={inputCls}
              placeholder="Ej: Caño corrugado blanco 3/4, Cable unipolar 1.5..."
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Unidad de Venta</label>
              <select
                value={formDataQuickMat.unidadVenta}
                onChange={(e) => setFormDataQuickMat({ ...formDataQuickMat, unidadVenta: e.target.value })}
                className={inputCls}
              >
                <option value="m">Metro (m)</option>
                <option value="u">Unidad (u)</option>
                <option value="kg">Kilogramo (kg)</option>
                <option value="rollo x100m">Rollo x 100m</option>
                <option value="caja x100u">Caja x 100u</option>
                <option value="tira x3m">Tira x 3m</option>
                <option value="global">Global</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Precio Referencia ARS (Opcional)
              </label>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={formDataQuickMat.precio || ''}
                onChange={(e) =>
                  setFormDataQuickMat({ ...formDataQuickMat, precio: parseFloat(e.target.value) || 0 })
                }
                className={inputCls}
                placeholder="0.00"
              />
            </div>
          </div>

          {proveedores.length > 0 && formDataQuickMat.precio > 0 && (
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Proveedor de Referencia
              </label>
              <select
                value={formDataQuickMat.proveedorId}
                onChange={(e) => setFormDataQuickMat({ ...formDataQuickMat, proveedorId: e.target.value })}
                className={inputCls}
              >
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.razonSocial || p.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-2 border-t border-outline-variant/20">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-600 dark:text-amber-400">
              <input
                type="checkbox"
                checked={modoCargaContinua}
                onChange={(e) => setModoCargaContinua(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded border-outline focus:ring-amber-500"
              />
              <span>⚡ Modo Carga Continua (Enter guarda y pasa al siguiente)</span>
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
              className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-full text-sm shadow-md active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar Rápido</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

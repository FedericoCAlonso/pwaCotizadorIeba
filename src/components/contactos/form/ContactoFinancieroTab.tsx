import React from 'react';
import { Building, Truck } from 'lucide-react';
import { ContactoFormData } from '../ContactoFormModal';

interface ContactoFinancieroTabProps {
  formData: ContactoFormData;
  setFormData: React.Dispatch<React.SetStateAction<ContactoFormData>>;
}

export const ContactoFinancieroTab: React.FC<ContactoFinancieroTabProps> = ({
  formData,
  setFormData
}) => {
  return (
    <div className="space-y-4">
      {/* Para Clientes */}
      <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/20 space-y-3">
        <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
          <Building className="w-4 h-4" /> Condiciones de Cobro & Comercial (Como Cliente)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Condiciones de Cobro Habitual
            </label>
            <input
              type="text"
              value={formData.financiero.condicionesCobroHabitual || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  financiero: { ...prev.financiero, condicionesCobroHabitual: e.target.value }
                }))
              }
              className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="ej: 50% anticipo al iniciar, 50% con certificado final"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Descuento Comercial Acordado (%)
            </label>
            <input
              type="number"
              step="0.5"
              value={formData.financiero.descuentoHabitualPct ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  financiero: { ...prev.financiero, descuentoHabitualPct: e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0 }
                }))
              }
              className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Límite de Crédito de Obra ($ ARS)
            </label>
            <input
              type="number"
              step="1000"
              value={formData.financiero.limiteCreditoARS ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  financiero: { ...prev.financiero, limiteCreditoARS: e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0 }
                }))
              }
              className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Para Proveedores */}
      <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/20 space-y-3">
        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
          <Truck className="w-4 h-4" /> Datos Bancarios & Pago (Como Proveedor)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Condiciones de Pago Acordadas
            </label>
            <input
              type="text"
              value={formData.financiero.condicionesPagoHabitual || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  financiero: { ...prev.financiero, condicionesPagoHabitual: e.target.value }
                }))
              }
              className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="ej: Cuenta corriente a 30 días, Cheque 60 días"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              CBU / CVU o Alias Bancario
            </label>
            <input
              type="text"
              value={formData.financiero.cbuCvuAlias || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  financiero: { ...prev.financiero, cbuCvuAlias: e.target.value }
                }))
              }
              className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface font-mono font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="ej: 0720... o electro.pagos.mp"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Banco / Billetera</label>
            <input
              type="text"
              value={formData.financiero.banco || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  financiero: { ...prev.financiero, banco: e.target.value }
                }))
              }
              className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="ej: Banco Galicia / Mercado Pago"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Titular de Cuenta</label>
            <input
              type="text"
              value={formData.financiero.titularCuenta || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  financiero: { ...prev.financiero, titularCuenta: e.target.value }
                }))
              }
              className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="ej: Electro Norte S.R.L."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

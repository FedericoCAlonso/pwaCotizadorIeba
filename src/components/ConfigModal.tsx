import React, { useState } from 'react';
import { X, Save, Building, DollarSign, Percent, Calendar } from 'lucide-react';
import { AppConfig } from '../core/types';
import { db } from '../db/database';

interface ConfigModalProps {
  config: AppConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  config,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<AppConfig>({ ...config });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.config.put(formData);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-lg">
            <Building className="w-5 h-5" />
            <span>Configuración del Cotizador & Identidad</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Section: Identidad de Marca */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Datos de la Empresa / Electricista
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Nombre Fantasía / Marca</label>
                <input
                  type="text"
                  value={formData.nombreEmpresa}
                  onChange={(e) => setFormData({ ...formData, nombreEmpresa: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Subtítulo / Especialidad</label>
                <input
                  type="text"
                  value={formData.subtituloEmpresa}
                  onChange={(e) => setFormData({ ...formData, subtituloEmpresa: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">CUIT / DNI</label>
                <input
                  type="text"
                  value={formData.cuit}
                  onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Email de Contacto</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Dirección / Ubicación</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Section: Moneda de Referencia Extranjera */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Cotización de Referencia Extranjera (Informativa Opcional)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Nombre de Moneda</label>
                <input
                  type="text"
                  value={formData.dolarReferenciaNombre}
                  onChange={(e) => setFormData({ ...formData, dolarReferenciaNombre: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  placeholder="Ej: USD Blue, USD Oficial"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Cotización 1 USD en ARS</label>
                <div className="relative">
                  <span className="text-xs text-slate-400 absolute left-3 top-2.5 font-mono font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.dolarReferenciaValor}
                    onChange={(e) => setFormData({ ...formData, dolarReferenciaValor: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={formData.mostrarDolarPorDefecto}
                    onChange={(e) => setFormData({ ...formData, mostrarDolarPorDefecto: e.target.checked })}
                    className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-800 focus:ring-amber-500"
                  />
                  <span>Mostrar USD por defecto en nuevos presupuestos</span>
                </label>
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Section: Valores por Defecto Presupuesto e Impuestos */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Parámetros de Cotización & Configuración Fiscal por Defecto
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Comprobante / Factura por Defecto</label>
                <select
                  value={formData.tipoFacturaPorDefecto || 'Factura B'}
                  onChange={(e) => setFormData({ ...formData, tipoFacturaPorDefecto: e.target.value as any })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Factura A">Factura A (Discrimina IVA/IIBB)</option>
                  <option value="Factura B">Factura B (Consumidor Final)</option>
                  <option value="Factura C">Factura C (Monotributo)</option>
                  <option value="Presupuesto X (Sin Factura)">Presupuesto X (Sin Factura)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Alícuota IVA (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.porcentajeIVAPorDefecto ?? 21}
                    onChange={(e) => setFormData({ ...formData, porcentajeIVAPorDefecto: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono pr-8"
                  />
                  <Percent className="w-4 h-4 text-slate-500 absolute right-2.5 top-2.5" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Alícuota IIBB (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.porcentajeIIBBPorDefecto ?? 3.5}
                    onChange={(e) => setFormData({ ...formData, porcentajeIIBBPorDefecto: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono pr-8"
                  />
                  <Percent className="w-4 h-4 text-slate-500 absolute right-2.5 top-2.5" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Margen Ganancia por Defecto (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.margenPorDefectoPct}
                    onChange={(e) => setFormData({ ...formData, margenPorDefectoPct: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono pr-8"
                  />
                  <Percent className="w-4 h-4 text-slate-500 absolute right-2.5 top-2.5" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Validez por Defecto (Días)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.validezDiasPorDefecto}
                    onChange={(e) => setFormData({ ...formData, validezDiasPorDefecto: parseInt(e.target.value) || 15 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono pr-8"
                  />
                  <Calendar className="w-4 h-4 text-slate-500 absolute right-2.5 top-2.5" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Prefijo de Presupuesto</label>
                <input
                  type="text"
                  value={formData.prefijoPresupuesto}
                  onChange={(e) => setFormData({ ...formData, prefijoPresupuesto: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Configuración</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

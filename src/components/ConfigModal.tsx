import React, { useState } from 'react';
import { X, Save, Building, DollarSign, Percent, Calendar, Sun, Moon, Monitor, Cloud, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppConfig } from '../core/types';
import { db } from '../db/database';
import { TIPOS_FACTURA } from '../core/sampleData';
import { isFirebaseConfigured, getFirebaseConfig, clearCustomFirebaseConfig } from '../config/firebase';
import { AuthModal } from './AuthModal';

interface ConfigModalProps {
  config: AppConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ config, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState<AppConfig>({ ...config });
  const [showAuthSetup, setShowAuthSetup] = useState(false);
  const firebaseConfigured = isFirebaseConfigured();
  const currentFbConfig = getFirebaseConfig();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.config.put(formData);
    onSave();
    onClose();
  };

  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 transition-shadow";
  const sectionTitle = "text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-on-surface">
        <div className="px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-semibold text-base">
            <Building className="w-5 h-5" />
            <span>Configuración del Cotizador</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Apariencia / Tema */}
          <div>
            <h3 className={`${sectionTitle} flex items-center gap-2`}><Sun className="w-4 h-4 text-primary" />Apariencia de la Aplicación</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, themeMode: 'system' })}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 text-xs font-medium transition-all ${
                  (formData.themeMode === 'system' || !formData.themeMode)
                    ? 'bg-primary-container text-on-primary-container border-primary shadow-sm'
                    : 'bg-surface-container-highest border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                <Monitor className="w-5 h-5" />
                <span>Automático (Sistema)</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, themeMode: 'dark' })}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 text-xs font-medium transition-all ${
                  formData.themeMode === 'dark'
                    ? 'bg-primary-container text-on-primary-container border-primary shadow-sm'
                    : 'bg-surface-container-highest border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                <Moon className="w-5 h-5" />
                <span>Modo Oscuro</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, themeMode: 'light' })}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 text-xs font-medium transition-all ${
                  formData.themeMode === 'light'
                    ? 'bg-primary-container text-on-primary-container border-primary shadow-sm'
                    : 'bg-surface-container-highest border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                <Sun className="w-5 h-5" />
                <span>Modo Claro</span>
              </button>
            </div>
          </div>

          <hr className="border-outline-variant/30" />

          {/* Integración Firebase Nube */}
          <div>
            <h3 className={`${sectionTitle} flex items-center gap-2`}><Cloud className="w-4 h-4 text-primary" />Sincronización Nube & Firebase</h3>
            <div className="p-4 rounded-2xl bg-surface-container-highest border border-outline-variant/30 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {firebaseConfigured ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-xs font-semibold">
                      {firebaseConfigured ? 'Firebase Conectado' : 'Sin Configurar'}
                    </h4>
                    <p className="text-[11px] text-on-surface-variant">
                      {firebaseConfigured
                        ? `Proyecto: ${currentFbConfig?.projectId || 'Configurado'}`
                        : 'Ingresá tus credenciales de Firebase para sincronizar entre dispositivos.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAuthSetup(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary text-on-primary hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {firebaseConfigured ? 'Editar Claves' : 'Configurar Claves'}
                </button>
              </div>

              {localStorage.getItem('ieba_custom_firebase_config') && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={clearCustomFirebaseConfig}
                    className="text-[11px] font-medium text-error hover:underline"
                  >
                    Restablecer credenciales por defecto
                  </button>
                </div>
              )}
            </div>
          </div>

          <hr className="border-outline-variant/30" />

          {/* Empresa */}
          <div>
            <h3 className={sectionTitle}>Datos de la Empresa / Electricista</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-xs text-on-surface-variant mb-1">Nombre / Marca</label><input type="text" value={formData.nombreEmpresa} onChange={(e) => setFormData({ ...formData, nombreEmpresa: e.target.value })} className={inputCls} required /></div>
              <div><label className="block text-xs text-on-surface-variant mb-1">Subtítulo / Especialidad</label><input type="text" value={formData.subtituloEmpresa} onChange={(e) => setFormData({ ...formData, subtituloEmpresa: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-xs text-on-surface-variant mb-1">CUIT / DNI</label><input type="text" value={formData.cuit} onChange={(e) => setFormData({ ...formData, cuit: e.target.value })} className={`${inputCls} font-mono`} /></div>
              <div><label className="block text-xs text-on-surface-variant mb-1">Teléfono / WhatsApp</label><input type="text" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-xs text-on-surface-variant mb-1">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-xs text-on-surface-variant mb-1">Dirección</label><input type="text" value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} className={inputCls} /></div>
            </div>
          </div>

          <hr className="border-outline-variant/30" />

          {/* Moneda referencia */}
          <div>
            <h3 className={`${sectionTitle} flex items-center gap-2`}><DollarSign className="w-4 h-4 text-primary" />Cotización de Referencia (Informativa)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className="block text-xs text-on-surface-variant mb-1">Nombre de Moneda</label><input type="text" value={formData.dolarReferenciaNombre} onChange={(e) => setFormData({ ...formData, dolarReferenciaNombre: e.target.value })} className={inputCls} placeholder="USD Blue, USD Oficial" /></div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Cotización 1 USD en ARS</label>
                <div className="relative"><span className="text-xs text-on-surface-variant absolute left-3 top-2.5 font-mono">$</span><input type="number" step="0.01" value={formData.dolarReferenciaValor} onChange={(e) => setFormData({ ...formData, dolarReferenciaValor: parseFloat(e.target.value) || 0 })} className={`${inputCls} pl-7 font-mono text-primary font-bold`} required /></div>
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-on-surface">
                  <input type="checkbox" checked={formData.mostrarDolarPorDefecto} onChange={(e) => setFormData({ ...formData, mostrarDolarPorDefecto: e.target.checked })} className="w-4 h-4 text-primary rounded border-outline-variant bg-surface-container-highest focus:ring-primary" />
                  <span className="text-xs">Mostrar en nuevos presupuestos</span>
                </label>
              </div>
            </div>
          </div>

          <hr className="border-outline-variant/30" />

          {/* Parámetros */}
          <div>
            <h3 className={sectionTitle}>Parámetros de Cotización & Fiscal</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Factura por Defecto</label>
                <select value={formData.tipoFacturaPorDefecto || 'Factura B'} onChange={(e) => setFormData({ ...formData, tipoFacturaPorDefecto: e.target.value as any })} className={inputCls}>
                  {TIPOS_FACTURA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">IVA (%)</label>
                <div className="relative"><input type="number" step="0.1" value={formData.porcentajeIVAPorDefecto ?? 21} onChange={(e) => setFormData({ ...formData, porcentajeIVAPorDefecto: parseFloat(e.target.value) || 0 })} className={`${inputCls} font-mono pr-7`} /><Percent className="w-3.5 h-3.5 text-on-surface-variant absolute right-2.5 top-2.5" /></div>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">IIBB (%)</label>
                <div className="relative"><input type="number" step="0.1" value={formData.porcentajeIIBBPorDefecto ?? 3.5} onChange={(e) => setFormData({ ...formData, porcentajeIIBBPorDefecto: parseFloat(e.target.value) || 0 })} className={`${inputCls} font-mono pr-7`} /><Percent className="w-3.5 h-3.5 text-on-surface-variant absolute right-2.5 top-2.5" /></div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Margen por Defecto (%)</label>
                <div className="relative"><input type="number" value={formData.margenPorDefectoPct} onChange={(e) => setFormData({ ...formData, margenPorDefectoPct: parseFloat(e.target.value) || 0 })} className={`${inputCls} font-mono pr-7`} /><Percent className="w-3.5 h-3.5 text-on-surface-variant absolute right-2.5 top-2.5" /></div>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Validez por Defecto (días)</label>
                <div className="relative"><input type="number" value={formData.validezDiasPorDefecto} onChange={(e) => setFormData({ ...formData, validezDiasPorDefecto: parseInt(e.target.value) || 15 })} className={`${inputCls} font-mono pr-7`} /><Calendar className="w-3.5 h-3.5 text-on-surface-variant absolute right-2.5 top-2.5" /></div>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Prefijo de Número</label>
                <input type="text" value={formData.prefijoPresupuesto} onChange={(e) => setFormData({ ...formData, prefijoPresupuesto: e.target.value.toUpperCase() })} className={`${inputCls} font-mono`} />
              </div>
            </div>
          </div>

          <hr className="border-outline-variant/30" />

          {/* Parámetros v2 (Calibración EMA & Vencimientos) */}
          <div>
            <h3 className={sectionTitle}>Ajustes de Calibración & Vencimiento (v2)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Peso α EMA Calibración MO</label>
                <input type="number" step="0.05" min="0.05" max="0.95" value={formData.alphaEmaManoObra ?? 0.3} onChange={(e) => setFormData({ ...formData, alphaEmaManoObra: parseFloat(e.target.value) || 0.3 })} className={`${inputCls} font-mono`} />
                <span className="text-[10px] text-on-surface-variant/70">Defecto: 0.3 (30% peso a dato nuevo)</span>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Umbral Vencimiento Verde (días)</label>
                <input type="number" value={formData.diasVencimientoPrecioVerde ?? 30} onChange={(e) => setFormData({ ...formData, diasVencimientoPrecioVerde: parseInt(e.target.value) || 30 })} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Umbral Vencimiento Amarillo (días)</label>
                <input type="number" value={formData.diasVencimientoPrecioAmarillo ?? 60} onChange={(e) => setFormData({ ...formData, diasVencimientoPrecioAmarillo: parseInt(e.target.value) || 60 })} className={`${inputCls} font-mono`} />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-outline-variant/30 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
            <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm shadow-sm"><Save className="w-3.5 h-3.5" />Guardar Configuración</button>
          </div>
        </form>
      </div>

      <AuthModal isOpen={showAuthSetup} onClose={() => setShowAuthSetup(false)} />
    </div>
  );
};

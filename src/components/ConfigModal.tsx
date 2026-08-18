import React from 'react';
import { X, Save, Settings, DollarSign, Percent, Calendar, Sun, Moon, Monitor, Cloud, KeyRound, CheckCircle2, AlertCircle, RefreshCw, Layers, Plus, Edit2, Trash2, Check, RotateCcw, AlertTriangle } from 'lucide-react';
import { AppConfig } from '../core/types';
import { TIPOS_FACTURA, INITIAL_MATERIALES, INITIAL_MANO_OBRA, INITIAL_COSTOS_INDIRECTOS, INITIAL_TAREAS_TIPO, BASE_TAREA_CATEGORIES, DEFAULT_MOTORES_BUSQUEDA, DEFAULT_APP_CONFIG } from '../core/sampleData';
import { AuthModal } from './AuthModal';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useToast } from '../contexts/ToastContext';
import { useConfigViewModel } from '../viewmodels/useConfigViewModel';

interface ConfigModalProps {
  config: AppConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ config, isOpen, onClose, onSave }) => {
  useEscapeKey(isOpen, onClose);
  const { toast } = useToast();

  const {
    formData,
    setFormData,
    updateFormData,
    handleSubmit,
    showAuthSetup,
    setShowAuthSetup,
    firebaseConfigured,
    currentFbConfig,
    newCatName,
    setNewCatName,
    editingCatIndex,
    editingCatValue,
    setEditingCatValue,
    handleSaveConfig,
    handleRestoreDefaultCategories,
    handleRestoreDefaultMaterials,
    handleRestoreDefaultManoObra,
    handleRestoreDefaultCostosIndirectos,
    handleRestoreDefaultTareasTipo,
    handleRestoreDefaultTareaCategories,
    handleResetToDefaults,
    handleAddCategory,
    handleStartEditCat,
    handleSaveEditCat,
    handleCancelEditCat,
    handleDeleteCategory,
    handleClearCustomFirebase
  } = useConfigViewModel({ config, isOpen, onClose, onSave });

  if (!isOpen) return null;

  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 min-h-[44px] transition-shadow";
  const sectionTitle = "text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] text-on-surface pb-safe">
        {/* Mobile Drag indicator */}
        <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />

        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-outline-variant/30 flex items-center justify-between shrink-0 bg-surface-container-low">
          <div className="flex items-center gap-2 text-primary font-semibold text-base">
            <Settings className="w-5 h-5" />
            <span>Configuración General del Cotizador</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors shrink-0"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
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

          {/* Integración Sincronización Descentralizada */}
          <div>
            <h3 className={`${sectionTitle} flex items-center gap-2`}><Cloud className="w-4 h-4 text-primary" />Sincronización Descentralizada & Frecuencia</h3>
            <div className="p-4 rounded-2xl bg-surface-container-highest border border-outline-variant/30 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('ieba_sync_active_provider', 'local_file');
                    setFormData({
                      ...formData,
                      syncConfig: {
                        providerType: 'local_file',
                        autoSync: formData.autoSyncEnabled ?? true,
                        syncIntervalMinutes: formData.syncIntervalMinutes ?? 5
                      }
                    });
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    (formData.syncConfig?.providerType || localStorage.getItem('ieba_sync_active_provider')) === 'local_file'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant/30 bg-surface text-on-surface hover:border-outline'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5">📁 Carpeta Local</div>
                  <div className="text-[10px] text-on-surface-variant mt-1">Disco local, Dropbox, Google Drive Sync o pendrive.</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('ieba_sync_active_provider', 'google_drive');
                    setFormData({
                      ...formData,
                      syncConfig: {
                        providerType: 'google_drive',
                        autoSync: formData.autoSyncEnabled ?? true,
                        syncIntervalMinutes: formData.syncIntervalMinutes ?? 5
                      }
                    });
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    (formData.syncConfig?.providerType || localStorage.getItem('ieba_sync_active_provider')) === 'google_drive'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant/30 bg-surface text-on-surface hover:border-outline'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5">☁️ Google Drive</div>
                  <div className="text-[10px] text-on-surface-variant mt-1">Sincronización en tu espacio personal de Google.</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('ieba_sync_active_provider', 'manual_json');
                    setFormData({
                      ...formData,
                      syncConfig: {
                        providerType: 'manual_json',
                        autoSync: false,
                        syncIntervalMinutes: formData.syncIntervalMinutes ?? 5
                      }
                    });
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    (formData.syncConfig?.providerType || localStorage.getItem('ieba_sync_active_provider')) === 'manual_json'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant/30 bg-surface text-on-surface hover:border-outline'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5">💾 Respaldo JSON</div>
                  <div className="text-[10px] text-on-surface-variant mt-1">Descarga y carga manual con fusión de datos.</div>
                </button>
              </div>

              <div className="pt-3 border-t border-outline-variant/20 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-on-surface">
                    <input
                      type="checkbox"
                      checked={formData.autoSyncEnabled ?? true}
                      onChange={(e) => setFormData({ ...formData, autoSyncEnabled: e.target.checked })}
                      className="w-4 h-4 text-primary rounded border-outline-variant bg-surface-container-highest focus:ring-primary"
                    />
                    <span>Sincronización Automática en Segundo Plano</span>
                  </label>
                  <p className="text-[10px] text-on-surface-variant/80 mt-0.5 pl-6">
                    Fusiona cambios por lotes al cambiar de pestaña o en intervalos regulares.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Intervalo de Fusión Automática</label>
                  <select
                    value={formData.syncIntervalMinutes ?? 5}
                    onChange={(e) => setFormData({ ...formData, syncIntervalMinutes: parseInt(e.target.value) || 5 })}
                    className={inputCls}
                    disabled={formData.autoSyncEnabled === false}
                  >
                    <option value={1}>Cada 1 minuto (Tiempo real)</option>
                    <option value={3}>Cada 3 minutos</option>
                    <option value={5}>Cada 5 minutos (Recomendado)</option>
                    <option value={10}>Cada 10 minutos</option>
                    <option value={15}>Cada 15 minutos</option>
                  </select>
                </div>
              </div>
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
                <label className="block text-xs text-on-surface-variant mb-1">Condición Fiscal Emisor</label>
                <select
                  value={formData.condicionFiscalEmisor || (formData.monotributista ? 'monotributo' : 'responsable_inscripto')}
                  onChange={(e) => {
                    const val = e.target.value as 'monotributo' | 'responsable_inscripto';
                    const isMono = val === 'monotributo';
                    setFormData({
                      ...formData,
                      condicionFiscalEmisor: val,
                      monotributista: isMono,
                      tipoFacturaPorDefecto: isMono ? 'Factura C' : (formData.tipoFacturaPorDefecto === 'Factura C' ? 'Factura B' : formData.tipoFacturaPorDefecto)
                    });
                  }}
                  className={inputCls}
                >
                  <option value="monotributo">Monotributo (Factura C)</option>
                  <option value="responsable_inscripto">Responsable Inscripto (Factura A y B)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Modo de Carga de Precios</label>
                <select
                  value={formData.modoIngresoPreciosDefault || 'con_iva'}
                  onChange={(e) => setFormData({ ...formData, modoIngresoPreciosDefault: e.target.value as any })}
                  className={inputCls}
                >
                  <option value="con_iva">Precios Finales (Con IVA incluido)</option>
                  <option value="neto">Precios Netos (Sin IVA)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Factura por Defecto</label>
                <select value={formData.tipoFacturaPorDefecto || 'Factura B'} onChange={(e) => setFormData({ ...formData, tipoFacturaPorDefecto: e.target.value as any })} className={inputCls}>
                  {TIPOS_FACTURA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">IVA por Defecto (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.alicuotaIVAPorDefecto ?? formData.porcentajeIVAPorDefecto ?? 21}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      setFormData({ ...formData, alicuotaIVAPorDefecto: v, porcentajeIVAPorDefecto: v });
                    }}
                    className={`${inputCls} font-mono pr-7`}
                  />
                  <Percent className="w-3.5 h-3.5 text-on-surface-variant absolute right-2.5 top-2.5" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">IIBB (%)</label>
                <div className="relative"><input type="number" step="0.1" value={formData.porcentajeIIBBPorDefecto ?? 3.5} onChange={(e) => setFormData({ ...formData, porcentajeIIBBPorDefecto: parseFloat(e.target.value) || 0 })} className={`${inputCls} font-mono pr-7`} /><Percent className="w-3.5 h-3.5 text-on-surface-variant absolute right-2.5 top-2.5" /></div>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Margen por Defecto (%)</label>
                <div className="relative"><input type="number" inputMode="decimal" value={formData.margenPorDefectoPct} onChange={(e) => setFormData({ ...formData, margenPorDefectoPct: parseFloat(e.target.value) || 0 })} className={`${inputCls} font-mono pr-7`} /><Percent className="w-3.5 h-3.5 text-on-surface-variant absolute right-2.5 top-2.5" /></div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Umbral Alerta Margen Bajo (%)</label>
                <div className="relative"><input type="number" inputMode="decimal" value={formData.umbralMargenMinimoAdvertencia ?? 20} onChange={(e) => setFormData({ ...formData, umbralMargenMinimoAdvertencia: parseFloat(e.target.value) || 0 })} className={`${inputCls} font-mono pr-7`} /><Percent className="w-3.5 h-3.5 text-on-surface-variant absolute right-2.5 top-2.5" /></div>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Validez por Defecto (días)</label>
                <div className="relative"><input type="number" inputMode="decimal" value={formData.validezDiasPorDefecto} onChange={(e) => setFormData({ ...formData, validezDiasPorDefecto: parseInt(e.target.value) || 15 })} className={`${inputCls} font-mono pr-7`} /><Calendar className="w-3.5 h-3.5 text-on-surface-variant absolute right-2.5 top-2.5" /></div>
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
                <input type="number" step="0.05" min="0.05" max="0.95" value={formData.alphaEmaManoObra ?? DEFAULT_APP_CONFIG.alphaEmaManoObra} onChange={(e) => setFormData({ ...formData, alphaEmaManoObra: parseFloat(e.target.value) || DEFAULT_APP_CONFIG.alphaEmaManoObra })} className={`${inputCls} font-mono`} />
                <span className="text-[10px] text-on-surface-variant/70">Defecto: {DEFAULT_APP_CONFIG.alphaEmaManoObra} (30% peso a dato nuevo)</span>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Umbral Vencimiento Verde (días)</label>
                <input type="number" value={formData.diasVencimientoPrecioVerde ?? DEFAULT_APP_CONFIG.diasVencimientoPrecioVerde} onChange={(e) => setFormData({ ...formData, diasVencimientoPrecioVerde: parseInt(e.target.value) || DEFAULT_APP_CONFIG.diasVencimientoPrecioVerde })} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Umbral Vencimiento Amarillo (días)</label>
                <input type="number" value={formData.diasVencimientoPrecioAmarillo ?? DEFAULT_APP_CONFIG.diasVencimientoPrecioAmarillo} onChange={(e) => setFormData({ ...formData, diasVencimientoPrecioAmarillo: parseInt(e.target.value) || DEFAULT_APP_CONFIG.diasVencimientoPrecioAmarillo })} className={`${inputCls} font-mono`} />
              </div>
            </div>
          </div>

          <hr className="border-outline-variant/30" />

          {/* Motores de Búsqueda de Precios Online */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className={`${sectionTitle} mb-0`}>Buscadores de Precios Online (Mercado Libre, Google, Tiendas)</h3>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    motoresBusquedaOnline: DEFAULT_MOTORES_BUSQUEDA
                  }));
                }}
                className="text-[11px] text-primary hover:underline"
              >
                Restablecer Predeterminados
              </button>
            </div>
            <p className="text-[11px] text-on-surface-variant mb-3">
              Activa o desactiva las plataformas donde consultar precios en 1 clic. Puedes agregar la URL de búsqueda de cualquier proveedor usando <code className="bg-surface-container-highest px-1.5 py-0.5 rounded font-mono text-[10px]">{"{query}"}</code>.
            </p>

            <div className="space-y-2">
              {(formData.motoresBusquedaOnline || DEFAULT_MOTORES_BUSQUEDA).map((engine, idx) => (
                <div key={engine.id || idx} className="p-3 bg-surface-container-highest/60 border border-outline-variant/20 rounded-2xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={engine.activo}
                      onChange={(e) => {
                        const next = [...(formData.motoresBusquedaOnline || DEFAULT_MOTORES_BUSQUEDA)];
                        next[idx] = { ...next[idx], activo: e.target.checked };
                        setFormData({ ...formData, motoresBusquedaOnline: next });
                      }}
                      className="w-4 h-4 text-primary rounded border-outline-variant focus:ring-primary"
                    />
                    <div className="min-w-0">
                      <span className="font-semibold text-on-surface block truncate">{engine.nombre}</span>
                      <span className="text-[10px] text-on-surface-variant font-mono truncate block opacity-75">{engine.urlTemplate}</span>
                    </div>
                  </div>

                  {engine.id !== 'mercadolibre' && engine.id !== 'google_shopping' && engine.id !== 'google_web' && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = (formData.motoresBusquedaOnline || DEFAULT_MOTORES_BUSQUEDA).filter((_, i) => i !== idx);
                        setFormData({ ...formData, motoresBusquedaOnline: next });
                      }}
                      className="p-1.5 text-on-surface-variant hover:text-rose-500 rounded-lg transition-colors"
                      title="Eliminar buscador personalizado"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Formulario para agregar nuevo motor */}
            <div className="mt-3 p-3 bg-surface-container border border-dashed border-outline-variant/30 rounded-2xl space-y-2">
              <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider block">+ Agregar Tienda o Distribuidor</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nombre (ej: Easy, Distribuidora Eléctrica)"
                  id="new-engine-name"
                  className={`${inputCls} py-1.5 text-xs min-h-[38px]`}
                />
                <input
                  type="text"
                  placeholder="URL con {query} (ej: https://tienda.com/search?q={query})"
                  id="new-engine-url"
                  className={`${inputCls} py-1.5 text-xs min-h-[38px] font-mono`}
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const nameInput = document.getElementById('new-engine-name') as HTMLInputElement;
                    const urlInput = document.getElementById('new-engine-url') as HTMLInputElement;
                    const name = nameInput?.value.trim();
                    const url = urlInput?.value.trim();
                    if (!name || !url) {
                      toast.warning('Ingresa el nombre y la URL con el comodín {query}');
                      return;
                    }
                    if (!url.includes('{query}')) {
                      toast.warning('La URL debe contener el comodín {query}, por ejemplo: https://tienda.com/buscar?q={query}');
                      return;
                    }
                    const newEngine = {
                      id: `eng-${Date.now()}`,
                      nombre: name,
                      urlTemplate: url,
                      activo: true
                    };
                    const next = [...(formData.motoresBusquedaOnline || DEFAULT_MOTORES_BUSQUEDA), newEngine];
                    setFormData({ ...formData, motoresBusquedaOnline: next });
                    nameInput.value = '';
                    urlInput.value = '';
                    toast.success(`Buscador "${name}" agregado`);
                  }}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs rounded-xl transition"
                >
                  + Agregar Buscador
                </button>
              </div>
            </div>
          </div>

          <hr className="border-outline-variant/30" />

          {/* Categorías de Trabajos / Tareas Tipo */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className={`${sectionTitle} mb-0 flex items-center gap-2`}>
                <Layers className="w-4 h-4 text-primary" /> Categorías de Trabajos / Tareas Tipo
              </h3>
              <button
                type="button"
                onClick={handleRestoreDefaultTareaCategories}
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Restablecer Predeterminadas
              </button>
            </div>
            <p className="text-[11px] text-on-surface-variant mb-3">
              Personaliza las categorías para clasificar tus trabajos tipo, módulos y plantillas de cotización (ej: Bocas, Tableros, Acometidas, Energía Solar, etc.).
            </p>

            <div className="space-y-2">
              {(formData.categoriasTarea || BASE_TAREA_CATEGORIES).map((cat, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-surface-container-highest/60 border border-outline-variant/20 rounded-2xl flex items-center justify-between gap-3 text-xs"
                >
                  {editingCatIndex === idx ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="text"
                        value={editingCatValue}
                        onChange={(e) => setEditingCatValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEditCat(idx);
                          } else if (e.key === 'Escape') {
                            handleCancelEditCat();
                          }
                        }}
                        autoFocus
                        className={`${inputCls} py-1 px-2.5 text-xs min-h-[34px] flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEditCat(idx)}
                        className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition"
                        title="Guardar nombre"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditCat}
                        className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-xl transition"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        <span className="font-semibold text-on-surface truncate">{cat}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditCat(idx, cat)}
                          className="p-1.5 text-on-surface-variant hover:text-primary rounded-lg transition-colors hover:bg-surface-container-high"
                          title="Editar nombre de categoría"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(idx)}
                          className="p-1.5 text-on-surface-variant hover:text-rose-500 rounded-lg transition-colors hover:bg-surface-container-high"
                          title="Eliminar categoría"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Formulario para agregar nueva categoría */}
            <div className="mt-3 p-3 bg-surface-container border border-dashed border-outline-variant/30 rounded-2xl flex items-center gap-2">
              <input
                type="text"
                placeholder="Nueva categoría (ej: Solar / Fotovoltaica, Domótica...)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
                className={`${inputCls} py-1.5 text-xs min-h-[38px] flex-1`}
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>
          </div>

          <hr className="border-outline-variant/30" />

          {/* Mantenimiento de Datos de Fábrica */}
          <div>
            <h3 className={`${sectionTitle} flex items-center gap-2 text-rose-500`}>
              <RefreshCw className="w-4 h-4 text-rose-500" /> Mantenimiento & Datos de Fábrica
            </h3>
            <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl space-y-4">
              <div>
                <h4 className="text-xs font-bold text-on-surface">Restaurar Categorías de Materiales por Defecto</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 mb-2">
                  Restablece el listado inicial de categorías (Cables, Protecciones, Canalizaciones, etc.) con sus atributos sugeridos. Usar con precaución.
                </p>
                <button
                  type="button"
                  onClick={handleRestoreDefaultCategories}
                  className="px-4 py-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 font-semibold text-xs rounded-xl border border-rose-500/30 transition-colors"
                >
                  Restaurar Categorías de Materiales IEBA
                </button>
              </div>

              <div className="pt-3 border-t border-rose-500/20">
                <h4 className="text-xs font-bold text-on-surface">Cargar / Restaurar Catálogo Base de Materiales</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 mb-2">
                  Carga las fichas técnicas por defecto en el catálogo: {INITIAL_MATERIALES.length} materiales (cables unipolares con código de colores, cajas de chapa y PVC, gabinetes, caños RS y PVC, conectores y bandejas portacables con accesorios).
                </p>
                <button
                  type="button"
                  onClick={handleRestoreDefaultMaterials}
                  className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 font-semibold text-xs rounded-xl border border-primary/30 transition-colors"
                >
                  Cargar Catálogo Base de Materiales ({INITIAL_MATERIALES.length} Fichas)
                </button>
              </div>

              <div className="pt-3 border-t border-rose-500/20">
                <h4 className="text-xs font-bold text-on-surface">Cargar / Restaurar Mano de Obra por Defecto</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 mb-2">
                  Carga los {INITIAL_MANO_OBRA.length} roles estándar de mano de obra eléctrica (Oficial Especializado, Oficial, Medio Oficial, Ayudante, Capataz, Matriculado, Tablerista, Proyectista) con tarifas en $0 para completar según tus costos.
                </p>
                <button
                  type="button"
                  onClick={handleRestoreDefaultManoObra}
                  className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 font-semibold text-xs rounded-xl border border-primary/30 transition-colors"
                >
                  Cargar Mano de Obra Base ({INITIAL_MANO_OBRA.length} Roles)
                </button>
              </div>

              <div className="pt-3 border-t border-rose-500/20">
                <h4 className="text-xs font-bold text-on-surface">Cargar / Restaurar Gastos Generales y Estructura por Defecto</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 mb-2">
                  Carga los {INITIAL_COSTOS_INDIRECTOS.length} conceptos típicos de gastos indirectos y de estructura (Movilidad, Seguro AP/ART, EPP, Amortización herramientas, Gastos administrativos, Taller, Matrícula, Imprevistos, Andamios) con valores en 0.
                </p>
                <button
                  type="button"
                  onClick={handleRestoreDefaultCostosIndirectos}
                  className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 font-semibold text-xs rounded-xl border border-primary/30 transition-colors"
                >
                  Cargar Gastos Generales Base ({INITIAL_COSTOS_INDIRECTOS.length} Conceptos)
                </button>
              </div>

              <div className="pt-3 border-t border-rose-500/20">
                <h4 className="text-xs font-bold text-on-surface">Cargar / Restaurar Trabajos Tipo Base</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 mb-2">
                  Carga los trabajos tipo recomendados de fábrica, incluyendo el modelo paramétrico de Recableado Integral (con coeficientes de antigüedad, accesibilidad, altura, artefactos especiales y cláusula técnica de protección).
                </p>
                <button
                  type="button"
                  onClick={handleRestoreDefaultTareasTipo}
                  className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 font-semibold text-xs rounded-xl border border-primary/30 transition-colors"
                >
                  Cargar Trabajos Tipo Recomendados ({INITIAL_TAREAS_TIPO.length} Plantillas)
                </button>
              </div>

              <div className="pt-3 border-t border-rose-500/20">
                <h4 className="text-xs font-bold text-on-surface">Restaurar Categorías de Trabajos Tipo por Defecto</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 mb-2">
                  Restablece las categorías de trabajos tipo a los valores de fábrica (Bocas, Circuitos, Tableros, Acometidas, Medición).
                </p>
                <button
                  type="button"
                  onClick={handleRestoreDefaultTareaCategories}
                  className="px-4 py-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 font-semibold text-xs rounded-xl border border-rose-500/30 transition-colors"
                >
                  Restaurar Categorías de Trabajos Tipo
                </button>
              </div>

              {/* Botón Maestro de Reseteo Total */}
              <div className="pt-4 border-t-2 border-rose-500/40 bg-rose-500/10 p-3.5 rounded-xl">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Zona de Peligro: Restablecer Todo de Fábrica</h4>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-1 mb-3">
                  Borra todos los presupuestos, clientes, proveedores y tareas creadas, y restablece completamente la base de datos a sus valores iniciales limpios de fábrica.
                </p>
                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restablecer TODO a Valores por Defecto
                </button>
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

import React, { useState } from 'react';
import { X, HelpCircle, FileSpreadsheet, Layers, Smartphone, Cloud, ArrowRight, CheckCircle2, Download } from 'lucide-react';

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenImporter?: () => void;
}

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({
  isOpen,
  onClose,
  onOpenImporter
}) => {
  const [activeTab, setActiveTab] = useState<'excel' | 'laboratorio' | 'obra' | 'sync'>('excel');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-3xl shadow-2xl p-6 text-on-surface max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-on-surface">Centro de Ayuda y Guía del Cotizador IEBA</h3>
              <p className="text-xs text-on-surface-variant">Instructivo rápido de uso, importación masiva de materiales y recolección en obra.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-outline-variant/20 gap-2 mb-4 shrink-0 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('excel')}
            className={`pb-2.5 px-3 font-semibold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'excel'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>1. Importación ExcelJS</span>
          </button>

          <button
            onClick={() => setActiveTab('laboratorio')}
            className={`pb-2.5 px-3 font-semibold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'laboratorio'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2. Ensambles y Cotizador</span>
          </button>

          <button
            onClick={() => setActiveTab('obra')}
            className={`pb-2.5 px-3 font-semibold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'obra'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>3. Registro de Obra</span>
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`pb-2.5 px-3 font-semibold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'sync'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>4. Modo Offline & Sincronización</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-on-surface-variant leading-relaxed">
          {activeTab === 'excel' && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl text-on-surface">
                <h4 className="font-bold text-sm text-primary flex items-center gap-2 mb-1">
                  <FileSpreadsheet className="w-4 h-4" />
                  Importación Técnica Masiva de Catálogo de Materiales
                </h4>
                <p>
                  El sistema genera plantillas inteligentes en formato <strong>.xlsx (ExcelJS)</strong> con dos hojas coordinadas para garantizar la calidad de datos sin errores de tipeo.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/20 space-y-1">
                  <span className="font-bold text-on-surface block text-xs">📊 Hoja 1: Materiales</span>
                  <p>Contiene la Tabla Oficial de Excel con las columnas: <em>Nombre / Descripción, Categoría, Unidad, Norma, Marca y Precio Referencia ARS</em>.</p>
                  <p className="text-primary font-medium pt-1">
                    ✓ La columna Categoría cuenta con validación desplegable vinculada automáticamente a la lista de tu base de datos.
                  </p>
                </div>

                <div className="p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/20 space-y-1">
                  <span className="font-bold text-on-surface block text-xs">🏷️ Hoja 2: Categorías (Disponibles)</span>
                  <p>Enlista todas las categorías registradas en tu sistema local (ej. <em>Cables & Conductores, Protecciones, Canalizaciones</em>).</p>
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                    ⚡ Creación On-the-fly: Si tipeas una categoría nueva en el Excel, el sistema la creará automáticamente al importar.
                  </p>
                </div>
              </div>

              {onOpenImporter && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenImporter();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-semibold text-xs rounded-full shadow-sm hover:bg-primary/90"
                  >
                    <Download className="w-4 h-4" />
                    <span>Abrir Importador y Descargar Plantilla</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'laboratorio' && (
            <div className="space-y-4">
              <div className="p-4 bg-surface-container-high border border-outline-variant/20 rounded-2xl text-on-surface space-y-2">
                <h4 className="font-bold text-sm text-primary flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Laboratorio de Tareas Tipo (Ensambles Eléctricos)
                </h4>
                <p>
                  Un ensamble o Tarea Tipo (ej. <em>"Punto de Toma Monofásico 10A"</em>) agrupa la lista de insumos necesarios y el tiempo de mano de obra estimado por unidad.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-on-surface">Pasos para armar un Presupuesto:</h5>
                <ol className="list-decimal pl-5 space-y-1.5 font-mono text-[11px]">
                  <li>Crea tus Tareas Tipo asignando materiales (ej. 1 caja, 1 módulo, 5m cable 2.5mm²) y horas de trabajo.</li>
                  <li>Abre el <strong>Editor de Presupuestos</strong> y añade los ítems especificando las cantidades de obra.</li>
                  <li>Aplica los márgenes de ganancia, costos indirectos e impuestos deseados.</li>
                  <li>Haz clic en <strong>"Vista Previa & PDF"</strong> para generar el documento formal para tu cliente.</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'obra' && (
            <div className="space-y-4">
              <div className="p-4 bg-surface-container-high border border-outline-variant/20 rounded-2xl text-on-surface space-y-2">
                <h4 className="font-bold text-sm text-primary flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Registro de Campo / Recolección en Obra (Mobile-First)
                </h4>
                <p>
                  Diseñado para usar desde el teléfono celular al finalizar la jornada o estando en la calle.
                </p>
              </div>

              <div className="p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/20 space-y-2">
                <span className="font-bold text-on-surface block text-xs">Métricas de Rendimiento y Factor EMA:</span>
                <p>
                  Al anotar las horas reales ejecutadas por tarea, el sistema calcula automáticamente la Media Móvil Exponencial (EMA) para sugerirte correcciones de tiempo reales en tus presupuestos futuros.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="p-4 bg-surface-container-high border border-outline-variant/20 rounded-2xl text-on-surface space-y-2">
                <h4 className="font-bold text-sm text-primary flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  Arquitectura Offline-First y Sincronización Delta
                </h4>
                <p>
                  Tu aplicación funciona <strong>100% sin conexión a Internet</strong> guardando todos tus datos de forma segura en la base de datos local Dexie/IndexedDB de tu dispositivo.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/20 space-y-1">
                  <span className="font-bold text-on-surface block text-xs">🔄 Sincronización Delta Ligera</span>
                  <p>Cuando te conectas a Internet, la PWA envía únicamente los registros modificados a la nube de Firebase, ahorrando más del 90% de consumo de datos y cuota.</p>
                </div>

                <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/20 space-y-1">
                  <span className="font-bold text-on-surface block text-xs">⚠️ Circuit Breaker de Cuota</span>
                  <p>Si la cuota de la nube se agota, el sistema conmuta automáticamente a <strong>Modo Local</strong> sin interrumpir tu trabajo ni trabar la pantalla.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-outline-variant/30 flex justify-between items-center shrink-0">
          <span className="text-[11px] text-on-surface-variant font-mono">Cotizador Eléctrico — IEBA v1.3.0</span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-surface-container-highest hover:bg-surface-variant text-on-surface rounded-full transition-colors"
          >
            Entendido, Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

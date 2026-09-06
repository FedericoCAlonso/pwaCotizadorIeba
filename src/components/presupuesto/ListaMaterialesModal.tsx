import React, { useState, useMemo } from 'react';
import {
  Package,
  X,
  FileSpreadsheet,
  Send,
  Copy,
  Check,
  ExternalLink,
  DollarSign,
  AlertCircle,
  Layers
} from 'lucide-react';
import { Presupuesto, Contacto, Cliente, AppConfig, MaterialFilterContext } from '../../core/types';
import { formatARS } from '../../core/calculations';
import {
  consolidarMaterialesPresupuesto,
  generarMensajeWhatsAppListaMateriales,
  generarEnlaceWhatsApp,
  MaterialConsolidadoItem
} from '../../core/whatsappUtils';
import { exportListaMaterialesToXLSX } from '../../core/exportUtils';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useToast } from '../../contexts/ToastContext';

interface ListaMaterialesModalProps {
  isOpen: boolean;
  onClose: () => void;
  presupuesto: Presupuesto | null;
  cliente?: Contacto | Cliente | null;
  config?: AppConfig | null;
  onOpenInCatalog?: () => void;
}

export const ListaMaterialesModal: React.FC<ListaMaterialesModalProps> = ({
  isOpen,
  onClose,
  presupuesto,
  cliente,
  config,
  onOpenInCatalog
}) => {
  useEscapeKey(isOpen, onClose);
  const { toast } = useToast();

  const [incluirPrecios, setIncluirPrecios] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const materialesConsolidados: MaterialConsolidadoItem[] = useMemo(() => {
    if (!presupuesto || !presupuesto.items) return [];
    return consolidarMaterialesPresupuesto(presupuesto.items);
  }, [presupuesto]);

  const filteredMateriales = useMemo(() => {
    if (!searchTerm.trim()) return materialesConsolidados;
    const q = searchTerm.toLowerCase();
    return materialesConsolidados.filter((m) => m.nombre.toLowerCase().includes(q));
  }, [materialesConsolidados, searchTerm]);

  const totalCostoMateriales = useMemo(() => {
    return materialesConsolidados.reduce((acc, m) => acc + m.subtotal, 0);
  }, [materialesConsolidados]);

  if (!isOpen || !presupuesto) return null;

  const handleCopyText = async () => {
    try {
      const text = generarMensajeWhatsAppListaMateriales(presupuesto, cliente as any, config, incluirPrecios);
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success('¡Lista de materiales copiada al portapapeles!');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      toast.error('No se pudo copiar la lista');
    }
  };

  const handleExportXLSX = async () => {
    try {
      await exportListaMaterialesToXLSX(presupuesto, cliente, config, incluirPrecios);
      toast.success('Excel de materiales descargado');
    } catch (err) {
      console.error(err);
      toast.error('Error al exportar Excel');
    }
  };

  const handleShareWhatsApp = () => {
    const text = generarMensajeWhatsAppListaMateriales(presupuesto, cliente as any, config, incluirPrecios);
    const url = generarEnlaceWhatsApp(undefined, text);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleGoToCatalog = () => {
    if (onOpenInCatalog) {
      onOpenInCatalog();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] text-on-surface pb-safe">
        
        {/* Mobile drag bar */}
        <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />

        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-outline-variant/30 flex items-center justify-between shrink-0 bg-surface-container-low">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-on-surface flex items-center gap-2">
                <span>Lista Consolidada de Materiales (BOM)</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                  {materialesConsolidados.length} {materialesConsolidados.length === 1 ? 'insumo' : 'insumos'}
                </span>
              </h3>
              <p className="text-xs text-on-surface-variant">
                Cotización {presupuesto.numero} · Cliente: {cliente?.nombre || (cliente as any)?.razonSocial || 'General'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Header Bar: Options & Search */}
        <div className="px-5 sm:px-6 py-3 bg-surface-container-high border-b border-outline-variant/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-on-surface select-none">
              <input
                type="checkbox"
                checked={incluirPrecios}
                onChange={(e) => setIncluirPrecios(e.target.checked)}
                className="w-4 h-4 text-primary rounded border-outline-variant focus:ring-primary"
              />
              <span>Incluir precios de referencia</span>
            </label>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-on-surface-variant font-medium">Costo Total Insumos:</span>
            <span className="font-mono font-bold text-primary text-sm">
              {formatARS(totalCostoMateriales)}
            </span>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {materialesConsolidados.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-outline-variant/40 rounded-2xl bg-surface-container-low p-6 space-y-2">
              <Layers className="w-10 h-10 text-on-surface-variant/50 mx-auto" />
              <p className="text-sm font-semibold text-on-surface">No hay materiales detallados en esta cotización</p>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                Las partidas agregadas son conceptos globales o directos de mano de obra sin desglose de insumos.
              </p>
            </div>
          ) : (
            <div className="border border-outline-variant/30 rounded-2xl overflow-hidden bg-surface-container-low shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container-highest/80 border-b border-outline-variant/30 text-on-surface-variant text-xs font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Descripción del Material / Insumo</th>
                    <th className="py-2.5 px-3 text-right">Cantidad</th>
                    <th className="py-2.5 px-2 text-center w-16">Unidad</th>
                    {incluirPrecios && (
                      <>
                        <th className="py-2.5 px-3 text-right">Costo Unit. Ref.</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-sans">
                  {filteredMateriales.map((mat, idx) => (
                    <tr key={`${mat.nombre}_${mat.unidad}_${idx}`} className="hover:bg-surface-container transition-colors">
                      <td className="py-2 px-3 text-center text-on-surface-variant font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium text-on-surface">{mat.nombre}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-on-surface">
                        {mat.cantidadTotal.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2 text-center text-on-surface-variant font-medium">{mat.unidad}</td>
                      {incluirPrecios && (
                        <>
                          <td className="py-2 px-3 text-right font-mono text-on-surface-variant">
                            {formatARS(mat.costoUnitario)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-primary">
                            {formatARS(mat.subtotal)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                {incluirPrecios && (
                  <tfoot>
                    <tr className="bg-surface-container-high border-t border-outline-variant/40 font-bold">
                      <td colSpan={4} className="py-3 px-3 text-right text-xs uppercase tracking-wide text-on-surface">
                        Total Estimado de Insumos:
                      </td>
                      <td colSpan={2} className="py-3 px-3 text-right font-mono text-sm text-primary">
                        {formatARS(totalCostoMateriales)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-t border-outline-variant/30 flex flex-wrap items-center justify-between gap-3 bg-surface-container-high shrink-0">
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {onOpenInCatalog && (
              <button
                type="button"
                onClick={handleGoToCatalog}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container text-xs font-bold rounded-full border border-outline-variant/20 transition-all shadow-xs"
                title="Abrir el catálogo de insumos filtrado con los materiales de esta cotización"
              >
                <Package className="w-4 h-4 text-primary" />
                <span>Abrir en Gestor de Insumos</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </button>
            )}

            <button
              type="button"
              onClick={handleExportXLSX}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-surface-container hover:bg-surface-variant text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full border border-emerald-500/30 transition-colors shadow-xs"
              title="Descargar lista de compra de materiales en formato Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyText}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-surface-container hover:bg-surface-variant text-on-surface text-xs font-semibold rounded-full border border-outline-variant/30 transition-colors"
              title="Copiar lista de texto para compras"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{isCopied ? '¡Copiado!' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-full shadow-sm transition-all"
              title="Enviar lista de materiales por WhatsApp a proveedor o distribuidor"
            >
              <Send className="w-4 h-4" />
              <span>WhatsApp Insumos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

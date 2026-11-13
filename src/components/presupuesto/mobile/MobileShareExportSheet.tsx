import React, { useState } from 'react';
import { Eye, FileSpreadsheet, FileText, MessageCircle, Share2, X } from 'lucide-react';
import { AppConfig, Contacto, Presupuesto } from '../../../core/types';
import { formatARS } from '../../../core/calculations';
import { exportPresupuestoToXLSX } from '../../../core/exportUtils';
import { exportPresupuestoToPDF, getPresupuestoPDFBlob } from '../../../core/pdfExportUtils';
import { WhatsAppShareModal } from '../WhatsAppShareModal';

interface MobileShareExportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  presupuesto: Presupuesto;
  cliente?: Contacto;
  config: AppConfig;
  totalFinal: number;
  onOpenPreview: () => void;
}

/**
 * Hoja de acciones rápidas de compartir y exportar cotización en vista móvil.
 */
export const MobileShareExportSheet: React.FC<MobileShareExportSheetProps> = ({
  isOpen,
  onClose,
  presupuesto,
  cliente,
  config,
  totalFinal,
  onOpenPreview
}) => {
  const [waOpen, setWaOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen && !waOpen) return null;

  const handleNativeShare = async () => {
    setBusy('share');
    setStatusMsg(null);
    try {
      const pdfBlob = getPresupuestoPDFBlob(presupuesto, cliente, config);
      const safeNum = (presupuesto.numero || 'cotizacion').replace(/[^a-zA-Z0-9_-]/g, '_');
      const file = new File([pdfBlob], `Presupuesto_${safeNum}.pdf`, {
        type: 'application/pdf'
      });
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          title: `Cotización ${presupuesto.numero || ''}`.trim(),
          text: `${presupuesto.direccionObra || presupuesto.numero || 'Presupuesto'} — Total estimado: ${formatARS(totalFinal)}`,
          files: [file]
        });
        onClose();
        return;
      }
      if (nav.share) {
        await nav.share({
          title: `Cotización ${presupuesto.numero || ''}`.trim(),
          text: `${presupuesto.direccionObra || presupuesto.numero || 'Presupuesto'} — Total: ${formatARS(totalFinal)}`
        });
        onClose();
        return;
      }
      exportPresupuestoToPDF(presupuesto, cliente, config);
      setStatusMsg('Tu navegador no admite compartir archivos; se descargó el PDF.');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        exportPresupuestoToPDF(presupuesto, cliente, config);
        setStatusMsg('Se descargó el PDF como alternativa.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleExportPDF = () => {
    exportPresupuestoToPDF(presupuesto, cliente, config);
    onClose();
  };

  const handleExportXLSX = async () => {
    setBusy('xlsx');
    try {
      await exportPresupuestoToXLSX(presupuesto, cliente, config);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Compartir o exportar cotización"
        >
          <div className="w-full max-w-lg space-y-3 rounded-t-3xl bg-m3-surface p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-m3-on-surface">
                  Compartir y exportar
                </h2>
                <p className="text-xs text-m3-on-surface-variant">
                  Total: {formatARS(totalFinal)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar opciones de compartir"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-m3-on-surface-variant hover:bg-m3-surface-container"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {statusMsg && (
              <p className="rounded-xl bg-m3-surface-container px-3 py-2 text-xs text-m3-on-surface">
                {statusMsg}
              </p>
            )}

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={handleNativeShare}
                className="flex min-h-[48px] items-center gap-3 rounded-2xl bg-m3-primary px-4 py-3 text-left text-sm font-semibold text-m3-on-primary shadow-sm disabled:opacity-50"
              >
                <Share2 className="h-5 w-5 shrink-0" />
                <span>Compartir PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  setWaOpen(true);
                }}
                className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-m3-outline-variant bg-m3-surface-container-low px-4 py-3 text-left text-sm font-medium text-m3-on-surface"
              >
                <MessageCircle className="h-5 w-5 shrink-0 text-m3-primary" />
                <span>Enviar resumen por WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPreview();
                }}
                className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-m3-outline-variant bg-m3-surface-container-low px-4 py-3 text-left text-sm font-medium text-m3-on-surface"
              >
                <Eye className="h-5 w-5 shrink-0 text-m3-on-surface-variant" />
                <span>Vista previa al cliente</span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={handleExportPDF}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-m3-outline-variant bg-m3-surface px-3 py-2.5 text-sm font-medium text-m3-on-surface"
                >
                  <FileText className="h-4 w-4 text-m3-error" />
                  <span>Descargar PDF</span>
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={handleExportXLSX}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-m3-outline-variant bg-m3-surface px-3 py-2.5 text-sm font-medium text-m3-on-surface"
                >
                  <FileSpreadsheet className="h-4 w-4 text-m3-primary" />
                  <span>Descargar Excel</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {waOpen && (
        <WhatsAppShareModal
          isOpen={waOpen}
          onClose={() => setWaOpen(false)}
          presupuesto={presupuesto}
          cliente={cliente}
          config={config}
        />
      )}
    </>
  );
};

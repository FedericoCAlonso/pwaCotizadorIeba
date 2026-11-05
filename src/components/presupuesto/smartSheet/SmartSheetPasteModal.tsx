import React, { useState, useMemo } from 'react';
import { X, ClipboardPaste, ArrowRight, Package, Zap, Truck, CheckCircle2 } from 'lucide-react';
import { MaterialCatalogSuggestion } from '../../../core/materialSuggestions';
import { parsePastedLines, ParsedLineDraft } from '../../../core/smartSheetPasteParser';
import { formatARS } from '../../../core/calculations';

export interface SmartSheetPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialSuggestions?: MaterialCatalogSuggestion[];
  onConfirmPaste: (rawText: string) => void;
}

/**
 * SmartSheetPasteModal: Modal para pegar texto con múltiples renglones
 * separados por tabulador o saltos de línea (Fase 3 - Inciso c).
 */
export const SmartSheetPasteModal: React.FC<SmartSheetPasteModalProps> = ({
  isOpen,
  onClose,
  materialSuggestions = [],
  onConfirmPaste
}) => {
  const [rawText, setRawText] = useState('');

  // Vista previa en tiempo real de los renglones parseados
  const parsedPreview: ParsedLineDraft[] = useMemo(() => {
    return parsePastedLines(rawText, materialSuggestions);
  }, [rawText, materialSuggestions]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (parsedPreview.length === 0) return;
    onConfirmPaste(rawText);
    setRawText('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-paste-lines-title"
    >
      <div className="relative w-full max-w-3xl bg-surface-container-high rounded-2xl shadow-2xl border border-outline-variant/30 flex flex-col max-h-[90vh] overflow-hidden">
        {/* ─── Cabecera ─── */}
        <div className="flex items-center justify-between px-4 py-3 bg-surface-container border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-secondary/10 text-secondary">
              <ClipboardPaste className="w-5 h-5" />
            </span>
            <div>
              <h2 id="modal-paste-lines-title" className="text-sm font-bold text-on-surface">
                Pegar Líneas (Excel, Sheets o Texto)
              </h2>
              <p className="text-xs text-on-surface-variant">
                Pegá texto con varias líneas separadas por tabulador o salto de línea. Se creará una línea por renglón.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── Contenido ─── */}
        <div className="flex-1 min-h-0 flex flex-col p-4 gap-3 overflow-y-auto">
          {/* Área de texto para pegar */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface-variant flex items-center justify-between">
              <span>Texto copiado:</span>
              <span className="text-[11px] text-on-surface-variant/60">
                Soporta columnas: [Función] o [Función, Cantidad] o [Función, Marca, Cantidad, Precio]
              </span>
            </label>
            <textarea
              autoFocus
              rows={5}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Ejemplo con tabuladores:\nCable unipolar 2.5 mm²\tPrysmian\t100\t1500\nDisyuntor bipolar 25A\tSchneider\t2\t18500\n\nO una simple lista:\nCable unipolar 2.5 mm²\nCaja octogonal chica`}
              className="w-full p-2.5 text-xs font-mono bg-surface-container-lowest border border-outline-variant/40 rounded-xl outline-hidden focus:border-primary text-on-surface placeholder:text-on-surface-variant/40 resize-y"
            />
          </div>

          {/* Vista Previa de Líneas Detectadas */}
          <div className="flex-1 min-h-[160px] flex flex-col border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-container-lowest">
            <div className="px-3 py-1.5 bg-surface-container border-b border-outline-variant/20 flex items-center justify-between text-xs font-semibold text-on-surface-variant">
              <span>Vista previa ({parsedPreview.length} {parsedPreview.length === 1 ? 'renglón' : 'renglones'})</span>
              {parsedPreview.some(p => p.catalogMatch) && (
                <span className="text-[11px] text-primary flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Precios y unidades completados desde catálogo
                </span>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-outline-variant/10">
              {parsedPreview.length === 0 ? (
                <div className="py-8 text-center text-xs text-on-surface-variant/50 italic">
                  Pegá texto en el cuadro superior para previsualizar los renglones detectados.
                </div>
              ) : (
                parsedPreview.map((line, idx) => (
                  <div key={idx} className="flex items-center px-3 py-1.5 text-xs gap-2 hover:bg-surface-container-high/30">
                    <span className="w-6 shrink-0 text-center text-[10px] text-on-surface-variant/50 font-mono">
                      {idx + 1}
                    </span>
                    <span className="w-7 shrink-0 flex items-center justify-center">
                      {line.tipo === 'material' && <Package className="w-3.5 h-3.5 text-primary" />}
                      {line.tipo === 'mano_obra' && <Zap className="w-3.5 h-3.5 text-secondary" />}
                      {line.tipo === 'servicio' && <Truck className="w-3.5 h-3.5 text-tertiary" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-on-surface truncate block">
                        {line.funcion}
                      </span>
                    </div>
                    <span className="w-28 shrink-0 text-on-surface-variant/80 truncate text-[11px]">
                      {line.marcaModelo}
                    </span>
                    <span className="w-20 shrink-0 text-right font-mono text-[11px]">
                      {line.formula || line.cantidad} {line.unidad}
                    </span>
                    <span className="w-24 shrink-0 text-right font-mono font-medium text-secondary text-[11px]">
                      {line.precioUnitario > 0 ? formatARS(line.precioUnitario) : '$ 0,00'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="p-3 bg-surface-container border-t border-outline-variant/30 flex items-center justify-between">
          <span className="text-xs text-on-surface-variant">
            {parsedPreview.length > 0
              ? `${parsedPreview.length} ${parsedPreview.length === 1 ? 'línea lista para insertar' : 'líneas listas para insertar'}`
              : 'Sin líneas para procesar'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={parsedPreview.length === 0}
              onClick={handleConfirm}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-primary text-on-primary shadow-xs hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Insertar {parsedPreview.length} {parsedPreview.length === 1 ? 'línea' : 'líneas'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { CheckCircle, X, Lock } from 'lucide-react';
import { OpcionesEmisionPresupuesto } from '../../core/types';
import { formatARS, TotalesPresupuestoResultado } from '../../core/calculations';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface EmisionPresupuestoModalProps {
  isOpen: boolean;
  onClose: () => void;
  opcionesEmision: OpcionesEmisionPresupuesto;
  setOpcionesEmision: React.Dispatch<React.SetStateAction<OpcionesEmisionPresupuesto>>;
  condicionesPagoTexto: string;
  totales: TotalesPresupuestoResultado;
  onConfirmEmitir: (opciones: OpcionesEmisionPresupuesto) => void;
}

export const EmisionPresupuestoModal: React.FC<EmisionPresupuestoModalProps> = ({
  isOpen,
  onClose,
  opcionesEmision,
  setOpcionesEmision,
  condicionesPagoTexto,
  totales,
  onConfirmEmitir,
}) => {
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-on-surface">
        <div className="px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-high">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-on-surface text-base">Opciones de Emisión del Presupuesto</h3>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-full hover:bg-surface-variant transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
              Presentación para el Cliente (Documento / PDF)
            </h4>

            <label className="flex items-start gap-3 p-2 rounded-xl hover:bg-surface-container transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={opcionesEmision.mostrarItemizado ?? true}
                onChange={(e) => setOpcionesEmision((prev) => ({ ...prev, mostrarItemizado: e.target.checked }))}
                className="w-4 h-4 text-primary rounded border-outline mt-0.5"
              />
              <div>
                <span className="text-sm font-semibold text-on-surface block">
                  Mostrar Itemizado (Precios por Renglón)
                </span>
                <span className="text-xs text-on-surface-variant">
                  Si está activo, el cliente ve cada partida con su Precio de Venta unitario y total (Costo × K).
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-2 rounded-xl hover:bg-surface-container transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={opcionesEmision.mostrarDetalleCostos ?? false}
                onChange={(e) => setOpcionesEmision((prev) => ({ ...prev, mostrarDetalleCostos: e.target.checked }))}
                className="w-4 h-4 text-primary rounded border-outline mt-0.5"
              />
              <div>
                <span className="text-sm font-semibold text-on-surface block">Mostrar Detalle de Costos Internos</span>
                <span className="text-xs text-on-surface-variant">
                  Si está desactivado (recomendado), oculta los costos puros de materiales, mano de obra, GG y margen,
                  mostrando solo los Precios de Venta cerrados.
                </span>
              </div>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-primary block">
              Condiciones Comerciales y Aclaraciones
            </label>
            <textarea
              rows={4}
              value={opcionesEmision.condicionesComerciales ?? condicionesPagoTexto}
              onChange={(e) => setOpcionesEmision((prev) => ({ ...prev, condicionesComerciales: e.target.value }))}
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl p-4 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Notas, condiciones de pago, validez de la oferta o aclaraciones sobre el alcance de la obra..."
            />
            <p className="text-[11px] text-on-surface-variant">
              Estas notas se guardan como parte del snapshot inmutable de esta emisión.
            </p>
          </div>

          {/* Summary box before emitting */}
          <div className="bg-primary-container/30 border border-primary/20 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs text-on-surface-variant block">Precio Total Final a Facturar:</span>
              <span className="font-mono text-xl font-bold text-primary">
                {formatARS(totales.precioFinalGlobal)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-on-surface-variant block">Coeficiente K:</span>
              <span className="font-mono text-xs font-bold text-on-surface bg-surface-container px-2.5 py-0.5 rounded-full">
                {totales.coeficienteK.toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-outline-variant/30 flex justify-end gap-3 bg-surface-container-high">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmEmitir(opcionesEmision)}
            className="px-6 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold text-sm rounded-full transition-colors flex items-center gap-2 shadow-sm"
          >
            <Lock className="w-4 h-4" />
            <span>Confirmar & Emitir</span>
          </button>
        </div>
      </div>
    </div>
  );
};

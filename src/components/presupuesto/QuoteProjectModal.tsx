import React, { useEffect, useMemo } from 'react';
import {
  X,
  Building,
  User,
  MapPin,
  Calendar,
  CreditCard,
  Check,
  Sparkles,
  Phone,
  Mail,
  Receipt
} from 'lucide-react';
import { Contacto, TipoFactura } from '../../core/types';
import { ClienteCombobox } from './ClienteCombobox';

interface QuoteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientes: Contacto[];
  clienteId: string;
  onSelectCliente: (id: string) => void;
  direccionObra: string;
  onUpdateDireccionObra: (dir: string) => void;
  validezDias: number;
  onUpdateValidezDias: (dias: number) => void;
  tipoFactura: TipoFactura;
  onUpdateTipoFactura: (tipo: TipoFactura) => void;
  condicionesPagoTexto: string;
  onUpdateCondicionesPagoTexto: (texto: string) => void;
  numero?: string;
  revision?: number;
}

const CONDICIONES_PAGO_SUGERIDAS = [
  '50% anticipo, 50% contra entrega',
  'Contado contra entrega',
  '30% anticipo, 40% acopio, 30% final',
  'Transferencia a 15 días de emitida'
];

export const QuoteProjectModal: React.FC<QuoteProjectModalProps> = ({
  isOpen,
  onClose,
  clientes,
  clienteId,
  onSelectCliente,
  direccionObra,
  onUpdateDireccionObra,
  validezDias,
  onUpdateValidezDias,
  tipoFactura,
  onUpdateTipoFactura,
  condicionesPagoTexto,
  onUpdateCondicionesPagoTexto,
  numero,
  revision
}) => {
  // Manejo de tecla Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const selectedCliente = useMemo(() => {
    return clientes.find((c) => c.id === clienteId) || null;
  }, [clientes, clienteId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-scrim/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-project-modal-title"
    >
      <div className="bg-surface-container-high border border-outline-variant/40 rounded-3xl shadow-md3-3 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Cabecera del Diálogo */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-outline-variant/30 shrink-0 bg-surface-container">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="quote-project-modal-title"
                className="text-base sm:text-lg font-bold text-on-surface"
              >
                Configurar Cliente y Obra
              </h2>
              <p className="text-xs text-on-surface-variant font-mono">
                {numero || 'Cotización'} · Revisión {revision || 1}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo con Scroll */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-on-surface text-sm">
          {/* ─── 1. Asignación de Cliente ─── */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              <span>Cliente Asignado</span>
            </label>

            <ClienteCombobox
              clientes={clientes}
              selectedClienteId={clienteId}
              onSelectCliente={onSelectCliente}
            />

            {/* Ficha Resumen del Cliente Seleccionado */}
            {selectedCliente && (
              <div className="mt-2 p-3 bg-surface-container rounded-2xl border border-outline-variant/20 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-on-surface-variant">
                {selectedCliente.telefono && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-secondary" />
                    <span>{selectedCliente.telefono}</span>
                  </span>
                )}
                {selectedCliente.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-secondary" />
                    <span>{selectedCliente.email}</span>
                  </span>
                )}
                {selectedCliente.cuit && (
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-container-highest">
                    CUIT: {selectedCliente.cuit}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ─── 2. Datos de la Obra y Ubicación ─── */}
          <div className="space-y-2 pt-2 border-t border-outline-variant/20">
            <div className="flex items-center justify-between">
              <label
                htmlFor="direccion-obra-input"
                className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span>Nombre de la Obra / Emplazamiento</span>
              </label>

              {/* Botón rápido para autocompletar con la dirección del cliente */}
              {selectedCliente?.direccion && selectedCliente.direccion !== direccionObra && (
                <button
                  type="button"
                  onClick={() => onUpdateDireccionObra(selectedCliente.direccion || '')}
                  className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  title="Copiar la dirección registrada del cliente"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Usar dirección del cliente</span>
                </button>
              )}
            </div>

            <input
              id="direccion-obra-input"
              type="text"
              value={direccionObra}
              onChange={(e) => onUpdateDireccionObra(e.target.value)}
              placeholder="Ej: Torre Bellini - Piso 14 / Planta Industrial San Martín"
              className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant/40 rounded-xl text-on-surface text-sm focus:outline-none focus:border-primary transition-colors shadow-2xs"
            />
          </div>

          {/* ─── 3. Condiciones Comerciales del Presupuesto ─── */}
          <div className="space-y-3 pt-2 border-t border-outline-variant/20">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-primary" />
              <span>Condiciones Comerciales</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Validez de la Oferta */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Validez de la oferta (días)</span>
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={validezDias || 15}
                    onChange={(e) => onUpdateValidezDias(parseInt(e.target.value, 10) || 15)}
                    className="w-20 px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-xl text-center text-sm font-bold text-on-surface focus:outline-none focus:border-primary transition-colors shadow-2xs"
                  />
                  <div className="flex items-center gap-1">
                    {[7, 15, 30].map((dias) => (
                      <button
                        key={dias}
                        type="button"
                        onClick={() => onUpdateValidezDias(dias)}
                        className={`px-2 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                          validezDias === dias
                            ? 'bg-primary/10 border-primary text-primary font-bold'
                            : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {dias}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tipo de Factura / Comprobante */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1">
                  <CreditCard className="w-3 h-3" />
                  <span>Tipo de comprobante</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'Factura A', label: 'Fact. A' },
                      { id: 'Factura B', label: 'Fact. B' },
                      { id: 'Factura C', label: 'Fact. C' },
                      { id: 'Presupuesto X (Sin Factura)', label: 'Ppto. X' }
                    ] as const
                  ).map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onUpdateTipoFactura(id as TipoFactura)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        tipoFactura === id
                          ? 'bg-primary text-on-primary border-primary shadow-xs'
                          : 'bg-surface border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Condiciones de Pago */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-medium text-on-surface-variant">
                Condiciones de Pago y Entrega
              </span>
              <input
                type="text"
                value={condicionesPagoTexto || ''}
                onChange={(e) => onUpdateCondicionesPagoTexto(e.target.value)}
                placeholder="Ej: 50% anticipo al confirmar, saldo contra entrega"
                className="w-full px-3.5 py-2 bg-surface border border-outline-variant/40 rounded-xl text-on-surface text-xs sm:text-sm focus:outline-none focus:border-primary transition-colors shadow-2xs"
              />

              {/* Chips rápidos de condiciones sugeridas */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CONDICIONES_PAGO_SUGERIDAS.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onUpdateCondicionesPagoTexto(sug)}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pie del Diálogo */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-outline-variant/30 bg-surface-container flex items-center justify-between shrink-0">
          <span className="text-xs text-on-surface-variant/70 italic">
            Los cambios se guardan automáticamente en el borrador.
          </span>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Listo</span>
          </button>
        </div>
      </div>
    </div>
  );
};

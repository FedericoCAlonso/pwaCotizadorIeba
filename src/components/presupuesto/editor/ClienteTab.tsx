import React from 'react';
import {
  Building2,
  Calendar,
  DollarSign,
  MapPin,
  Phone,
  Mail,
  User,
  ArrowRight,
  FileSpreadsheet
} from 'lucide-react';
import { Cliente, TipoFactura, AppConfig } from '../../../core/types';
import { ClienteCombobox } from '../ClienteCombobox';
import { NumericInput } from '../../common/NumericInput';

interface ClienteTabProps {
  clientes: Cliente[];
  clienteId: string;
  setClienteId: (id: string) => void;
  selectedCliente: Cliente | null;
  tipoFactura: TipoFactura;
  setTipoFactura: (tf: TipoFactura) => void;
  validezDias: number;
  setValidezDias: (days: number) => void;
  config: AppConfig;
  mostrarDolar: boolean;
  setMostrarDolar: (val: boolean) => void;
  nombreDolar: string;
  setNombreDolar: (val: string) => void;
  cotizacionDolar: number;
  setCotizacionDolar: (val: number) => void;
  onNext: () => void;
}

export const ClienteTab: React.FC<ClienteTabProps> = ({
  clientes,
  clienteId,
  setClienteId,
  selectedCliente,
  tipoFactura,
  setTipoFactura,
  validezDias,
  setValidezDias,
  config,
  mostrarDolar,
  setMostrarDolar,
  nombreDolar,
  setNombreDolar,
  cotizacionDolar,
  setCotizacionDolar,
  onNext
}) => {
  const tiposFactura: TipoFactura[] = ['Factura A', 'Factura B', 'Factura C', 'Presupuesto X (Sin Factura)'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Selección y Datos del Cliente */}
      <div className="bg-surface-container-low rounded-3xl p-4 sm:p-6 border border-outline-variant/20 shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/15">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface">
              Cliente y Ubicación del Proyecto
            </h2>
            <p className="text-sm text-on-surface-variant">
              Selecciona el cliente o solicitante y verifica los datos de obra.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-on-surface mb-2">
              Cliente Solicitante *
            </label>
            <ClienteCombobox
              clientes={clientes}
              selectedClienteId={clienteId}
              onSelectCliente={(newId) => setClienteId(newId)}
            />
          </div>

          {selectedCliente && (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-primary uppercase tracking-wider">
                  Ficha del Cliente Seleccionado
                </span>
                {selectedCliente.cuit && (
                  <span className="text-xs font-mono font-semibold bg-surface-container-highest px-2.5 py-1 rounded-lg text-on-surface-variant">
                    CUIT/DNI: {selectedCliente.cuit}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm text-on-surface">
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-on-surface-variant shrink-0" />
                  <span className="font-semibold">{selectedCliente.nombre}</span>
                </div>

                {selectedCliente.direccion && (
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-on-surface-variant shrink-0" />
                    <span className="truncate">{selectedCliente.direccion}</span>
                  </div>
                )}

                {selectedCliente.telefono && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-on-surface-variant shrink-0" />
                    <span>{selectedCliente.telefono}</span>
                  </div>
                )}

                {selectedCliente.email && (
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-on-surface-variant shrink-0" />
                    <span className="truncate">{selectedCliente.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Condiciones Fiscales y Oferta */}
      <div className="bg-surface-container-low rounded-3xl p-4 sm:p-6 border border-outline-variant/20 shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/15">
          <div className="w-10 h-10 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface">
              Condiciones Fiscales y Validez
            </h2>
            <p className="text-sm text-on-surface-variant">
              Establece el encuadre fiscal del comprobante y plazo de validez de la cotización.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-on-surface mb-2">
              Tipo de Factura / Comprobante
            </label>
            <select
              value={tipoFactura}
              onChange={(e) => setTipoFactura(e.target.value as TipoFactura)}
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl px-4 py-2.5 text-sm sm:text-base font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[46px] transition-shadow shadow-2xs"
            >
              {tiposFactura.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-on-surface mb-2">
              Validez de la Oferta (Días)
            </label>
            <div className="relative">
              <NumericInput
                value={validezDias}
                onChange={(val) => setValidezDias(val as any)}
                fallbackOnBlur={config.validezDiasPorDefecto || 15}
                min={1}
                max={365}
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl px-4 py-2.5 text-sm sm:text-base text-on-surface font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[46px] transition-shadow shadow-2xs"
              />
              <Calendar className="w-4 h-4 text-on-surface-variant absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Moneda de Cotización */}
      <div className="bg-surface-container-low rounded-3xl p-4 sm:p-6 border border-outline-variant/20 shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/15">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface">
              Moneda y Referencia Cambiaria
            </h2>
            <p className="text-sm text-on-surface-variant">
              Opción para presentar importes equivalentes en moneda extranjera (USD).
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer text-sm sm:text-base font-semibold text-on-surface select-none">
            <input
              type="checkbox"
              checked={mostrarDolar}
              onChange={(e) => setMostrarDolar(e.target.checked)}
              className="w-5 h-5 text-primary rounded border-outline bg-surface-container-highest focus:ring-primary cursor-pointer"
            />
            <span>Mostrar cotización equivalente en moneda extranjera</span>
          </label>

          {mostrarDolar && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Nombre de Referencia (Ej: Dólar MEP)
                </label>
                <input
                  type="text"
                  value={nombreDolar}
                  onChange={(e) => setNombreDolar(e.target.value)}
                  className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl px-4 py-2.5 text-sm sm:text-base text-on-surface font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[46px]"
                  placeholder="Dólar Blue / MEP"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Cotización ARS / USD
                </label>
                <NumericInput
                  value={cotizacionDolar}
                  onChange={(val) => setCotizacionDolar(val as any)}
                  fallbackOnBlur={config.dolarReferenciaValor || 1200}
                  min={0}
                  decimals={2}
                  className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl px-4 py-2.5 text-sm sm:text-base text-on-surface font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[46px]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botón de navegación hacia la etapa 2 */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onNext}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-on-primary rounded-2xl text-sm sm:text-base font-bold shadow-md hover:bg-primary/90 transition-all cursor-pointer min-h-[48px]"
        >
          <span>Continuar a Partidas & Cómputo</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import {
  Calendar,
  ArrowRight,
  MapPin
} from 'lucide-react';
import { Cliente, TipoFactura, AppConfig } from '../../../core/types';
import { ClienteCombobox } from '../ClienteCombobox';
import { NumericInput } from '../../common/NumericInput';

interface ClienteTabProps {
  clientes: Cliente[];
  clienteId: string;
  setClienteId: (id: string) => void;
  direccionObra: string;
  setDireccionObra: (direccion: string) => void;
  selectedCliente?: Cliente | null;
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
  direccionObra,
  setDireccionObra,
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

  const handleSelectCliente = (newId: string) => {
    setClienteId(newId);
    // Si la dirección de obra está vacía, sugerir la dirección base del cliente como punto de partida
    if (!direccionObra) {
      const found = clientes.find((c) => c.id === newId);
      if (found?.direccion) {
        const fullAddr = [found.direccion, found.localidad].filter(Boolean).join(', ');
        setDireccionObra(fullAddr);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* 1. Cliente & Ubicación de Obra (Sin marcos redundantes ni encabezados repetitivos) */}
      <div className="bg-surface-container-low rounded-3xl p-4 sm:p-6 border border-outline-variant/20 shadow-xs space-y-4">
        <div>
          <label className="block text-sm sm:text-base font-bold text-on-surface mb-2">
            Cliente o Comitente *
          </label>
          <ClienteCombobox
            clientes={clientes}
            selectedClienteId={clienteId}
            onSelectCliente={handleSelectCliente}
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-on-surface mb-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span>Dirección o Ubicación de la Obra</span>
          </label>
          <input
            type="text"
            value={direccionObra}
            onChange={(e) => setDireccionObra(e.target.value)}
            placeholder="Ej: Thames 1850, Palermo (o dejar vacío para usar domicilio del cliente)"
            className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl px-4 py-2.5 text-sm sm:text-base font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[46px] placeholder:text-on-surface-variant/40 shadow-2xs transition-shadow"
          />
          <p className="text-xs text-on-surface-variant mt-1.5 pl-1">
            Indica el domicilio exacto donde se ejecutarán las tareas (imprescindible cuando el cliente es un estudio de arquitectura, consorcio o empresa con múltiples obras).
          </p>
        </div>
      </div>

      {/* 2. Condiciones Comerciales y Facturación (Agrupadas de forma limpia) */}
      <div className="bg-surface-container-low rounded-3xl p-4 sm:p-6 border border-outline-variant/20 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-on-surface mb-2">
              Tipo de Comprobante / Factura
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

        {/* Moneda Extranjera Integrada */}
        <div className="pt-2 border-t border-outline-variant/15 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer text-sm sm:text-base font-semibold text-on-surface select-none">
            <input
              type="checkbox"
              checked={mostrarDolar}
              onChange={(e) => setMostrarDolar(e.target.checked)}
              className="w-5 h-5 text-primary rounded border-outline bg-surface-container-highest focus:ring-primary cursor-pointer"
            />
            <span>Mostrar cotización equivalente en moneda extranjera (USD)</span>
          </label>

          {mostrarDolar && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
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
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
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

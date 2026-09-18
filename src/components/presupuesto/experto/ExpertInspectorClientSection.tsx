import React, { useState, useMemo } from 'react';
import {
  Building2,
  ChevronDown,
  Plus,
  Search,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  AlertTriangle
} from 'lucide-react';
import { Cliente } from '../../../core/types';

interface ExpertInspectorClientSectionProps {
  clienteMatched?: Cliente;
  clienteQuery?: string;
  direccionObra?: string;
  clientes?: Cliente[];
  onSelectCliente?: (cliente: Cliente) => void;
  onOpenQuickClienteModal?: (initialName?: string) => void;
  onSetDireccionObra?: (direccion: string) => void;
}

export const ExpertInspectorClientSection: React.FC<ExpertInspectorClientSectionProps> = ({
  clienteMatched,
  clienteQuery,
  direccionObra,
  clientes = [],
  onSelectCliente,
  onOpenQuickClienteModal,
  onSetDireccionObra
}) => {
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  const filteredClientesForPicker = useMemo(() => {
    if (!clientSearchQuery.trim()) return clientes.slice(0, 10);
    const q = clientSearchQuery.toLowerCase().trim();
    return clientes.filter(
      (c) =>
        (c.razonSocial && c.razonSocial.toLowerCase().includes(q)) ||
        (c.nombre && c.nombre.toLowerCase().includes(q)) ||
        (c.cuitDni && c.cuitDni.includes(q)) ||
        (c.cuit && c.cuit.includes(q)) ||
        (c.direccion && c.direccion.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [clientes, clientSearchQuery]);

  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
            Comitente & Obra
          </h4>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsClientPickerOpen(!isClientPickerOpen)}
            className="text-[11px] font-bold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
          >
            <span>{isClientPickerOpen ? 'Cerrar' : clienteMatched ? 'Cambiar' : 'Buscar'}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isClientPickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {onOpenQuickClienteModal && (
            <button
              type="button"
              onClick={() => onOpenQuickClienteModal(clienteQuery || '')}
              className="text-[11px] font-bold text-secondary hover:text-secondary/80 bg-secondary/10 hover:bg-secondary/20 p-1 rounded-lg transition cursor-pointer"
              title="Nuevo Cliente rápido"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Selector Desplegable de Clientes */}
      {isClientPickerOpen && (
        <div className="p-3 bg-surface border border-outline-variant/30 rounded-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150 shadow-sm">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              value={clientSearchQuery}
              onChange={(e) => setClientSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, CUIT o dirección..."
              className="w-full bg-surface-container-high text-xs rounded-xl pl-8 pr-3 py-1.5 border border-outline-variant/30 focus:border-primary focus:outline-none"
              autoFocus
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {filteredClientesForPicker.length === 0 ? (
              <div className="text-[11px] text-on-surface-variant text-center py-2">
                No se encontraron contactos.
              </div>
            ) : (
              filteredClientesForPicker.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelectCliente?.(c);
                    setIsClientPickerOpen(false);
                    setClientSearchQuery('');
                  }}
                  className="w-full text-left p-2 rounded-xl text-xs hover:bg-surface-container-highest transition flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-on-surface block truncate">
                      {c.razonSocial || c.nombre}
                    </span>
                    <span className="text-[10px] text-on-surface-variant block truncate">
                      {c.cuitDni ? `CUIT: ${c.cuitDni} · ` : ''}{c.condicionIVA || 'Consumidor Final'}{c.direccion ? ` · ${c.direccion}` : ''}
                    </span>
                  </div>
                  {c.id === clienteMatched?.id && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {onOpenQuickClienteModal && (
            <button
              type="button"
              onClick={() => {
                onOpenQuickClienteModal(clientSearchQuery);
                setIsClientPickerOpen(false);
                setClientSearchQuery('');
              }}
              className="w-full py-1.5 px-2 bg-primary text-on-primary rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>+ Registrar "{clientSearchQuery || 'Nuevo Cliente'}" en Contactos</span>
            </button>
          )}
        </div>
      )}

      {/* Estado y Ficha del Cliente */}
      <div className="space-y-2.5 text-xs">
        {clienteMatched ? (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Contacto Registrado</span>
              </span>
              {clienteMatched.condicionIVA && (
                <span className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                  {clienteMatched.condicionIVA}
                </span>
              )}
            </div>

            <div className="font-bold text-sm text-on-surface">
              {clienteMatched.razonSocial || clienteMatched.nombre}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-on-surface-variant pt-1 border-t border-emerald-500/15">
              {(clienteMatched.cuitDni || clienteMatched.cuit) && (
                <span className="font-mono">
                  CUIT: {clienteMatched.cuitDni || clienteMatched.cuit}
                </span>
              )}
              {clienteMatched.telefono && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-on-surface-variant" />
                  <span>{clienteMatched.telefono}</span>
                </span>
              )}
              {clienteMatched.email && (
                <span className="flex items-center gap-1 col-span-2 truncate">
                  <Mail className="w-3 h-3 text-on-surface-variant shrink-0" />
                  <span className="truncate">{clienteMatched.email}</span>
                </span>
              )}
              {clienteMatched.direccion && (
                <span className="col-span-2 text-[11px]">
                  Fiscal: {clienteMatched.direccion}{clienteMatched.localidad ? `, ${clienteMatched.localidad}` : ''}
                </span>
              )}
            </div>

            {clienteMatched.direccion && direccionObra !== clienteMatched.direccion && onSetDireccionObra && (
              <button
                type="button"
                onClick={() => onSetDireccionObra(clienteMatched.direccion!)}
                className="w-full text-left text-[11px] font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 p-2 rounded-xl flex items-center justify-between transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Usar como obra: <strong>{clienteMatched.direccion}</strong></span>
                </span>
                <span className="text-[10px] font-bold shrink-0 ml-1">Copiar</span>
              </button>
            )}
          </div>
        ) : clienteQuery ? (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>No Registrado</span>
              </span>
              <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80">
                Texto en YAML
              </span>
            </div>

            <div className="font-bold text-sm text-on-surface">
              "{clienteQuery}"
            </div>

            <p className="text-[11px] text-on-surface-variant">
              Este cliente no figura en tu base de contactos. Podés registrarlo rápidamente:
            </p>

            {onOpenQuickClienteModal && (
              <button
                type="button"
                onClick={() => onOpenQuickClienteModal(clienteQuery)}
                className="w-full py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar "{clienteQuery}" en Contactos</span>
              </button>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-surface-container-high/60 border border-outline-variant/20 space-y-2 text-center">
            <span className="text-xs text-on-surface-variant block">
              Sin cliente asignado a la cotización
            </span>
            <button
              type="button"
              onClick={() => setIsClientPickerOpen(true)}
              className="w-full py-2 px-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Asignar o Registrar Cliente</span>
            </button>
          </div>
        )}

        {/* Obra */}
        <div className="flex items-start gap-2 text-on-surface pt-2 border-t border-outline-variant/15">
          <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] uppercase tracking-wider text-on-surface-variant font-bold">
              Dirección de Obra
            </span>
            <span className="font-medium block truncate">
              {direccionObra || 'Sin dirección de obra especificada'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

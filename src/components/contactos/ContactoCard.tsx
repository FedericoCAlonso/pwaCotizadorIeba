import React from 'react';
import {
  Building,
  Truck,
  Sparkles,
  Edit2,
  Trash2,
  Tag,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  ChevronUp,
  FileText,
  Send
} from 'lucide-react';
import { Contacto, Presupuesto, SolicitudCotizacion } from '../../core/types';
import { formatARS } from '../../core/calculations';

interface ContactoCardProps {
  contacto: Contacto;
  presupuestos: Presupuesto[];
  rfqs: SolicitudCotizacion[];
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  activeTab: 'info' | 'presupuestos' | 'rfqs' | 'financiero';
  onTabChange: (tab: 'info' | 'presupuestos' | 'rfqs' | 'financiero') => void;
  onEdit: (contacto: Contacto) => void;
  onDelete: (id: string, name: string) => void;
  onSelectPresupuesto?: (id: string) => void;
  onNewPresupuestoForCliente?: (clienteId: string) => void;
  onNewRFQForProveedor?: (proveedorId: string) => void;
}

export const ContactoCard: React.FC<ContactoCardProps> = ({
  contacto,
  presupuestos,
  rfqs,
  isExpanded,
  onToggleExpand,
  activeTab,
  onTabChange,
  onEdit,
  onDelete,
  onSelectPresupuesto,
  onNewPresupuestoForCliente,
  onNewRFQForProveedor
}) => {
  const isCli = contacto.roles?.includes('cliente');
  const isProv = contacto.roles?.includes('proveedor');
  const isAmbos = isCli && isProv;

  const contactPresupuestos = presupuestos.filter(
    (p) => (p.clienteId === contacto.id || (p as any).contactoId === contacto.id) && !p.deleted
  );
  const contactRFQs = rfqs.filter((r) => r.proveedorId === contacto.id && !r.deleted);

  return (
    <div className="bg-surface-container-low hover:bg-surface-container-high rounded-2xl p-5 transition-colors flex flex-col justify-between">
      <div>
        {/* Top Bar with Badges & Actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {isAmbos ? (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-primary-container text-on-primary-container flex items-center gap-1 select-none">
                <Sparkles className="w-3.5 h-3.5" /> Cliente & Proveedor
              </span>
            ) : (
              <>
                {isCli && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-secondary-container text-on-secondary-container flex items-center gap-1 select-none">
                    <Building className="w-3.5 h-3.5" /> Cliente
                  </span>
                )}
                {isProv && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-tertiary-container text-on-tertiary-container flex items-center gap-1 select-none">
                    <Truck className="w-3.5 h-3.5" /> Proveedor ({contacto.tipoProveedor || 'ambos'})
                  </span>
                )}
              </>
            )}

            {contacto.condicionIVA && (
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-lg bg-surface-container-highest text-on-surface-variant select-none">
                {contacto.condicionIVA}
              </span>
            )}
          </div>

          {/* Touch targets M3: 48x48px mínimo con state layer */}
          <div className="flex items-center gap-0.5 shrink-0 -mt-1 -mr-1">
            <button
              type="button"
              onClick={() => onEdit(contacto)}
              className="min-w-[48px] min-h-[48px] p-3 text-on-surface-variant hover:text-primary rounded-full state-layer transition-colors flex items-center justify-center cursor-pointer"
              title="Editar Contacto"
              aria-label={`Editar contacto ${contacto.razonSocial || contacto.nombre}`}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(contacto.id, contacto.razonSocial || contacto.nombre || 'Contacto')}
              className="min-w-[48px] min-h-[48px] p-3 text-on-surface-variant hover:text-error rounded-full state-layer transition-colors flex items-center justify-center cursor-pointer"
              title="Eliminar Contacto"
              aria-label={`Eliminar contacto ${contacto.razonSocial || contacto.nombre}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Identity */}
        <div className="mt-2.5">
          <h3 className="text-base font-bold text-on-surface leading-snug">
            {contacto.razonSocial || contacto.nombre}
          </h3>
          {contacto.nombreFantasia && (
            <p className="text-xs text-primary font-medium">{contacto.nombreFantasia}</p>
          )}
          {contacto.cuitDni && (
            <p className="text-xs text-on-surface-variant font-mono mt-0.5">
              CUIT/DNI: <strong>{contacto.cuitDni}</strong>
            </p>
          )}
        </div>

        {/* Tags / Rubros Mini Chips (8dp) */}
        {contacto.etiquetas && contacto.etiquetas.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {contacto.etiquetas.map((tag, tIdx) => (
              <span
                key={tIdx}
                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-lg bg-surface-container text-on-surface-variant flex items-center gap-1 select-none"
              >
                <Tag className="w-2.5 h-2.5 text-primary" />
                <span>{tag}</span>
              </span>
            ))}
          </div>
        )}

        {/* Quick Channels / Links */}
        <div className="mt-3 pt-3 border-t border-outline-variant/15 space-y-1.5 text-xs text-on-surface-variant">
          {contacto.telefono && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <Phone className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                <span className="font-mono">{contacto.telefono}</span>
              </div>
              <a
                href={`https://wa.me/${contacto.telefono.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-[#25D366] hover:underline shrink-0"
              >
                WhatsApp
              </a>
            </div>
          )}

          {contacto.email && (
            <div className="flex items-center gap-2 truncate">
              <Mail className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
              <a href={`mailto:${contacto.email}`} className="truncate hover:underline">
                {contacto.email}
              </a>
            </div>
          )}

          {(contacto.direccion || contacto.localidad) && (
            <div className="flex items-center gap-2 truncate">
              <MapPin className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
              <span className="truncate">
                {contacto.direccion} {contacto.localidad ? `(${contacto.localidad})` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Personas de Contacto Count / Mini Sub-card */}
        {contacto.contactos && contacto.contactos.length > 0 && (
          <div className="mt-3 bg-surface-container p-3 rounded-xl space-y-1.5">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
              Personas ({contacto.contactos.length}):
            </span>
            <div className="space-y-1">
              {contacto.contactos.map((p, idx) => (
                <div key={idx} className="text-xs flex items-center justify-between text-on-surface">
                  <span className="truncate font-medium">
                    {p.nombre} {p.rol ? <span className="text-[10px] text-on-surface-variant">({p.rol})</span> : ''}
                  </span>
                  {p.telefono && (
                    <a href={`tel:${p.telefono}`} className="text-[11px] font-mono text-primary hover:underline shrink-0 ml-1">
                      {p.telefono}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible 360 Activity Drawer */}
        {isExpanded && (
          <div className="mt-4 pt-3 border-t border-outline-variant/15 space-y-3">
            {/* Tabs inside Drawer */}
            <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl text-xs font-semibold">
              {isCli && (
                <button
                  type="button"
                  onClick={() => onTabChange('presupuestos')}
                  className={`flex-1 py-1.5 rounded-lg state-layer transition-colors cursor-pointer ${
                    activeTab === 'presupuestos' ? 'bg-surface-container-highest text-primary shadow-2xs font-bold' : 'text-on-surface-variant'
                  }`}
                >
                  Cotizaciones ({contactPresupuestos.length})
                </button>
              )}
              {isProv && (
                <button
                  type="button"
                  onClick={() => onTabChange('rfqs')}
                  className={`flex-1 py-1.5 rounded-lg state-layer transition-colors cursor-pointer ${
                    activeTab === 'rfqs' ? 'bg-surface-container-highest text-primary shadow-2xs font-bold' : 'text-on-surface-variant'
                  }`}
                >
                  RFQs ({contactRFQs.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => onTabChange('financiero')}
                className={`flex-1 py-1.5 rounded-lg state-layer transition-colors cursor-pointer ${
                  activeTab === 'financiero' ? 'bg-surface-container-highest text-primary shadow-2xs font-bold' : 'text-on-surface-variant'
                }`}
              >
                Financiero
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'presupuestos' && isCli && (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar scrollbar-none">
                {contactPresupuestos.length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-2 text-center">Sin cotizaciones registradas.</p>
                ) : (
                  contactPresupuestos.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => onSelectPresupuesto?.(p.id)}
                      className="bg-surface-container p-2.5 rounded-xl text-xs hover:bg-surface-container-highest transition cursor-pointer flex items-center justify-between state-layer"
                    >
                      <div>
                        <div className="font-bold text-on-surface font-mono">{p.numero}</div>
                        <div className="text-[10px] text-on-surface-variant">
                          {new Date(p.fechaEmision).toLocaleDateString('es-AR')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-primary font-mono">{formatARS(p.precioFinalGlobal || p.totalARS)}</div>
                        <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-md bg-surface-variant text-on-surface-variant select-none">
                          {p.estado}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'rfqs' && isProv && (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar scrollbar-none">
                {contactRFQs.length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-2 text-center">Sin solicitudes RFQ enviadas.</p>
                ) : (
                  contactRFQs.map((r) => (
                    <div
                      key={r.id}
                      className="bg-surface-container p-2.5 rounded-xl text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-on-surface font-mono">RFQ #{r.id.slice(0, 8)}</div>
                        <div className="text-[10px] text-on-surface-variant">
                          {r.items?.length || 0} materiales solicitados
                        </div>
                      </div>
                      <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-md bg-surface-variant text-on-surface-variant select-none">
                        {r.estado}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'financiero' && (
              <div className="bg-surface-container p-3.5 rounded-xl space-y-2 text-xs text-on-surface-variant">
                {contacto.financiero?.condicionesCobroHabitual && (
                  <div>
                    <span className="font-bold text-[10px] uppercase text-on-surface block">Cobro habitual:</span>
                    <span>{contacto.financiero.condicionesCobroHabitual}</span>
                  </div>
                )}
                {contacto.financiero?.condicionesPagoHabitual && (
                  <div>
                    <span className="font-bold text-[10px] uppercase text-on-surface block">Pago a proveedor:</span>
                    <span>{contacto.financiero.condicionesPagoHabitual}</span>
                  </div>
                )}
                {contacto.financiero?.cbuCvuAlias && (
                  <div>
                    <span className="font-bold text-[10px] uppercase text-on-surface block">CBU / Alias:</span>
                    <span className="font-mono font-bold text-primary">{contacto.financiero.cbuCvuAlias}</span>
                    {contacto.financiero.banco && <span className="block text-[11px]">({contacto.financiero.banco})</span>}
                  </div>
                )}
                {!contacto.financiero?.condicionesCobroHabitual &&
                  !contacto.financiero?.condicionesPagoHabitual &&
                  !contacto.financiero?.cbuCvuAlias && (
                    <p className="text-[11px] text-center text-on-surface-variant py-2">
                      Sin datos financieros o bancarios cargados.
                    </p>
                  )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onToggleExpand(contacto.id)}
          className="min-h-[40px] px-3 text-xs text-on-surface-variant hover:text-on-surface rounded-full state-layer flex items-center gap-1 font-medium cursor-pointer"
        >
          <span>{isExpanded ? 'Ocultar' : 'Actividad'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <div className="flex items-center gap-2">
          {isCli && onNewPresupuestoForCliente && (
            <button
              type="button"
              onClick={() => onNewPresupuestoForCliente(contacto.id)}
              className="px-4 py-2 bg-primary text-on-primary font-semibold text-xs rounded-full state-layer transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Crear nueva cotización para este cliente"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Cotizar</span>
            </button>
          )}

          {isProv && onNewRFQForProveedor && (
            <button
              type="button"
              onClick={() => onNewRFQForProveedor(contacto.id)}
              className="px-4 py-2 bg-tertiary text-on-tertiary font-semibold text-xs rounded-full state-layer transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Crear nueva solicitud de precios RFQ"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Pedir RFQ</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

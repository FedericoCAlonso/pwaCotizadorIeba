import React, { useState, useEffect } from 'react';
import { UserPlus, X, Check, Building, Phone, Mail, MapPin } from 'lucide-react';
import { db } from '../../db/database';
import { Contacto, CondicionIVA } from '../../core/types';
import { CONDICIONES_IVA } from '../../core/sampleData';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useToast } from '../../contexts/ToastContext';

interface QuickClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  onClienteCreated: (newClienteId: string) => void;
}

export const QuickClienteModal: React.FC<QuickClienteModalProps> = ({
  isOpen,
  onClose,
  initialName = '',
  onClienteCreated
}) => {
  useEscapeKey(isOpen, onClose);
  const { toast } = useToast();

  const [nombre, setNombre] = useState('');
  const [cuitDni, setCuitDni] = useState('');
  const [condicionIVA, setCondicionIVA] = useState<CondicionIVA>('Consumidor Final');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNombre(initialName.trim());
      setCuitDni('');
      setCondicionIVA('Consumidor Final');
      setTelefono('');
      setEmail('');
      setDireccion('');
      setLocalidad('');
      setIsSaving(false);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.warning('Por favor ingresa el nombre o razón social del cliente.');
      return;
    }

    try {
      setIsSaving(true);
      const now = new Date().toISOString();
      const newId = `cli-${crypto.randomUUID()}`;

      const newContacto: Contacto = {
        id: newId,
        razonSocial: nombre.trim(),
        nombre: nombre.trim(),
        roles: ['cliente'],
        cuitDni: cuitDni.trim() || undefined,
        cuit: cuitDni.trim() || undefined,
        condicionIVA: condicionIVA,
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
        direccion: direccion.trim() || undefined,
        localidad: localidad.trim() || undefined,
        createdAt: now,
        updatedAt: now,
        deleted: false
      };

      await db.contactos.put(newContacto);
      await db.clientes.put(newContacto);
      toast.success(`Cliente "${nombre.trim()}" creado correctamente`);
      onClienteCreated(newId);
      onClose();
    } catch (err) {
      console.error('Error al crear cliente rápido:', err);
      toast.error('Ocurrió un error al guardar el cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-surface border border-outline-variant/30 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-outline-variant/20 bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl text-primary border border-primary/20 shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-on-surface">Crear Nuevo Cliente</h3>
              <p className="text-[11px] sm:text-xs text-on-surface-variant">
                Se guardará en tu directorio y se asociará a esta cotización
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition active:scale-95 min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
          {/* Nombre / Razón Social */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-on-surface uppercase tracking-wider block">
              Nombre / Razón Social <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Juan Pérez o Constructora del Sur S.A."
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
              />
            </div>
          </div>

          {/* CUIT/DNI & Condición IVA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface uppercase tracking-wider block">
                CUIT / DNI
              </label>
              <input
                type="text"
                value={cuitDni}
                onChange={(e) => setCuitDni(e.target.value)}
                placeholder="Ej: 20-34567890-9"
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2 text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[40px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface uppercase tracking-wider block">
                Condición IVA
              </label>
              <select
                value={condicionIVA}
                onChange={(e) => setCondicionIVA(e.target.value as CondicionIVA)}
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[40px]"
              >
                {CONDICIONES_IVA.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Teléfono & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface uppercase tracking-wider block flex items-center gap-1">
                <Phone className="w-3 h-3 text-primary" />
                <span>Teléfono / WhatsApp</span>
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: +54 9 11 1234-5678"
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[40px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface uppercase tracking-wider block flex items-center gap-1">
                <Mail className="w-3 h-3 text-primary" />
                <span>Correo Electrónico</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[40px]"
              />
            </div>
          </div>

          {/* Dirección & Localidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface uppercase tracking-wider block flex items-center gap-1">
                <MapPin className="w-3 h-3 text-primary" />
                <span>Dirección / Calle</span>
              </label>
              <input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Ej: Av. Corrientes 1234"
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[40px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface uppercase tracking-wider block">
                Localidad / Ciudad
              </label>
              <input
                type="text"
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
                placeholder="Ej: CABA o Rosario"
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[40px]"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-outline-variant/20 flex flex-col-reverse sm:flex-row justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition text-center min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-full shadow-xs transition flex items-center justify-center gap-2 min-h-[44px] active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Crear y Seleccionar Cliente'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

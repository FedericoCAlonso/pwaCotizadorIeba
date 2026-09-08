import React from 'react';
import { X } from 'lucide-react';
import { PersonaContacto } from '../../../core/types';
import { ContactoFormData } from '../ContactoFormModal';

interface ContactoPersonasTabProps {
  formData: ContactoFormData;
  handleAddPersona: () => void;
  handleUpdatePersona: (index: number, field: keyof PersonaContacto, value: string) => void;
  handleRemovePersona: (index: number) => void;
}

export const ContactoPersonasTab: React.FC<ContactoPersonasTabProps> = ({
  formData,
  handleAddPersona,
  handleUpdatePersona,
  handleRemovePersona
}) => {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs text-on-surface-variant">
          Registra a los técnicos, jefes de obra o responsables de compras de esta entidad.
        </span>
        <button
          type="button"
          onClick={handleAddPersona}
          className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full hover:bg-primary/20 transition cursor-pointer"
        >
          + Agregar Persona
        </button>
      </div>

      {formData.contactos.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-outline-variant/30 rounded-2xl bg-surface-container p-4 text-xs text-on-surface-variant">
          No hay personas secundarias registradas. Haz clic en "+ Agregar Persona".
        </div>
      ) : (
        <div className="space-y-2.5">
          {formData.contactos.map((persona, idx) => (
            <div key={persona.id || idx} className="bg-surface-container p-3 rounded-xl border border-outline-variant/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-primary uppercase">Persona #{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => handleRemovePersona(idx)}
                  className="text-on-surface-variant hover:text-error text-xs p-1 cursor-pointer"
                  aria-label={`Eliminar persona ${idx + 1}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={persona.nombre}
                  onChange={(e) => handleUpdatePersona(idx, 'nombre', e.target.value)}
                  placeholder="Nombre completo *"
                  className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
                <input
                  type="text"
                  value={persona.rol || ''}
                  onChange={(e) => handleUpdatePersona(idx, 'rol', e.target.value)}
                  placeholder="Cargo (ej: Jefe de Obra, Compras)"
                  className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
                <input
                  type="tel"
                  value={persona.telefono || ''}
                  onChange={(e) => handleUpdatePersona(idx, 'telefono', e.target.value)}
                  placeholder="Teléfono / WhatsApp"
                  className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-2.5 py-1.5 text-xs text-on-surface font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
                <input
                  type="email"
                  value={persona.email || ''}
                  onChange={(e) => handleUpdatePersona(idx, 'email', e.target.value)}
                  placeholder="Email directo"
                  className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

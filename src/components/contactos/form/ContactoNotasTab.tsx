import React from 'react';
import { ContactoFormData } from '../ContactoFormModal';

interface ContactoNotasTabProps {
  formData: ContactoFormData;
  setFormData: React.Dispatch<React.SetStateAction<ContactoFormData>>;
}

export const ContactoNotasTab: React.FC<ContactoNotasTabProps> = ({
  formData,
  setFormData
}) => {
  return (
    <div>
      <label className="block text-xs font-semibold text-on-surface-variant mb-1">
        Notas Internas / Observaciones
      </label>
      <textarea
        rows={6}
        value={formData.notas}
        onChange={(e) => setFormData((prev) => ({ ...prev, notas: e.target.value }))}
        className="w-full bg-surface-container-high border border-outline-variant/40 rounded-2xl p-4 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        placeholder="Escribe aquí acuerdos especiales, horarios de atención, personas clave o cualquier dato relevante..."
      />
    </div>
  );
};

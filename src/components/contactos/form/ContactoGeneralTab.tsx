import React from 'react';
import { Building, Truck, Tag, Smartphone, Plus, X } from 'lucide-react';
import { ContactoFormData } from '../ContactoFormModal';
import { CONDICIONES_IVA } from '../../../core/sampleData';

interface ContactoGeneralTabProps {
  formData: ContactoFormData;
  setFormData: React.Dispatch<React.SetStateAction<ContactoFormData>>;
  tagInput: string;
  setTagInput: (val: string) => void;
  handleAddTag: (tag?: string) => void;
  handleRemoveTag: (tag: string) => void;
  availableSuggestions: string[];
  hasContactPicker: boolean;
  handleImportFromPhoneContacts: () => void;
}

export const ContactoGeneralTab: React.FC<ContactoGeneralTabProps> = ({
  formData,
  setFormData,
  tagInput,
  setTagInput,
  handleAddTag,
  handleRemoveTag,
  availableSuggestions,
  hasContactPicker,
  handleImportFromPhoneContacts
}) => {
  return (
    <div className="space-y-4">
      {/* Roles Selection */}
      <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20 space-y-2">
        <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
          Roles en el Negocio (Tildar los que correspondan)
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-on-surface">
            <input
              type="checkbox"
              checked={formData.roles.includes('cliente')}
              onChange={(e) => {
                if (e.target.checked) {
                  setFormData((prev) => ({ ...prev, roles: [...prev.roles, 'cliente'] }));
                } else {
                  setFormData((prev) => ({ ...prev, roles: prev.roles.filter((r) => r !== 'cliente') }));
                }
              }}
              className="w-4 h-4 text-primary rounded"
            />
            <Building className="w-4 h-4 text-blue-600" />
            <span>Es Cliente (Cotizaciones y obras)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-on-surface">
            <input
              type="checkbox"
              checked={formData.roles.includes('proveedor')}
              onChange={(e) => {
                if (e.target.checked) {
                  setFormData((prev) => ({ ...prev, roles: [...prev.roles, 'proveedor'] }));
                } else {
                  setFormData((prev) => ({ ...prev, roles: prev.roles.filter((r) => r !== 'proveedor') }));
                }
              }}
              className="w-4 h-4 text-primary rounded"
            />
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>Es Proveedor / Subcontratista (RFQ y precios)</span>
          </label>
        </div>

        {formData.roles.includes('proveedor') && (
          <div className="pt-2 border-t border-outline-variant/10 flex items-center gap-2 text-xs">
            <span className="text-on-surface-variant font-medium">Tipo Proveedor:</span>
            <select
              value={formData.tipoProveedor}
              onChange={(e) => setFormData((prev) => ({ ...prev, tipoProveedor: e.target.value as any }))}
              className="bg-surface-container-high rounded-xl px-3 py-1.5 text-xs text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="material">Materiales / Insumos</option>
              <option value="servicio">Servicios Tercerizados / Grúas</option>
              <option value="ambos">Ambos (Materiales y Servicios)</option>
            </select>
          </div>
        )}
      </div>

      {/* Sistema de Etiquetas / Tags (M3 Input Chips) */}
      <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-primary" />
            <span>Etiquetas & Rubros (Tags)</span>
          </label>
          <span className="text-xs text-on-surface-variant">Escribe y presiona Enter</span>
        </div>

        {/* Input Field + Add Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="ej: Iluminación, Tableristas, Urgencias, Cableado..."
              className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl pl-3.5 pr-8 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[40px] transition-all"
            />
            {tagInput && (
              <button
                type="button"
                onClick={() => setTagInput('')}
                className="absolute right-2.5 top-2.5 text-on-surface-variant hover:text-on-surface p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleAddTag()}
            disabled={!tagInput.trim()}
            className="px-3.5 py-2 bg-primary text-on-primary font-semibold text-xs rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 shrink-0 min-h-[40px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar</span>
          </button>
        </div>

        {/* Active Chips List */}
        {formData.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {formData.etiquetas.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary-container text-on-secondary-container text-xs font-semibold rounded-full border border-primary/20 shadow-xs animate-in fade-in zoom-in duration-150"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-on-secondary-container transition"
                  aria-label={`Eliminar etiqueta ${tag}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Autocomplete / Suggested Tags from Database */}
        {availableSuggestions.length > 0 && (
          <div className="pt-1.5 border-t border-outline-variant/15 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mr-1">
              Sugerencias ({availableSuggestions.length}):
            </span>
            {availableSuggestions.slice(0, 8).map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => handleAddTag(sug)}
                className="text-xs px-2.5 py-0.5 bg-surface-container-highest hover:bg-surface-variant text-on-surface font-medium rounded-full border border-outline-variant/30 transition flex items-center gap-1 active:scale-95"
                title={`Agregar etiqueta "${sug}"`}
              >
                <Plus className="w-3 h-3 text-primary" />
                <span>{sug}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Identification — M3 Text Fields */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
          Datos Principales
        </span>
        {hasContactPicker && (
          <button
            type="button"
            onClick={handleImportFromPhoneContacts}
            className="flex items-center gap-1.5 px-3 py-1 bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 rounded-full text-xs font-semibold transition active:scale-95 shadow-2xs"
            title="Importar datos desde los contactos del teléfono/dispositivo"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Importar de Agenda</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Razón Social / Nombre *
          </label>
          <input
            type="text"
            required
            value={formData.razonSocial}
            onChange={(e) => setFormData((prev) => ({ ...prev, razonSocial: e.target.value }))}
            className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[42px] transition-all"
            placeholder="ej: Electro Norte S.R.L. o Juan Pérez"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Nombre de Fantasía / Alias
          </label>
          <input
            type="text"
            value={formData.nombreFantasia}
            onChange={(e) => setFormData((prev) => ({ ...prev, nombreFantasia: e.target.value }))}
            className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[42px] transition-all"
            placeholder="ej: ElectroNorte"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">CUIT / DNI</label>
          <input
            type="text"
            value={formData.cuitDni}
            onChange={(e) => setFormData((prev) => ({ ...prev, cuitDni: e.target.value }))}
            className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3.5 py-2.5 text-xs text-on-surface font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[42px] transition-all"
            placeholder="ej: 30-71234567-8"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">Condición Fiscal IVA</label>
          <select
            value={formData.condicionIVA}
            onChange={(e) => setFormData((prev) => ({ ...prev, condicionIVA: e.target.value as any }))}
            className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[42px] transition-all"
          >
            {CONDICIONES_IVA.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* General Contact Info — M3 Text Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">Teléfono Principal</label>
          <input
            type="tel"
            value={formData.telefono}
            onChange={(e) => setFormData((prev) => ({ ...prev, telefono: e.target.value }))}
            className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3.5 py-2.5 text-xs text-on-surface font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[42px] transition-all"
            placeholder="ej: 11 4567-8900"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">Email Principal / Facturación</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[42px] transition-all"
            placeholder="ej: contacto@empresa.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">Dirección / Obra</label>
          <input
            type="text"
            value={formData.direccion}
            onChange={(e) => setFormData((prev) => ({ ...prev, direccion: e.target.value }))}
            className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[42px] transition-all"
            placeholder="ej: Av. Libertador 1234"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">Localidad / Provincia</label>
          <input
            type="text"
            value={formData.localidad}
            onChange={(e) => setFormData((prev) => ({ ...prev, localidad: e.target.value }))}
            className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[42px] transition-all"
            placeholder="ej: Vicente López, Buenos Aires"
          />
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { Users, X, MessageSquare } from 'lucide-react';
import {
  Contacto,
  RolContacto,
  TipoProveedor,
  CondicionIVA,
  PersonaContacto,
  DatosFinancierosContacto
} from '../../core/types';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useModalKeyboardNavigation } from '../../hooks/useModalKeyboardNavigation';
import { ContactoGeneralTab } from './form/ContactoGeneralTab';
import { ContactoPersonasTab } from './form/ContactoPersonasTab';
import { ContactoFinancieroTab } from './form/ContactoFinancieroTab';
import { ContactoWhatsAppTab } from './form/ContactoWhatsAppTab';
import { ContactoNotasTab } from './form/ContactoNotasTab';

export interface ContactoFormData {
  razonSocial: string;
  nombreFantasia: string;
  cuitDni: string;
  condicionIVA: CondicionIVA;
  roles: RolContacto[];
  tipoProveedor: TipoProveedor;
  etiquetas: string[];
  direccion: string;
  localidad: string;
  provincia: string;
  telefono: string;
  email: string;
  sitioWeb: string;
  contactos: PersonaContacto[];
  financiero: DatosFinancierosContacto;
  plantillaWhatsAppPersonalizada?: string;
  notas: string;
}

interface ContactoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingContacto: Contacto | null;
  initialRole?: 'cliente' | 'proveedor';
  allUniqueTags: string[];
  onSave: (data: ContactoFormData) => Promise<void>;
}

export const ContactoFormModal: React.FC<ContactoFormModalProps> = ({
  isOpen,
  onClose,
  editingContacto,
  initialRole = 'cliente',
  allUniqueTags,
  onSave
}) => {
  useEscapeKey(isOpen, onClose);
  const { containerRef, handleKeyDown } = useModalKeyboardNavigation({ isOpen });
  const [modalActiveTab, setModalActiveTab] = useState<'general' | 'personas' | 'financiero' | 'whatsapp' | 'notas'>('general');
  const [tagInput, setTagInput] = useState('');

  const [formData, setFormData] = useState<ContactoFormData>({
    razonSocial: '',
    nombreFantasia: '',
    cuitDni: '',
    condicionIVA: 'Consumidor Final',
    roles: [initialRole],
    tipoProveedor: 'ambos',
    etiquetas: [],
    direccion: '',
    localidad: '',
    provincia: '',
    telefono: '',
    email: '',
    sitioWeb: '',
    contactos: [],
    financiero: {
      condicionesCobroHabitual: '',
      descuentoHabitualPct: 0,
      limiteCreditoARS: 0,
      condicionesPagoHabitual: '',
      cbuCvuAlias: '',
      banco: '',
      titularCuenta: '',
      cuitTitular: '',
      diasPlazoPago: 30
    },
    plantillaWhatsAppPersonalizada: '',
    notas: ''
  });

  useEffect(() => {
    if (editingContacto) {
      setFormData({
        razonSocial: editingContacto.razonSocial || editingContacto.nombre || '',
        nombreFantasia: editingContacto.nombreFantasia || '',
        cuitDni: editingContacto.cuitDni || editingContacto.cuit || '',
        condicionIVA: editingContacto.condicionIVA || 'Consumidor Final',
        roles: editingContacto.roles || (initialRole ? [initialRole] : ['cliente']),
        tipoProveedor: editingContacto.tipoProveedor || 'ambos',
        etiquetas: editingContacto.etiquetas ? [...editingContacto.etiquetas] : [],
        direccion: editingContacto.direccion || '',
        localidad: editingContacto.localidad || '',
        provincia: editingContacto.provincia || '',
        telefono: editingContacto.telefono || '',
        email: editingContacto.email || '',
        sitioWeb: editingContacto.sitioWeb || '',
        contactos: editingContacto.contactos ? [...editingContacto.contactos] : [],
        financiero: {
          condicionesCobroHabitual: editingContacto.financiero?.condicionesCobroHabitual || '',
          descuentoHabitualPct: editingContacto.financiero?.descuentoHabitualPct || 0,
          limiteCreditoARS: editingContacto.financiero?.limiteCreditoARS || 0,
          condicionesPagoHabitual: editingContacto.financiero?.condicionesPagoHabitual || '',
          cbuCvuAlias: editingContacto.financiero?.cbuCvuAlias || '',
          banco: editingContacto.financiero?.banco || '',
          titularCuenta: editingContacto.financiero?.titularCuenta || '',
          cuitTitular: editingContacto.financiero?.cuitTitular || '',
          diasPlazoPago: editingContacto.financiero?.diasPlazoPago || 30
        },
        plantillaWhatsAppPersonalizada: editingContacto.plantillaWhatsAppPersonalizada || '',
        notas: editingContacto.notas || ''
      });
      setModalActiveTab('general');
      setTagInput('');
    } else if (isOpen) {
      setFormData({
        razonSocial: '',
        nombreFantasia: '',
        cuitDni: '',
        condicionIVA: 'Consumidor Final',
        roles: [initialRole],
        tipoProveedor: 'ambos',
        etiquetas: [],
        direccion: '',
        localidad: '',
        provincia: '',
        telefono: '',
        email: '',
        sitioWeb: '',
        contactos: [],
        financiero: {
          condicionesCobroHabitual: '',
          descuentoHabitualPct: 0,
          limiteCreditoARS: 0,
          condicionesPagoHabitual: '',
          cbuCvuAlias: '',
          banco: '',
          titularCuenta: '',
          cuitTitular: '',
          diasPlazoPago: 30
        },
        plantillaWhatsAppPersonalizada: '',
        notas: ''
      });
      setModalActiveTab('general');
      setTagInput('');
    }
  }, [editingContacto, isOpen, initialRole]);

  // Autocomplete tag suggestions matching current input
  const availableSuggestions = useMemo(() => {
    const currentSet = new Set(formData.etiquetas.map((t) => t.toLowerCase()));
    return allUniqueTags.filter((t) => {
      if (currentSet.has(t.toLowerCase())) return false;
      if (!tagInput.trim()) return true;
      return t.toLowerCase().includes(tagInput.trim().toLowerCase());
    });
  }, [allUniqueTags, formData.etiquetas, tagInput]);

  const handleAddTag = (tagToAdd?: string) => {
    const val = (tagToAdd !== undefined ? tagToAdd : tagInput).trim();
    if (!val) return;
    if (!formData.etiquetas.some((t) => t.toLowerCase() === val.toLowerCase())) {
      setFormData((prev) => ({ ...prev, etiquetas: [...prev.etiquetas, val] }));
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      etiquetas: prev.etiquetas.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase())
    }));
  };

  const handleAddPersona = () => {
    const newPersona: PersonaContacto = {
      id: `p-${crypto.randomUUID()}`,
      nombre: '',
      rol: '',
      telefono: '',
      email: ''
    };
    setFormData((prev) => ({ ...prev, contactos: [...prev.contactos, newPersona] }));
  };

  const handleUpdatePersona = (index: number, field: keyof PersonaContacto, value: string) => {
    setFormData((prev) => {
      const next = [...prev.contactos];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, contactos: next };
    });
  };

  const handleRemovePersona = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      contactos: prev.contactos.filter((_, idx) => idx !== index)
    }));
  };

  const hasContactPicker = typeof navigator !== 'undefined' && 'contacts' in navigator && 'select' in (navigator as any).contacts;

  const handleImportFromPhoneContacts = async () => {
    if (!hasContactPicker) {
      alert('La selección de contactos desde la agenda no está soportada en este navegador/dispositivo. Puedes ingresar los datos manualmente.');
      return;
    }
    try {
      const contacts = await (navigator as any).contacts.select(['name', 'tel', 'email', 'address'], { multiple: false });
      if (contacts && contacts.length > 0) {
        const c = contacts[0];
        const name = (c.name && c.name[0]) || '';
        const phone = (c.tel && c.tel[0]) || '';
        const email = (c.email && c.email[0]) || '';
        let address = '';
        if (c.address && c.address[0]) {
          const addr = c.address[0];
          address = typeof addr === 'string' ? addr : (addr.addressLine || addr.city || '');
        }

        setFormData((prev) => ({
          ...prev,
          razonSocial: name || prev.razonSocial,
          telefono: phone || prev.telefono,
          email: email || prev.email,
          direccion: address || prev.direccion
        }));
      }
    } catch (err) {
      console.log('Selección de contacto cancelada o no permitida:', err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.razonSocial.trim()) return;
    await onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        className="bg-surface rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-4 border border-outline-variant/20 shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex justify-between items-center pb-2 border-b border-outline-variant/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-on-surface">
                {editingContacto ? 'Editar Contacto' : 'Nuevo Contacto'}
              </h3>
              <p className="text-xs text-on-surface-variant">
                Configura identidad, rubros/etiquetas, roles y datos fiscales.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center gap-2 border-b border-outline-variant/15 pb-2 overflow-x-auto no-scrollbar scrollbar-none">
          <button
            type="button"
            onClick={() => setModalActiveTab('general')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              modalActiveTab === 'general'
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            1. Identidad & Rubros
          </button>
          <button
            type="button"
            onClick={() => setModalActiveTab('personas')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              modalActiveTab === 'personas'
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            2. Personas de Contacto
          </button>
          <button
            type="button"
            onClick={() => setModalActiveTab('financiero')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              modalActiveTab === 'financiero'
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            3. Cobros / Pagos / CBU
          </button>
          <button
            type="button"
            onClick={() => setModalActiveTab('whatsapp')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
              modalActiveTab === 'whatsapp'
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>4. Plantilla WhatsApp</span>
            {formData.plantillaWhatsAppPersonalizada && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setModalActiveTab('notas')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              modalActiveTab === 'notas'
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            5. Notas
          </button>
        </div>

        {/* Form Scrollable Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {modalActiveTab === 'general' && (
            <ContactoGeneralTab
              formData={formData}
              setFormData={setFormData}
              tagInput={tagInput}
              setTagInput={setTagInput}
              handleAddTag={handleAddTag}
              handleRemoveTag={handleRemoveTag}
              availableSuggestions={availableSuggestions}
              hasContactPicker={hasContactPicker}
              handleImportFromPhoneContacts={handleImportFromPhoneContacts}
            />
          )}

          {modalActiveTab === 'personas' && (
            <ContactoPersonasTab
              formData={formData}
              handleAddPersona={handleAddPersona}
              handleUpdatePersona={handleUpdatePersona}
              handleRemovePersona={handleRemovePersona}
            />
          )}

          {modalActiveTab === 'financiero' && (
            <ContactoFinancieroTab
              formData={formData}
              setFormData={setFormData}
            />
          )}

          {modalActiveTab === 'whatsapp' && (
            <ContactoWhatsAppTab
              formData={formData}
              setFormData={setFormData}
            />
          )}

          {modalActiveTab === 'notas' && (
            <ContactoNotasTab
              formData={formData}
              setFormData={setFormData}
            />
          )}

          {/* Modal Actions */}
          <div className="flex justify-end items-center gap-3 pt-4 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-xs font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-xs shadow-xs cursor-pointer"
            >
              Guardar Contacto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

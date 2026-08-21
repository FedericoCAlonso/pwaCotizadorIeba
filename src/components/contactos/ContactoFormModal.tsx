import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Building,
  Truck,
  Plus,
  X,
  Tag,
  Smartphone
} from 'lucide-react';
import {
  Contacto,
  RolContacto,
  TipoProveedor,
  CondicionIVA,
  PersonaContacto,
  DatosFinancierosContacto
} from '../../core/types';
import { CONDICIONES_IVA } from '../../core/sampleData';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useModalKeyboardNavigation } from '../../hooks/useModalKeyboardNavigation';

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
  const [modalActiveTab, setModalActiveTab] = useState<'general' | 'personas' | 'financiero' | 'notas'>('general');
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
            className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full"
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
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
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
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              modalActiveTab === 'personas'
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            2. Personas ({formData.contactos.length})
          </button>
          <button
            type="button"
            onClick={() => setModalActiveTab('financiero')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              modalActiveTab === 'financiero'
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            3. Cobros / Pagos / CBU
          </button>
          <button
            type="button"
            onClick={() => setModalActiveTab('notas')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              modalActiveTab === 'notas'
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            4. Notas
          </button>
        </div>

        {/* Form Scrollable Body with Clean Hidden Scrollbar */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {modalActiveTab === 'general' && (
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
                  <span className="text-[11px] text-on-surface-variant">Escribe y presiona Enter</span>
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
                    <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mr-1">
                      Sugerencias ({availableSuggestions.length}):
                    </span>
                    {availableSuggestions.slice(0, 8).map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => handleAddTag(sug)}
                        className="text-[11px] px-2.5 py-0.5 bg-surface-container-highest hover:bg-surface-variant text-on-surface font-medium rounded-full border border-outline-variant/30 transition flex items-center gap-1 active:scale-95"
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
          )}

          {modalActiveTab === 'personas' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-on-surface-variant">
                  Registra a los técnicos, jefes de obra o responsables de compras de esta entidad.
                </span>
                <button
                  type="button"
                  onClick={handleAddPersona}
                  className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full hover:bg-primary/20 transition"
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
                        <span className="text-[10px] font-bold text-primary uppercase">Persona #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePersona(idx)}
                          className="text-on-surface-variant hover:text-error text-xs p-1"
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
          )}

          {modalActiveTab === 'financiero' && (
            <div className="space-y-4">
              {/* Para Clientes */}
              <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/20 space-y-3">
                <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-4 h-4" /> Condiciones de Cobro & Comercial (Como Cliente)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                      Condiciones de Cobro Habitual
                    </label>
                    <input
                      type="text"
                      value={formData.financiero.condicionesCobroHabitual || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          financiero: { ...prev.financiero, condicionesCobroHabitual: e.target.value }
                        }))
                      }
                      className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="ej: 50% anticipo al iniciar, 50% con certificado final"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                      Descuento Comercial Acordado (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.financiero.descuentoHabitualPct || 0}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          financiero: { ...prev.financiero, descuentoHabitualPct: parseFloat(e.target.value) || 0 }
                        }))
                      }
                      className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                      Límite de Crédito de Obra ($ ARS)
                    </label>
                    <input
                      type="number"
                      step="1000"
                      value={formData.financiero.limiteCreditoARS || 0}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          financiero: { ...prev.financiero, limiteCreditoARS: parseFloat(e.target.value) || 0 }
                        }))
                      }
                      className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Para Proveedores */}
              <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/20 space-y-3">
                <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-4 h-4" /> Datos Bancarios & Pago (Como Proveedor)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                      Condiciones de Pago Acordadas
                    </label>
                    <input
                      type="text"
                      value={formData.financiero.condicionesPagoHabitual || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          financiero: { ...prev.financiero, condicionesPagoHabitual: e.target.value }
                        }))
                      }
                      className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="ej: Cuenta corriente a 30 días, Cheque 60 días"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                      CBU / CVU o Alias Bancario
                    </label>
                    <input
                      type="text"
                      value={formData.financiero.cbuCvuAlias || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          financiero: { ...prev.financiero, cbuCvuAlias: e.target.value }
                        }))
                      }
                      className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface font-mono font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="ej: 0720... o electro.pagos.mp"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">Banco / Billetera</label>
                    <input
                      type="text"
                      value={formData.financiero.banco || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          financiero: { ...prev.financiero, banco: e.target.value }
                        }))
                      }
                      className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="ej: Banco Galicia / Mercado Pago"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">Titular de Cuenta</label>
                    <input
                      type="text"
                      value={formData.financiero.titularCuenta || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          financiero: { ...prev.financiero, titularCuenta: e.target.value }
                        }))
                      }
                      className="w-full bg-surface-container-high border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="ej: Electro Norte S.R.L."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {modalActiveTab === 'notas' && (
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
          )}

          {/* Modal Actions */}
          <div className="flex justify-end items-center gap-3 pt-4 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-xs shadow-xs"
            >
              Guardar Contacto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Users,
  Building,
  Truck,
  Plus,
  Search,
  Sparkles,
  X,
  Tag,
  FileSpreadsheet,
  RotateCcw
} from 'lucide-react';
import { db, softDelete } from '../db/database';
import { Contacto, Presupuesto, RolContacto } from '../core/types';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { ContactoCard } from './contactos/ContactoCard';
import { ContactoFormModal, ContactoFormData } from './contactos/ContactoFormModal';
import { ImportContactosModal } from './contactos/ImportContactosModal';

interface ContactosManagerProps {
  onSelectPresupuesto?: (id: string) => void;
  onEditPresupuesto?: (id: string) => void;
  onNewPresupuestoForCliente?: (clienteId: string) => void;
  onDuplicatePresupuesto?: (p: Presupuesto) => void;
  onNewRFQForProveedor?: (proveedorId: string) => void;
}

export const ContactosManager: React.FC<ContactosManagerProps> = ({
  onSelectPresupuesto,
  onEditPresupuesto,
  onNewPresupuestoForCliente,
  onDuplicatePresupuesto,
  onNewRFQForProveedor
}) => {
  const { toast } = useToast();
  const confirm = useConfirm();

  // Live queries
  const allContactos = useLiveQuery(() => db.contactos.toArray()) || [];
  const contactos = useMemo(() => allContactos.filter((c) => !c.deleted), [allContactos]);

  const presupuestos = useLiveQuery(() => db.presupuestos.toArray()) || [];
  const rfqs = useLiveQuery(() => db.solicitudesCotizacion.toArray()) || [];

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'todos' | 'cliente' | 'proveedor' | 'ambos'>('todos');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [selectedTabContact, setSelectedTabContact] = useState<Record<string, 'info' | 'presupuestos' | 'rfqs' | 'financiero'>>({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingContacto, setEditingContacto] = useState<Contacto | null>(null);
  const [initialModalRole, setInitialModalRole] = useState<'cliente' | 'proveedor'>('cliente');

  useEffect(() => {
    const handleNew = () => {
      setEditingContacto(null);
      setIsModalOpen(true);
    };
    window.addEventListener('app:shortcut-new', handleNew);
    return () => window.removeEventListener('app:shortcut-new', handleNew);
  }, []);

  // Extract all unique tags across existing database contacts for autocomplete
  const allUniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    contactos.forEach((c) => {
      (c.etiquetas || []).forEach((t) => {
        const trimmed = t.trim();
        if (trimmed) tagSet.add(trimmed);
      });
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [contactos]);

  // Filtered list
  const filteredContactos = useMemo(() => {
    return contactos.filter((c) => {
      // Role Filter
      const hasCliente = c.roles?.includes('cliente') || false;
      const hasProveedor = c.roles?.includes('proveedor') || false;

      if (filterRole === 'cliente' && !hasCliente) return false;
      if (filterRole === 'proveedor' && !hasProveedor) return false;
      if (filterRole === 'ambos' && (!hasCliente || !hasProveedor)) return false;

      // Text Search
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();

      const matchName = (c.razonSocial || c.nombre || '').toLowerCase().includes(q);
      const matchAlias = (c.nombreFantasia || '').toLowerCase().includes(q);
      const matchCuit = (c.cuitDni || c.cuit || '').toLowerCase().includes(q);
      const matchLoc = (c.localidad || '').toLowerCase().includes(q);
      const matchDir = (c.direccion || '').toLowerCase().includes(q);
      const matchTel = (c.telefono || '').toLowerCase().includes(q);
      const matchEmail = (c.email || '').toLowerCase().includes(q);
      const matchTags = (c.etiquetas || []).some((t) => t.toLowerCase().includes(q));
      const matchPersonas = (c.contactos || []).some(
        (p) => p.nombre?.toLowerCase().includes(q) || p.rol?.toLowerCase().includes(q) || p.telefono?.includes(q)
      );

      return matchName || matchAlias || matchCuit || matchLoc || matchDir || matchTel || matchEmail || matchTags || matchPersonas;
    });
  }, [contactos, filterRole, searchQuery]);

  const countsByRole = useMemo(() => {
    const counts = {
      todos: contactos.length,
      cliente: 0,
      proveedor: 0,
      ambos: 0
    };
    contactos.forEach((c) => {
      const hasCliente = c.roles?.includes('cliente');
      const hasProveedor = c.roles?.includes('proveedor');
      if (hasCliente) counts.cliente++;
      if (hasProveedor) counts.proveedor++;
      if (hasCliente && hasProveedor) counts.ambos++;
    });
    return counts;
  }, [contactos]);


  // Handlers
  const handleOpenNewModal = (defaultRole: 'cliente' | 'proveedor' = 'cliente') => {
    setEditingContacto(null);
    setInitialModalRole(defaultRole);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Contacto) => {
    setEditingContacto(c);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Eliminar Contacto',
      message: `¿Estás seguro de eliminar a "${name}" de tu libreta de contactos?`,
      confirmText: 'Eliminar',
      isDestructive: true
    });
    if (ok) {
      await softDelete('contactos', id);
      toast.success(`Contacto "${name}" eliminado`);
    }
  };

  const handleSaveContacto = async (formData: ContactoFormData) => {
    const now = new Date().toISOString();
    const finalRoles: RolContacto[] = formData.roles.length > 0 ? formData.roles : ['cliente'];

    if (editingContacto) {
      await db.contactos.update(editingContacto.id, {
        razonSocial: formData.razonSocial.trim(),
        nombreFantasia: formData.nombreFantasia.trim() || undefined,
        cuitDni: formData.cuitDni.trim() || undefined,
        condicionIVA: formData.condicionIVA,
        roles: finalRoles,
        tipoProveedor: finalRoles.includes('proveedor') ? formData.tipoProveedor : undefined,
        etiquetas: formData.etiquetas,
        direccion: formData.direccion.trim() || undefined,
        localidad: formData.localidad.trim() || undefined,
        provincia: formData.provincia.trim() || undefined,
        telefono: formData.telefono.trim() || undefined,
        email: formData.email.trim() || undefined,
        sitioWeb: formData.sitioWeb.trim() || undefined,
        contactos: formData.contactos.filter((p) => p.nombre && p.nombre.trim() !== ''),
        financiero: formData.financiero,
        plantillaWhatsAppPersonalizada: formData.plantillaWhatsAppPersonalizada?.trim() || undefined,
        notas: formData.notas.trim() || undefined,
        updatedAt: now
      });
      toast.success('Contacto actualizado correctamente');
    } else {
      const newId = `ct-${crypto.randomUUID()}`;
      await db.contactos.add({
        id: newId,
        razonSocial: formData.razonSocial.trim(),
        nombreFantasia: formData.nombreFantasia.trim() || undefined,
        cuitDni: formData.cuitDni.trim() || undefined,
        condicionIVA: formData.condicionIVA,
        roles: finalRoles,
        tipoProveedor: finalRoles.includes('proveedor') ? formData.tipoProveedor : undefined,
        etiquetas: formData.etiquetas,
        direccion: formData.direccion.trim() || undefined,
        localidad: formData.localidad.trim() || undefined,
        provincia: formData.provincia.trim() || undefined,
        telefono: formData.telefono.trim() || undefined,
        email: formData.email.trim() || undefined,
        sitioWeb: formData.sitioWeb.trim() || undefined,
        contactos: formData.contactos.filter((p) => p.nombre && p.nombre.trim() !== ''),
        financiero: formData.financiero,
        plantillaWhatsAppPersonalizada: formData.plantillaWhatsAppPersonalizada?.trim() || undefined,
        notas: formData.notas.trim() || undefined,
        createdAt: now,
        updatedAt: now,
        deleted: false
      });
      toast.success('¡Contacto creado exitosamente!');
    }
    setIsModalOpen(false);
  };

  const toggleCardExpansion = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-5 pb-24 relative">
      {/* Header & Quick Filter Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            <span>Directorio de Contactos 360°</span>
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Gestión integral de Clientes, Proveedores, Subcontratistas y personas de contacto.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-primary hover:text-primary-hover bg-primary/10 hover:bg-primary/20 rounded-full border border-primary/20 transition shadow-xs cursor-pointer active:scale-95"
            title="Importar contactos desde Excel o CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Importar Contactos</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenNewModal(filterRole === 'proveedor' ? 'proveedor' : 'cliente')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Contacto</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-surface-container-low p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-outline-variant/20 space-y-3 shadow-xs">
        {/* Role Filter Tabs with count badges and mobile scroll fade */}
        <div className="relative w-full overflow-hidden">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1 touch-pan-x overscroll-contain pr-6">
            <button
              type="button"
              onClick={() => setFilterRole('todos')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap state-layer transition-all flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[34px] ${
                filterRole === 'todos'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Todos</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  filterRole === 'todos'
                    ? 'bg-on-primary/20 text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                {countsByRole.todos}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterRole('cliente')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap state-layer transition-all flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[34px] ${
                filterRole === 'cliente'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Clientes</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  filterRole === 'cliente'
                    ? 'bg-on-primary/20 text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                {countsByRole.cliente}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterRole('proveedor')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap state-layer transition-all flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[34px] ${
                filterRole === 'proveedor'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Proveedores</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  filterRole === 'proveedor'
                    ? 'bg-on-primary/20 text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                {countsByRole.proveedor}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterRole('ambos')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap state-layer transition-all flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[34px] ${
                filterRole === 'ambos'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ambos Roles</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  filterRole === 'ambos'
                    ? 'bg-on-primary/20 text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                {countsByRole.ambos}
              </span>
            </button>
          </div>
          {/* Mobile soft edge fade */}
          <div className="md:hidden pointer-events-none absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-surface-container-low to-transparent" />
        </div>

        {/* Search Input Box */}
        <div className="relative">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por razón social, CUIT, rubro, localidad, persona o teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl pl-10 pr-9 py-2 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[40px] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-variant transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Results & Active Filters Feedback Bar */}
        {(searchQuery || filterRole !== 'todos') && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/15 text-xs text-on-surface-variant flex-wrap animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-bold text-on-surface">
                {filteredContactos.length} {filteredContactos.length === 1 ? 'contacto' : 'contactos'}
              </span>
              <span className="text-outline-variant">•</span>
              {filterRole !== 'todos' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-medium text-[11px] capitalize">
                  {filterRole === 'cliente' ? 'Clientes' : filterRole === 'proveedor' ? 'Proveedores' : 'Ambos Roles'}
                  <button
                    type="button"
                    onClick={() => setFilterRole('todos')}
                    className="hover:opacity-75 p-0.5 cursor-pointer"
                    aria-label="Quitar filtro de rol"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-mono text-[11px] max-w-[150px] truncate">
                  "{searchQuery}"
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="hover:opacity-75 p-0.5 cursor-pointer"
                    aria-label="Quitar búsqueda"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterRole('todos');
              }}
              className="text-primary hover:text-primary-hover font-semibold text-xs shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-primary/10 transition-colors ml-auto cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpiar filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* Contact Cards Grid */}
      {filteredContactos.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-low border border-dashed border-outline-variant/30 rounded-3xl p-6 space-y-3">
          <div className="p-3 bg-surface-container rounded-full w-12 h-12 mx-auto flex items-center justify-center text-on-surface-variant">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-on-surface">No se encontraron contactos</p>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            {searchQuery || filterRole !== 'todos'
              ? 'Intenta ajustar los términos de búsqueda o cambiar el filtro de roles.'
              : 'Agrega tu primer cliente o proveedor para comenzar a cotizar.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            <button
              type="button"
              onClick={() => handleOpenNewModal(filterRole === 'proveedor' ? 'proveedor' : 'cliente')}
              className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-full text-xs font-semibold transition cursor-pointer"
            >
              + Crear Contacto
            </button>
            {(searchQuery || filterRole !== 'todos') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterRole('todos');
                }}
                className="px-4 py-2 bg-surface-container-highest hover:bg-surface-variant text-on-surface rounded-full text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer filtros</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContactos.map((contacto) => (
            <ContactoCard
              key={contacto.id}
              contacto={contacto}
              presupuestos={presupuestos}
              rfqs={rfqs}
              isExpanded={!!expandedCards[contacto.id]}
              onToggleExpand={toggleCardExpansion}
              activeTab={selectedTabContact[contacto.id] || (contacto.roles?.includes('cliente') ? 'presupuestos' : 'rfqs')}
              onTabChange={(tab) => setSelectedTabContact((prev) => ({ ...prev, [contacto.id]: tab }))}
              onEdit={handleOpenEditModal}
              onDelete={handleDelete}
              onSelectPresupuesto={onSelectPresupuesto}
              onNewPresupuestoForCliente={onNewPresupuestoForCliente}
              onNewRFQForProveedor={onNewRFQForProveedor}
            />
          ))}
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        onClick={() => handleOpenNewModal(filterRole === 'proveedor' ? 'proveedor' : 'cliente')}
        className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-30 floating-action-btn w-14 h-14 rounded-2xl md:rounded-3xl bg-primary hover:bg-primary/90 text-on-primary shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center transition-all"
        aria-label="Crear Nuevo Contacto"
        title="Nuevo Contacto (Cliente / Proveedor)"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Form Modal */}
      <ContactoFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingContacto={editingContacto}
        initialRole={initialModalRole}
        allUniqueTags={allUniqueTags}
        onSave={handleSaveContacto}
      />

      {/* Import Modal */}
      <ImportContactosModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
};

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
  Tag
} from 'lucide-react';
import { db, softDelete } from '../db/database';
import { Contacto, Presupuesto, RolContacto } from '../core/types';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { ContactoCard } from './contactos/ContactoCard';
import { ContactoFormModal, ContactoFormData } from './contactos/ContactoFormModal';

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

  // Counts for tabs
  const counts = useMemo(() => {
    let clis = 0;
    let provs = 0;
    let ambos = 0;
    contactos.forEach((c) => {
      const isCli = c.roles?.includes('cliente');
      const isProv = c.roles?.includes('proveedor');
      if (isCli) clis++;
      if (isProv) provs++;
      if (isCli && isProv) ambos++;
    });
    return { todos: contactos.length, cliente: clis, proveedor: provs, ambos };
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

        {/* Action Button: Nuevo Contacto */}
        <button
          type="button"
          onClick={() => handleOpenNewModal(filterRole === 'proveedor' ? 'proveedor' : 'cliente')}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Contacto</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-surface-container-low p-4 rounded-2xl space-y-3">
        {/* Role Filter Tabs (M3 Filter Chips: selectable action = rounded-full) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none pb-1">
          <button
            type="button"
            onClick={() => setFilterRole('todos')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap state-layer transition-all flex items-center gap-1.5 cursor-pointer ${
              filterRole === 'todos'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Todos</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 dark:bg-black/20">
              {counts.todos}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterRole('cliente')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap state-layer transition-all flex items-center gap-1.5 cursor-pointer ${
              filterRole === 'cliente'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Clientes</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 dark:bg-black/20">
              {counts.cliente}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterRole('proveedor')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap state-layer transition-all flex items-center gap-1.5 cursor-pointer ${
              filterRole === 'proveedor'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Proveedores</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 dark:bg-black/20">
              {counts.proveedor}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterRole('ambos')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap state-layer transition-all flex items-center gap-1.5 cursor-pointer ${
              filterRole === 'ambos'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ambos Roles</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 dark:bg-black/20">
              {counts.ambos}
            </span>
          </button>
        </div>

        {/* Search Input Box */}
        <div className="relative">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por razón social, CUIT, rubro, localidad, persona o teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl pl-10 pr-10 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[40px] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-on-surface-variant hover:text-on-surface p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Contact Cards Grid */}
      {filteredContactos.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-low border border-dashed border-outline-variant/30 rounded-3xl p-6 space-y-3">
          <div className="p-3 bg-surface-container rounded-full w-12 h-12 mx-auto flex items-center justify-center text-on-surface-variant">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-on-surface">No se encontraron contactos</p>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            {searchQuery
              ? 'Intenta ajustar los términos de búsqueda o cambiar el filtro de roles.'
              : 'Agrega tu primer cliente o proveedor para comenzar a cotizar.'}
          </p>
          <button
            type="button"
            onClick={() => handleOpenNewModal(filterRole === 'proveedor' ? 'proveedor' : 'cliente')}
            className="mt-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-full text-xs font-semibold transition"
          >
            + Crear Contacto
          </button>
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
    </div>
  );
};

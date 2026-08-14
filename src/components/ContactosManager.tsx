import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Users,
  Building,
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  FileText,
  Send,
  Edit2,
  Trash2,
  X,
  Sparkles,
  CreditCard,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  UserCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { db, softDelete } from '../db/database';
import {
  Contacto,
  RolContacto,
  TipoProveedor,
  CondicionIVA,
  PersonaContacto,
  DatosFinancierosContacto,
  Presupuesto
} from '../core/types';
import { CONDICIONES_IVA } from '../core/sampleData';
import { formatARS } from '../core/calculations';

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
  const [modalActiveTab, setModalActiveTab] = useState<'general' | 'personas' | 'financiero' | 'notas'>('general');

  // Form State
  const [formData, setFormData] = useState<{
    razonSocial: string;
    nombreFantasia: string;
    cuitDni: string;
    condicionIVA: CondicionIVA;
    roles: RolContacto[];
    tipoProveedor: TipoProveedor;
    direccion: string;
    localidad: string;
    provincia: string;
    telefono: string;
    email: string;
    sitioWeb: string;
    contactos: PersonaContacto[];
    financiero: DatosFinancierosContacto;
    notas: string;
  }>({
    razonSocial: '',
    nombreFantasia: '',
    cuitDni: '',
    condicionIVA: 'Consumidor Final',
    roles: ['cliente'],
    tipoProveedor: 'ambos',
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
      const matchPersonas = (c.contactos || []).some(
        (p) => p.nombre?.toLowerCase().includes(q) || p.rol?.toLowerCase().includes(q) || p.telefono?.includes(q)
      );

      return matchName || matchAlias || matchCuit || matchLoc || matchDir || matchTel || matchEmail || matchPersonas;
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
    return { total: contactos.length, clis, provs, ambos };
  }, [contactos]);

  // Open Modal for New
  const handleOpenNewModal = (preselectedRole: RolContacto = 'cliente') => {
    setEditingContacto(null);
    setFormData({
      razonSocial: '',
      nombreFantasia: '',
      cuitDni: '',
      condicionIVA: preselectedRole === 'cliente' ? 'Consumidor Final' : 'Responsable Inscripto',
      roles: [preselectedRole],
      tipoProveedor: 'ambos',
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
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (contacto: Contacto) => {
    setEditingContacto(contacto);
    setFormData({
      razonSocial: contacto.razonSocial || contacto.nombre || '',
      nombreFantasia: contacto.nombreFantasia || '',
      cuitDni: contacto.cuitDni || contacto.cuit || '',
      condicionIVA: contacto.condicionIVA || 'Consumidor Final',
      roles: contacto.roles && contacto.roles.length > 0 ? contacto.roles : ['cliente'],
      tipoProveedor: contacto.tipoProveedor || 'ambos',
      direccion: contacto.direccion || '',
      localidad: contacto.localidad || '',
      provincia: contacto.provincia || '',
      telefono: contacto.telefono || '',
      email: contacto.email || '',
      sitioWeb: contacto.sitioWeb || '',
      contactos: contacto.contactos || [],
      financiero: {
        condicionesCobroHabitual: contacto.financiero?.condicionesCobroHabitual || '',
        descuentoHabitualPct: contacto.financiero?.descuentoHabitualPct || 0,
        limiteCreditoARS: contacto.financiero?.limiteCreditoARS || 0,
        condicionesPagoHabitual: contacto.financiero?.condicionesPagoHabitual || '',
        cbuCvuAlias: contacto.financiero?.cbuCvuAlias || '',
        banco: contacto.financiero?.banco || '',
        titularCuenta: contacto.financiero?.titularCuenta || '',
        cuitTitular: contacto.financiero?.cuitTitular || '',
        diasPlazoPago: contacto.financiero?.diasPlazoPago || 30
      },
      notas: contacto.notas || ''
    });
    setModalActiveTab('general');
    setIsModalOpen(true);
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.razonSocial.trim()) {
      alert('Por favor ingresa la Razón Social o Nombre del contacto.');
      return;
    }
    if (formData.roles.length === 0) {
      alert('Debes seleccionar al menos un rol (Cliente o Proveedor).');
      return;
    }

    const now = new Date().toISOString();

    const contactoData: Contacto = {
      id: editingContacto ? editingContacto.id : `cto-${crypto.randomUUID()}`,
      razonSocial: formData.razonSocial.trim(),
      nombre: formData.razonSocial.trim(),
      nombreFantasia: formData.nombreFantasia.trim() || undefined,
      cuitDni: formData.cuitDni.trim() || undefined,
      cuit: formData.cuitDni.trim() || undefined,
      condicionIVA: formData.condicionIVA,
      roles: formData.roles,
      tipoProveedor: formData.roles.includes('proveedor') ? formData.tipoProveedor : undefined,
      direccion: formData.direccion.trim() || undefined,
      localidad: formData.localidad.trim() || undefined,
      provincia: formData.provincia.trim() || undefined,
      telefono: formData.telefono.trim() || undefined,
      email: formData.email.trim() || undefined,
      sitioWeb: formData.sitioWeb.trim() || undefined,
      contactos: formData.contactos.filter((p) => (p.nombre || '').trim().length > 0),
      financiero: formData.financiero,
      notas: formData.notas.trim() || undefined,
      createdAt: editingContacto ? editingContacto.createdAt : now,
      updatedAt: now,
      deleted: false
    };

    if (editingContacto) {
      await db.contactos.put(contactoData);
      // Sync legacy tables if applicable
      if (await db.clientes.get(editingContacto.id)) {
        await db.clientes.put(contactoData as any);
      }
      if (await db.proveedores.get(editingContacto.id)) {
        await db.proveedores.put(contactoData as any);
      }
    } else {
      await db.contactos.add(contactoData);
      if (contactoData.roles.includes('cliente')) {
        await db.clientes.put(contactoData as any);
      }
      if (contactoData.roles.includes('proveedor')) {
        await db.proveedores.put(contactoData as any);
      }
    }

    setIsModalOpen(false);
  };

  // Handle Delete
  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar el contacto "${name}"? No se eliminarán los presupuestos históricos.`)) {
      await softDelete('contactos', id);
      await softDelete('clientes', id);
      await softDelete('proveedores', id);
    }
  };

  // Add / Remove persona sub-contact in modal
  const handleAddPersona = () => {
    setFormData((prev) => ({
      ...prev,
      contactos: [
        ...prev.contactos,
        {
          id: `p-${crypto.randomUUID()}`,
          nombre: '',
          rol: 'Contacto',
          telefono: '',
          email: '',
          esPrincipal: prev.contactos.length === 0
        }
      ]
    }));
  };

  const handleUpdatePersona = (index: number, field: keyof PersonaContacto, value: any) => {
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

  const toggleCardExpansion = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-low p-6 rounded-3xl border border-outline-variant/20 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-extrabold text-on-surface tracking-tight">Directorio de Contactos</h2>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Gestión unificada 360° de Clientes, Proveedores y Subcontratistas.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleOpenNewModal('cliente')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Contacto</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/10 flex items-center gap-3">
          <div className="p-2.5 bg-surface-variant rounded-xl text-on-surface">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Total Directorio</span>
            <span className="text-lg font-bold text-on-surface font-mono">{counts.total}</span>
          </div>
        </div>

        <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/10 flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Clientes</span>
            <span className="text-lg font-bold text-on-surface font-mono">{counts.clis}</span>
          </div>
        </div>

        <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/10 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Proveedores</span>
            <span className="text-lg font-bold text-on-surface font-mono">{counts.provs}</span>
          </div>
        </div>

        <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/10 flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Ambos Roles</span>
            <span className="text-lg font-bold text-on-surface font-mono">{counts.ambos}</span>
          </div>
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por Razón Social, CUIT, persona, localidad, teléfono..."
              className="w-full bg-surface-container-highest border-none rounded-full pl-9 pr-8 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-on-surface-variant hover:text-on-surface"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
            <button
              type="button"
              onClick={() => setFilterRole('todos')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                filterRole === 'todos'
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              <span>Todos</span>
              <span className="text-[10px] opacity-75 font-mono">({counts.total})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterRole('cliente')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                filterRole === 'cliente'
                  ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/40'
                  : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              <Building className="w-3 h-3" />
              <span>Clientes</span>
              <span className="text-[10px] opacity-75 font-mono">({counts.clis})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterRole('proveedor')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                filterRole === 'proveedor'
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                  : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              <Truck className="w-3 h-3" />
              <span>Proveedores</span>
              <span className="text-[10px] opacity-75 font-mono">({counts.provs})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterRole('ambos')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                filterRole === 'ambos'
                  ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40'
                  : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Mixtos</span>
              <span className="text-[10px] opacity-75 font-mono">({counts.ambos})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contact Cards Grid */}
      {filteredContactos.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-outline-variant/30 rounded-3xl bg-surface-container-low p-6">
          <Users className="w-12 h-12 text-outline-variant mx-auto mb-3" />
          <p className="text-base font-medium text-on-surface">No se encontraron contactos en esta vista.</p>
          <p className="text-xs text-on-surface-variant mt-1 max-w-sm mx-auto">
            Prueba ajustando el término de búsqueda o crea un nuevo contacto usando el botón superior.
          </p>
          <button
            type="button"
            onClick={() => handleOpenNewModal('cliente')}
            className="mt-4 px-4 py-2 bg-primary text-on-primary text-xs font-semibold rounded-full hover:bg-primary/90"
          >
            + Crear Primer Contacto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContactos.map((contacto) => {
            const isCli = contacto.roles?.includes('cliente');
            const isProv = contacto.roles?.includes('proveedor');
            const isAmbos = isCli && isProv;

            const contactPresupuestos = presupuestos.filter((p) => p.clienteId === contacto.id && !p.deleted);
            const contactRFQs = rfqs.filter((r) => r.proveedorId === contacto.id && !r.deleted);

            const isExpanded = !!expandedCards[contacto.id];
            const currentTab = selectedTabContact[contacto.id] || (isCli ? 'presupuestos' : isProv ? 'rfqs' : 'info');

            return (
              <div
                key={contacto.id}
                className="bg-surface-container-low rounded-3xl p-5 border border-outline-variant/20 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Bar with Badges & Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isAmbos ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Cliente & Proveedor
                        </span>
                      ) : (
                        <>
                          {isCli && (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1">
                              <Building className="w-3 h-3" /> Cliente
                            </span>
                          )}
                          {isProv && (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <Truck className="w-3 h-3" /> Proveedor ({contacto.tipoProveedor || 'ambos'})
                            </span>
                          )}
                        </>
                      )}

                      {contacto.condicionIVA && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant">
                          {contacto.condicionIVA}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(contacto)}
                        className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-variant rounded-full transition-colors"
                        title="Editar Contacto"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(contacto.id, contacto.razonSocial || contacto.nombre || 'Contacto')}
                        className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/30 rounded-full transition-colors"
                        title="Eliminar Contacto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Main Identity */}
                  <div className="mt-3">
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
                          className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
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

                  {/* Personas de Contacto Count / Mini Pills */}
                  {contacto.contactos && contacto.contactos.length > 0 && (
                    <div className="mt-3 bg-surface-container p-2.5 rounded-xl border border-outline-variant/10 space-y-1.5">
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
                    <div className="mt-4 pt-3 border-t border-outline-variant/20 space-y-3">
                      {/* Tabs inside Drawer */}
                      <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl text-xs font-semibold">
                        {isCli && (
                          <button
                            type="button"
                            onClick={() => setSelectedTabContact((prev) => ({ ...prev, [contacto.id]: 'presupuestos' }))}
                            className={`flex-1 py-1 rounded-lg transition-colors ${
                              currentTab === 'presupuestos' ? 'bg-surface-container-highest text-primary shadow-xs' : 'text-on-surface-variant'
                            }`}
                          >
                            Cotizaciones ({contactPresupuestos.length})
                          </button>
                        )}
                        {isProv && (
                          <button
                            type="button"
                            onClick={() => setSelectedTabContact((prev) => ({ ...prev, [contacto.id]: 'rfqs' }))}
                            className={`flex-1 py-1 rounded-lg transition-colors ${
                              currentTab === 'rfqs' ? 'bg-surface-container-highest text-primary shadow-xs' : 'text-on-surface-variant'
                            }`}
                          >
                            RFQs ({contactRFQs.length})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedTabContact((prev) => ({ ...prev, [contacto.id]: 'financiero' }))}
                          className={`flex-1 py-1 rounded-lg transition-colors ${
                            currentTab === 'financiero' ? 'bg-surface-container-highest text-primary shadow-xs' : 'text-on-surface-variant'
                          }`}
                        >
                          Financiero
                        </button>
                      </div>

                      {/* Tab Content */}
                      {currentTab === 'presupuestos' && isCli && (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {contactPresupuestos.length === 0 ? (
                            <p className="text-xs text-on-surface-variant py-2 text-center">Sin cotizaciones registradas.</p>
                          ) : (
                            contactPresupuestos.map((p) => (
                              <div
                                key={p.id}
                                onClick={() => onSelectPresupuesto?.(p.id)}
                                className="bg-surface-container p-2.5 rounded-xl text-xs hover:bg-surface-container-highest transition cursor-pointer flex items-center justify-between border border-outline-variant/10"
                              >
                                <div>
                                  <div className="font-bold text-on-surface font-mono">{p.numero}</div>
                                  <div className="text-[10px] text-on-surface-variant">
                                    {new Date(p.fechaEmision).toLocaleDateString('es-AR')}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-primary font-mono">{formatARS(p.precioFinalGlobal || p.totalARS)}</div>
                                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-surface-variant text-on-surface-variant">
                                    {p.estado}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {currentTab === 'rfqs' && isProv && (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {contactRFQs.length === 0 ? (
                            <p className="text-xs text-on-surface-variant py-2 text-center">Sin solicitudes RFQ enviadas.</p>
                          ) : (
                            contactRFQs.map((r) => (
                              <div
                                key={r.id}
                                className="bg-surface-container p-2.5 rounded-xl text-xs flex items-center justify-between border border-outline-variant/10"
                              >
                                <div>
                                  <div className="font-bold text-on-surface font-mono">RFQ #{r.id.slice(0, 8)}</div>
                                  <div className="text-[10px] text-on-surface-variant">
                                    {r.items?.length || 0} materiales solicitados
                                  </div>
                                </div>
                                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant">
                                  {r.estado}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {currentTab === 'financiero' && (
                        <div className="bg-surface-container p-3 rounded-xl space-y-2 text-xs text-on-surface-variant">
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
                <div className="pt-3 border-t border-outline-variant/15 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleCardExpansion(contacto.id)}
                    className="text-xs text-on-surface-variant hover:text-on-surface flex items-center gap-1 font-medium"
                  >
                    <span>{isExpanded ? 'Ocultar' : 'Actividad'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex items-center gap-1.5">
                    {isCli && onNewPresupuestoForCliente && (
                      <button
                        type="button"
                        onClick={() => onNewPresupuestoForCliente(contacto.id)}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs rounded-full transition flex items-center gap-1"
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
                        className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-semibold text-xs rounded-full transition flex items-center gap-1"
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
          })}
        </div>
      )}

      {/* Modal Dialog for New / Edit Contact */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-3xl max-w-2xl w-full p-6 space-y-5 border border-outline-variant/20 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">
                    {editingContacto ? 'Editar Contacto' : 'Nuevo Contacto'}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Configura identidad, roles, personas y condiciones comerciales.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 border-b border-outline-variant/15 pb-2">
              <button
                type="button"
                onClick={() => setModalActiveTab('general')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  modalActiveTab === 'general'
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                1. Identidad & Roles
              </button>
              <button
                type="button"
                onClick={() => setModalActiveTab('personas')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
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
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
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
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  modalActiveTab === 'notas'
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                4. Notas
              </button>
            </div>

            {/* Form Scrollable Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto space-y-4 pr-1">
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
                        <span>Es Cliente (Emisión de cotizaciones y obras)</span>
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
                          className="bg-surface-container-highest rounded-lg px-2.5 py-1 text-xs text-on-surface border-none"
                        >
                          <option value="material">Materiales / Insumos</option>
                          <option value="servicio">Servicios Tercerizados / Grúas</option>
                          <option value="ambos">Ambos (Materiales y Servicios)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Identification */}
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
                        className="w-full bg-surface-container-highest border-none rounded-xl px-3.5 py-2 text-xs text-on-surface focus:ring-2 focus:ring-primary/50"
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
                        className="w-full bg-surface-container-highest border-none rounded-xl px-3.5 py-2 text-xs text-on-surface focus:ring-2 focus:ring-primary/50"
                        placeholder="ej: ElectroNorte"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1">CUIT / DNI</label>
                      <input
                        type="text"
                        value={formData.cuitDni}
                        onChange={(e) => setFormData((prev) => ({ ...prev, cuitDni: e.target.value }))}
                        className="w-full bg-surface-container-highest border-none rounded-xl px-3.5 py-2 text-xs text-on-surface font-mono focus:ring-2 focus:ring-primary/50"
                        placeholder="ej: 30-71234567-8"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1">Condición Fiscal IVA</label>
                      <select
                        value={formData.condicionIVA}
                        onChange={(e) => setFormData((prev) => ({ ...prev, condicionIVA: e.target.value as any }))}
                        className="w-full bg-surface-container-highest border-none rounded-xl px-3.5 py-2 text-xs text-on-surface focus:ring-2 focus:ring-primary/50"
                      >
                        {CONDICIONES_IVA.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* General Contact Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1">Teléfono Principal</label>
                      <input
                        type="tel"
                        value={formData.telefono}
                        onChange={(e) => setFormData((prev) => ({ ...prev, telefono: e.target.value }))}
                        className="w-full bg-surface-container-highest border-none rounded-xl px-3.5 py-2 text-xs text-on-surface font-mono focus:ring-2 focus:ring-primary/50"
                        placeholder="ej: 11 4567-8900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1">Email Principal / Facturación</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        className="w-full bg-surface-container-highest border-none rounded-xl px-3.5 py-2 text-xs text-on-surface focus:ring-2 focus:ring-primary/50"
                        placeholder="ej: contacto@empresa.com"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1">Dirección / Obra</label>
                      <input
                        type="text"
                        value={formData.direccion}
                        onChange={(e) => setFormData((prev) => ({ ...prev, direccion: e.target.value }))}
                        className="w-full bg-surface-container-highest border-none rounded-xl px-3.5 py-2 text-xs text-on-surface focus:ring-2 focus:ring-primary/50"
                        placeholder="ej: Av. Libertador 1234"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1">Localidad / Provincia</label>
                      <input
                        type="text"
                        value={formData.localidad}
                        onChange={(e) => setFormData((prev) => ({ ...prev, localidad: e.target.value }))}
                        className="w-full bg-surface-container-highest border-none rounded-xl px-3.5 py-2 text-xs text-on-surface focus:ring-2 focus:ring-primary/50"
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
                              className="text-on-surface-variant hover:text-error text-xs"
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
                              className="bg-surface-container-highest border-none rounded-lg px-2.5 py-1.5 text-xs text-on-surface"
                            />
                            <input
                              type="text"
                              value={persona.rol || ''}
                              onChange={(e) => handleUpdatePersona(idx, 'rol', e.target.value)}
                              placeholder="Cargo (ej: Jefe de Obra, Compras)"
                              className="bg-surface-container-highest border-none rounded-lg px-2.5 py-1.5 text-xs text-on-surface"
                            />
                            <input
                              type="tel"
                              value={persona.telefono || ''}
                              onChange={(e) => handleUpdatePersona(idx, 'telefono', e.target.value)}
                              placeholder="Teléfono / WhatsApp"
                              className="bg-surface-container-highest border-none rounded-lg px-2.5 py-1.5 text-xs text-on-surface font-mono"
                            />
                            <input
                              type="email"
                              value={persona.email || ''}
                              onChange={(e) => handleUpdatePersona(idx, 'email', e.target.value)}
                              placeholder="Email directo"
                              className="bg-surface-container-highest border-none rounded-lg px-2.5 py-1.5 text-xs text-on-surface"
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
                          className="w-full bg-surface-container-highest border-none rounded-xl px-3 py-2 text-xs text-on-surface"
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
                          className="w-full bg-surface-container-highest border-none rounded-xl px-3 py-2 text-xs text-on-surface font-mono"
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
                          className="w-full bg-surface-container-highest border-none rounded-xl px-3 py-2 text-xs text-on-surface font-mono"
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
                          className="w-full bg-surface-container-highest border-none rounded-xl px-3 py-2 text-xs text-on-surface"
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
                          className="w-full bg-surface-container-highest border-none rounded-xl px-3 py-2 text-xs text-on-surface font-mono font-bold"
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
                          className="w-full bg-surface-container-highest border-none rounded-xl px-3 py-2 text-xs text-on-surface"
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
                          className="w-full bg-surface-container-highest border-none rounded-xl px-3 py-2 text-xs text-on-surface"
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
                    className="w-full bg-surface-container-highest border-none rounded-2xl p-4 text-xs text-on-surface focus:ring-2 focus:ring-primary/50"
                    placeholder="Escribe aquí acuerdos especiales, horarios de atención, personas clave o cualquier dato relevante..."
                  />
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
      )}
    </div>
  );
};

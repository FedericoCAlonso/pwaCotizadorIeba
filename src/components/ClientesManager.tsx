import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Phone,
  Mail,
  MapPin,
  FileSpreadsheet,
  FileText,
  Eye,
  Copy,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  FileCheck,
  TrendingUp,
  UserPlus
} from 'lucide-react';
import { db, importClientesCSV, softDelete } from '../db/database';
import { Cliente, Presupuesto, EstadoPresupuesto } from '../core/types';
import { CONDICIONES_IVA } from '../core/sampleData';
import { formatARS } from '../core/calculations';

interface ClientesManagerProps {
  onSelectPresupuesto?: (id: string) => void;
  onEditPresupuesto?: (id: string) => void;
  onNewPresupuestoForCliente?: (clienteId: string) => void;
  onDuplicatePresupuesto?: (p: Presupuesto) => void;
}

export const ClientesManager: React.FC<ClientesManagerProps> = ({
  onSelectPresupuesto,
  onEditPresupuesto,
  onNewPresupuestoForCliente,
  onDuplicatePresupuesto
}) => {
  const clientes = (useLiveQuery(() => db.clientes.toArray()) || []).filter((c) => !c.deleted);
  const presupuestos = (useLiveQuery(() => db.presupuestos.toArray()) || []).filter((p) => !p.deleted);

  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [selectedClienteForPresupuestos, setSelectedClienteForPresupuestos] = useState<Cliente | null>(null);

  const [formData, setFormData] = useState<Partial<Cliente>>({
    nombre: '',
    cuitDni: '',
    telefono: '',
    email: '',
    direccion: '',
    notas: ''
  });

  const handleOpenCreate = () => {
    setFormData({ nombre: '', cuitDni: '', telefono: '', email: '', direccion: '', notas: '' });
    setIsCreating(true);
  };

  const handleImportFromContacts = async () => {
    if (!('contacts' in navigator && 'select' in (navigator as any).contacts)) {
      alert('La importación de contactos desde la agenda no está disponible en este dispositivo/navegador. Puedes ingresar los datos manualmente.');
      return;
    }
    try {
      const contacts = await (navigator as any).contacts.select(['name', 'tel', 'email'], { multiple: false });
      if (contacts && contacts.length > 0) {
        const c = contacts[0];
        setFormData(prev => ({
          ...prev,
          nombre: (c.name && c.name[0]) || prev.nombre || '',
          telefono: (c.tel && c.tel[0]) || prev.telefono || '',
          email: (c.email && c.email[0]) || prev.email || ''
        }));
      }
    } catch (err) {
      console.log('Contacto no seleccionado o no permitido:', err);
    }
  };

  const handleOpenEdit = (c: Cliente) => {
    setEditingCliente(c);
    setFormData({ ...c });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    if (isCreating) {
      await db.clientes.add({
        id: `cli-${crypto.randomUUID()}`,
        nombre: formData.nombre || 'Nuevo Cliente',
        cuitDni: formData.cuitDni,
        condicionIVA: formData.condicionIVA || 'Consumidor Final',
        telefono: formData.telefono,
        email: formData.email,
        direccion: formData.direccion,
        notas: formData.notas,
        createdAt: now,
        updatedAt: now,
        deleted: false
      });
      setIsCreating(false);
    } else if (editingCliente) {
      await db.clientes.update(editingCliente.id, {
        nombre: formData.nombre,
        cuitDni: formData.cuitDni,
        condicionIVA: formData.condicionIVA,
        telefono: formData.telefono,
        email: formData.email,
        direccion: formData.direccion,
        notas: formData.notas,
        updatedAt: now
      });
      setEditingCliente(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este cliente?')) {
      await softDelete('clientes', id);
    }
  };

  const handleImportCSV = async () => {
    if (!csvContent.trim()) return;
    const importedCount = await importClientesCSV(csvContent);
    alert(`¡Se importaron ${importedCount} clientes desde el CSV!`);
    setCsvContent('');
    setShowCSVModal(false);
  };

  const handleExportCSV = () => {
    const header = 'nombre,cuitDni,condicionIVA,telefono,email,direccion,notas\n';
    const rows = clientes
      .map((c) => {
        const n = (c.nombre || '').replace(/,/g, '');
        const ct = (c.cuitDni || '').replace(/,/g, '');
        const iva = (c.condicionIVA || '').replace(/,/g, '');
        const t = (c.telefono || '').replace(/,/g, '');
        const e = (c.email || '').replace(/,/g, '');
        const d = (c.direccion || '').replace(/,/g, '');
        const no = (c.notas || '').replace(/,/g, '');
        return `"${n}","${ct}","${iva}","${t}","${e}","${d}","${no}"`;
      })
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ieba_clientes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleKeyDownSequential = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
      e.preventDefault();
      const form = e.currentTarget;
      const elements = Array.from(form.elements) as HTMLElement[];
      const index = elements.indexOf(target);
      if (index > -1 && index < elements.length - 1) {
        let nextEl = elements[index + 1];
        while (
          nextEl &&
          (nextEl.hasAttribute('disabled') || nextEl.tabIndex === -1 || nextEl.tagName === 'FIELDSET')
        ) {
          nextEl = elements[elements.indexOf(nextEl) + 1];
        }
        if (nextEl) nextEl.focus();
      }
    }
  };

  // Obtiene los presupuestos asociados a un cliente específico
  const getClientePresupuestos = (clienteId: string) => {
    return presupuestos.filter((p) => p.clienteId === clienteId);
  };

  // Formatea el estado con badges de colores
  const getEstadoBadge = (estado: EstadoPresupuesto) => {
    switch (estado) {
      case 'aprobado':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-3 h-3" /> Aprobado
          </span>
        );
      case 'enviado':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <FileCheck className="w-3 h-3" /> Enviado
          </span>
        );
      case 'borrador':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400">
            <Clock className="w-3 h-3" /> Borrador
          </span>
        );
      case 'rechazado':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <XCircle className="w-3 h-3" /> Rechazado
          </span>
        );
      case 'vencido':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" /> Vencido
          </span>
        );
      default:
        return null;
    }
  };

  const inputCls =
    'w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 min-h-[44px] transition-shadow';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Directorio de Clientes
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Gestión de clientes, historial de presupuestos y cotizaciones directas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar</span>
          </button>
          <button
            onClick={() => setShowCSVModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importar</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clientes.map((cliente) => {
          const clientPresupuestos = getClientePresupuestos(cliente.id);
          const totalCount = clientPresupuestos.length;
          const aprobadosCount = clientPresupuestos.filter((p) => p.estado === 'aprobado').length;
          const enviadosCount = clientPresupuestos.filter((p) => p.estado === 'enviado').length;
          const montoTotalAprobado = clientPresupuestos
            .filter((p) => p.estado === 'aprobado')
            .reduce((sum, p) => sum + (p.totalARS || 0), 0);

          return (
            <div
              key={cliente.id}
              className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all flex flex-col justify-between shadow-sm"
            >
              <div>
                {/* Header card */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-on-surface text-base">{cliente.nombre}</h3>
                    {cliente.cuitDni && (
                      <span className="text-xs font-mono text-on-surface-variant block mt-1">
                        CUIT/DNI: {cliente.cuitDni}
                      </span>
                    )}
                    {cliente.condicionIVA && (
                      <span className="inline-block mt-2 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                        {cliente.condicionIVA}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(cliente)}
                      className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors"
                      aria-label={`Editar ${cliente.nombre}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cliente.id)}
                      className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors"
                      aria-label={`Eliminar ${cliente.nombre}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="mt-4 space-y-2 text-xs text-on-surface-variant border-t border-outline-variant/20 pt-3">
                  {cliente.telefono && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      {cliente.telefono}
                    </div>
                  )}
                  {cliente.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-3.5 h-3.5 text-primary" />
                      {cliente.email}
                    </div>
                  )}
                  {cliente.direccion && (
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      {cliente.direccion}
                    </div>
                  )}
                </div>

                {/* Presupuestos Stats Banner on Card */}
                <div className="mt-4 pt-3 border-t border-outline-variant/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-on-surface flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      Presupuestos:
                    </span>
                    <span className="font-bold text-primary font-mono">{totalCount}</span>
                  </div>

                  {totalCount > 0 ? (
                    <div className="flex items-center justify-between bg-surface-container-high/60 px-3 py-1.5 rounded-2xl text-[11px]">
                      <div className="flex items-center gap-2">
                        {aprobadosCount > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {aprobadosCount} aprob.
                          </span>
                        )}
                        {enviadosCount > 0 && (
                          <span className="text-sky-600 dark:text-sky-400 font-medium">
                            {enviadosCount} env.
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-on-surface">
                        {formatARS(montoTotalAprobado)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-on-surface-variant/70 italic">
                      Sin cotizaciones registradas
                    </span>
                  )}
                </div>
              </div>

              {/* Card Actions Footer */}
              <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center gap-2">
                <button
                  onClick={() => setSelectedClienteForPresupuestos(cliente)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-xs font-semibold text-on-surface transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>Ver Presupuestos ({totalCount})</span>
                </button>

                {onNewPresupuestoForCliente && (
                  <button
                    onClick={() => onNewPresupuestoForCliente(cliente.id)}
                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-xs font-semibold transition-colors shadow-sm"
                    title={`Crear nuevo presupuesto para ${cliente.nombre}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Cotizar</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Historial de Presupuestos Asociados al Cliente */}
      {selectedClienteForPresupuestos && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-on-surface">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-2xl text-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-on-surface">
                    Presupuestos de {selectedClienteForPresupuestos.nombre}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {selectedClienteForPresupuestos.cuitDni ? `CUIT/DNI: ${selectedClienteForPresupuestos.cuitDni} · ` : ''}
                    Historial de trabajos cotizados
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onNewPresupuestoForCliente && (
                  <button
                    onClick={() => {
                      const cid = selectedClienteForPresupuestos.id;
                      setSelectedClienteForPresupuestos(null);
                      onNewPresupuestoForCliente(cid);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary hover:bg-primary/90 text-xs font-semibold rounded-xl shadow-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nuevo Presupuesto</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedClienteForPresupuestos(null)}
                  className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Presupuestos list for this client */}
              {(() => {
                const list = getClientePresupuestos(selectedClienteForPresupuestos.id);
                if (list.length === 0) {
                  return (
                    <div className="text-center py-10 px-4 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/30">
                      <FileText className="w-12 h-12 text-on-surface-variant/40 mx-auto mb-3" />
                      <h4 className="font-semibold text-sm text-on-surface">No hay presupuestos emitidos</h4>
                      <p className="text-xs text-on-surface-variant mt-1 mb-4">
                        Este cliente aún no tiene cotizaciones guardadas.
                      </p>
                      {onNewPresupuestoForCliente && (
                        <button
                          onClick={() => {
                            const cid = selectedClienteForPresupuestos.id;
                            setSelectedClienteForPresupuestos(null);
                            onNewPresupuestoForCliente(cid);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-sm hover:bg-primary/90 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Crear Primer Presupuesto</span>
                        </button>
                      )}
                    </div>
                  );
                }

                const totalMontoAprobado = list
                  .filter((p) => p.estado === 'aprobado')
                  .reduce((sum, p) => sum + (p.totalARS || 0), 0);

                const totalMontoGeneral = list.reduce((sum, p) => sum + (p.totalARS || 0), 0);

                return (
                  <>
                    {/* Summary statistics KPI cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-surface-container-high p-3.5 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-on-surface-variant block font-medium">Total Cotizado</span>
                          <span className="text-sm font-bold font-mono text-on-surface">{formatARS(totalMontoGeneral)}</span>
                        </div>
                        <TrendingUp className="w-5 h-5 text-primary opacity-80" />
                      </div>
                      <div className="bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/20 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block font-medium">Aprobado / Facturado</span>
                          <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatARS(totalMontoAprobado)}</span>
                        </div>
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div className="bg-surface-container-high p-3.5 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-on-surface-variant block font-medium">Presupuestos Emitidos</span>
                          <span className="text-sm font-bold font-mono text-on-surface">{list.length} unidades</span>
                        </div>
                        <FileText className="w-5 h-5 text-tertiary opacity-80" />
                      </div>
                    </div>

                    {/* Presupuestos Table */}
                    <div className="border border-outline-variant/30 rounded-2xl overflow-auto max-h-[60vh] shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-container-high text-on-surface-variant font-semibold border-b border-outline-variant/20 sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="p-3">Número</th>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Estado</th>
                            <th className="p-3 text-right">Total ARS</th>
                            <th className="p-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10 bg-surface">
                          {list.map((p) => (
                            <tr key={p.id} className="hover:bg-surface-container-highest/40 transition-colors">
                              <td className="p-3 font-mono font-bold text-primary">{p.numero}</td>
                              <td className="p-3 text-on-surface-variant">
                                {new Date(p.fechaEmision).toLocaleDateString('es-AR')}
                              </td>
                              <td className="p-3">{getEstadoBadge(p.estado)}</td>
                              <td className="p-3 text-right font-mono font-bold text-on-surface">
                                {formatARS(p.totalARS || 0)}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {onSelectPresupuesto && (
                                    <button
                                      onClick={() => {
                                        setSelectedClienteForPresupuestos(null);
                                        onSelectPresupuesto(p.id);
                                      }}
                                      className="p-1.5 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-variant transition-colors"
                                      title="Ver detalle / PDF"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  )}
                                  {onEditPresupuesto && (
                                    <button
                                      onClick={() => {
                                        setSelectedClienteForPresupuestos(null);
                                        onEditPresupuesto(p.id);
                                      }}
                                      className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-variant transition-colors"
                                      title="Editar Presupuesto"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  {onDuplicatePresupuesto && (
                                    <button
                                      onClick={() => {
                                        setSelectedClienteForPresupuestos(null);
                                        onDuplicatePresupuesto(p);
                                      }}
                                      className="p-1.5 text-on-surface-variant hover:text-tertiary rounded-lg hover:bg-surface-variant transition-colors"
                                      title="Duplicar como plantilla"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear / Editar Cliente */}
      {(isCreating || editingCliente) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-md shadow-2xl p-6 text-on-surface">
            <div className="flex items-center justify-between mb-5 border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-on-surface">
                  {isCreating ? 'Agregar Nuevo Cliente' : 'Editar Cliente'}
                </h3>
                {'contacts' in navigator && (
                  <button
                    type="button"
                    onClick={handleImportFromContacts}
                    className="flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-full transition-colors"
                    title="Importar de los contactos del teléfono"
                  >
                    <UserPlus className="w-3 h-3" /> Agenda
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingCliente(null);
                }}
                className="text-on-surface-variant hover:text-on-surface p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} onKeyDown={handleKeyDownSequential} className="space-y-4">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Nombre / Razón Social</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">CUIT / DNI</label>
                  <input
                    type="text"
                    value={formData.cuitDni}
                    onChange={(e) => setFormData({ ...formData, cuitDni: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Condición IVA</label>
                  <select
                    value={formData.condicionIVA || 'Consumidor Final'}
                    onChange={(e) => setFormData({ ...formData, condicionIVA: e.target.value as any })}
                    className={inputCls}
                  >
                    {CONDICIONES_IVA.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Dirección</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Notas</label>
                <textarea
                  rows={2}
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingCliente(null);
                  }}
                  className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: CSV */}
      {showCSVModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-lg shadow-2xl p-6 text-on-surface">
            <div className="flex items-center justify-between mb-5 border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2 text-tertiary font-semibold text-sm">
                <FileSpreadsheet className="w-4 h-4" />
                Importar Clientes desde CSV
              </div>
              <button onClick={() => setShowCSVModal(false)} className="text-on-surface-variant hover:text-on-surface p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3.5">
              <p className="text-xs text-on-surface-variant">
                Pegá el contenido CSV. Formato:
                <br />
                <code className="text-primary bg-surface-container-highest px-1.5 py-0.5 rounded font-mono text-[11px] block mt-1">
                  Nombre, CUIT_DNI, CondicionIVA, Telefono, Email, Direccion, Notas
                </code>
              </p>
              <textarea
                rows={5}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`nombre,cuitDni,condicionIVA,telefono,email,direccion,notas\nJuan Perez,20-11111111-9,Consumidor Final,11-5555-5555,juan@gmail.com,Av Siempre Viva 123,Llamar de tarde`}
                className={`${inputCls} font-mono text-xs`}
              />
              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button
                  onClick={() => setShowCSVModal(false)}
                  className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportCSV}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm"
                >
                  Importar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile M3 Extended FAB for Client creation */}
      <button
        type="button"
        onClick={handleOpenCreate}
        className="sm:hidden fixed bottom-20 right-4 px-4 py-3.5 bg-primary text-on-primary rounded-2xl shadow-md3-2 hover:shadow-md3-3 active:scale-95 transition-all z-30 flex items-center gap-2 font-semibold text-xs"
        aria-label="Nuevo Cliente"
      >
        <Plus className="w-5 h-5" />
        <span>Nuevo Cliente</span>
      </button>
    </div>
  );
};

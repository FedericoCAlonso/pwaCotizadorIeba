import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  Save,
  Calculator,
  HardHat,
  Package,
  Truck,
  Globe,
  Percent,
  DollarSign,
  Zap,
  Sparkles
} from 'lucide-react';
import { db, softDelete } from '../db/database';
import {
  CategoriaManoDeObra,
  CostoIndirecto,
  GastoPresupuestoConfig,
  DestinoGasto,
  ModalidadGasto
} from '../core/types';
import { formatARS } from '../core/calculations';
import { ModalContainer } from './ModalContainer';
import { GastoEditorModal } from './presupuesto/GastoEditorModal';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';

export const ManoObraManager: React.FC = () => {
  const { toast } = useToast();
  const confirm = useConfirm();

  const manoObraList = (useLiveQuery(() => db.manoObra.toArray()) || []).filter((m) => !m.deleted);
  const gastosCatalogList = (useLiveQuery(() => db.costosIndirectos.toArray()) || []).filter((c) => !c.deleted);

  // Mano de Obra State
  const [editingMO, setEditingMO] = useState<CategoriaManoDeObra | null>(null);
  const [isCreatingMO, setIsCreatingMO] = useState(false);
  const [moForm, setMOForm] = useState({ nombre: '', costoHora: 0 });

  // Gastos (Catálogo Global) State
  const [showGastoModal, setShowGastoModal] = useState(false);
  const [editingGasto, setEditingGasto] = useState<GastoPresupuestoConfig | null>(null);

  useEffect(() => {
    const handleNew = () => setIsCreatingMO(true);
    window.addEventListener('app:shortcut-new', handleNew);
    return () => window.removeEventListener('app:shortcut-new', handleNew);
  }, []);

  // Handlers Mano de Obra
  const handleSaveMO = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    if (isCreatingMO) {
      await db.manoObra.add({
        id: `mo-${crypto.randomUUID()}`,
        nombre: moForm.nombre.trim(),
        costoHora: moForm.costoHora,
        fechaActualizacion: now,
        createdAt: now,
        updatedAt: now,
        deleted: false
      });
      toast.success('Categoría de mano de obra creada');
      setIsCreatingMO(false);
    } else if (editingMO) {
      await db.manoObra.update(editingMO.id, {
        nombre: moForm.nombre.trim(),
        costoHora: moForm.costoHora,
        fechaActualizacion: now,
        updatedAt: now
      });
      toast.success('Categoría de mano de obra actualizada');
      setEditingMO(null);
    }
  };

  const handleDeleteMO = async (id: string) => {
    const ok = await confirm({
      title: 'Eliminar Mano de Obra',
      message: '¿Estás seguro de eliminar esta categoría de mano de obra del catálogo?',
      confirmText: 'Eliminar',
      isDestructive: true
    });
    if (ok) {
      await softDelete('manoObra', id);
      toast.success('Categoría eliminada');
    }
  };

  // Handlers Gastos del Catálogo
  const handleOpenCreateGasto = () => {
    setEditingGasto(null);
    setShowGastoModal(true);
  };

  const handleOpenEditGasto = (g: CostoIndirecto) => {
    const configFormat: GastoPresupuestoConfig = {
      id: g.id,
      costoIndirectoId: g.id,
      nombre: g.nombre,
      destino: g.destino || (g.tipo === 'porcentual_sobre_costo' ? 'costo_indirecto' : 'costo_indirecto'),
      modalidad: g.modalidad || (g.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo'),
      valor: g.valor,
      formula: g.formula,
      incluirPorDefecto: g.incluirPorDefecto ?? true,
      aplica: true
    };
    setEditingGasto(configFormat);
    setShowGastoModal(true);
  };

  const handleSaveCatalogGasto = async (gasto: GastoPresupuestoConfig) => {
    const now = new Date().toISOString();
    const existing = gastosCatalogList.find((g) => g.id === gasto.id);

    const catalogRecord: CostoIndirecto = {
      id: gasto.id,
      nombre: gasto.nombre,
      destino: gasto.destino || 'costo_indirecto',
      modalidad: gasto.modalidad || 'porcentual',
      valor: gasto.valor,
      formula: gasto.formula,
      tipo: gasto.modalidad === 'porcentual' ? 'porcentual_sobre_costo' : 'fijo_mensual',
      incluirPorDefecto: gasto.incluirPorDefecto ?? true,
      updatedAt: now
    };

    if (existing) {
      await db.costosIndirectos.update(gasto.id, catalogRecord);
      toast.success(`Gasto "${gasto.nombre}" actualizado`);
    } else {
      catalogRecord.createdAt = now;
      catalogRecord.deleted = false;
      await db.costosIndirectos.add(catalogRecord);
      toast.success(`Gasto "${gasto.nombre}" agregado al catálogo`);
    }
    setShowGastoModal(false);
    setEditingGasto(null);
  };

  const handleDeleteCatalogGasto = async (id: string) => {
    const ok = await confirm({
      title: 'Eliminar Gasto del Catálogo',
      message: '¿Estás seguro de eliminar este gasto del catálogo global?',
      confirmText: 'Eliminar',
      isDestructive: true
    });
    if (ok) {
      await softDelete('costosIndirectos', id);
      toast.success('Gasto eliminado del catálogo');
      setShowGastoModal(false);
      setEditingGasto(null);
    }
  };

  const handleToggleIncluirPorDefecto = async (g: CostoIndirecto) => {
    const nuevoEstado = !(g.incluirPorDefecto ?? true);
    await db.costosIndirectos.update(g.id, {
      incluirPorDefecto: nuevoEstado,
      updatedAt: new Date().toISOString()
    });
    toast.success(
      nuevoEstado
        ? `"${g.nombre}" se incluirá por defecto en nuevas cotizaciones`
        : `"${g.nombre}" no se incluirá por defecto`
    );
  };

  const getDestinoBadge = (destino?: DestinoGasto) => {
    switch (destino) {
      case 'mano_obra':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/20">
            <HardHat className="w-3.5 h-3.5 text-amber-500" />
            <span>Mano de Obra (MOD)</span>
          </span>
        );
      case 'materiales':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full border border-blue-500/20">
            <Package className="w-3.5 h-3.5 text-blue-500" />
            <span>Materiales / Insumos</span>
          </span>
        );
      case 'servicios':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full border border-purple-500/20">
            <Truck className="w-3.5 h-3.5 text-purple-500" />
            <span>Servicios Tercerizados</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-slate-500/10 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-500/20">
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>Costo Indirecto (s/ Total C)</span>
          </span>
        );
    }
  };

  const getModalidadBadge = (modalidad?: ModalidadGasto, formula?: string) => {
    if (modalidad === 'parametrico' || formula) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
          <Zap className="w-3 h-3" />
          <span>Fórmula ⚡</span>
        </span>
      );
    }
    if (modalidad === 'monto_fijo') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full">
          <DollarSign className="w-3 h-3" />
          <span>Monto Fijo</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full">
        <Percent className="w-3 h-3" />
        <span>Porcentual</span>
      </span>
    );
  };

  const inputCls =
    'w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl px-3.5 py-2.5 text-base sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 min-h-[44px] transition-shadow';

  return (
    <div className="space-y-8">
      {/* SECTION 1: MANO DE OBRA */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span>Categorías de Mano de Obra</span>
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Tarifas horarias base de mano de obra directa (MOD) sin margen de ganancia.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMOForm({ nombre: '', costoHora: 8000 });
              setIsCreatingMO(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs sm:text-sm transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Categoría</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {manoObraList.map((mo) => (
            <div
              key={mo.id}
              className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all space-y-3 shadow-sm flex flex-col justify-between"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-on-surface text-base">{mo.nombre}</h3>
                  <span className="text-xs text-on-surface-variant block mt-1">
                    Actualizado: {new Date(mo.fechaActualizacion).toLocaleDateString('es-AR')}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMO(mo);
                      setMOForm({ nombre: mo.nombre, costoHora: mo.costoHora });
                    }}
                    className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors"
                    aria-label={`Editar ${mo.nombre}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMO(mo.id)}
                    className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors"
                    aria-label={`Eliminar ${mo.nombre}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="pt-3 border-t border-outline-variant/20 flex justify-between items-baseline">
                <span className="text-xs font-medium text-on-surface-variant">Costo / hora:</span>
                <span className="font-mono text-xl font-black text-primary">
                  {formatARS(mo.costoHora)}
                  <span className="text-xs text-on-surface-variant font-sans font-normal ml-1">/h</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-outline-variant/20" />

      {/* SECTION 2: GASTOS & MODIFICADORES DEL CATÁLOGO */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              <span>Gastos & Modificadores de Costo (Catálogo)</span>
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Gastos directos (cargas sociales s/MO, garantía s/materiales) o costos indirectos (s/Costo Total C).
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreateGasto}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs sm:text-sm transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Gasto</span>
          </button>
        </div>

        {gastosCatalogList.length === 0 ? (
          <div className="p-8 rounded-3xl bg-surface-container/50 border border-dashed border-outline-variant/30 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-primary mx-auto opacity-75" />
            <p className="text-sm font-semibold text-on-surface">No hay gastos configurados en el catálogo global.</p>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto">
              Presiona <strong>"Nuevo Gasto"</strong> para definir cargas sociales de MO, coeficientes de garantía para materiales o gastos indirectos de obra.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gastosCatalogList.map((g) => {
              const destino = g.destino || (g.tipo === 'porcentual_sobre_costo' ? 'costo_indirecto' : 'costo_indirecto');
              const modalidad = g.modalidad || (g.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo');

              return (
                <div
                  key={g.id}
                  className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all space-y-3 shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-on-surface text-base truncate">{g.nombre}</h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditGasto(g)}
                          className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors"
                          aria-label={`Editar ${g.nombre}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCatalogGasto(g.id)}
                          className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors"
                          aria-label={`Eliminar ${g.nombre}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Chips de Destino y Modalidad */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {getDestinoBadge(destino)}
                      {getModalidadBadge(modalidad, g.formula)}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">
                        Valor / Regla:
                      </span>
                      <span className="font-mono text-base font-black text-primary">
                        {modalidad === 'parametrico' && g.formula ? (
                          <span className="text-xs font-mono bg-surface-container-highest px-2 py-0.5 rounded-md">
                            {g.formula}
                          </span>
                        ) : modalidad === 'porcentual' ? (
                          `${g.valor}%`
                        ) : (
                          formatARS(g.valor)
                        )}
                      </span>
                    </div>

                    {/* Switch rápido de Inclusión por Defecto */}
                    <button
                      type="button"
                      onClick={() => handleToggleIncluirPorDefecto(g)}
                      className={`px-3 py-1.5 rounded-full border text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 shadow-2xs ${
                        (g.incluirPorDefecto ?? true)
                          ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-surface-container-highest hover:bg-surface-variant text-on-surface-variant border-outline-variant/30 opacity-70'
                      }`}
                      title="Hacer clic para activar o desactivar la inclusión automática en nuevos presupuestos"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          (g.incluirPorDefecto ?? true) ? 'bg-emerald-500' : 'bg-outline-variant'
                        }`}
                      />
                      <span>{(g.incluirPorDefecto ?? true) ? 'Por Defecto: Sí' : 'Por Defecto: No'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Mano de Obra */}
      <ModalContainer
        isOpen={isCreatingMO || editingMO !== null}
        onClose={() => {
          setIsCreatingMO(false);
          setEditingMO(null);
        }}
        title={isCreatingMO ? 'Nueva Categoría de Mano de Obra' : 'Editar Categoría de Mano de Obra'}
        subtitle="Tarifa horaria neta para cómputo de tareas y cuadrillas"
        icon={<Clock className="w-5 h-5 text-primary" />}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => {
                setIsCreatingMO(false);
                setEditingMO(null);
              }}
              className="px-4 py-2 rounded-full text-xs sm:text-sm text-on-surface-variant hover:bg-surface-variant"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveMO}
              className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs sm:text-sm shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveMO} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">Nombre de la Categoría *</label>
            <input
              type="text"
              value={moForm.nombre}
              onChange={(e) => setMOForm({ ...moForm, nombre: e.target.value })}
              className={inputCls}
              placeholder="Ej: Oficial Electricista, Ayudante, Especialista"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">Costo Hora Real (ARS) *</label>
            <div className="relative">
              <span className="text-xs text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2 font-mono">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={moForm.costoHora || ''}
                onChange={(e) => setMOForm({ ...moForm, costoHora: parseFloat(e.target.value) || 0 })}
                className={`${inputCls} pl-8 font-mono text-primary font-bold`}
                placeholder="0.00"
                required
              />
            </div>
          </div>
        </form>
      </ModalContainer>

      {/* Modal: Gasto del Catálogo Global */}
      <GastoEditorModal
        isOpen={showGastoModal}
        onClose={() => {
          setShowGastoModal(false);
          setEditingGasto(null);
        }}
        gastoToEdit={editingGasto}
        showIncluirPorDefecto={true}
        onSave={handleSaveCatalogGasto}
        onDelete={editingGasto ? handleDeleteCatalogGasto : undefined}
      />
    </div>
  );
};

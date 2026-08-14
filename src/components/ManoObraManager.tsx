import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, Plus, Edit2, Trash2, Save, Calculator } from 'lucide-react';
import { db, softDelete } from '../db/database';
import { CategoriaManoDeObra, CostoIndirecto, TipoCostoIndirecto } from '../core/types';
import { formatARS } from '../core/calculations';
import { TIPOS_COSTO_INDIRECTO } from '../core/sampleData';
import { ModalContainer } from './ModalContainer';

export const ManoObraManager: React.FC = () => {
  const manoObraList = (useLiveQuery(() => db.manoObra.toArray()) || []).filter((m) => !m.deleted);
  const costosIndirectosList = (useLiveQuery(() => db.costosIndirectos.toArray()) || []).filter((c) => !c.deleted);

  const [editingMO, setEditingMO] = useState<CategoriaManoDeObra | null>(null);
  const [isCreatingMO, setIsCreatingMO] = useState(false);
  const [moForm, setMOForm] = useState({ nombre: '', costoHora: 0 });

  const [editingCI, setEditingCI] = useState<CostoIndirecto | null>(null);
  const [isCreatingCI, setIsCreatingCI] = useState(false);
  const [ciForm, setCIForm] = useState<{ nombre: string; tipo: TipoCostoIndirecto; valor: number }>({
    nombre: '',
    tipo: 'porcentual_sobre_costo',
    valor: 0
  });

  const handleSaveMO = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    if (isCreatingMO) {
      await db.manoObra.add({
        id: `mo-${crypto.randomUUID()}`,
        nombre: moForm.nombre,
        costoHora: moForm.costoHora,
        fechaActualizacion: now,
        createdAt: now,
        updatedAt: now,
        deleted: false
      });
      setIsCreatingMO(false);
    } else if (editingMO) {
      await db.manoObra.update(editingMO.id, {
        nombre: moForm.nombre,
        costoHora: moForm.costoHora,
        fechaActualizacion: now,
        updatedAt: now
      });
      setEditingMO(null);
    }
  };

  const handleDeleteMO = async (id: string) => {
    if (confirm('¿Eliminar esta categoría?')) {
      await softDelete('manoObra', id);
    }
  };

  const handleSaveCI = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    if (isCreatingCI) {
      await db.costosIndirectos.add({
        id: `ci-${crypto.randomUUID()}`,
        nombre: ciForm.nombre,
        tipo: ciForm.tipo,
        valor: ciForm.valor,
        createdAt: now,
        updatedAt: now,
        deleted: false
      });
      setIsCreatingCI(false);
    } else if (editingCI) {
      await db.costosIndirectos.update(editingCI.id, {
        nombre: ciForm.nombre,
        tipo: ciForm.tipo,
        valor: ciForm.valor,
        updatedAt: now
      });
      setEditingCI(null);
    }
  };

  const handleDeleteCI = async (id: string) => {
    if (confirm('¿Eliminar este costo indirecto?')) {
      await softDelete('costosIndirectos', id);
    }
  };

  const inputCls =
    'w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 min-h-[44px] transition-shadow';

  return (
    <div className="space-y-8">
      {/* SECTION 1: MANO DE OBRA */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Categorías de Mano de Obra
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Costo hora real por categoría (sin margen de ganancia).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMOForm({ nombre: '', costoHora: 8000 });
              setIsCreatingMO(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Categoría</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {manoObraList.map((mo) => (
            <div
              key={mo.id}
              className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all space-y-3 shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-on-surface text-base">{mo.nombre}</h3>
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
                <span className="text-xs text-on-surface-variant">Costo / hora:</span>
                <span className="font-mono text-xl font-bold text-primary">
                  {formatARS(mo.costoHora)}
                  <span className="text-xs text-on-surface-variant font-sans font-normal ml-1">/h</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-outline-variant/20" />

      {/* SECTION 2: COSTOS INDIRECTOS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              Costos Indirectos & Estructura
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Viáticos, herramientas, monotributo, amortización.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCIForm({ nombre: '', tipo: 'porcentual_sobre_costo', valor: 5 });
              setIsCreatingCI(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Costo Indirecto</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {costosIndirectosList.map((ci) => (
            <div
              key={ci.id}
              className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all space-y-3 shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-on-surface text-base">{ci.nombre}</h3>
                  <span className="inline-block mt-1.5 text-[11px] font-medium px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container">
                    {ci.tipo === 'porcentual_sobre_costo'
                      ? 'Porcentual'
                      : ci.tipo === 'fijo_mensual'
                      ? 'Fijo Mensual'
                      : 'Por Visita'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCI(ci);
                      setCIForm({ nombre: ci.nombre, tipo: ci.tipo, valor: ci.valor });
                    }}
                    className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors"
                    aria-label={`Editar ${ci.nombre}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCI(ci.id)}
                    className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors"
                    aria-label={`Eliminar ${ci.nombre}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="pt-3 border-t border-outline-variant/20 flex justify-between items-baseline">
                <span className="text-xs text-on-surface-variant">Valor:</span>
                <span className="font-mono text-lg font-bold text-primary">
                  {ci.tipo === 'porcentual_sobre_costo' ? `${ci.valor}%` : formatARS(ci.valor)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Mano de Obra */}
      <ModalContainer
        isOpen={isCreatingMO || editingMO !== null}
        onClose={() => {
          setIsCreatingMO(false);
          setEditingMO(null);
        }}
        title={isCreatingMO ? 'Nueva Categoría de Mano de Obra' : 'Editar Categoría de Mano de Obra'}
        icon={<Clock className="w-5 h-5" />}
        maxWidth="md"
      >
        <form onSubmit={handleSaveMO} className="space-y-4">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Nombre de la Categoría</label>
            <input
              type="text"
              value={moForm.nombre}
              onChange={(e) => setMOForm({ ...moForm, nombre: e.target.value })}
              className={inputCls}
              placeholder="Ej: Oficial Electricista"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Costo Hora Real (ARS)</label>
            <div className="relative">
              <span className="text-xs text-on-surface-variant absolute left-3 top-3 font-mono">$</span>
              <input
                type="number"
                step="0.01"
                value={moForm.costoHora}
                onChange={(e) => setMOForm({ ...moForm, costoHora: parseFloat(e.target.value) || 0 })}
                className={`${inputCls} pl-7 font-mono text-primary font-bold`}
                required
              />
            </div>
          </div>
          <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
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
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-xs sm:text-sm shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar
            </button>
          </div>
        </form>
      </ModalContainer>

      {/* Modal: Costo Indirecto */}
      <ModalContainer
        isOpen={isCreatingCI || editingCI !== null}
        onClose={() => {
          setIsCreatingCI(false);
          setEditingCI(null);
        }}
        title={isCreatingCI ? 'Nuevo Costo Indirecto' : 'Editar Costo Indirecto'}
        icon={<Calculator className="w-5 h-5" />}
        maxWidth="md"
      >
        <form onSubmit={handleSaveCI} className="space-y-4">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Concepto</label>
            <input
              type="text"
              value={ciForm.nombre}
              onChange={(e) => setCIForm({ ...ciForm, nombre: e.target.value })}
              className={inputCls}
              placeholder="Ej: Combustible y Viáticos"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Tipo de Costo</label>
            <select
              value={ciForm.tipo}
              onChange={(e) => setCIForm({ ...ciForm, tipo: e.target.value as TipoCostoIndirecto })}
              className={inputCls}
            >
              {TIPOS_COSTO_INDIRECTO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">
              {ciForm.tipo === 'porcentual_sobre_costo' ? 'Porcentaje (%)' : 'Monto (ARS)'}
            </label>
            <div className="relative">
              {ciForm.tipo !== 'porcentual_sobre_costo' && (
                <span className="text-xs text-on-surface-variant absolute left-3 top-3 font-mono">$</span>
              )}
              <input
                type="number"
                step="0.01"
                value={ciForm.valor}
                onChange={(e) => setCIForm({ ...ciForm, valor: parseFloat(e.target.value) || 0 })}
                className={`${inputCls} ${
                  ciForm.tipo !== 'porcentual_sobre_costo' ? 'pl-7' : ''
                } font-mono text-primary font-bold`}
                required
              />
              {ciForm.tipo === 'porcentual_sobre_costo' && (
                <span className="text-xs text-on-surface-variant absolute right-3 top-3">%</span>
              )}
            </div>
          </div>
          <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCreatingCI(false);
                setEditingCI(null);
              }}
              className="px-4 py-2 rounded-full text-xs sm:text-sm text-on-surface-variant hover:bg-surface-variant"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-xs sm:text-sm shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar
            </button>
          </div>
        </form>
      </ModalContainer>
    </div>
  );
};

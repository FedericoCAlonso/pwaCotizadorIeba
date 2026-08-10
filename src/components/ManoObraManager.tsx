import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, Plus, Edit2, Trash2, X, Save, DollarSign, ShieldAlert, Calculator } from 'lucide-react';
import { db } from '../db/database';
import { CategoriaManoDeObra, CostoIndirecto, TipoCostoIndirecto } from '../core/types';
import { formatARS } from '../core/calculations';

export const ManoObraManager: React.FC = () => {
  const manoObraList = useLiveQuery(() => db.manoObra.toArray()) || [];
  const costosIndirectosList = useLiveQuery(() => db.costosIndirectos.toArray()) || [];

  // Mano de obra Form Modal state
  const [editingMO, setEditingMO] = useState<CategoriaManoDeObra | null>(null);
  const [isCreatingMO, setIsCreatingMO] = useState(false);
  const [moForm, setMOForm] = useState({ nombre: '', costoHora: 0 });

  // Costos Indirectos Form Modal state
  const [editingCI, setEditingCI] = useState<CostoIndirecto | null>(null);
  const [isCreatingCI, setIsCreatingCI] = useState(false);
  const [ciForm, setCIForm] = useState<{
    nombre: string;
    tipo: TipoCostoIndirecto;
    valor: number;
  }>({
    nombre: '',
    tipo: 'porcentual_sobre_costo',
    valor: 0
  });

  // Handlers Mano de Obra
  const handleSaveMO = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    if (isCreatingMO) {
      await db.manoObra.add({
        id: `mo-${crypto.randomUUID()}`,
        nombre: moForm.nombre,
        costoHora: moForm.costoHora,
        fechaActualizacion: now
      });
      setIsCreatingMO(false);
    } else if (editingMO) {
      await db.manoObra.update(editingMO.id, {
        nombre: moForm.nombre,
        costoHora: moForm.costoHora,
        fechaActualizacion: now
      });
      setEditingMO(null);
    }
  };

  const handleDeleteMO = async (id: string) => {
    if (confirm('¿Eliminar esta categoría de mano de obra?')) {
      await db.manoObra.delete(id);
    }
  };

  // Handlers Costos Indirectos
  const handleSaveCI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingCI) {
      await db.costosIndirectos.add({
        id: `ci-${crypto.randomUUID()}`,
        nombre: ciForm.nombre,
        tipo: ciForm.tipo,
        valor: ciForm.valor
      });
      setIsCreatingCI(false);
    } else if (editingCI) {
      await db.costosIndirectos.update(editingCI.id, {
        nombre: ciForm.nombre,
        tipo: ciForm.tipo,
        valor: ciForm.valor
      });
      setEditingCI(null);
    }
  };

  const handleDeleteCI = async (id: string) => {
    if (confirm('¿Eliminar este costo indirecto?')) {
      await db.costosIndirectos.delete(id);
    }
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: MANO DE OBRA */}
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span>Categorías de Mano de Obra (Costo/Hora Real)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Establece el costo hora real por categoría (sin incluir margen de ganancia).
            </p>
          </div>

          <button
            onClick={() => {
              setMOForm({ nombre: '', costoHora: 8000 });
              setIsCreatingMO(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nueva Categoría</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {manoObraList.map((mo) => (
            <div
              key={mo.id}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition space-y-3 relative group"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-base">{mo.nombre}</h3>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Actualizado: {new Date(mo.fechaActualizacion).toLocaleDateString('es-AR')}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingMO(mo);
                      setMOForm({ nombre: mo.nombre, costoHora: mo.costoHora });
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                    aria-label={`Editar categoría ${mo.nombre}`}
                  >
                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button onClick={() => handleDeleteMO(mo.id)} className="p-1 text-slate-400 hover:text-rose-400" aria-label={`Eliminar categoría ${mo.nombre}`}>
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                <span className="text-xs text-slate-400">Costo Hora Real:</span>
                <span className="font-mono text-xl font-extrabold text-emerald-400">
                  {formatARS(mo.costoHora)}
                  <span className="text-xs text-slate-500 font-sans font-normal ml-1">/h</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-slate-800" />

      {/* SECTION 2: COSTOS INDIRECTOS / ESTRUCTURA */}
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              <span>Costos Indirectos & Gastos de Estructura</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Gastos no materiales asignados a los presupuestos (viáticos, herramientas, monotributo, amortización).
            </p>
          </div>

          <button
            onClick={() => {
              setCIForm({ nombre: '', tipo: 'porcentual_sobre_costo', valor: 5 });
              setIsCreatingCI(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuevo Costo Indirecto</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {costosIndirectosList.map((ci) => (
            <div
              key={ci.id}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-base">{ci.nombre}</h3>
                  <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-amber-500/20">
                    {ci.tipo === 'porcentual_sobre_costo'
                      ? 'Porcentual s/ Costo Directo'
                      : ci.tipo === 'fijo_mensual'
                      ? 'Monto Fijo Mensual'
                      : 'Por Visita / Obra'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingCI(ci);
                      setCIForm({ nombre: ci.nombre, tipo: ci.tipo, valor: ci.valor });
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                    aria-label={`Editar costo indirecto ${ci.nombre}`}
                  >
                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button onClick={() => handleDeleteCI(ci.id)} className="p-1 text-slate-400 hover:text-rose-400" aria-label={`Eliminar costo indirecto ${ci.nombre}`}>
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                <span className="text-xs text-slate-400">Valor Asignado:</span>
                <span className="font-mono text-lg font-bold text-amber-300">
                  {ci.tipo === 'porcentual_sobre_costo' ? `${ci.valor}%` : formatARS(ci.valor)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Create/Edit Mano de Obra */}
      {(isCreatingMO || editingMO) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-white">
                {isCreatingMO ? 'Nueva Categoría Mano de Obra' : 'Editar Mano de Obra'}
              </h3>
              <button
                onClick={() => {
                  setIsCreatingMO(false);
                  setEditingMO(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMO} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Nombre de la Categoría</label>
                <input
                  type="text"
                  value={moForm.nombre}
                  onChange={(e) => setMOForm({ ...moForm, nombre: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  placeholder="Ej: Oficial Electricista, Ayudante"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Costo Hora Real (ARS)</label>
                <div className="relative">
                  <span className="text-xs text-slate-400 absolute left-3 top-2.5 font-mono font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={moForm.costoHora}
                    onChange={(e) => setMOForm({ ...moForm, costoHora: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingMO(false);
                    setEditingMO(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create/Edit Costo Indirecto */}
      {(isCreatingCI || editingCI) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-white">
                {isCreatingCI ? 'Nuevo Costo Indirecto' : 'Editar Costo Indirecto'}
              </h3>
              <button
                onClick={() => {
                  setIsCreatingCI(false);
                  setEditingCI(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCI} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Concepto / Nombre</label>
                <input
                  type="text"
                  value={ciForm.nombre}
                  onChange={(e) => setCIForm({ ...ciForm, nombre: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  placeholder="Ej: Combustible, Amortización de Herramientas"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Tipo de Costo</label>
                <select
                  value={ciForm.tipo}
                  onChange={(e) => setCIForm({ ...ciForm, tipo: e.target.value as TipoCostoIndirecto })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="porcentual_sobre_costo">Porcentual sobre Costo Directo (%)</option>
                  <option value="por_visita">Monto Fijo por Visita / Obra (ARS)</option>
                  <option value="fijo_mensual">Monto Fijo Mensual (ARS)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  {ciForm.tipo === 'porcentual_sobre_costo' ? 'Porcentaje (%)' : 'Monto (ARS)'}
                </label>
                <div className="relative">
                  {ciForm.tipo !== 'porcentual_sobre_costo' ? (
                    <span className="text-xs text-slate-400 absolute left-3 top-2.5 font-mono font-bold">$</span>
                  ) : null}
                  <input
                    type="number"
                    step="0.01"
                    value={ciForm.valor}
                    onChange={(e) => setCIForm({ ...ciForm, valor: parseFloat(e.target.value) || 0 })}
                    className={`w-full bg-slate-800 border border-slate-700 rounded-lg ${ciForm.tipo !== 'porcentual_sobre_costo' ? 'pl-7' : 'pl-3'} pr-8 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500`}
                    required
                  />
                  {ciForm.tipo === 'porcentual_sobre_costo' ? (
                    <span className="text-xs text-slate-400 absolute right-3 top-2.5 font-mono font-bold">%</span>
                  ) : null}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingCI(false);
                    setEditingCI(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

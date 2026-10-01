import React, { useState } from 'react';
import {
  Edit2,
  Trash2,
  Copy,
  Plus,
  Building2,
  HardHat,
  Package,
  Truck,
  Globe,
  DollarSign,
  Percent,
  Zap,
  Check,
  X
} from 'lucide-react';
import { CostoIndirecto, DestinoGasto, ModalidadGasto } from '../../core/types';
import { formatARS, safeNum } from '../../core/calculations';

interface ManoObraGastosTableProps {
  gastosList: CostoIndirecto[];
  onOpenCreate: () => void;
  onOpenEdit: (g: CostoIndirecto) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleDefault: (g: CostoIndirecto) => void;
  onUpdateField: (id: string, field: string, value: any) => Promise<void>;
  onQuickCreate: (
    nombre?: string,
    destino?: DestinoGasto,
    modalidad?: ModalidadGasto,
    valor?: number
  ) => Promise<string>;
}

export const ManoObraGastosTable: React.FC<ManoObraGastosTableProps> = ({
  gastosList,
  onOpenCreate,
  onOpenEdit,
  onDelete,
  onDuplicate,
  onToggleDefault,
  onUpdateField,
  onQuickCreate
}) => {
  const [quickName, setQuickName] = useState('');
  const [quickDestino, setQuickDestino] = useState<DestinoGasto>('costo_indirecto');
  const [quickModalidad, setQuickModalidad] = useState<ModalidadGasto>('porcentual');
  const [quickValor, setQuickValor] = useState<string>('5');
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);

  // Estados locales de edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'nombre' | 'valor' | null>(null);
  const [draftValue, setDraftValue] = useState<string>('');

  const startEdit = (gasto: CostoIndirecto, field: 'nombre' | 'valor') => {
    setEditingId(gasto.id);
    setEditingField(field);
    setDraftValue(field === 'nombre' ? gasto.nombre : String(gasto.valor));
  };

  const commitEdit = async (gasto: CostoIndirecto) => {
    if (!editingId || !editingField) return;
    const currentField = editingField;
    const val = draftValue.trim();
    setEditingId(null);
    setEditingField(null);

    if (currentField === 'nombre' && val && val !== gasto.nombre) {
      await onUpdateField(gasto.id, 'nombre', val);
    } else if (currentField === 'valor') {
      const num = parseFloat(val);
      if (!isNaN(num) && num !== gasto.valor) {
        await onUpdateField(gasto.id, 'valor', num);
      }
    }
  };

  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = quickName.trim();
    if (!trimmed) return;
    setIsCreatingQuick(true);
    try {
      const numVal = parseFloat(quickValor) || 5;
      await onQuickCreate(trimmed, quickDestino, quickModalidad, numVal);
      setQuickName('');
    } finally {
      setIsCreatingQuick(false);
    }
  };

  const getDestinoBadge = (destino?: DestinoGasto) => {
    switch (destino) {
      case 'mano_obra':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20">
            <HardHat className="w-3 h-3 text-amber-500" />
            <span>Mano de Obra</span>
          </span>
        );
      case 'materiales':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">
            <Package className="w-3 h-3 text-blue-500" />
            <span>Materiales</span>
          </span>
        );
      case 'servicios':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/20">
            <Truck className="w-3 h-3 text-purple-500" />
            <span>Servicios</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-slate-500/10 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-500/20">
            <Globe className="w-3 h-3 text-slate-500" />
            <span>Indirecto Obra</span>
          </span>
        );
    }
  };

  const getModalidadBadge = (modalidad?: ModalidadGasto, formula?: string) => {
    if (modalidad === 'parametrico' || formula) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
          <Zap className="w-3 h-3" />
          <span>Fórmula ⚡</span>
        </span>
      );
    }
    if (modalidad === 'monto_fijo') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full">
          <DollarSign className="w-3 h-3" />
          <span>Monto Fijo</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full">
        <Percent className="w-3 h-3" />
        <span>Porcentual</span>
      </span>
    );
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-high/60 border-b border-outline-variant/20 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              <th className="px-3 py-2.5 w-10 text-center">#</th>
              <th className="px-3 py-2.5 min-w-[200px]">Concepto / Gasto de Obra</th>
              <th className="px-3 py-2.5 w-40">Destino (Base)</th>
              <th className="px-3 py-2.5 w-36">Modalidad</th>
              <th className="px-3 py-2.5 w-36 text-right">Valor / Regla</th>
              <th className="px-3 py-2.5 w-32 text-center">Por Defecto</th>
              <th className="px-3 py-2.5 w-24 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {gastosList.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-on-surface-variant space-y-2">
                  <Building2 className="w-8 h-8 text-primary mx-auto opacity-40" />
                  <p className="text-sm font-semibold text-on-surface">No hay gastos configurados en el catálogo</p>
                  <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                    Define gastos de obra (fletes, andamios, volquetes) o coeficientes indirectos de estructura.
                  </p>
                </td>
              </tr>
            ) : (
              gastosList.map((g, idx) => {
                const destino = g.destino || (g.tipo === 'porcentual_sobre_costo' ? 'costo_indirecto' : 'costo_indirecto');
                const modalidad = g.modalidad || (g.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo');
                const isEditingThisNombre = editingId === g.id && editingField === 'nombre';
                const isEditingThisValor = editingId === g.id && editingField === 'valor';
                const isPorDefecto = g.incluirPorDefecto ?? true;

                return (
                  <tr
                    key={g.id}
                    className="border-b border-outline-variant/10 hover:bg-surface-container-high/40 transition-colors group"
                  >
                    {/* # Index */}
                    <td className="px-3 py-2.5 text-xs text-on-surface-variant font-mono text-center">
                      {idx + 1}
                    </td>

                    {/* Concepto / Gasto */}
                    <td className="px-3 py-2.5 text-sm font-semibold text-on-surface">
                      {isEditingThisNombre ? (
                        <input
                          type="text"
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onBlur={() => commitEdit(g)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit(g);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="w-full px-2 py-1 text-xs font-semibold bg-surface border border-primary rounded-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(g, 'nombre')}
                          className="text-left w-full hover:text-primary transition-colors cursor-pointer rounded px-1 -mx-1 hover:bg-surface-variant/40 flex items-center justify-between group/name"
                          title="Clic para editar nombre"
                        >
                          <span className="truncate">{g.nombre}</span>
                          <Edit2 className="w-3 h-3 opacity-0 group-hover/name:opacity-50 text-on-surface-variant shrink-0 ml-1.5" />
                        </button>
                      )}
                    </td>

                    {/* Destino (Base) */}
                    <td className="px-3 py-2.5">
                      <select
                        value={destino}
                        onChange={(e) => onUpdateField(g.id, 'destino', e.target.value as DestinoGasto)}
                        aria-label={`Destino para ${g.nombre}`}
                        className="text-xs font-bold px-2 py-1 rounded-full border border-outline-variant/20 bg-surface-container hover:bg-surface-variant text-on-surface cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="costo_indirecto">Indirecto Obra</option>
                        <option value="mano_obra">Mano de Obra</option>
                        <option value="materiales">Materiales</option>
                        <option value="servicios">Servicios</option>
                      </select>
                    </td>

                    {/* Modalidad */}
                    <td className="px-3 py-2.5">
                      <select
                        value={modalidad}
                        onChange={(e) => onUpdateField(g.id, 'modalidad', e.target.value as ModalidadGasto)}
                        aria-label={`Modalidad para ${g.nombre}`}
                        className="text-xs font-bold px-2 py-1 rounded-full border border-outline-variant/20 bg-surface-container hover:bg-surface-variant text-on-surface cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="porcentual">Porcentual (%)</option>
                        <option value="monto_fijo">Monto Fijo ($)</option>
                        <option value="parametrico">Fórmula (⚡)</option>
                      </select>
                    </td>

                    {/* Valor / Regla */}
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-primary">
                      {isEditingThisValor ? (
                        <input
                          type="number"
                          step="0.5"
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onBlur={() => commitEdit(g)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit(g);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="w-24 px-1.5 py-0.5 text-xs font-mono font-bold text-right bg-surface border border-primary rounded-md text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(g, 'valor')}
                          className="w-full text-right hover:underline cursor-pointer rounded px-1 -mx-1"
                          title="Clic para editar valor"
                        >
                          {modalidad === 'parametrico' && g.formula ? (
                            <span className="text-2xs font-mono bg-surface-container-highest px-1.5 py-0.5 rounded">
                              {g.formula}
                            </span>
                          ) : modalidad === 'porcentual' ? (
                            `${g.valor}%`
                          ) : (
                            formatARS(g.valor)
                          )}
                        </button>
                      )}
                    </td>

                    {/* Switch Por Defecto */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => onToggleDefault(g)}
                        aria-label={`Incluir ${g.nombre} por defecto`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                          isPorDefecto
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-surface-container text-on-surface-variant border-outline-variant/30 opacity-70'
                        }`}
                        title="Toca para cambiar si se incluye por defecto en nuevas cotizaciones"
                      >
                        <span className={`w-2 h-2 rounded-full ${isPorDefecto ? 'bg-emerald-500' : 'bg-outline-variant'}`} />
                        <span>{isPorDefecto ? 'Sí' : 'No'}</span>
                      </button>
                    </td>

                    {/* Acciones */}
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onDuplicate(g.id)}
                          className="p-1.5 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
                          title="Clonar / Duplicar gasto"
                          aria-label={`Duplicar ${g.nombre}`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEdit(g)}
                          className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
                          title="Editar en detalle"
                          aria-label={`Editar ${g.nombre} en detalle`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(g.id)}
                          className="p-1.5 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors cursor-pointer"
                          title="Eliminar gasto"
                          aria-label={`Eliminar ${g.nombre}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}

            {/* Fila de creación rápida al pie */}
            <tr className="bg-surface-container-high/20 border-t border-outline-variant/20">
              <td className="px-3 py-2 text-center text-xs text-primary font-bold">
                <Plus className="w-3.5 h-3.5 mx-auto" />
              </td>
              <td colSpan={6} className="px-3 py-2">
                <form onSubmit={handleQuickAdd} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    placeholder="+ Agregar nuevo gasto o concepto de obra rápido (ej: Alquiler de Andamio tubular)..."
                    className="flex-1 bg-surface-container-lowest/80 border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface"
                  />
                  <select
                    value={quickDestino}
                    onChange={(e) => setQuickDestino(e.target.value as DestinoGasto)}
                    aria-label="Destino para nuevo gasto"
                    className="bg-surface-container border border-outline-variant/20 rounded-lg px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shrink-0"
                  >
                    <option value="costo_indirecto">Indirecto Obra</option>
                    <option value="mano_obra">Mano de Obra</option>
                    <option value="materiales">Materiales</option>
                    <option value="servicios">Servicios</option>
                  </select>
                  <select
                    value={quickModalidad}
                    onChange={(e) => setQuickModalidad(e.target.value as ModalidadGasto)}
                    aria-label="Modalidad para nuevo gasto"
                    className="bg-surface-container border border-outline-variant/20 rounded-lg px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shrink-0"
                  >
                    <option value="porcentual">% Porcentual</option>
                    <option value="monto_fijo">$ Monto Fijo</option>
                  </select>
                  <input
                    type="number"
                    step="0.5"
                    value={quickValor}
                    onChange={(e) => setQuickValor(e.target.value)}
                    placeholder="Valor"
                    aria-label="Valor para nuevo gasto"
                    className="w-20 bg-surface-container border border-outline-variant/20 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-right text-primary focus:outline-none focus:ring-1 focus:ring-primary shrink-0"
                  />
                  <button
                    type="submit"
                    disabled={!quickName.trim() || isCreatingQuick}
                    className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  >
                    {isCreatingQuick ? 'Agregando...' : 'Agregar'}
                  </button>
                </form>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

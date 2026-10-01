import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Copy,
  Edit2,
  Trash2,
  Calendar,
  Percent,
  Check,
  X,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { ConvenioLaboral } from '../../core/types';
import { formatARS, safeNum } from '../../core/calculations';

interface ConveniosTableProps {
  conveniosList: ConvenioLaboral[];
  onOpenCreate: () => void;
  onOpenEdit: (c: ConvenioLaboral) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onUpdateField: (id: string, field: string, value: any) => Promise<void>;
  onQuickCreate: (nombre?: string, cargasSocialesPct?: number) => Promise<string>;
}

export const ConveniosTable: React.FC<ConveniosTableProps> = ({
  conveniosList,
  onOpenCreate,
  onOpenEdit,
  onDelete,
  onDuplicate,
  onUpdateField,
  onQuickCreate
}) => {
  const [quickName, setQuickName] = useState('');
  const [quickPct, setQuickPct] = useState('65');
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);

  // Estados locales de edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'nombre' | 'cargasSocialesPct' | 'gastosDirectosOperarioDefecto' | null>(null);
  const [draftValue, setDraftValue] = useState<string>('');

  const startEdit = (
    convenio: ConvenioLaboral,
    field: 'nombre' | 'cargasSocialesPct' | 'gastosDirectosOperarioDefecto'
  ) => {
    setEditingId(convenio.id);
    setEditingField(field);
    if (field === 'nombre') setDraftValue(convenio.nombre);
    else if (field === 'cargasSocialesPct') setDraftValue(convenio.cargasSocialesPct.toString());
    else if (field === 'gastosDirectosOperarioDefecto') setDraftValue((convenio.gastosDirectosOperarioDefecto ?? 5000).toString());
  };

  const commitEdit = async (convenio: ConvenioLaboral) => {
    if (!editingId || !editingField) return;
    const field = editingField;
    const val = draftValue.trim();
    setEditingId(null);
    setEditingField(null);

    if (field === 'nombre') {
      if (val && val !== convenio.nombre) {
        await onUpdateField(convenio.id, 'nombre', val);
      }
    } else if (field === 'cargasSocialesPct') {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0 && num !== convenio.cargasSocialesPct) {
        await onUpdateField(convenio.id, 'cargasSocialesPct', num);
      }
    } else if (field === 'gastosDirectosOperarioDefecto') {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0 && num !== convenio.gastosDirectosOperarioDefecto) {
        await onUpdateField(convenio.id, 'gastosDirectosOperarioDefecto', num);
      }
    }
  };

  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = quickName.trim();
    if (!trimmed) return;
    setIsCreatingQuick(true);
    try {
      const pct = parseFloat(quickPct) || 65;
      await onQuickCreate(trimmed, pct);
      setQuickName('');
      setQuickPct('65');
    } finally {
      setIsCreatingQuick(false);
    }
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-high/60 border-b border-outline-variant/20 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              <th className="px-3 py-2.5 w-10 text-center">#</th>
              <th className="px-3 py-2.5 min-w-[200px]">Convenio / Régimen Laboral</th>
              <th className="px-3 py-2.5 w-32 text-center">Cargas Sociales (FCS %)</th>
              <th className="px-3 py-2.5 w-36 text-right">EPP y Ropa ($/día)</th>
              <th className="px-3 py-2.5 w-28 text-center">Jornada Base</th>
              <th className="px-3 py-2.5 min-w-[220px]">Modificadores de Fórmula (DSL)</th>
              <th className="px-3 py-2.5 w-24 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {conveniosList.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-on-surface-variant space-y-2">
                  <FileText className="w-8 h-8 text-primary mx-auto opacity-40" />
                  <p className="text-sm font-semibold text-on-surface">No hay convenios laborales registrados</p>
                  <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                    Crea convenios laborales como UOCRA, UOM o regímenes independientes para calcular el costo real de mano de obra.
                  </p>
                </td>
              </tr>
            ) : (
              conveniosList.map((c, idx) => {
                const isEditingNombre = editingId === c.id && editingField === 'nombre';
                const isEditingPct = editingId === c.id && editingField === 'cargasSocialesPct';
                const isEditingGasto = editingId === c.id && editingField === 'gastosDirectosOperarioDefecto';
                const hsDefecto = c.horasJornadaDefecto || 9;
                const adicionalesEntries = Object.entries(c.adicionales || {});

                return (
                  <tr
                    key={c.id}
                    className="border-b border-outline-variant/10 hover:bg-surface-container-high/40 transition-colors group"
                  >
                    {/* # Index */}
                    <td className="px-3 py-2.5 text-xs text-on-surface-variant font-mono text-center">
                      {idx + 1}
                    </td>

                    {/* Nombre y Descripción */}
                    <td className="px-3 py-2.5 text-sm font-semibold text-on-surface">
                      {isEditingNombre ? (
                        <input
                          type="text"
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onBlur={() => commitEdit(c)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit(c);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="w-full px-2 py-1 text-xs font-semibold bg-surface border border-primary rounded-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => startEdit(c, 'nombre')}
                            className="text-left font-semibold text-on-surface hover:text-primary transition-colors cursor-pointer rounded px-1 -mx-1 hover:bg-surface-variant/40 flex items-center justify-between group/name"
                            title="Clic para editar nombre"
                          >
                            <span className="truncate">{c.nombre}</span>
                            <Edit2 className="w-3 h-3 opacity-0 group-hover/name:opacity-50 text-on-surface-variant shrink-0 ml-1.5" />
                          </button>
                          {c.descripcion && (
                            <span className="text-[11px] text-on-surface-variant font-normal line-clamp-1 mt-0.5">
                              {c.descripcion}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Cargas Sociales (FCS %) */}
                    <td className="px-3 py-2.5 text-center">
                      {isEditingPct ? (
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="150"
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onBlur={() => commitEdit(c)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit(c);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="w-20 px-2 py-1 text-xs font-mono font-bold text-center bg-surface border border-primary rounded-md text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(c, 'cargasSocialesPct')}
                          aria-label={`Editar cargas sociales de ${c.nombre}`}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition cursor-pointer"
                          title="Porcentaje total de cargas sociales (leyes + inasistencias). Clic para editar."
                        >
                          <ShieldCheck className="w-3 h-3 opacity-70" />
                          <span>{c.cargasSocialesPct}%</span>
                        </button>
                      )}
                    </td>

                    {/* EPP & Ropa ($/día) */}
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {isEditingGasto ? (
                        <input
                          type="number"
                          step="500"
                          min="0"
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onBlur={() => commitEdit(c)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit(c);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="w-24 px-2 py-1 text-xs font-mono font-bold text-right bg-surface border border-primary rounded-md text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(c, 'gastosDirectosOperarioDefecto')}
                          className="font-bold text-on-surface hover:text-primary transition-colors cursor-pointer rounded px-1.5 py-0.5 hover:bg-surface-variant/40"
                          title="Gastos directos por operario por día (EPP, ropa, refrigerio). Clic para editar."
                        >
                          {formatARS(c.gastosDirectosOperarioDefecto ?? 5000)}
                          <span className="text-2xs font-normal text-on-surface-variant ml-1 font-sans">/día</span>
                        </button>
                      )}
                    </td>

                    {/* Jornada Base (hs/día) */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const nextHs = hsDefecto === 9 ? 8 : 9;
                          onUpdateField(c.id, 'horasJornadaDefecto', nextHs);
                        }}
                        aria-label={`Jornada de ${hsDefecto} horas para ${c.nombre}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-surface-container hover:bg-surface-variant border border-outline-variant/20 text-on-surface-variant transition cursor-pointer"
                        title={`Jornada típica: ${hsDefecto} hs. Clic para alternar 9hs (UOCRA) / 8hs (Estándar).`}
                      >
                        <Calendar className="w-3 h-3 opacity-60" />
                        <span>{hsDefecto} hs</span>
                      </button>
                    </td>

                    {/* Modificadores de Fórmula */}
                    <td className="px-3 py-2.5">
                      {adicionalesEntries.length === 0 ? (
                        <span className="text-xs text-on-surface-variant/60 italic">Sin adicionales</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {adicionalesEntries.map(([k, v]) => (
                            <span
                              key={k}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-surface-container-high border border-outline-variant/30 text-on-surface"
                              title={`Variable de fórmula: ${c.id}.${k} = ${v}`}
                            >
                              <Zap className="w-2.5 h-2.5 text-amber-500" />
                              <span className="font-semibold">{k.replace('adicional', '')}:</span>
                              <span className="text-primary font-bold">+{Math.round(v * 100)}%</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onDuplicate(c.id)}
                          className="p-1.5 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
                          title="Clonar convenio"
                          aria-label={`Duplicar ${c.nombre}`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEdit(c)}
                          className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
                          title="Editar convenio y modificadores"
                          aria-label={`Editar ${c.nombre}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(c.id)}
                          className="p-1.5 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors cursor-pointer"
                          title="Eliminar convenio"
                          aria-label={`Eliminar ${c.nombre}`}
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
                    placeholder="Nuevo régimen o convenio laboral (ej: Petroleros CCT 644/12, SMATA...)"
                    className="flex-1 min-w-[200px] px-2.5 py-1 text-xs bg-surface border border-outline-variant/30 rounded-lg text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex items-center gap-1 bg-surface border border-outline-variant/30 rounded-lg px-2 py-1">
                    <span className="text-[11px] text-on-surface-variant font-medium">FCS:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="150"
                      value={quickPct}
                      onChange={(e) => setQuickPct(e.target.value)}
                      placeholder="65"
                      aria-label="Cargas sociales porcentaje rápido"
                      className="w-12 text-xs font-mono font-bold text-center bg-transparent focus:outline-none text-primary"
                    />
                    <span className="text-xs font-bold text-primary">%</span>
                  </div>
                  <button
                    type="submit"
                    disabled={!quickName.trim() || isCreatingQuick}
                    className="px-3 py-1 bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs rounded-lg transition disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    Agregar Convenio
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

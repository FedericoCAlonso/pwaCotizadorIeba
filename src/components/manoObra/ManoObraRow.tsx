import React, { useState, useEffect, useRef } from 'react';
import {
  Edit2,
  Trash2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Copy,
  HardHat,
  ShieldCheck,
  TrendingUp,
  Percent
} from 'lucide-react';
import { CategoriaManoDeObra, RolCategoriaManoDeObra, ConvenioLaboral } from '../../core/types';
import { formatARS, safeNum, calcularDesgloseCostoManoObraReal } from '../../core/calculations';

interface ManoObraRowProps {
  mo: CategoriaManoDeObra;
  index: number;
  conveniosList: ConvenioLaboral[];
  onUpdateField: (moId: string, field: string, value: string | number) => Promise<void>;
  onOpenEdit: (mo: CategoriaManoDeObra) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const ROLES: { id: RolCategoriaManoDeObra; label: string; badgeCls: string }[] = [
  { id: 'oficial', label: 'Oficial', badgeCls: 'bg-primary/10 text-primary border-primary/20' },
  { id: 'ayudante', label: 'Ayudante', badgeCls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  { id: 'especialista', label: 'Especialista', badgeCls: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20' },
  { id: 'independiente', label: 'Unipersonal', badgeCls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' }
];

export const ManoObraRow: React.FC<ManoObraRowProps> = ({
  mo,
  index,
  conveniosList,
  onUpdateField,
  onOpenEdit,
  onDelete,
  onDuplicate
}) => {
  const hs = mo.horasJornada && mo.horasJornada > 0 ? mo.horasJornada : 9;
  const cId = mo.convenioId || 'uocra';
  const convenio = conveniosList.find((c) => c.id === cId) || conveniosList[0];
  const fcs = mo.porcentajeCargasSociales ?? convenio.cargasSocialesPct;
  const gastosDirectos = mo.gastosDirectosJornada ?? (convenio.gastosDirectosOperarioDefecto || 0);

  // Desglose de costos
  const basicoJornada = mo.costoBasicoJornada && mo.costoBasicoJornada > 0
    ? mo.costoBasicoJornada
    : Math.round(((mo.costoJornada || mo.costoHora * hs) - gastosDirectos) / (1 + fcs / 100));

  const desglose = calcularDesgloseCostoManoObraReal(basicoJornada, fcs, gastosDirectos, hs);

  // Estados locales para acordeón y edición inline
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingField, setEditingField] = useState<'nombre' | 'costoHora' | 'costoJornada' | 'costoBasico' | null>(null);
  const [draftValue, setDraftValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const startEdit = (field: 'nombre' | 'costoHora' | 'costoJornada' | 'costoBasico', initialVal: string | number) => {
    setDraftValue(String(initialVal));
    setEditingField(field);
  };

  const commitEdit = async () => {
    if (!editingField) return;
    const currentField = editingField;
    const val = draftValue.trim();
    setEditingField(null);

    if (currentField === 'nombre') {
      if (val && val !== mo.nombre) {
        await onUpdateField(mo.id, 'nombre', val);
      }
    } else if (currentField === 'costoBasico') {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0 && num !== basicoJornada) {
        await onUpdateField(mo.id, 'costoBasicoJornada', num);
      }
    } else if (currentField === 'costoHora') {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0 && num !== mo.costoHora) {
        await onUpdateField(mo.id, 'costoHora', num);
      }
    } else if (currentField === 'costoJornada') {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0 && num !== mo.costoJornada) {
        await onUpdateField(mo.id, 'costoJornada', num);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingField(null);
    }
  };

  const currentRole = ROLES.find((r) => r.id === mo.rol) || ROLES[0];

  return (
    <>
      {/* ─── FILA PRINCIPAL DE TABLA ────────────────────────────────────────── */}
      <tr className={`border-b border-outline-variant/10 hover:bg-surface-container-high/40 transition-colors group ${isExpanded ? 'bg-surface-container-low/60' : ''}`}>
        {/* Chevron para acordeón */}
        <td className="px-2 py-2 text-center w-8">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition cursor-pointer"
            title={isExpanded ? 'Colapsar desglose' : 'Desplegar desglose de cargas sociales y costo real'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-primary" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </td>

        {/* # Index */}
        <td className="px-2 py-2 text-xs text-on-surface-variant font-mono text-center w-8">
          {index + 1}
        </td>

        {/* Nombre de la Categoría */}
        <td className="px-3 py-2 text-sm font-semibold text-on-surface min-w-[190px]">
          {editingField === 'nombre' ? (
            <input
              ref={inputRef}
              type="text"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 text-xs font-semibold bg-surface border border-primary rounded-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Nombre de categoría"
            />
          ) : (
            <button
              type="button"
              onClick={() => startEdit('nombre', mo.nombre)}
              aria-label={`Editar nombre para ${mo.nombre}`}
              className="text-left w-full hover:text-primary transition-colors cursor-pointer rounded px-1 -mx-1 hover:bg-surface-variant/40 flex items-center justify-between group/name"
              title="Clic para editar nombre"
            >
              <span className="truncate">{mo.nombre}</span>
              <Edit2 className="w-3 h-3 opacity-0 group-hover/name:opacity-50 text-on-surface-variant shrink-0 ml-1" />
            </button>
          )}
        </td>

        {/* Convenio Laboral */}
        <td className="px-2 py-2 w-36">
          <select
            value={cId}
            onChange={(e) => onUpdateField(mo.id, 'convenioId', e.target.value)}
            aria-label={`Convenio para ${mo.nombre}`}
            className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-outline-variant/30 bg-surface-container hover:bg-surface-variant text-on-surface cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary w-full truncate"
          >
            {conveniosList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre.split(' ')[0]} ({c.cargasSocialesPct}%)
              </option>
            ))}
          </select>
        </td>

        {/* Rol Funcional */}
        <td className="px-2 py-2 w-32">
          <select
            value={mo.rol || 'oficial'}
            onChange={(e) => onUpdateField(mo.id, 'rol', e.target.value as RolCategoriaManoDeObra)}
            aria-label={`Rol para ${mo.nombre}`}
            className={`text-xs font-bold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary transition-all ${currentRole.badgeCls} bg-transparent w-full`}
          >
            {ROLES.map((r) => (
              <option key={r.id} value={r.id} className="bg-surface text-on-surface">
                {r.label}
              </option>
            ))}
          </select>
        </td>

        {/* Jornada (hs) */}
        <td className="px-2 py-2 w-20 text-center">
          <button
            type="button"
            onClick={() => {
              const nextHs = hs === 9 ? 8 : 9;
              onUpdateField(mo.id, 'horasJornada', nextHs);
            }}
            aria-label={`Jornada de ${hs} horas para ${mo.nombre}`}
            title={`Base: ${hs} hs/día. Clic para alternar 9hs (UOCRA) / 8hs (Estándar)`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-mono font-medium bg-surface-container hover:bg-surface-variant border border-outline-variant/20 text-on-surface-variant transition cursor-pointer"
          >
            <Calendar className="w-3 h-3 opacity-60" />
            <span>{hs} hs</span>
          </button>
        </td>

        {/* Costo / Hora Real Empresa */}
        <td className="px-3 py-2 w-32 text-right">
          {editingField === 'costoHora' ? (
            <input
              ref={inputRef}
              type="number"
              step="10"
              min="0"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              aria-label="Editar costo hora"
              className="w-24 px-1 py-0.5 text-xs font-mono font-bold text-right bg-surface border border-primary rounded-md text-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            />
          ) : (
            <button
              type="button"
              onClick={() => startEdit('costoHora', mo.costoHora)}
              aria-label={`Editar costo por hora para ${mo.nombre}`}
              className="w-full text-right font-mono text-sm font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer rounded px-1 py-0.5 hover:bg-surface-variant/40"
              title="Costo Real Empresa por hora (MOD). Clic para editar."
            >
              {formatARS(mo.costoHora)}
              <span className="text-2xs font-normal text-on-surface-variant font-sans ml-1">/h</span>
            </button>
          )}
        </td>

        {/* Costo / Jornal Real Empresa */}
        <td className="px-3 py-2 w-32 text-right">
          {editingField === 'costoJornada' ? (
            <input
              ref={inputRef}
              type="number"
              step="50"
              min="0"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              aria-label="Editar costo jornal"
              className="w-24 px-1 py-0.5 text-xs font-mono font-bold text-right bg-surface border border-primary rounded-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            />
          ) : (
            <button
              type="button"
              onClick={() => startEdit('costoJornada', mo.costoJornada || mo.costoHora * hs)}
              aria-label={`Editar costo por jornal para ${mo.nombre}`}
              className="w-full text-right font-mono text-xs font-semibold text-on-surface hover:text-primary transition-colors cursor-pointer rounded px-1 py-0.5 hover:bg-surface-variant/40"
              title="Costo Real Empresa por jornada completa. Clic para editar."
            >
              {formatARS(mo.costoJornada || mo.costoHora * hs)}
              <span className="text-2xs font-normal text-on-surface-variant font-sans ml-1">/día</span>
            </button>
          )}
        </td>

        {/* Acciones */}
        <td className="px-2 py-2 w-24 text-right">
          <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onDuplicate(mo.id)}
              className="p-1.5 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
              title="Clonar / Duplicar categoría"
              aria-label={`Duplicar ${mo.nombre}`}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onOpenEdit(mo)}
              className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
              title="Editar en detalle"
              aria-label={`Editar ${mo.nombre} en detalle`}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(mo.id)}
              className="p-1.5 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors cursor-pointer"
              title="Eliminar categoría"
              aria-label={`Eliminar ${mo.nombre}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* ─── ACORDEÓN DESPLEGABLE: DESGLOSE DE COSTO REAL ───────────────────── */}
      {isExpanded && (
        <tr className="bg-surface-container/30 border-b border-outline-variant/20">
          <td colSpan={9} className="px-6 py-3.5">
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-3.5 space-y-3 max-w-4xl">
              <div className="flex items-center justify-between border-b border-outline-variant/15 pb-2">
                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <HardHat className="w-3.5 h-3.5 text-primary" />
                  <span>Composición del Costo Real Empresa (MOD) — {mo.nombre}</span>
                </span>
                <span className="text-2xs font-mono text-on-surface-variant">
                  Convenio: {convenio.nombre}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                {/* 1. Salario Básico de Convenio */}
                <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/15 space-y-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                    1. Básico Convenio:
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono font-bold text-on-surface text-sm">
                      {formatARS(desglose.costoBasicoJornada)}
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      {formatARS(desglose.costoBasicoHora)}/h
                    </span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant/80 block">
                    Salario directo de escala
                  </span>
                </div>

                {/* 2. Cargas Sociales (FCS %) */}
                <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/15 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                      2. Cargas Sociales ({fcs}%):
                    </span>
                    <span className="text-2xs px-1 rounded bg-secondary/15 text-secondary font-mono font-bold">
                      FCS
                    </span>
                  </div>
                  <div className="font-mono font-bold text-secondary text-sm">
                    +{formatARS(desglose.montoCargasSocialesJornada)}
                  </div>
                  <span className="text-[10px] text-on-surface-variant/80 block truncate" title="Leyes obligatorias + inasistencias pagas (lluvia, feriados, etc.)">
                    Leyes + Lluvia + ART
                  </span>
                </div>

                {/* 3. Complementos Directos */}
                <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/15 space-y-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                    3. Gastos Directos:
                  </span>
                  <div className="font-mono font-bold text-on-surface text-sm">
                    +{formatARS(desglose.gastosDirectosJornada)}
                  </div>
                  <span className="text-[10px] text-on-surface-variant/80 block truncate" title="Ropa de trabajo, EPP amortizado y viáticos diarios">
                    EPP + Ropa + Viático/día
                  </span>
                </div>

                {/* 4. Costo Real Empresa Resultante */}
                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                    = Costo Empresa Real:
                  </span>
                  <div className="font-mono font-black text-primary text-sm">
                    {formatARS(desglose.costoJornadaReal)}
                  </div>
                  <span className="text-[11px] font-mono font-bold text-primary block">
                    {formatARS(desglose.costoHoraReal)} / hora ({hs} hs)
                  </span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

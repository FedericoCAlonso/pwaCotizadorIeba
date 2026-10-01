import React, { useState } from 'react';
import {
  Edit2,
  Trash2,
  Copy,
  Calendar,
  Clock,
  Building2,
  HardHat,
  Package,
  Truck,
  Globe,
  DollarSign,
  Percent,
  FileText,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import {
  CategoriaManoDeObra,
  RolCategoriaManoDeObra,
  CostoIndirecto,
  DestinoGasto,
  ModalidadGasto,
  ConvenioLaboral
} from '../../core/types';
import { formatARS, calcularDesgloseCostoManoObraReal } from '../../core/calculations';

interface ManoObraMobileListProps {
  activeTab: 'cuadrilla' | 'cargas' | 'convenios';
  manoObraList: CategoriaManoDeObra[];
  gastosList: CostoIndirecto[];
  conveniosList?: ConvenioLaboral[];
  onOpenEditMO: (mo: CategoriaManoDeObra) => void;
  onDeleteMO: (id: string) => void;
  onDuplicateMO: (id: string) => void;
  onUpdateMOField: (moId: string, field: string, value: string | number) => Promise<void>;
  onOpenEditGasto: (g: CostoIndirecto) => void;
  onDeleteGasto: (id: string) => void;
  onDuplicateGasto: (id: string) => void;
  onToggleDefaultGasto: (g: CostoIndirecto) => void;
  onOpenEditConvenio?: (c: ConvenioLaboral) => void;
  onDeleteConvenio?: (id: string) => void;
  onDuplicateConvenio?: (id: string) => void;
}

const ROLES: Record<RolCategoriaManoDeObra, { label: string; badgeCls: string }> = {
  oficial: { label: 'Oficial', badgeCls: 'bg-primary/10 text-primary border-primary/20' },
  ayudante: { label: 'Ayudante', badgeCls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  especialista: { label: 'Especialista', badgeCls: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20' },
  independiente: { label: 'Unipersonal', badgeCls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' }
};

export const ManoObraMobileList: React.FC<ManoObraMobileListProps> = ({
  activeTab,
  manoObraList,
  gastosList,
  conveniosList = [],
  onOpenEditMO,
  onDeleteMO,
  onDuplicateMO,
  onUpdateMOField,
  onOpenEditGasto,
  onDeleteGasto,
  onDuplicateGasto,
  onToggleDefaultGasto,
  onOpenEditConvenio,
  onDeleteConvenio,
  onDuplicateConvenio
}) => {
  const [expandedMOId, setExpandedMOId] = useState<string | null>(null);

  if (activeTab === 'cuadrilla') {
    if (manoObraList.length === 0) {
      return (
        <div className="p-8 rounded-2xl bg-surface-container/40 border border-dashed border-outline-variant/30 text-center space-y-2">
          <Clock className="w-8 h-8 text-primary mx-auto opacity-40" />
          <p className="text-sm font-semibold text-on-surface">No hay categorías de mano de obra</p>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            Toca en "+ Nueva Categoría" arriba para definir tu cuadrilla.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {manoObraList.map((mo) => {
          const hs = mo.horasJornada && mo.horasJornada > 0 ? mo.horasJornada : 9;
          const cj = mo.costoJornada && mo.costoJornada > 0 ? mo.costoJornada : mo.costoHora * hs;
          const roleInfo = ROLES[mo.rol || 'oficial'] || ROLES.oficial;
          const isExpanded = expandedMOId === mo.id;

          const cId = mo.convenioId || 'uocra';
          const convenio = conveniosList.find((c) => c.id === cId) || conveniosList[0] || { cargasSocialesPct: 65, gastosDirectosOperarioDefecto: 5000 };
          const fcs = mo.porcentajeCargasSociales ?? convenio.cargasSocialesPct;
          const gastosDirectos = mo.gastosDirectosJornada ?? (convenio.gastosDirectosOperarioDefecto || 0);

          const basicoJornada = mo.costoBasicoJornada && mo.costoBasicoJornada > 0
            ? mo.costoBasicoJornada
            : Math.round(((mo.costoJornada || mo.costoHora * hs) - gastosDirectos) / (1 + fcs / 100));

          const desglose = calcularDesgloseCostoManoObraReal(basicoJornada, fcs, gastosDirectos, hs);

          return (
            <div
              key={mo.id}
              className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-4 space-y-3 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h3 className="font-bold text-on-surface text-base">{mo.nombre}</h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full border ${roleInfo.badgeCls}`}>
                      {roleInfo.label}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                      {(mo.convenioId || 'uocra').toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDuplicateMO(mo.id)}
                    className="p-1.5 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-variant transition-colors"
                    title="Clonar categoría"
                    aria-label={`Clonar ${mo.nombre}`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenEditMO(mo)}
                    className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors"
                    aria-label={`Editar ${mo.nombre}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMO(mo.id)}
                    className="p-1.5 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors"
                    aria-label={`Eliminar ${mo.nombre}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="pt-2.5 border-t border-outline-variant/20 grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-on-surface-variant block">
                    Costo / hora Real (MOD):
                  </span>
                  <span className="font-mono text-lg font-black text-primary block">
                    {formatARS(mo.costoHora)}
                    <span className="text-2xs font-normal text-on-surface-variant font-sans ml-1">/h</span>
                  </span>
                </div>

                <div className="space-y-0.5 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      const nextHs = hs === 9 ? 8 : 9;
                      onUpdateMOField(mo.id, 'horasJornada', nextHs);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-on-surface-variant hover:text-primary transition cursor-pointer"
                    title="Toca para cambiar jornada 9hs/8hs"
                  >
                    <Calendar className="w-3 h-3 text-on-surface-variant/70" />
                    <span>Jornal ({hs} hs):</span>
                  </button>
                  <span className="font-mono text-sm font-bold text-on-surface block">
                    {formatARS(cj)}
                    <span className="text-2xs font-normal text-on-surface-variant font-sans ml-1">/día</span>
                  </span>
                </div>
              </div>

              {/* Botón Acordeón Desglose Económico (Coherencia con Desktop) */}
              <button
                type="button"
                onClick={() => setExpandedMOId(isExpanded ? null : mo.id)}
                className="w-full pt-2 flex items-center justify-between text-xs font-semibold text-primary/90 hover:text-primary border-t border-outline-variant/15 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span>{isExpanded ? 'Ocultar desglose económico' : 'Ver desglose económico (FCS, EPP, Básico)'}</span>
                </span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {/* Panel Desplegable Desglose */}
              {isExpanded && (
                <div className="mt-2 p-3 rounded-xl bg-surface-container/60 border border-outline-variant/30 space-y-2 text-xs animate-in fade-in duration-150">
                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span>Salario Básico Convenio:</span>
                    <span className="font-mono font-bold text-on-surface">
                      {formatARS(basicoJornada)}/día ({formatARS(desglose.costoBasicoHora)}/h)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span>Cargas Sociales ({fcs}%):</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      +{formatARS(desglose.montoCargasSocialesJornada)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span>Gastos Directos EPP/Ropa:</span>
                    <span className="font-mono font-bold text-on-surface">
                      +{formatARS(gastosDirectos)}/día
                    </span>
                  </div>
                  <div className="pt-2 border-t border-outline-variant/30 flex justify-between items-center font-bold text-on-surface">
                    <span>Costo Real Empresa Total:</span>
                    <span className="font-mono text-primary text-sm">
                      {formatARS(cj)}/día ({formatARS(mo.costoHora)}/h)
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Pestaña de Gastos en Mobile
  if (activeTab === 'cargas') {
    if (gastosList.length === 0) {
      return (
        <div className="p-8 rounded-2xl bg-surface-container/40 border border-dashed border-outline-variant/30 text-center space-y-2">
          <Building2 className="w-8 h-8 text-primary mx-auto opacity-40" />
          <p className="text-sm font-semibold text-on-surface">No hay gastos configurados en el catálogo</p>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            Toca en "+ Nuevo Gasto" arriba para definir costos de obra y estructura.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {gastosList.map((g) => {
          const isPorDefecto = g.incluirPorDefecto ?? true;
          const modalidad = g.modalidad || (g.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo');

          return (
            <div
              key={g.id}
              className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-4 space-y-3 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h3 className="font-bold text-on-surface text-base">{g.nombre}</h3>
                  <span className="text-[11px] font-bold text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full border border-outline-variant/20">
                    {g.destino === 'mano_obra' ? 'Mano de Obra' : g.destino === 'materiales' ? 'Materiales' : 'Indirecto Obra'}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDuplicateGasto(g.id)}
                    className="p-1.5 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-variant transition-colors"
                    title="Clonar gasto"
                    aria-label={`Clonar ${g.nombre}`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenEditGasto(g)}
                    className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors"
                    aria-label={`Editar ${g.nombre}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteGasto(g.id)}
                    className="p-1.5 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors"
                    aria-label={`Eliminar ${g.nombre}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="pt-2.5 border-t border-outline-variant/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Valor / Regla:</span>
                  <span className="font-mono text-base font-bold text-primary">
                    {modalidad === 'porcentual' ? `${g.valor}%` : formatARS(g.valor)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleDefaultGasto(g)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
                    isPorDefecto
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-surface-container text-on-surface-variant border-outline-variant/30 opacity-70'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isPorDefecto ? 'bg-emerald-500' : 'bg-outline-variant'}`} />
                  <span>{isPorDefecto ? 'Por Defecto: Sí' : 'Por Defecto: No'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (activeTab === 'convenios') {
    if (conveniosList.length === 0) {
      return (
        <div className="p-8 rounded-2xl bg-surface-container/40 border border-dashed border-outline-variant/30 text-center space-y-2">
          <FileText className="w-8 h-8 text-primary mx-auto opacity-40" />
          <p className="text-sm font-semibold text-on-surface">No hay convenios laborales</p>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            Toca en "+ Nuevo Convenio" arriba para registrar un régimen laboral.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {conveniosList.map((c) => {
          const hs = c.horasJornadaDefecto || 9;
          const adicEntries = Object.entries(c.adicionales || {});

          return (
            <div
              key={c.id}
              className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-on-surface">{c.nombre}</h4>
                  {c.descripcion && (
                    <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{c.descripcion}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {onDuplicateConvenio && (
                    <button
                      type="button"
                      onClick={() => onDuplicateConvenio(c.id)}
                      className="p-1.5 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-variant transition-colors"
                      aria-label={`Duplicar ${c.nombre}`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onOpenEditConvenio && (
                    <button
                      type="button"
                      onClick={() => onOpenEditConvenio(c)}
                      className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors"
                      aria-label={`Editar ${c.nombre}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onDeleteConvenio && (
                    <button
                      type="button"
                      onClick={() => onDeleteConvenio(c.id)}
                      className="p-1.5 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors"
                      aria-label={`Eliminar ${c.nombre}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/20 text-center">
                <div className="bg-surface-container/60 p-2 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Cargas Soc.</span>
                  <span className="font-mono text-sm font-bold text-primary">{c.cargasSocialesPct}%</span>
                </div>
                <div className="bg-surface-container/60 p-2 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">EPP / Día</span>
                  <span className="font-mono text-sm font-bold text-on-surface">
                    {formatARS(c.gastosDirectosOperarioDefecto ?? 5000)}
                  </span>
                </div>
                <div className="bg-surface-container/60 p-2 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Jornada</span>
                  <span className="font-mono text-sm font-bold text-on-surface">{hs} hs</span>
                </div>
              </div>

              {adicEntries.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {adicEntries.map(([k, v]) => (
                    <span
                      key={k}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface border border-outline-variant/30"
                    >
                      {k.replace('adicional', '')}: <strong className="text-primary">+{Math.round(v * 100)}%</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return null;
};

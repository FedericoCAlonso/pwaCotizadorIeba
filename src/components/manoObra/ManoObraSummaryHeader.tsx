import React from 'react';
import { Clock, Plus, HardHat, Search, X, Building2, FileText } from 'lucide-react';
import { ParitariaAdjustmentPopover } from './ParitariaAdjustmentPopover';
import { ConvenioLaboral } from '../../core/types';

interface ManoObraSummaryHeaderProps {
  activeTab: 'cuadrilla' | 'cargas' | 'convenios';
  onTabChange: (tab: 'cuadrilla' | 'cargas' | 'convenios') => void;
  totalCategorias: number;
  totalGastos: number;
  totalConvenios: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterRol: string;
  onFilterRolChange: (r: string) => void;
  filterConvenio: string;
  onFilterConvenioChange: (c: string) => void;
  filterDestino: string;
  onFilterDestinoChange: (d: string) => void;
  conveniosList: ConvenioLaboral[];
  onOpenCreateMO: () => void;
  onOpenCreateGasto: () => void;
  onOpenCreateConvenio: () => void;
  onApplyParitaria: (percentage: number) => Promise<void>;
}

export const ManoObraSummaryHeader: React.FC<ManoObraSummaryHeaderProps> = ({
  activeTab,
  onTabChange,
  totalCategorias,
  totalGastos,
  totalConvenios,
  searchQuery,
  onSearchChange,
  filterRol,
  onFilterRolChange,
  filterConvenio,
  onFilterConvenioChange,
  filterDestino,
  onFilterDestinoChange,
  conveniosList,
  onOpenCreateMO,
  onOpenCreateGasto,
  onOpenCreateConvenio,
  onApplyParitaria
}) => {
  return (
    <div className="space-y-3">
      {/* 1. Titular Principal & Pestañas Segmentadas */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <span>Tarifas de Mano de Obra, Convenios & Gastos de Obra</span>
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Costo real empresa (básico + cargas sociales UOCRA/UOM) y gastos de logística/estructura.
          </p>
        </div>

        {/* Selector de Pestañas Segmentadas */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-container-high/60 border border-outline-variant/20 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => onTabChange('cuadrilla')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'cuadrilla'
                ? 'bg-primary text-on-primary shadow-2xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <HardHat className="w-3.5 h-3.5" />
            <span>Cuadrilla & Convenios MO</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'cuadrilla' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}>
              {totalCategorias}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('cargas')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'cargas'
                ? 'bg-primary text-on-primary shadow-2xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Gastos de Obra</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'cargas' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}>
              {totalGastos}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('convenios')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'convenios'
                ? 'bg-primary text-on-primary shadow-2xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Convenios & Cargas</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'convenios' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}>
              {totalConvenios}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Herramientas Compacta (Buscador, Filtros y Acciones Principales) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
        {/* Buscador & Selectores de Filtro */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-on-surface-variant absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={
                activeTab === 'cuadrilla'
                  ? 'Buscar categoría o rol...'
                  : activeTab === 'cargas'
                  ? 'Buscar gasto o concepto...'
                  : 'Buscar convenio laboral...'
              }
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl pl-8 pr-7 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="p-1 text-on-surface-variant hover:text-on-surface absolute right-1.5 top-1/2 -translate-y-1/2"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filtros específicos según pestaña */}
          {activeTab === 'cuadrilla' ? (
            <>
              <select
                value={filterRol}
                onChange={(e) => onFilterRolChange(e.target.value)}
                aria-label="Filtrar por rol"
                className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="todos">Todos los roles</option>
                <option value="oficial">Oficial</option>
                <option value="ayudante">Ayudante</option>
                <option value="especialista">Especialista</option>
                <option value="independiente">Unipersonal</option>
              </select>

              <select
                value={filterConvenio}
                onChange={(e) => onFilterConvenioChange(e.target.value)}
                aria-label="Filtrar por convenio"
                className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="todos">Todos los convenios</option>
                {conveniosList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <select
              value={filterDestino}
              onChange={(e) => onFilterDestinoChange(e.target.value)}
              aria-label="Filtrar por destino del gasto"
              className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="todos">Todos los destinos</option>
              <option value="costo_indirecto">Costo Indirecto / Obra</option>
              <option value="mano_obra">Mano de Obra</option>
              <option value="materiales">Materiales</option>
              <option value="servicios">Servicios</option>
            </select>
          )}
        </div>

        {/* Acciones principales de la pestaña */}
        <div className="flex items-center gap-2 shrink-0 justify-end">
          {activeTab === 'cuadrilla' && (
            <>
              <ParitariaAdjustmentPopover
                promedioHora={0}
                totalCategorias={totalCategorias}
                onApply={onApplyParitaria}
              />
              <button
                type="button"
                onClick={onOpenCreateMO}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Categoría</span>
              </button>
            </>
          )}

          {activeTab === 'cargas' && (
            <button
              type="button"
              onClick={onOpenCreateGasto}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Gasto</span>
            </button>
          )}

          {activeTab === 'convenios' && (
            <button
              type="button"
              onClick={onOpenCreateConvenio}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Convenio</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Search, Copy, Edit2, Trash2, Sliders } from 'lucide-react';
import { TareaTipo, Insumo, CategoriaManoDeObra, AppConfig } from '../../core/types';
import { calcularCostoTareaTipo, formatARS, auditarRentabilidadTareaTipo } from '../../core/calculations';

interface CatalogoSubmoduloProps {
  tareas: TareaTipo[];
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  config?: AppConfig;
  categoriasList: string[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  onDuplicate: (tarea: TareaTipo) => void;
  onEdit: (tarea: TareaTipo) => void;
  onDelete: (id: string) => void;
  onSimulate: (id: string) => void;
}

export const CatalogoSubmodulo: React.FC<CatalogoSubmoduloProps> = ({
  tareas,
  insumosMap,
  manoObraMap,
  config,
  categoriasList,
  searchTerm,
  onSearchChange,
  selectedCategoryFilter,
  onCategoryFilterChange,
  onDuplicate,
  onEdit,
  onDelete,
  onSimulate,
}) => {
  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] transition-shadow";

  const filteredTareas = tareas.filter((t) => {
    const matchesSearch =
      t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.notasTecnicas && t.notasTecnicas.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategoryFilter === 'todas' || t.categoria === selectedCategoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-5">
      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar tarea o nota técnica..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>

        <select
          value={selectedCategoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className={`${inputCls} sm:w-auto capitalize`}
        >
          <option value="todas">Todas las categorías</option>
          {categoriasList.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Empty State */}
      {filteredTareas.length === 0 && (
        <div className="text-center py-12 bg-surface-container-low border border-dashed border-outline-variant/30 rounded-3xl p-6">
          <p className="text-sm text-on-surface-variant">No se encontraron tareas con los filtros seleccionados.</p>
        </div>
      )}

      {/* Grid of Task Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTareas.map((tarea) => {
          const costData = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);
          const audit = auditarRentabilidadTareaTipo(tarea, insumosMap, manoObraMap, config);

          return (
            <div
              key={tarea.id}
              className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all flex flex-col justify-between space-y-4 shadow-sm"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-on-tertiary-container bg-tertiary-container px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {tarea.categoria}
                    </span>
                    <h3 className="font-bold text-on-surface text-base mt-1">{tarea.nombre}</h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        audit.estado === 'verde'
                          ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                          : audit.estado === 'amarillo'
                          ? 'bg-amber-500 shadow-sm shadow-amber-500/50'
                          : 'bg-rose-500 shadow-sm shadow-rose-500/50'
                      }`}
                      title={`Estado auditoría: ${audit.estado}`}
                    />
                    <button
                      onClick={() => onDuplicate(tarea)}
                      className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                      title="Duplicar tarea"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEdit(tarea)}
                      className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                      title="Editar tarea"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(tarea.id)}
                      className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-xl transition-colors"
                      title="Eliminar tarea"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {tarea.notasTecnicas && (
                  <p className="text-xs text-on-surface-variant mt-2 line-clamp-2 italic">
                    {tarea.notasTecnicas}
                  </p>
                )}

                {/* Despiece Insumos */}
                <div className="mt-3 pt-3 border-t border-outline-variant/20 space-y-1 text-xs">
                  <div className="text-[11px] font-semibold text-on-surface-variant uppercase">
                    Insumos ({tarea.insumos.length}):
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {tarea.insumos.map((item, idx) => {
                      const mat = insumosMap.get(item.materialId || item.insumoId || '');
                      return (
                        <div key={idx} className="flex justify-between items-center text-[11px] text-on-surface">
                          <span className="truncate max-w-[170px]">{mat?.nombre || 'Material'}</span>
                          <span className="font-mono text-on-surface-variant shrink-0">
                            {item.cantidad} {mat?.unidadVenta || mat?.unidad || 'u'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mano de Obra */}
                <div className="mt-3 pt-2 border-t border-outline-variant/20 flex justify-between text-xs">
                  <span className="text-on-surface-variant">Mano de Obra:</span>
                  <span className="font-mono font-semibold text-on-surface">
                    {tarea.manoObra.reduce((acc, m) => acc + m.horas, 0)} hs
                  </span>
                </div>
              </div>

              {/* Costos Footer */}
              <div className="pt-3 border-t border-outline-variant/30 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase block">Costo Directo Base</span>
                  <span className="font-mono text-base font-extrabold text-primary">
                    {formatARS(costData.costoDirectoUnitario)}
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-normal"> /{tarea.unidad}</span>
                </div>

                <button
                  onClick={() => onSimulate(tarea.id)}
                  className="px-3 py-1.5 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Simular</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

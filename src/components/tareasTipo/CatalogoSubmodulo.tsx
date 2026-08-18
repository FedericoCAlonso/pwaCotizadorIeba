import React from 'react';
import { Search, Copy, Edit2, Trash2, Sliders, Package } from 'lucide-react';
import { TareaTipo, Insumo, CategoriaManoDeObra, AppConfig, MaterialFilterContext } from '../../core/types';
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
  onViewMaterialsInCatalog?: (ctx: MaterialFilterContext) => void;
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
  onViewMaterialsInCatalog,
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-low p-4 rounded-2xl">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
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
        <div className="text-center py-12 bg-surface-container-low rounded-2xl p-6">
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
              className="bg-surface-container-low hover:bg-surface-container-high rounded-2xl p-5 transition-colors flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    {/* Chip M3: 8dp (rounded-lg) */}
                    <span className="text-[11px] font-semibold text-on-tertiary-container bg-tertiary-container px-2.5 py-0.5 rounded-lg uppercase tracking-wider select-none">
                      {tarea.categoria}
                    </span>
                    <h3 className="font-bold text-on-surface text-base mt-1.5 leading-snug">{tarea.nombre}</h3>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0 -mt-1 -mr-1">
                    <span
                      className={`w-2.5 h-2.5 rounded-full mr-1.5 ${
                        audit.estado === 'verde'
                          ? 'bg-emerald-500'
                          : audit.estado === 'amarillo'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      title={`Estado auditoría: ${audit.estado}`}
                    />
                    <button
                      type="button"
                      onClick={() => onDuplicate(tarea)}
                      className="min-w-[40px] min-h-[40px] p-2 text-on-surface-variant hover:text-primary rounded-full state-layer transition-colors flex items-center justify-center cursor-pointer"
                      title="Duplicar tarea"
                      aria-label="Duplicar tarea"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {/* Acceso contextual al catálogo de materiales para este trabajo tipo */}
                    {onViewMaterialsInCatalog && tarea.insumos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const ids = tarea.insumos.map(i => i.materialId || i.insumoId).filter(Boolean) as string[];
                          const quantities: Record<string, { cantidad: number; unidad: string }> = {};
                          const names: string[] = [];
                          tarea.insumos.forEach(i => {
                            const id = i.materialId || i.insumoId;
                            const mat = insumosMap.get(id || '');
                            if (id) {
                              quantities[id] = { cantidad: i.cantidad, unidad: mat?.unidadVenta || mat?.unidad || 'u' };
                            }
                            if (mat?.nombre) {
                              names.push(mat.nombre.trim());
                            }
                          });
                          onViewMaterialsInCatalog({
                            title: `Trabajo Tipo: ${tarea.nombre}`,
                            materialIds: ids,
                            materialNames: names,
                            quantities,
                            returnTab: 'tareasTipo'
                          });
                        }}
                        className="min-w-[40px] min-h-[40px] p-2 text-on-surface-variant hover:text-primary rounded-full state-layer transition-colors flex items-center justify-center cursor-pointer"
                        title="Ver y actualizar materiales en el Catálogo"
                        aria-label="Ver materiales en el catálogo"
                      >
                        <Package className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEdit(tarea)}
                      className="min-w-[40px] min-h-[40px] p-2 text-on-surface-variant hover:text-primary rounded-full state-layer transition-colors flex items-center justify-center cursor-pointer"
                      title="Editar tarea"
                      aria-label="Editar tarea"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(tarea.id)}
                      className="min-w-[40px] min-h-[40px] p-2 text-on-surface-variant hover:text-error rounded-full state-layer transition-colors flex items-center justify-center cursor-pointer"
                      title="Eliminar tarea"
                      aria-label="Eliminar tarea"
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
                <div className="mt-3 pt-3 border-t border-outline-variant/15 space-y-1 text-xs">
                  <div className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                    Insumos ({tarea.insumos.length}):
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
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
                <div className="mt-3 pt-2 border-t border-outline-variant/15 flex justify-between text-xs">
                  <span className="text-on-surface-variant">Mano de Obra:</span>
                  <span className="font-mono font-semibold text-on-surface">
                    {tarea.manoObra.reduce((acc, m) => acc + m.horas, 0)} hs
                  </span>
                </div>
              </div>

              {/* Costos Footer */}
              <div className="pt-3 border-t border-outline-variant/15 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase block font-medium">Costo Directo Base</span>
                  <span className="font-mono text-base font-bold text-primary">
                    {formatARS(costData.costoDirectoUnitario)}
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-normal"> /{tarea.unidad}</span>
                </div>

                {/* Botón Simular: Shape Full Stadium */}
                <button
                  type="button"
                  onClick={() => onSimulate(tarea.id)}
                  className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full text-xs font-semibold flex items-center gap-1.5 state-layer transition-colors cursor-pointer"
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

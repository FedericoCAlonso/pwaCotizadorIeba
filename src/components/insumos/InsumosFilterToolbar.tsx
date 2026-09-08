import React, { useMemo } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Tag,
  TrendingUp,
  FileSpreadsheet,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { CategoriaMaterial, Material, MaterialFilterContext } from '../../core/types';

interface InsumosFilterToolbarProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  selectedVencimiento: 'todos' | 'verde' | 'amarillo' | 'rojo';
  setSelectedVencimiento: (val: 'todos' | 'verde' | 'amarillo' | 'rojo') => void;
  selectedFichaStatus: 'todas' | 'completas' | 'incompletas';
  setSelectedFichaStatus: (val: 'todas' | 'completas' | 'incompletas') => void;
  viewModeMat: 'grid' | 'table';
  setViewModeMat: (val: 'grid' | 'table') => void;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  categorias: CategoriaMaterial[];
  materiales: Material[];
  filteredMateriales: Material[];
  filterContext?: MaterialFilterContext | null;
  onClearFilterContext?: () => void;
  onOpenBlockPriceModal: () => void;
  onOpenMassUpdateModal: () => void;
  onOpenImportCatalogModal: () => void;
  onExportCatalog: () => void;
}

export const InsumosFilterToolbar: React.FC<InsumosFilterToolbarProps> = ({
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  selectedVencimiento,
  setSelectedVencimiento,
  selectedFichaStatus,
  setSelectedFichaStatus,
  viewModeMat,
  setViewModeMat,
  showFilters,
  setShowFilters,
  categorias,
  materiales,
  filteredMateriales,
  filterContext,
  onClearFilterContext,
  onOpenBlockPriceModal,
  onOpenMassUpdateModal,
  onOpenImportCatalogModal,
  onExportCatalog
}) => {
  // Precompute category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const sourceList = filterContext ? filteredMateriales : materiales;
    sourceList.forEach((m) => {
      if (m.categoriaId) {
        counts[m.categoriaId] = (counts[m.categoriaId] || 0) + 1;
      }
    });
    return counts;
  }, [materiales, filteredMateriales, filterContext]);

  // Active filters count for badge on "Filtros" button
  const advancedFiltersActive =
    (selectedVencimiento !== 'todos' ? 1 : 0) +
    (selectedFichaStatus !== 'todas' ? 1 : 0);

  const hasAnyFilterActive =
    selectedCategory !== 'todas' ||
    selectedVencimiento !== 'todos' ||
    selectedFichaStatus !== 'todas' ||
    searchTerm.trim() !== '' ||
    !!filterContext;

  const handleClearAll = () => {
    setSearchTerm('');
    setSelectedCategory('todas');
    setSelectedVencimiento('todos');
    setSelectedFichaStatus('todas');
    if (onClearFilterContext) {
      onClearFilterContext();
    }
  };

  return (
    <div className="bg-surface-container-low p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-outline-variant/20 space-y-3 shadow-xs">
      {/* Row 1: Search + Quick Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-2.5">
        {/* Search Bar with clear button */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre técnico, atributos (sección, norma, calibre)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm rounded-xl sm:rounded-2xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[40px] transition-shadow"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-variant transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto justify-between md:justify-end shrink-0">
          {/* Filter Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all min-h-[38px] cursor-pointer ${
              showFilters || advancedFiltersActive > 0
                ? 'bg-primary/10 border-primary/40 text-primary shadow-xs'
                : 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {advancedFiltersActive > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center">
                {advancedFiltersActive}
              </span>
            )}
          </button>

          {/* Grid / Table View Switcher */}
          <div className="flex items-center bg-surface-container-high rounded-xl p-0.5 border border-outline-variant/30 min-h-[38px]">
            <button
              type="button"
              onClick={() => setViewModeMat('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewModeMat === 'grid' ? 'bg-surface-container text-primary shadow-xs' : 'text-on-surface-variant'
              }`}
              title="Vista en Cuadrícula"
              aria-label="Vista en Cuadrícula"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewModeMat('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewModeMat === 'table' ? 'bg-surface-container text-primary shadow-xs' : 'text-on-surface-variant'
              }`}
              title="Vista en Tabla"
              aria-label="Vista en Tabla"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Desktop Secondary Action Buttons */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenBlockPriceModal}
              className="px-3 py-2 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[38px]"
              title="Fijar Precio Común en Bloque"
            >
              <Tag className="w-3.5 h-3.5 text-primary" />
              <span>Precio en Bloque</span>
            </button>

            <button
              type="button"
              onClick={onOpenMassUpdateModal}
              className="px-3 py-2 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[38px]"
              title="Aumento Masivo de Precios"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>Aumento %</span>
            </button>

            <button
              type="button"
              onClick={onOpenImportCatalogModal}
              className="px-3 py-2 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[38px]"
              title="Importar catálogo desde Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
              <span>Importar</span>
            </button>

            <button
              type="button"
              onClick={onExportCatalog}
              className="px-3 py-2 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[38px]"
              title="Exportar catálogo a Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exportar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile-Only Action Pills Row */}
      <div className="flex sm:hidden items-center gap-1.5 w-full pt-0.5">
        <button
          type="button"
          onClick={onOpenBlockPriceModal}
          className="flex-1 py-1.5 px-2 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/30 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors min-h-[34px]"
        >
          <Tag className="w-3 h-3 text-primary" />
          <span>Bloque</span>
        </button>
        <button
          type="button"
          onClick={onOpenMassUpdateModal}
          className="flex-1 py-1.5 px-2 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/30 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors min-h-[34px]"
        >
          <TrendingUp className="w-3 h-3 text-emerald-500" />
          <span>Aumento %</span>
        </button>
        <button
          type="button"
          onClick={onOpenImportCatalogModal}
          className="flex-1 py-1.5 px-2 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/30 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors min-h-[34px]"
        >
          <FileSpreadsheet className="w-3 h-3 text-primary" />
          <span>Importar</span>
        </button>
        <button
          type="button"
          onClick={onExportCatalog}
          className="flex-1 py-1.5 px-2 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/30 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors min-h-[34px]"
        >
          <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
          <span>Exportar</span>
        </button>
      </div>

      {/* Row 2: Category Quick Chips with Count Badges and Gradient Scroll Indicator */}
      <div className="relative w-full overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pt-1 pb-0.5 touch-pan-x overscroll-contain pr-6">
          <button
            type="button"
            onClick={() => setSelectedCategory('todas')}
            className={`px-3 py-1 sm:px-3.5 sm:py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 min-h-[32px] ${
              selectedCategory === 'todas'
                ? 'bg-primary text-on-primary font-bold'
                : 'bg-surface-container-high hover:bg-surface-variant text-on-surface-variant hover:text-on-surface border border-outline-variant/30'
            }`}
          >
            <span>Todas</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedCategory === 'todas'
                  ? 'bg-on-primary/20 text-on-primary'
                  : 'bg-surface-container-highest text-on-surface-variant'
              }`}
            >
              {materiales.length}
            </span>
          </button>

          {categorias.map((cat) => {
            const count = categoryCounts[cat.id] ?? 0;
            if (count === 0) return null;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 sm:px-3.5 sm:py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 min-h-[32px] ${
                  isSelected
                    ? 'bg-primary-container text-on-primary-container border border-primary/30 font-bold'
                    : 'bg-surface-container-high hover:bg-surface-variant text-on-surface-variant hover:text-on-surface border border-outline-variant/30'
                }`}
              >
                <span>{cat.nombre}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {/* Soft edge fade on mobile to indicate scrollability */}
        <div className="md:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-surface-container-low to-transparent" />
      </div>

      {/* Row 3: Active Filters & Results Counter Bar */}
      {hasAnyFilterActive && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/15 text-xs text-on-surface-variant flex-wrap animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="font-bold text-on-surface">
              {filteredMateriales.length} {filteredMateriales.length === 1 ? 'material' : 'materiales'}
            </span>
            <span className="text-outline-variant">•</span>
            {filterContext && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium text-[11px] border border-primary/20">
                Obra
                {onClearFilterContext && (
                  <button
                    type="button"
                    onClick={onClearFilterContext}
                    className="hover:text-primary-hover p-0.5 cursor-pointer"
                    title="Quitar filtro de obra"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            )}
            {selectedCategory !== 'todas' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-medium text-[11px]">
                {categorias.find((c) => c.id === selectedCategory)?.nombre || 'Categoría'}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('todas')}
                  className="hover:opacity-75 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedVencimiento !== 'todos' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-medium text-[11px]">
                {selectedVencimiento === 'verde'
                  ? '🟢 Vigente'
                  : selectedVencimiento === 'amarillo'
                  ? '🟡 Por Vencer'
                  : '🔴 Vencido'}
                <button
                  type="button"
                  onClick={() => setSelectedVencimiento('todos')}
                  className="hover:opacity-75 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedFichaStatus !== 'todas' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium text-[11px]">
                {selectedFichaStatus === 'completas' ? 'Fichas completas' : 'Fichas incompletas'}
                <button
                  type="button"
                  onClick={() => setSelectedFichaStatus('todas')}
                  className="hover:opacity-75 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchTerm.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-mono text-[11px] max-w-[150px] truncate">
                "{searchTerm.trim()}"
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="hover:opacity-75 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleClearAll}
            className="text-primary hover:text-primary-hover font-semibold text-xs shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-primary/10 transition-colors ml-auto cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Limpiar todo</span>
          </button>
        </div>
      )}

      {/* Collapsible Filter Panel */}
      {showFilters && (
        <div className="pt-3 border-t border-outline-variant/20 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Familia / Categoría</label>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-3 pr-8 py-2 sm:py-1.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none has-custom-icon min-h-[40px] sm:min-h-[36px] cursor-pointer"
              >
                <option value="todas">Todas las Categorías</option>
                {(() => {
                  const groups = categorias.reduce((acc, c) => {
                    const superName = c.supercategoriaNombre || 'General / Otros';
                    if (!acc[superName]) acc[superName] = [];
                    acc[superName].push(c);
                    return acc;
                  }, {} as Record<string, typeof categorias>);

                  return Object.entries(groups).map(([supercat, cats]) => (
                    <optgroup key={supercat} label={supercat}>
                      {cats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </optgroup>
                  ));
                })()}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Vigencia del Precio</label>
            <div className="relative">
              <select
                value={selectedVencimiento}
                onChange={(e) => setSelectedVencimiento(e.target.value as any)}
                className="w-full pl-3 pr-8 py-2 sm:py-1.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none has-custom-icon min-h-[40px] sm:min-h-[36px] cursor-pointer"
              >
                <option value="todos">Todos los Estados</option>
                <option value="verde">🟢 Vigente (≤ 30 días)</option>
                <option value="amarillo">🟡 Por Vencer (31 - 60 días)</option>
                <option value="rojo">🔴 Vencido / Sin Precio (&gt; 60 días)</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Estado de Ficha Técnica</label>
            <div className="relative">
              <select
                value={selectedFichaStatus}
                onChange={(e) => setSelectedFichaStatus(e.target.value as any)}
                className="w-full pl-3 pr-8 py-2 sm:py-1.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none has-custom-icon min-h-[40px] sm:min-h-[36px] cursor-pointer"
              >
                <option value="todas">Todas las Fichas</option>
                <option value="completas">Fichas Técnicas Completas</option>
                <option value="incompletas">⚠️ Fichas Pendientes / Alta Rápida</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Zap,
  Building2,
  MapPin,
  FileSpreadsheet,
  Calendar,
  Percent,
  ShieldAlert,
  DollarSign,
  Truck,
  Package,
  HardHat,
  Layers,
  Hash
} from 'lucide-react';
import { TareaTipo, Cliente, Insumo, CategoriaManoDeObra, CostoIndirecto } from '../../../core/types';
import { normalizeString, CursorContextType, CalculatedCell } from './dslParser';
import { SlashCommandItem, generateSlashSuggestions } from './slashSuggestionsEngine';

export type { SlashCommandItem };

interface SlashCommandMenuProps {
  query: string;
  tareasTipo: TareaTipo[];
  clientes: Cliente[];
  clienteMatched?: Cliente;
  insumosMap?: Map<string, Insumo>;
  manoObraMap?: Map<string, CategoriaManoDeObra>;
  costosIndirectos?: CostoIndirecto[];
  contextType?: CursorContextType;
  directiveType?: 'cliente' | 'obra' | 'factura' | 'validez' | 'margen' | 'riesgo' | 'dolar';
  calculatedCells?: CalculatedCell[];
  isExplicit?: boolean;
  onSelect: (snippet: string) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  query,
  tareasTipo,
  clientes,
  clienteMatched,
  insumosMap,
  manoObraMap,
  costosIndirectos = [],
  contextType = 'general',
  directiveType,
  calculatedCells = [],
  isExplicit = false,
  onSelect,
  onClose,
  position
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasUserNavigated, setHasUserNavigated] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGastosFilter, setSelectedGastosFilter] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extraer categorías únicas de materiales
  const materialCategories = useMemo(() => {
    if (!insumosMap) return [];
    const set = new Set<string>();
    insumosMap.forEach((ins) => {
      if (ins.categoria) set.add(ins.categoria);
    });
    return Array.from(set).sort();
  }, [insumosMap]);

  // Si el usuario tipeó "cables/" o "#cables" en la query, extraer la categoría
  const { inlineCategory, effectiveQuery } = useMemo(() => {
    const raw = query.replace(/^[\/@]/, '').trim();
    const catSlashMatch = raw.match(/^([a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]+)[\/#:]\s*(.*)$/);
    if (catSlashMatch) {
      const candidateCat = normalizeString(catSlashMatch[1]);
      const matchedCat = materialCategories.find((c) => normalizeString(c) === candidateCat);
      if (matchedCat) {
        return {
          inlineCategory: matchedCat,
          effectiveQuery: catSlashMatch[2].trim()
        };
      }
    }
    return {
      inlineCategory: null,
      effectiveQuery: raw
    };
  }, [query, materialCategories]);

  const activeCategory = inlineCategory || selectedCategory;

  // Lista consolidada de sugerencias
  // Lista consolidada de sugerencias delegada al motor de sugerencias
  const items: SlashCommandItem[] = useMemo(() => {
    return generateSlashSuggestions({
      query,
      effectiveQuery,
      activeCategory,
      selectedGastosFilter,
      contextType,
      directiveType,
      tareasTipo,
      clientes,
      clienteMatched,
      insumosMap,
      manoObraMap,
      costosIndirectos,
      calculatedCells,
      isExplicit
    });
  }, [
    query,
    effectiveQuery,
    activeCategory,
    selectedGastosFilter,
    contextType,
    directiveType,
    tareasTipo,
    clientes,
    clienteMatched,
    insumosMap,
    manoObraMap,
    costosIndirectos,
    calculatedCells,
    isExplicit
  ]);

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setSelectedIndex(0);
    setHasUserNavigated(false);
  }, [query]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [selectedIndex]);

  // Manejo de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        if (items.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setHasUserNavigated(true);
          setSelectedIndex((prev) => (prev + 1) % items.length);
        }
      } else if (e.key === 'ArrowUp') {
        if (items.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setHasUserNavigated(true);
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        }
      } else if (e.key === 'Tab') {
        if (items.length > 0 && items[selectedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(items[selectedIndex].snippet);
        }
      } else if (e.key === 'Enter') {
        if (isExplicit || hasUserNavigated) {
          if (items.length > 0 && items[selectedIndex]) {
            e.preventDefault();
            e.stopPropagation();
            onSelect(items[selectedIndex].snippet);
          }
        } else {
          // El usuario estaba escribiendo texto libre sin navegar las opciones.
          // Cerrar el menú sin interceptar Enter, permitiendo que el editor pase al siguiente renglón con texto libre.
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [items, selectedIndex, isExplicit, hasUserNavigated, onSelect, onClose]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Si no hay ítems y no es explícito (/ o @) ni directiva de cabecera, no renderizar nada
  // (sin disparar onClose, para que el usuario pueda corregir errores con Backspace y seguir recibiendo sugerencias)
  if (items.length === 0 && !activeCategory && !isExplicit && !directiveType) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => e.preventDefault()}
      className="slash-command-menu absolute z-50 w-80 sm:w-96 max-h-96 bg-surface-container-high/95 backdrop-blur-md border border-outline-variant/40 rounded-2xl shadow-2xl overflow-y-auto p-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: position ? `${position.top}px` : '48px',
        left: position ? `${position.left}px` : '16px'
      }}
    >
      {/* Cabecera del Menú */}
      <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center justify-between border-b border-outline-variant/15 mb-1">
        <span className="flex items-center gap-1.5">
          {directiveType === 'cliente' || query.startsWith('@') ? (
            <>
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>Directorio de Clientes ({clientes.length})</span>
            </>
          ) : directiveType === 'factura' ? (
            <>
              <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
              <span>Tipo de Factura</span>
            </>
          ) : directiveType === 'validez' ? (
            <>
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Validez de Oferta</span>
            </>
          ) : directiveType === 'margen' ? (
            <>
              <Percent className="w-3.5 h-3.5 text-primary" />
              <span>Margen de Ganancia</span>
            </>
          ) : directiveType === 'riesgo' ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-primary" />
              <span>Fondo de Riesgo</span>
            </>
          ) : directiveType === 'dolar' ? (
            <>
              <DollarSign className="w-3.5 h-3.5 text-primary" />
              <span>Dólar de Referencia</span>
            </>
          ) : directiveType === 'obra' ? (
            <>
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>Ubicación de la Obra</span>
            </>
          ) : contextType === 'materiales' ? (
            <>
              <Package className="w-3.5 h-3.5 text-primary" />
              <span>Insumos del Catálogo</span>
            </>
          ) : contextType === 'mano_obra' ? (
            <>
              <HardHat className="w-3.5 h-3.5 text-primary" />
              <span>Mano de Obra</span>
            </>
          ) : contextType === 'servicios' ? (
            <>
              <Truck className="w-3.5 h-3.5 text-primary" />
              <span>Servicios y Alquileres</span>
            </>
          ) : contextType === 'item' ? (
            <>
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Despiece de Partida</span>
            </>
          ) : contextType === 'gastos' ? (
            <>
              <Truck className="w-3.5 h-3.5 text-primary" />
              <span>Gastos y Modificadores de Costo</span>
            </>
          ) : contextType === 'calculos' ? (
            <>
              <Hash className="w-3.5 h-3.5 text-primary" />
              <span>Cálculos y Fórmulas</span>
            </>
          ) : contextType === 'tareas' ? (
            <>
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>Partidas y Trabajos Tipo</span>
            </>
          ) : (
            <span>Catálogo y Comandos YAML</span>
          )}
        </span>
        <span className="font-mono text-[10px]">
          {!isExplicit ? (
            hasUserNavigated ? (
              <span className="flex items-center gap-1 text-primary font-bold">
                <span>Enter insertar</span>
                <span className="opacity-40">·</span>
                <span className="text-on-surface-variant font-normal">Esc cerrar</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-on-surface-variant">
                <span className="text-primary font-bold">Tab</span> insertar
                <span className="opacity-40">·</span>
                <span className="text-on-surface font-bold">Enter</span> libre
                <span className="opacity-40">·</span>
                <span>↑↓</span>
              </span>
            )
          ) : (
            <span className="text-primary font-bold">↑ ↓ Enter</span>
          )}
        </span>
      </div>

      {/* Barra de Filtro de Categorías para Gastos */}
      {contextType === 'gastos' && (
        <div className="px-2 py-1 flex items-center gap-1 overflow-x-auto pb-1.5 border-b border-outline-variant/10 text-[10px] scrollbar-none">
          {[
            { id: null, label: 'Todos' },
            { id: 'catalogo', label: 'Catálogo' },
            { id: 'mano_obra', label: 's/ Mano de Obra' },
            { id: 'materiales', label: 's/ Materiales' },
            { id: 'fijos', label: 'Fijos ($)' },
            { id: 'formulas', label: 'Fórmulas (=)' }
          ].map((tab) => {
            const isSelected = selectedGastosFilter === tab.id;
            return (
              <button
                key={tab.label}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setSelectedGastosFilter(tab.id);
                }}
                onClick={() => setSelectedGastosFilter(tab.id)}
                className={`px-2 py-0.5 rounded-md font-bold transition shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Barra de Filtro de Categorías para Materiales */}
      {contextType === 'materiales' && !directiveType && materialCategories.length > 0 && (
        <div className="px-2 py-1 flex items-center gap-1 overflow-x-auto pb-1.5 border-b border-outline-variant/10 text-[10px] scrollbar-none">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onTouchEnd={(e) => {
              e.preventDefault();
              setSelectedCategory(null);
            }}
            onClick={() => setSelectedCategory(null)}
            className={`px-2 py-0.5 rounded-md font-bold transition shrink-0 cursor-pointer ${
              activeCategory === null
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Todas
          </button>
          {materialCategories.slice(0, 6).map((cat) => {
            const isSelected = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setSelectedCategory(isSelected ? null : cat);
                }}
                onClick={() => setSelectedCategory(isSelected ? null : cat)}
                className={`px-2 py-0.5 rounded-md font-bold transition shrink-0 cursor-pointer capitalize ${
                  isSelected
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Lista de Sugerencias */}
      <div className="space-y-0.5 mt-1">
        {items.length === 0 ? (
          <div className="py-6 text-center text-xs text-on-surface-variant">
            No se encontraron coincidencias en esta categoría.
          </div>
        ) : (
          items.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = idx === selectedIndex;

            return (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onSelect(item.snippet);
                }}
                onClick={() => onSelect(item.snippet)}
                onMouseEnter={() => {
                  setSelectedIndex(idx);
                  setHasUserNavigated(true);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-on-surface hover:bg-surface-container-highest'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-on-primary/20 text-on-primary' : 'bg-primary/10 text-primary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-bold truncate">{item.title}</div>
                  {item.subtitle && (
                    <div
                      className={`text-[11px] truncate ${
                        isSelected ? 'text-on-primary/80' : 'text-on-surface-variant'
                      }`}
                    >
                      {item.subtitle}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

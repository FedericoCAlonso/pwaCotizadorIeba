import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FolderPlus,
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
  Filter
} from 'lucide-react';
import { TareaTipo, Cliente, Insumo, CategoriaManoDeObra } from '../../../core/types';
import { normalizeString, CursorContextType } from './dslParser';

export interface SlashCommandItem {
  id: string;
  category: 'tarea' | 'material' | 'mano_obra' | 'capitulo' | 'directiva' | 'gasto';
  title: string;
  subtitle?: string;
  snippet: string;
  categoryTag?: string;
  icon: React.FC<{ className?: string }>;
}

interface SlashCommandMenuProps {
  query: string;
  tareasTipo: TareaTipo[];
  clientes: Cliente[];
  insumosMap?: Map<string, Insumo>;
  manoObraMap?: Map<string, CategoriaManoDeObra>;
  contextType?: CursorContextType;
  onSelect: (snippet: string) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  query,
  tareasTipo,
  clientes,
  insumosMap,
  manoObraMap,
  contextType = 'general',
  onSelect,
  onClose,
  position
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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
    const catSlashMatch = raw.match(/^([a-zA-Z0-9áéíóúÁÉÍÓÚ]+)[\/#:]\s*(.*)$/);
    if (catSlashMatch) {
      const candidateCat = normalizeString(catSlashMatch[1]);
      const matchedCat = materialCategories.find((c) => normalizeString(c) === candidateCat);
      if (matchedCat) {
        return {
          inlineCategory: matchedCat,
          effectiveQuery: normalizeString(catSlashMatch[2])
        };
      }
    }
    return {
      inlineCategory: null,
      effectiveQuery: normalizeString(raw)
    };
  }, [query, materialCategories]);

  const activeCategory = inlineCategory || selectedCategory;

  // Lista consolidada de sugerencias
  const items: SlashCommandItem[] = useMemo(() => {
    const list: SlashCommandItem[] = [];

    // 1. Insumos y Materiales del Catálogo
    if (insumosMap && (contextType === 'materiales' || contextType === 'general')) {
      insumosMap.forEach((ins) => {
        list.push({
          id: `ins-${ins.id}`,
          category: 'material',
          categoryTag: ins.categoria,
          title: ins.nombre,
          subtitle: `Material · $ ${Math.round(ins.precioActual || 0).toLocaleString('es-AR')} / ${ins.unidad || 'u'}${ins.categoria ? ` · ${ins.categoria}` : ''}`,
          snippet: `- 1 ${ins.unidad || 'u'} ${ins.nombre}\n`,
          icon: Package
        });
      });
    }

    // 2. Categorías de Mano de Obra
    if (manoObraMap && (contextType === 'mano_obra' || contextType === 'general')) {
      manoObraMap.forEach((mo) => {
        list.push({
          id: `mo-${mo.id}`,
          category: 'mano_obra',
          title: `MO: ${mo.nombre}`,
          subtitle: `Mano de Obra · $ ${Math.round(mo.costoHora || 0).toLocaleString('es-AR')} / hora`,
          snippet: `- 4 h ${mo.nombre}\n`,
          icon: HardHat
        });
      });
    }

    // 3. Tareas Tipo de Catálogo (en contexto tareas o general)
    if (contextType === 'tareas' || contextType === 'general') {
      tareasTipo.forEach((t) => {
        list.push({
          id: `tarea-${t.id}`,
          category: 'tarea',
          title: t.nombre,
          subtitle: `Tarea Catálogo · /${t.unidad || 'u'} · ${t.categoria || 'General'}`,
          snippet: `- 1 ${t.unidad || 'u'} ${t.nombre}\n`,
          icon: Zap
        });
      });

      // Partida a Medida (Plantilla APU compuesta)
      list.push({
        id: 'cmd-partida-medida',
        category: 'tarea',
        title: '⚡ Partida a Medida (APU)',
        subtitle: 'Crea un trabajo con despiece de materiales y mano de obra',
        snippet: `- Tablero a Medida:\n    materiales:\n      - 1 u Gabinete DIN 24 módulos\n    mano_obra:\n      - 6 h Oficial\n`,
        icon: Layers
      });
    }

    if (contextType === 'general') {
      // Estructura y Capítulos
      list.push({
        id: 'cmd-capitulo',
        category: 'capitulo',
        title: 'Nuevo Capítulo',
        subtitle: 'Agrupa partidas bajo una sección de obra',
        snippet: `Capítulo Nuevo:\n  - 1 u `,
        icon: FolderPlus
      });

      // Directivas de Cotización en YAML
      list.push({
        id: 'cmd-cliente',
        category: 'directiva',
        title: 'cliente: [Nombre]',
        subtitle: 'Asigna el comitente o estudio de arquitectura',
        snippet: `cliente: `,
        icon: Building2
      });

      list.push({
        id: 'cmd-obra',
        category: 'directiva',
        title: 'obra: [Dirección]',
        subtitle: 'Ubicación específica de la obra',
        snippet: `obra: `,
        icon: MapPin
      });

      list.push({
        id: 'cmd-factura',
        category: 'directiva',
        title: 'factura: [Factura A | B | C]',
        subtitle: 'Encuadre fiscal de la cotización',
        snippet: `factura: Factura A\n`,
        icon: FileSpreadsheet
      });

      list.push({
        id: 'cmd-validez',
        category: 'directiva',
        title: 'validez: [15] dias',
        subtitle: 'Plazo de validez de la oferta',
        snippet: `validez: 15 dias\n`,
        icon: Calendar
      });

      list.push({
        id: 'cmd-margen',
        category: 'directiva',
        title: 'margen: [35]%',
        subtitle: 'Margen de beneficio sobre costos',
        snippet: `margen: 35%\n`,
        icon: Percent
      });

      list.push({
        id: 'cmd-riesgo',
        category: 'directiva',
        title: 'riesgo: [bajo | normal | alto]',
        subtitle: 'Fondo de contingencia para imprevistos',
        snippet: `riesgo: normal\n`,
        icon: ShieldAlert
      });

      list.push({
        id: 'cmd-dolar',
        category: 'directiva',
        title: 'dolar: [MEP 1350]',
        subtitle: 'Cotización en moneda extranjera',
        snippet: `dolar: MEP 1350\n`,
        icon: DollarSign
      });

      list.push({
        id: 'cmd-gasto',
        category: 'gasto',
        title: 'gastos: Viáticos = $ 15.000',
        subtitle: 'Costo logístico, fletes o traslados',
        snippet: `gastos:\n  - Viáticos: $ 15.000\n`,
        icon: Truck
      });
    }

    // Filtrar por categoría activa
    let filtered = list;
    if (activeCategory) {
      filtered = filtered.filter(
        (it) => it.category === 'material' && normalizeString(it.categoryTag || '') === normalizeString(activeCategory)
      );
    }

    // Filtrar por query de búsqueda
    if (!effectiveQuery) {
      return filtered.slice(0, 20);
    }

    return filtered
      .filter((it) => {
        const tNorm = normalizeString(it.title);
        const subNorm = normalizeString(it.subtitle || '');
        return tNorm.includes(effectiveQuery) || subNorm.includes(effectiveQuery);
      })
      .slice(0, 25);
  }, [effectiveQuery, activeCategory, contextType, tareasTipo, insumosMap, manoObraMap]);

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (items.length === 0 && !activeCategory) {
      onClose();
    }
  }, [items.length, activeCategory, onClose]);

  // Manejo de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        if (items.length > 0) {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % items.length);
        }
      } else if (e.key === 'ArrowUp') {
        if (items.length > 0) {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        }
      } else if (e.key === 'Enter') {
        if (items.length > 0 && items[selectedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(items[selectedIndex].snippet);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedIndex, onSelect, onClose]);

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

  if (items.length === 0 && !activeCategory) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-80 sm:w-96 max-h-96 bg-surface-container-high/95 backdrop-blur-md border border-outline-variant/40 rounded-2xl shadow-2xl overflow-y-auto p-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: position ? `${position.top}px` : '48px',
        left: position ? `${position.left}px` : '16px'
      }}
    >
      {/* Cabecera del Menú */}
      <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center justify-between border-b border-outline-variant/15 mb-1">
        <span className="flex items-center gap-1.5">
          {contextType === 'materiales' ? (
            <>
              <Package className="w-3.5 h-3.5 text-primary" />
              <span>Insumos del Catálogo</span>
            </>
          ) : contextType === 'mano_obra' ? (
            <>
              <HardHat className="w-3.5 h-3.5 text-primary" />
              <span>Mano de Obra</span>
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
        <span className="font-mono text-[10px] text-primary">↑ ↓ Enter</span>
      </div>

      {/* Barra de Filtro de Categorías para Materiales */}
      {(contextType === 'materiales' || materialCategories.length > 0) && (
        <div className="px-2 py-1 flex items-center gap-1 overflow-x-auto pb-1.5 border-b border-outline-variant/10 text-[10px] scrollbar-none">
          <button
            type="button"
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
                onClick={() => onSelect(item.snippet)}
                onMouseEnter={() => setSelectedIndex(idx)}
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

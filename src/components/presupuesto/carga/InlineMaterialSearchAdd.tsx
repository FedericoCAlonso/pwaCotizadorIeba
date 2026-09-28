import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Plus, BookOpen, Check } from 'lucide-react';
import { Insumo } from '../../../core/types';
import { formatARS } from '../../../core/calculations';

interface InlineMaterialSearchAddProps {
  insumosMap: Map<string, Insumo>;
  onAddMaterial: (material: Insumo, cantidad: number, formula?: string) => void;
  onOpenCatalog?: () => void;
  placeholder?: string;
}

export const InlineMaterialSearchAdd: React.FC<InlineMaterialSearchAddProps> = ({
  insumosMap,
  onAddMaterial,
  onOpenCatalog,
  placeholder = 'Buscar material en catálogo (ej: Cable 2.5mm)...'
}) => {
  const [query, setQuery] = useState('');
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const [cantidadStr, setCantidadStr] = useState('1');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const allInsumos = useMemo(() => Array.from(insumosMap.values()), [insumosMap]);

  // Filtrado de insumos en memoria con límite a los 8 mejores resultados
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const terms = q.split(/\s+/);
    return allInsumos
      .filter((ins) => {
        const fullText = `${ins.nombre} ${ins.marca || ''} ${ins.categoria || ''}`.toLowerCase();
        return terms.every((t) => fullText.includes(t));
      })
      .slice(0, 8);
  }, [allInsumos, query]);

  // Manejar clic fuera para cerrar dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (ins: Insumo) => {
    setSelectedInsumo(ins);
    setQuery(ins.nombre);
    setIsOpenDropdown(false);
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 50);
  };

  const handleConfirmAdd = () => {
    if (!selectedInsumo) return;

    const trimmedQty = cantidadStr.trim();
    let qty = 1;
    let formula: string | undefined = undefined;

    if (trimmedQty.startsWith('=')) {
      formula = trimmedQty;
    } else {
      const parsed = Number(trimmedQty.replace(',', '.'));
      qty = isNaN(parsed) || parsed <= 0 ? 1 : parsed;
    }

    onAddMaterial(selectedInsumo, qty, formula);

    // Resetear formulario
    setSelectedInsumo(null);
    setQuery('');
    setCantidadStr('1');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full text-xs">
      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
        {/* Buscador predictivo */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedInsumo(null);
              setIsOpenDropdown(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => {
              if (query.trim().length >= 2) setIsOpenDropdown(true);
            }}
            onKeyDown={(e) => {
              if (isOpenDropdown && matches.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedIndex((prev) => (prev + 1) % matches.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedIndex((prev) => (prev - 1 + matches.length) % matches.length);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (matches[highlightedIndex]) {
                    handleSelect(matches[highlightedIndex]);
                  }
                } else if (e.key === 'Escape') {
                  setIsOpenDropdown(false);
                }
              }
            }}
            placeholder={placeholder}
            className="w-full pl-8 pr-3 py-1.5 bg-surface border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs placeholder:text-on-surface-variant/50"
          />

          {/* Menú flotante de resultados predictivos */}
          {isOpenDropdown && matches.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-surface-container-high border border-outline-variant/30 rounded-xl shadow-lg z-50 overflow-hidden max-h-56 overflow-y-auto divide-y divide-outline-variant/15">
              {matches.map((ins, idx) => (
                <div
                  key={ins.id}
                  onClick={() => handleSelect(ins)}
                  className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    idx === highlightedIndex
                      ? 'bg-primary-container text-on-primary-container'
                      : 'hover:bg-surface-container text-on-surface'
                  }`}
                >
                  <div className="flex flex-col truncate">
                    <span className="font-semibold truncate">{ins.nombre}</span>
                    <span className="text-[10px] text-on-surface-variant/70">
                      {ins.marca ? `${ins.marca} · ` : ''}
                      {ins.categoria || 'General'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-xs block">
                      {formatARS(ins.precioActual ?? ins.precioNeto ?? ins.precioFinal ?? 0)}
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      por {ins.unidad || 'u'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input de cantidad o fórmula */}
        <div className="flex items-center gap-1 shrink-0">
          <input
            ref={qtyInputRef}
            type="text"
            value={cantidadStr}
            onChange={(e) => setCantidadStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirmAdd();
              }
            }}
            placeholder="Cant / ="
            title="Cantidad numérica o fórmula matemática empezando con ="
            className="w-20 px-2 py-1.5 text-center font-mono bg-surface border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
          />
          {selectedInsumo && (
            <span className="text-[11px] font-mono text-on-surface-variant font-semibold px-0.5">
              {selectedInsumo.unidad || 'u'}
            </span>
          )}

          {/* Botón rápido de agregar */}
          <button
            type="button"
            onClick={handleConfirmAdd}
            disabled={!selectedInsumo}
            className={`inline-flex items-center gap-1 px-3 py-1.5 font-semibold rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 ${
              selectedInsumo
                ? 'bg-primary text-on-primary hover:bg-primary/90'
                : 'bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed'
            }`}
            title="Agregar material a la partida"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar</span>
          </button>

          {/* Botón secundario para explorar catálogo completo */}
          {onOpenCatalog && (
            <button
              type="button"
              onClick={onOpenCatalog}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-surface-container text-on-surface-variant hover:text-on-surface rounded-xl border border-outline-variant/30 transition-colors cursor-pointer"
              title="Abrir catálogo completo con filtros y selección múltiple"
            >
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Catálogo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface ItemUnidadSelectorProps {
  unidad: string;
  onChangeUnidad: (nuevaUnidad: string) => void;
  disabled?: boolean;
}

const UNIDADES_FRECUENTES = [
  { id: 'u', label: 'u (Unidad)' },
  { id: 'm', label: 'm (Metros)' },
  { id: 'ml', label: 'ml (Metros lineales)' },
  { id: 'm²', label: 'm² (Metros cuadrados)' },
  { id: 'boca', label: 'boca (Bocas)' },
  { id: 'gl', label: 'gl (Global)' },
  { id: 'hs', label: 'hs (Horas)' },
  { id: 'pto', label: 'pto (Puntos)' },
  { id: 'tramo', label: 'tramo (Tramos)' },
  { id: 'kg', label: 'kg (Kilogramos)' },
  { id: 'jgo', label: 'jgo (Juegos)' }
];

export const ItemUnidadSelector: React.FC<ItemUnidadSelectorProps> = ({
  unidad,
  onChangeUnidad,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentUnidad = unidad?.trim() || 'u';

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCustomMode(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsCustomMode(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isCustomMode && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isCustomMode]);

  const handleSelect = (u: string) => {
    onChangeUnidad(u);
    setIsOpen(false);
    setIsCustomMode(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customValue.trim()) {
      onChangeUnidad(customValue.trim().toLowerCase());
    }
    setIsOpen(false);
    setIsCustomMode(false);
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-50"
        title="Cambiar unidad de medida del ítem"
      >
        <span>{currentUnidad}</span>
        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1 z-50 w-44 rounded-xl bg-surface-container-high border border-outline-variant/30 shadow-xl p-1.5 text-xs animate-in fade-in duration-100"
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 border-b border-outline-variant/20 mb-1">
            Unidad de medida
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5 no-scrollbar">
            {UNIDADES_FRECUENTES.map((u) => {
              const isSelected = currentUnidad.toLowerCase() === u.id.toLowerCase();
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelect(u.id)}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-primary-container text-on-primary-container font-semibold'
                      : 'text-on-surface hover:bg-surface-container-highest'
                  }`}
                >
                  <span className="font-mono">{u.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="pt-1 mt-1 border-t border-outline-variant/20">
            {isCustomMode ? (
              <form onSubmit={handleCustomSubmit} className="flex items-center gap-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="Otra unidad..."
                  className="flex-1 px-1.5 py-0.5 text-xs bg-surface border border-primary rounded text-on-surface focus:outline-none font-mono"
                />
                <button
                  type="submit"
                  className="px-2 py-0.5 text-xs bg-primary text-on-primary rounded font-medium hover:bg-primary/90 cursor-pointer"
                >
                  OK
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCustomValue(currentUnidad);
                  setIsCustomMode(true);
                }}
                className="w-full text-left px-2 py-1 text-[11px] text-primary hover:underline cursor-pointer font-medium"
              >
                + Otra personalizada...
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

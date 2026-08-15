import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingCart, Search, Globe, ChevronDown, ExternalLink, Sparkles } from 'lucide-react';
import { db } from '../db/database';
import { Material, Producto, MotorBusquedaEcommerce } from '../core/types';
import { buildSearchTerm, openEcommerceSearch, getActiveSearchEngines } from '../core/searchUtils';

interface OnlinePriceButtonProps {
  tipo: 'material' | 'producto';
  material?: Partial<Material> | null;
  producto?: Partial<Producto> | null;
  customNombre?: string;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'pill' | 'compact' | 'icon';
  className?: string;
}

export const OnlinePriceButton: React.FC<OnlinePriceButtonProps> = ({
  tipo,
  material,
  producto,
  customNombre,
  size = 'xs',
  variant = 'pill',
  className = ''
}) => {
  const configs = useLiveQuery(() => db.config.toArray()) || [];
  const config = configs[0];

  const engines = useMemo(() => {
    return getActiveSearchEngines(config?.motoresBusquedaOnline);
  }, [config?.motoresBusquedaOnline]);

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const queryTerm = useMemo(() => {
    return buildSearchTerm({ tipo, material, producto, customNombre });
  }, [tipo, material, producto, customNombre]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectEngine = (e: React.MouseEvent, engine: MotorBusquedaEcommerce) => {
    e.stopPropagation();
    openEcommerceSearch(engine, { tipo, material, producto, customNombre });
    setIsOpen(false);
  };

  const getEngineIcon = (engine: MotorBusquedaEcommerce) => {
    if (engine.id === 'mercadolibre') {
      return <ShoppingCart className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    }
    if (engine.id === 'google_shopping') {
      return <Search className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    }
    return <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  };

  const sizeClasses = {
    xs: 'px-2 py-1 text-[11px]',
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-xs'
  }[size];

  if (engines.length === 0 || !queryTerm) {
    return null;
  }

  // Si solo hay un motor activo, clic directo
  if (engines.length === 1) {
    const singleEngine = engines[0];
    return (
      <button
        type="button"
        onClick={(e) => handleSelectEngine(e, singleEngine)}
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-colors border border-outline-variant/20 shadow-2xs ${sizeClasses} ${className}`}
        title={`Buscar "${queryTerm}" en ${singleEngine.nombre}`}
      >
        {getEngineIcon(singleEngine)}
        {variant !== 'icon' && (
          <span className="truncate">
            {variant === 'compact' ? singleEngine.nombre : `Buscar en ${singleEngine.nombre}`}
          </span>
        )}
        <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
      </button>
    );
  }

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-colors border border-outline-variant/20 shadow-2xs ${sizeClasses}`}
        title={`Buscar precios online de: "${queryTerm}"`}
      >
        <ShoppingCart className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        {variant !== 'icon' && (
          <span className="truncate">
            {variant === 'compact' ? 'Buscar Precio' : tipo === 'producto' ? 'Precios Producto' : 'Precios Online'}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1.5 w-64 rounded-2xl bg-surface-container-high border border-outline-variant/30 shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Preview of Term */}
          <div className="px-2.5 py-1.5 bg-surface-container rounded-xl border border-outline-variant/10">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
              Término a buscar ({tipo === 'producto' ? 'Producto/SKU' : 'Material'}):
            </span>
            <span className="text-xs font-semibold text-primary truncate block font-mono">
              "{queryTerm}"
            </span>
          </div>

          {/* Engine Options */}
          <div className="space-y-0.5 pt-0.5">
            {engines.map((engine) => (
              <button
                key={engine.id}
                type="button"
                onClick={(e) => handleSelectEngine(e, engine)}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium text-on-surface hover:bg-primary/10 hover:text-primary transition-colors group text-left"
              >
                <div className="flex items-center gap-2 truncate">
                  {getEngineIcon(engine)}
                  <span className="font-semibold">{engine.nombre}</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:text-primary transition-opacity shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

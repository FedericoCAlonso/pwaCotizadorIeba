import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingCart, Search, Globe, ChevronDown, ExternalLink, X } from 'lucide-react';
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
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const queryTerm = useMemo(() => {
    return buildSearchTerm({ tipo, material, producto, customNombre });
  }, [tipo, material, producto, customNombre]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;
      if (!isMobile) {
        // En desktop calculamos posición fija sin que se desborde la pantalla
        const menuWidth = 270;
        let left = rect.right - menuWidth;
        if (left < 10) left = rect.left;
        if (left + menuWidth > window.innerWidth - 10) {
          left = window.innerWidth - menuWidth - 10;
        }

        let top = rect.bottom + 6;
        if (top + 220 > window.innerHeight) {
          top = rect.top - 200; // Si no entra abajo, abrir hacia arriba
        }

        setCoords({ top, left });
      }
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      // Si se hace scroll en desktop cerramos para no desfasar coordenadas
      if (window.innerWidth >= 640) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleGlobalClick);
    document.addEventListener('touchstart', handleGlobalClick);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('touchstart', handleGlobalClick);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const handleSelectEngine = (e: React.MouseEvent, engine: MotorBusquedaEcommerce) => {
    e.stopPropagation();
    openEcommerceSearch(engine, { tipo, material, producto, customNombre });
    setIsOpen(false);
  };

  const getEngineIcon = (engine: MotorBusquedaEcommerce) => {
    if (engine.id === 'mercadolibre') {
      return <ShoppingCart className="w-4 h-4 text-amber-500 shrink-0" />;
    }
    if (engine.id === 'google_shopping') {
      return <Search className="w-4 h-4 text-blue-500 shrink-0" />;
    }
    return <Globe className="w-4 h-4 text-emerald-500 shrink-0" />;
  };

  const sizeClasses = {
    xs: 'p-1.5 text-[11px]',
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
        ref={buttonRef}
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
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center justify-center gap-1 font-medium rounded-full bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-all border border-outline-variant/20 shadow-2xs active:scale-95 ${sizeClasses} ${className}`}
        title={`Consultar precio online: "${queryTerm}"`}
      >
        <ShoppingCart className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        {variant !== 'icon' && (
          <span className="truncate">
            {variant === 'compact' ? 'Precio' : tipo === 'producto' ? 'Precios Producto' : 'Precios Online'}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Renderizado vía Portal para evitar que contenedores con overflow o max-height tapen el menú */}
      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] pointer-events-none flex sm:block items-end justify-center">
            {/* Backdrop en Mobile */}
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs pointer-events-auto sm:hidden animate-in fade-in duration-150"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu Container: Bottom Sheet en Mobile, Popover flotante en Desktop */}
            <div
              ref={menuRef}
              style={
                window.innerWidth >= 640
                  ? { position: 'fixed', top: `${coords.top}px`, left: `${coords.left}px` }
                  : undefined
              }
              className="pointer-events-auto w-full sm:w-[280px] bg-surface-container-high border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 sm:p-2 space-y-2 animate-in slide-in-from-bottom-6 sm:slide-in-from-top-2 sm:zoom-in-95 duration-150 text-on-surface z-[100000]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile Header / Drag Handle */}
              <div className="sm:hidden flex items-center justify-between pb-2 border-b border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-sm">Consultar Precio Online</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-full text-on-surface-variant hover:bg-surface-variant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Preview del término de búsqueda */}
              <div className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/15">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                  Búsqueda {tipo === 'producto' ? 'Producto/Marca' : 'Material Técnico'}:
                </span>
                <span className="text-xs font-semibold text-primary truncate block font-mono mt-0.5">
                  "{queryTerm}"
                </span>
              </div>

              {/* Lista de Motores / Tiendas */}
              <div className="space-y-1 pt-1">
                {engines.map((engine) => (
                  <button
                    key={engine.id}
                    type="button"
                    onClick={(e) => handleSelectEngine(e, engine)}
                    className="w-full flex items-center justify-between px-3 py-2.5 sm:py-2 rounded-xl text-xs font-semibold text-on-surface hover:bg-primary/10 hover:text-primary transition-colors group text-left min-h-[44px] sm:min-h-0 bg-surface-container/50 sm:bg-transparent"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {getEngineIcon(engine)}
                      <span>{engine.nombre}</span>
                    </div>
                    <ExternalLink className="w-4 h-4 sm:w-3.5 sm:h-3.5 opacity-50 group-hover:opacity-100 group-hover:text-primary transition-opacity shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

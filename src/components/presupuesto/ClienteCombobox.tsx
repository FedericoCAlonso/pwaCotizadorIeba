import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  User,
  UserPlus,
  X,
  Check,
  Phone,
  Mail,
  MapPin,
  Edit2,
  ChevronDown
} from 'lucide-react';
import { Contacto } from '../../core/types';
import { QuickClienteModal } from './QuickClienteModal';

interface ClienteComboboxProps {
  clientes: Contacto[];
  selectedClienteId: string;
  onSelectCliente: (clienteId: string) => void;
  className?: string;
}

export const ClienteCombobox: React.FC<ClienteComboboxProps> = ({
  clientes,
  selectedClienteId,
  onSelectCliente,
  className = ''
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cliente actualmente seleccionado
  const selectedCliente = useMemo(() => {
    return clientes.find((c) => c.id === selectedClienteId);
  }, [clientes, selectedClienteId]);

  // Si no hay cliente seleccionado, iniciamos en modo búsqueda por defecto
  useEffect(() => {
    if (!selectedClienteId) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [selectedClienteId]);

  // Filtrado de clientes en tiempo real
  const filteredClientes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Si no hay texto, mostramos los primeros 10 clientes del directorio
      return clientes.slice(0, 10);
    }

    return clientes.filter((c) => {
      const name = (c.razonSocial || c.nombre || '').toLowerCase();
      const alias = (c.nombreFantasia || '').toLowerCase();
      const cuit = (c.cuitDni || c.cuit || '').replace(/[^0-9]/g, '');
      const cleanQ = q.replace(/[^0-9]/g, '');
      const phone = (c.telefono || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const address = (c.direccion || '').toLowerCase();
      const city = (c.localidad || '').toLowerCase();

      return (
        name.includes(q) ||
        alias.includes(q) ||
        (cleanQ && cuit.includes(cleanQ)) ||
        phone.includes(q) ||
        email.includes(q) ||
        address.includes(q) ||
        city.includes(q)
      );
    }).slice(0, 15);
  }, [clientes, query]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (cliente: Contacto) => {
    onSelectCliente(cliente.id);
    setIsSearching(false);
    setIsOpenDropdown(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectCliente('');
    setQuery('');
    setIsSearching(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleStartSearch = () => {
    setIsSearching(true);
    setIsOpenDropdown(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpenDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpenDropdown(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredClientes.length + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredClientes.length + 1) % (filteredClientes.length + 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex < filteredClientes.length) {
        handleSelect(filteredClientes[selectedIndex]);
      } else {
        // Opción "+ Crear cliente"
        setIsQuickCreateOpen(true);
        setIsOpenDropdown(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpenDropdown(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'CL';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* ─── Estado 1: Cliente Seleccionado (Card M3) ─── */}
      {!isSearching && selectedCliente ? (
        <div className="bg-surface-container-highest/70 hover:bg-surface-container-highest border border-outline-variant/30 rounded-2xl p-3 flex items-center justify-between gap-3 transition shadow-2xs">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Avatar con Iniciales */}
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              {getInitials(selectedCliente.razonSocial || selectedCliente.nombre)}
            </div>

            {/* Datos del Cliente */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs sm:text-sm font-bold text-on-surface truncate">
                  {selectedCliente.razonSocial || selectedCliente.nombre}
                </h4>
                {selectedCliente.cuitDni && (
                  <span className="text-[10px] font-mono font-semibold bg-surface-container px-2 py-0.5 rounded-md text-on-surface-variant shrink-0 border border-outline-variant/20">
                    {selectedCliente.cuitDni}
                  </span>
                )}
                {selectedCliente.condicionIVA && (
                  <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded shrink-0">
                    {selectedCliente.condicionIVA}
                  </span>
                )}
              </div>

              {/* Sub-info: Teléfono / Dirección */}
              <div className="flex items-center gap-3 text-[11px] text-on-surface-variant truncate mt-0.5">
                {selectedCliente.telefono && (
                  <span className="flex items-center gap-1 shrink-0">
                    <Phone className="w-3 h-3 text-primary" />
                    <span>{selectedCliente.telefono}</span>
                  </span>
                )}
                {(selectedCliente.direccion || selectedCliente.localidad) && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-outline-variant shrink-0" />
                    <span className="truncate">
                      {[selectedCliente.direccion, selectedCliente.localidad].filter(Boolean).join(', ')}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleStartSearch}
              className="px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl transition flex items-center gap-1 active:scale-95"
              title="Buscar y seleccionar otro cliente"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cambiar</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition active:scale-95"
              title="Quitar cliente seleccionado"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* ─── Estado 2: Input de Búsqueda y Selector Combobox ─── */
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpenDropdown(true);
                setSelectedIndex(0);
              }}
              onFocus={() => setIsOpenDropdown(true)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar cliente por nombre, CUIT, teléfono, dirección..."
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl pl-10 pr-24 py-2.5 text-xs sm:text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] transition-shadow placeholder:text-on-surface-variant/50 shadow-2xs"
            />

            <div className="absolute right-2 flex items-center gap-1">
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 text-on-surface-variant hover:text-on-surface rounded-lg transition"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsQuickCreateOpen(true);
                  setIsOpenDropdown(false);
                }}
                className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl border border-primary/20 transition flex items-center gap-1 active:scale-95 shrink-0"
                title="Crear un nuevo cliente"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">+ Nuevo</span>
              </button>
            </div>
          </div>

          {/* Menú Dropdown Flotante */}
          {isOpenDropdown && (
            <div className="absolute left-0 top-full mt-1.5 w-full bg-surface-container-high border border-outline-variant/30 rounded-2xl shadow-2xl z-50 p-1.5 space-y-1 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
              <div className="px-3 py-1.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center justify-between border-b border-outline-variant/15">
                <span>{filteredClientes.length} Clientes Encontrados</span>
                <span className="font-mono lowercase text-[9px]">↑↓ enter para elegir</span>
              </div>

              {filteredClientes.length === 0 ? (
                <div className="text-center py-4 px-3">
                  <User className="w-6 h-6 text-outline-variant mx-auto mb-1 opacity-60" />
                  <p className="text-xs font-bold text-on-surface">No se encontró "{query}"</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Puedes darlo de alta rápidamente con el botón de abajo.
                  </p>
                </div>
              ) : (
                filteredClientes.map((c, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelect(c)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-primary text-on-primary font-bold shadow-xs'
                          : 'hover:bg-surface-variant/60 text-on-surface'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-primary/10 text-primary border border-primary/20'
                          }`}
                        >
                          {getInitials(c.razonSocial || c.nombre)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-xs font-bold truncate">
                              {c.razonSocial || c.nombre}
                            </span>
                            {c.cuitDni && (
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
                                }`}
                              >
                                {c.cuitDni}
                              </span>
                            )}
                          </div>
                          {(c.telefono || c.direccion || c.localidad) && (
                            <p
                              className={`text-[10px] truncate ${
                                isSelected ? 'text-white/80' : 'text-on-surface-variant/80'
                              }`}
                            >
                              {[c.telefono, c.localidad, c.direccion].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {c.id === selectedClienteId && (
                        <Check
                          className={`w-4 h-4 shrink-0 ${
                            isSelected ? 'text-white' : 'text-primary'
                          }`}
                        />
                      )}
                    </button>
                  );
                })
              )}

              {/* Botón "+ Crear nuevo cliente" siempre visible al pie del dropdown */}
              <button
                type="button"
                onClick={() => {
                  setIsQuickCreateOpen(true);
                  setIsOpenDropdown(false);
                }}
                className={`w-full text-left p-2.5 rounded-xl border border-dashed transition flex items-center gap-2 font-bold text-xs ${
                  selectedIndex === filteredClientes.length
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-primary/5 hover:bg-primary/15 text-primary border-primary/30'
                }`}
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>+ Crear nuevo cliente {query ? `"${query}"` : ''}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Alta Rápida de Cliente */}
      <QuickClienteModal
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        initialName={query}
        onClienteCreated={(newId) => {
          onSelectCliente(newId);
          setIsSearching(false);
          setQuery('');
        }}
      />
    </div>
  );
};

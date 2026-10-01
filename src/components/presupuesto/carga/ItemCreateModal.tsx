import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Tag } from 'lucide-react';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

interface ItemCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  capituloNombre?: string;
  onConfirm: (data: { descripcion: string; unidad: string; cantidad: number }) => void;
}

const UNIDADES_FRECUENTES = ['u', 'm', 'ml', 'm²', 'boca', 'gl', 'hs', 'pto', 'tramo', 'kg'];

export const ItemCreateModal: React.FC<ItemCreateModalProps> = ({
  isOpen,
  onClose,
  capituloNombre,
  onConfirm
}) => {
  const [descripcion, setDescripcion] = useState('');
  const [unidad, setUnidad] = useState('u');
  const [cantidad, setCantidad] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setDescripcion('');
      setUnidad('u');
      setCantidad(1);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDesc = descripcion.trim();
    if (!cleanDesc) return;

    onConfirm({
      descripcion: cleanDesc,
      unidad: unidad.trim() || 'u',
      cantidad: cantidad > 0 ? cantidad : 1
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-container rounded-3xl border border-outline-variant/30 shadow-2xl p-5 overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Agregar nuevo ítem"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 pb-3">
          <div>
            <span className="text-[11px] font-bold text-primary uppercase font-mono tracking-wider">
              Nuevo Ítem
            </span>
            <h3 className="text-base font-bold text-on-surface leading-tight mt-0.5">
              {capituloNombre ? `En Rubro: ${capituloNombre}` : 'Crear partida en la cotización'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors cursor-pointer"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Nombre / Descripción */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1.5">
              Nombre / Descripción del Ítem <span className="text-error">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="ej. Boca de iluminación living, Tablero seccional..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs transition-all"
            />
          </div>

          {/* Unidad de medida */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-on-surface">
                Unidad de medida
              </label>
              <input
                type="text"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                placeholder="u, m, m², boca..."
                className="w-28 px-2 py-0.5 text-xs font-mono font-bold text-primary bg-surface border border-outline-variant/40 rounded-lg focus:outline-none focus:border-primary text-right"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {UNIDADES_FRECUENTES.map((u) => {
                const isSelected = unidad.toLowerCase() === u.toLowerCase();
                return (
                  <button
                    key={u}
                    type="button"
                    tabIndex={-1}
                    onClick={() => setUnidad(u)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-on-primary font-bold shadow-xs'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                    }`}
                  >
                    {u}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cantidad inicial */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1.5">
              Cantidad inicial
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.01"
                step="any"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value) || 1)}
                className="w-28 px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface text-on-surface font-mono text-sm focus:outline-none focus:border-primary shadow-2xs"
              />
              <span className="text-xs text-on-surface-variant font-mono">
                {unidad}
              </span>
            </div>
          </div>

          {/* Footer de botones */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-outline-variant/30 text-xs font-semibold text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!descripcion.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-xs hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Ítem</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

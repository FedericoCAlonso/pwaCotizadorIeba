import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { TERMINOLOGY } from '../../../config/terminology';
import { MathInput } from '../../common/MathInput';

interface MobileQuickFreeItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope?: Record<string, number>;
  onAdd: (
    descripcion: string,
    cantidad: number | string,
    precioUnitario: number | string
  ) => void;
}

/**
 * Atajo móvil de 3 campos exactos (descripción, cantidad, precio) para agregar un ítem libre.
 * Soporta expresiones matemáticas y variables globales vía MathInput.
 */
export const MobileQuickFreeItemModal: React.FC<MobileQuickFreeItemModalProps> = ({
  isOpen,
  onClose,
  scope,
  onAdd
}) => {
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState<number | null>(1);
  const [cantidadFormula, setCantidadFormula] = useState<string | undefined>(undefined);
  const [precio, setPrecio] = useState<number | null>(null);
  const [precioFormula, setPrecioFormula] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) {
      setDescripcion('');
      setCantidad(1);
      setCantidadFormula(undefined);
      setPrecio(null);
      setPrecioFormula(undefined);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasScopeVars = Boolean(scope && Object.keys(scope).length > 0);
  const canSubmit =
    descripcion.trim().length > 0 &&
    cantidad !== null &&
    cantidad > 0 &&
    precio !== null &&
    precio >= 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onAdd(
      descripcion.trim(),
      cantidadFormula || (cantidad ?? 1),
      precioFormula || (precio ?? 0)
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Agregar ${TERMINOLOGY.elementoLibre}`}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-on-surface">
            Nuevo {TERMINOLOGY.elementoLibre}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="quick-item-desc"
              className="mb-1 block text-xs font-medium text-on-surface-variant"
            >
              Descripción
            </label>
            <input
              id="quick-item-desc"
              type="text"
              autoFocus
              required
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej. Visita de diagnóstico / Canaleta extra"
              className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="quick-item-qty"
                className="mb-1 block text-xs font-medium text-on-surface-variant"
              >
                Cantidad
              </label>
              <MathInput
                id="quick-item-qty"
                ariaLabel="Cantidad"
                value={cantidad}
                formula={cantidadFormula}
                allowFormula
                scope={scope}
                inputMode={hasScopeVars ? 'text' : 'decimal'}
                min={0.01}
                placeholder="1"
                onChange={(val, fx) => {
                  setCantidad(val);
                  setCantidadFormula(fx);
                }}
                className="h-11 bg-surface-container-lowest text-sm font-medium"
              />
            </div>
            <div>
              <label
                htmlFor="quick-item-price"
                className="mb-1 block text-xs font-medium text-on-surface-variant"
              >
                Precio unitario ($)
              </label>
              <MathInput
                id="quick-item-price"
                ariaLabel="Precio unitario ($)"
                value={precio}
                formula={precioFormula}
                allowFormula
                scope={scope}
                inputMode={hasScopeVars ? 'text' : 'decimal'}
                min={0}
                placeholder="0"
                onChange={(val, fx) => {
                  setPrecio(val);
                  setPrecioFormula(fx);
                }}
                className="h-11 bg-surface-container-lowest text-sm font-medium"
              />
            </div>
          </div>

          <p className="text-[11px] text-on-surface-variant">
            {hasScopeVars
              ? `Podés escribir operaciones o variables (${Object.keys(scope!).slice(0, 4).join(', ')}).`
              : 'Podés escribir operaciones rápidas (ej. 12 + 4 o 15000 * 1.2).'}
          </p>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-on-primary shadow-sm active:scale-[0.99] disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Agregar {TERMINOLOGY.elementoLibre.toLowerCase()}
        </button>
      </form>
    </div>
  );
};

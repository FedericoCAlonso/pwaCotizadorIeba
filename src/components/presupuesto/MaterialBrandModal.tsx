import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Tag,
  X,
  Check,
  Star,
  Package,
  Building2,
  DollarSign,
  Sparkles,
  Edit3
} from 'lucide-react';
import { db } from '../../db/database';
import { InsumoSnapshot, Producto, Oferta } from '../../core/types';
import { formatARS, safeNum, roundMoney } from '../../core/calculations';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { MathInput } from '../common/MathInput';

export interface ApplyBrandPayload {
  productoId?: string;
  ofertaId?: string;
  marca: string;
  precioUnitario: number;
}

interface MaterialBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialSnapshot: InsumoSnapshot;
  itemDescription?: string;
  onApplyBrand: (payload: ApplyBrandPayload) => void;
}

export const MaterialBrandModal: React.FC<MaterialBrandModalProps> = ({
  isOpen,
  onClose,
  materialSnapshot,
  itemDescription,
  onApplyBrand,
}) => {
  useEscapeKey(isOpen, onClose);

  const matId = materialSnapshot.materialId || materialSnapshot.insumoId || '';

  const rawProductos = useLiveQuery(() => db.productos.toArray()) || [];
  const rawOfertas = useLiveQuery(() => db.ofertas.toArray()) || [];

  const matchingProducts: Producto[] = useMemo(() => {
    return rawProductos
      .filter((p) => !p.deleted && (p.materialId === matId || p.materialId === materialSnapshot.insumoId))
      .sort((a, b) => {
        if (a.esPreferido && !b.esPreferido) return -1;
        if (!a.esPreferido && b.esPreferido) return 1;
        return a.marca.localeCompare(b.marca);
      });
  }, [rawProductos, matId, materialSnapshot.insumoId]);

  // Offers indexed by productId or materialId
  const offersByProductId = useMemo(() => {
    const map = new Map<string, Oferta>();
    const activeOffers = rawOfertas
      .filter((o) => !o.deleted && (o.materialId === matId || o.materialId === materialSnapshot.insumoId))
      .sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());

    for (const o of activeOffers) {
      if (o.productoId) {
        map.set(o.productoId, o);
      }
    }
    return map;
  }, [rawOfertas, matId, materialSnapshot.insumoId]);

  // Mode: 'catalog' | 'custom' | 'generic'
  const [selectedMode, setSelectedMode] = useState<'catalog' | 'custom' | 'generic'>('catalog');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [customMarca, setCustomMarca] = useState<string>('');
  const [customPrice, setCustomPrice] = useState<number>(materialSnapshot.precioUnitarioCongelado || 0);

  // Initialize state when modal opens or materialSnapshot changes
  useEffect(() => {
    if (isOpen) {
      setCustomPrice(materialSnapshot.precioUnitarioCongelado || 0);

      if (materialSnapshot.productoId) {
        setSelectedMode('catalog');
        setSelectedProductId(materialSnapshot.productoId);
        setCustomMarca('');
      } else if (materialSnapshot.marca && materialSnapshot.marca !== 'Genérico') {
        // Check if current brand matches any product in catalog
        const match = matchingProducts.find(
          (p) => `${p.marca}${p.modelo ? ` ${p.modelo}` : ''}`.trim().toLowerCase() === materialSnapshot.marca?.toLowerCase()
        );
        if (match) {
          setSelectedMode('catalog');
          setSelectedProductId(match.id);
          setCustomMarca('');
        } else {
          setSelectedMode('custom');
          setSelectedProductId(null);
          setCustomMarca(materialSnapshot.marca || '');
        }
      } else {
        if (matchingProducts.length > 0) {
          const pref = matchingProducts.find((p) => p.esPreferido) || matchingProducts[0];
          setSelectedMode('catalog');
          setSelectedProductId(pref.id);
          setCustomMarca('');
        } else {
          setSelectedMode('generic');
          setSelectedProductId(null);
          setCustomMarca('');
        }
      }
    }
  }, [isOpen, materialSnapshot, matchingProducts]);

  if (!isOpen) return null;

  const handleSelectProduct = (prod: Producto) => {
    setSelectedMode('catalog');
    setSelectedProductId(prod.id);
    const oferta = offersByProductId.get(prod.id);
    if (oferta && oferta.precio > 0) {
      setCustomPrice(oferta.precio);
    }
  };

  const handleSelectGeneric = () => {
    setSelectedMode('generic');
    setSelectedProductId(null);
  };

  const handleSelectCustom = () => {
    setSelectedMode('custom');
    setSelectedProductId(null);
    if (!customMarca && materialSnapshot.marca && materialSnapshot.marca !== 'Genérico') {
      setCustomMarca(materialSnapshot.marca);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedMode === 'catalog' && selectedProductId) {
      const prod = matchingProducts.find((p) => p.id === selectedProductId);
      if (prod) {
        const marcaStr = `${prod.marca}${prod.modelo ? ` ${prod.modelo}` : ''}`.trim();
        const oferta = offersByProductId.get(prod.id);
        const finalPrice = customPrice > 0 ? customPrice : (oferta?.precio || materialSnapshot.precioUnitarioCongelado || 0);

        onApplyBrand({
          productoId: prod.id,
          ofertaId: oferta?.id,
          marca: marcaStr,
          precioUnitario: roundMoney(finalPrice)
        });
        onClose();
        return;
      }
    }

    if (selectedMode === 'custom') {
      const brandTrimmed = customMarca.trim() || 'Marca personalizada';
      onApplyBrand({
        productoId: undefined,
        ofertaId: undefined,
        marca: brandTrimmed,
        precioUnitario: roundMoney(customPrice > 0 ? customPrice : materialSnapshot.precioUnitarioCongelado || 0)
      });
      onClose();
      return;
    }

    // Generic
    onApplyBrand({
      productoId: undefined,
      ofertaId: undefined,
      marca: '',
      precioUnitario: roundMoney(customPrice > 0 ? customPrice : materialSnapshot.precioUnitarioCongelado || 0)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative bg-surface border border-outline-variant/30 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-on-surface z-10 animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-2xl">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-on-surface text-base sm:text-lg">
                Marca & Modelo de Material
              </h3>
              <p className="text-xs text-on-surface-variant">
                {itemDescription ? `Para partida: "${itemDescription}"` : 'Especifica qué marca y modelo cotizar en este presupuesto'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Material Context Card */}
          <div className="p-3 bg-surface-container-highest/60 rounded-2xl border border-outline-variant/25 flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary shrink-0" />
                <h4 className="font-bold text-on-surface truncate text-sm">
                  {materialSnapshot.nombre}
                </h4>
              </div>
              <p className="text-xs text-on-surface-variant">
                Cantidad asignada:{' '}
                <strong className="text-on-surface font-mono">
                  {materialSnapshot.cantidadTotal} {materialSnapshot.unidad}
                </strong>
                {materialSnapshot.marca && (
                  <span>
                    {' '}• Marca actual en presupuesto:{' '}
                    <strong className="text-primary">{materialSnapshot.marca}</strong>
                  </span>
                )}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[11px] text-on-surface-variant block">Precio unitario actual</span>
              <span className="font-mono font-bold text-primary text-sm">
                {formatARS(materialSnapshot.precioUnitarioCongelado)}
              </span>
            </div>
          </div>

          {/* Catalog Registered Products List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Marcas registradas en tu catálogo ({matchingProducts.length})</span>
              </label>
              {matchingProducts.length === 0 && (
                <span className="text-[11px] text-on-surface-variant italic">
                  Sin marcas registradas para este material
                </span>
              )}
            </div>

            {matchingProducts.length > 0 ? (
              <div className="space-y-2">
                {matchingProducts.map((prod) => {
                  const isSelected = selectedMode === 'catalog' && selectedProductId === prod.id;
                  const oferta = offersByProductId.get(prod.id);

                  return (
                    <div
                      key={prod.id}
                      onClick={() => handleSelectProduct(prod)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40'
                          : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary text-on-primary'
                              : 'border-outline-variant/60 bg-surface'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-on-surface text-xs sm:text-sm">
                              {prod.marca}
                            </span>
                            {prod.modelo && (
                              <span className="text-xs text-on-surface-variant">
                                ({prod.modelo})
                              </span>
                            )}
                            {prod.esPreferido && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                Preferida
                              </span>
                            )}
                            {prod.tierCalidad && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-surface-variant text-on-surface-variant">
                                {prod.tierCalidad}
                              </span>
                            )}
                          </div>
                          {oferta?.proveedorNombre && (
                            <p className="text-[11px] text-on-surface-variant mt-0.5">
                              Proveedor habitual: {oferta.proveedorNombre}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {oferta ? (
                          <>
                            <span className="font-mono font-bold text-on-surface text-xs sm:text-sm block">
                              {formatARS(oferta.precio)}
                            </span>
                            <span className="text-[10px] text-on-surface-variant block">Ref. catálogo</span>
                          </>
                        ) : (
                          <span className="text-[11px] text-on-surface-variant italic">
                            Sin oferta cargada
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="p-3 text-xs text-on-surface-variant bg-surface-container-low rounded-2xl border border-outline-variant/20 italic">
                No hay marcas ni modelos asociados a este material en el catálogo de Insumos. Puedes ingresar una marca personalizada abajo.
              </p>
            )}
          </div>

          {/* Alternative Modes: Generic or Custom */}
          <div className="space-y-2 pt-2 border-t border-outline-variant/20">
            <span className="font-bold text-xs uppercase tracking-wider text-on-surface-variant block">
              Otras Opciones
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Option: Generic */}
              <div
                onClick={handleSelectGeneric}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                  selectedMode === 'generic'
                    ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40'
                    : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/30'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    selectedMode === 'generic'
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-outline-variant/60 bg-surface'
                  }`}
                >
                  {selectedMode === 'generic' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <div>
                  <h5 className="font-bold text-xs text-on-surface">Genérico / Sin Marca</h5>
                  <p className="text-[11px] text-on-surface-variant">Sin especificación comercial en el pliego</p>
                </div>
              </div>

              {/* Option: Custom Brand */}
              <div
                onClick={handleSelectCustom}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                  selectedMode === 'custom'
                    ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40'
                    : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/30'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    selectedMode === 'custom'
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-outline-variant/60 bg-surface'
                  }`}
                >
                  {selectedMode === 'custom' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <div>
                  <h5 className="font-bold text-xs text-on-surface">Marca Libre / Específica</h5>
                  <p className="text-[11px] text-on-surface-variant">Escribir marca puntual para este presupuesto</p>
                </div>
              </div>
            </div>

            {/* Custom Brand Inputs */}
            {selectedMode === 'custom' && (
              <div className="p-3.5 bg-primary/5 rounded-2xl border border-primary/20 space-y-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Marca y Modelo puntual (ej: Siemens 5SY4, ABB, Jeluz Platinum...)
                  </label>
                  <input
                    type="text"
                    value={customMarca}
                    onChange={(e) => setCustomMarca(e.target.value)}
                    placeholder="Ej: Schneider Electric Acti9 iC60N..."
                    className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    autoFocus
                  />
                </div>
              </div>
            )}
          </div>

          {/* Unit Price Adjustment for this Brand */}
          <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/20 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-on-surface block flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-primary" />
                <span>Precio Unitario a congelar en esta cotización</span>
              </span>
              <span className="text-[11px] text-on-surface-variant">
                Se multiplicará por {materialSnapshot.cantidadTotal} {materialSnapshot.unidad} = {formatARS((customPrice || 0) * materialSnapshot.cantidadTotal)}
              </span>
            </div>
            <div className="w-32 shrink-0">
              <MathInput
                value={customPrice}
                onChange={(val) => setCustomPrice(Math.max(0, safeNum(val)))}
                size="sm"
                min={0}
                step={10}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar a la Cotización</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { Layers, X, Tag, DollarSign, Package, Check, HelpCircle, AlertCircle } from 'lucide-react';
import { Material, Contacto, Oferta } from '../../core/types';
import {
  calcularPrecioNeto,
  calcularPrecioFinal,
  calcularPrecioUnitarioDesdePresentacion,
  obtenerPresentacionesSugeridas,
  formatARS
} from '../../core/calculations';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { MathInput } from '../common/MathInput';

export interface BlockPriceData {
  precioNetoUnitario: number;
  precioFinalUnitario: number;
  alicuotaIVA: number;
  proveedorId?: string;
  proveedorNombre?: string;
  presentacionCompra?: string;
  cantidadPorPresentacion?: number;
  precioPresentacion?: number;
}

interface BlockPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetMaterials: Material[];
  proveedores: Contacto[];
  onApply: (data: BlockPriceData) => Promise<void>;
}

export const BlockPriceModal: React.FC<BlockPriceModalProps> = ({
  isOpen,
  onClose,
  targetMaterials,
  proveedores,
  onApply,
}) => {
  useEscapeKey(isOpen, onClose);

  // Determinar la unidad más frecuente del conjunto
  const primaryUnidad = useMemo(() => {
    if (targetMaterials.length === 0) return 'u';
    const counts: Record<string, number> = {};
    for (const m of targetMaterials) {
      const u = m.unidadVenta || 'u';
      counts[u] = (counts[u] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || 'u';
  }, [targetMaterials]);

  const sugerenciasEmpaque = useMemo(() => obtenerPresentacionesSugeridas(primaryUnidad), [primaryUnidad]);

  // Form State
  const [modoPrecio, setModoPrecio] = useState<'con_iva' | 'neto'>('con_iva');
  const [alicuotaIVA, setAlicuotaIVA] = useState<number>(21);
  const [presentacionSeleccionada, setPresentacionSeleccionada] = useState<string>('');
  const [factorEmpaque, setFactorEmpaque] = useState<number>(1);
  const [precioBultoDisplay, setPrecioBultoDisplay] = useState<number>(0);
  const [proveedorId, setProveedorId] = useState<string>('');
  const [showMaterialsList, setShowMaterialsList] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setModoPrecio('con_iva');
      setAlicuotaIVA(21);
      const defaultPres = sugerenciasEmpaque[0]?.etiqueta || 'Unidad';
      const defaultFactor = sugerenciasEmpaque[0]?.cantidad || 1;
      setPresentacionSeleccionada(defaultPres);
      setFactorEmpaque(defaultFactor);
      setPrecioBultoDisplay(0);
      setProveedorId('');
      setShowMaterialsList(false);
      setIsSubmitting(false);
    }
  }, [isOpen, sugerenciasEmpaque]);

  // Cálculos reactivos
  const bultoNeto = modoPrecio === 'con_iva'
    ? calcularPrecioNeto(precioBultoDisplay, alicuotaIVA)
    : precioBultoDisplay;

  const bultoFinal = modoPrecio === 'con_iva'
    ? precioBultoDisplay
    : calcularPrecioFinal(precioBultoDisplay, alicuotaIVA);

  const unitarioNeto = calcularPrecioUnitarioDesdePresentacion(bultoNeto, factorEmpaque);
  const unitarioFinal = calcularPrecioUnitarioDesdePresentacion(bultoFinal, factorEmpaque);

  const handlePresentacionChange = (etiqueta: string) => {
    setPresentacionSeleccionada(etiqueta);
    const matched = sugerenciasEmpaque.find(s => s.etiqueta === etiqueta);
    if (matched) {
      setFactorEmpaque(matched.cantidad);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unitarioNeto <= 0) return;

    setIsSubmitting(true);
    try {
      const provObj = proveedores.find(p => p.id === proveedorId);
      await onApply({
        precioNetoUnitario: unitarioNeto,
        precioFinalUnitario: unitarioFinal,
        alicuotaIVA,
        proveedorId: proveedorId || undefined,
        proveedorNombre: provObj ? (provObj.razonSocial || provObj.nombre) : undefined,
        presentacionCompra: presentacionSeleccionada,
        cantidadPorPresentacion: factorEmpaque,
        precioPresentacion: modoPrecio === 'con_iva' ? bultoNeto : precioBultoDisplay
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-on-surface my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/25 bg-surface-container-high/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">Asignar Precio en Bloque</h3>
              <p className="text-xs text-on-surface-variant">
                Fija el mismo valor a todo el conjunto de materiales coincidentes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          
          {/* Target Summary Card */}
          <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                <span>{targetMaterials.length} material{targetMaterials.length > 1 ? 'es' : ''} seleccionado{targetMaterials.length > 1 ? 's' : ''}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowMaterialsList(prev => !prev)}
                className="text-[11px] text-primary hover:underline font-semibold"
              >
                {showMaterialsList ? 'Ocultar lista' : 'Ver detalle'}
              </button>
            </div>

            {showMaterialsList ? (
              <div className="max-h-36 overflow-y-auto space-y-1 pt-1 pr-1">
                {targetMaterials.map(m => (
                  <div key={m.id} className="text-[11px] bg-surface-container px-2.5 py-1 rounded-lg text-on-surface flex items-center justify-between border border-outline-variant/15">
                    <span className="truncate">{m.nombre}</span>
                    <span className="text-[10px] font-mono text-on-surface-variant shrink-0 ml-2">({m.unidadVenta || 'u'})</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1 max-h-16 overflow-hidden">
                {targetMaterials.slice(0, 4).map(m => (
                  <span key={m.id} className="text-[10px] bg-surface-container-highest px-2 py-0.5 rounded-md text-on-surface truncate max-w-[200px]">
                    {m.nombre}
                  </span>
                ))}
                {targetMaterials.length > 4 && (
                  <span className="text-[10px] text-on-surface-variant font-bold self-center">
                    +{targetMaterials.length - 4} más...
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Presentación / Factor de Empaque */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              1. Presentación de Compra o Empaque
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={presentacionSeleccionada}
                onChange={(e) => handlePresentacionChange(e.target.value)}
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {sugerenciasEmpaque.map((s) => (
                  <option key={s.etiqueta} value={s.etiqueta}>
                    {s.etiqueta}
                  </option>
                ))}
                <option value="Personalizado">Empaque personalizado...</option>
              </select>

              <div className="flex items-center gap-1.5 bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-1.5">
                <span className="text-[11px] text-on-surface-variant font-medium shrink-0">Cant. por bulto:</span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={factorEmpaque}
                  onChange={(e) => setFactorEmpaque(Math.max(1, parseFloat(e.target.value) || 1))}
                  className="w-full bg-transparent text-xs font-mono font-bold text-on-surface focus:outline-none text-right"
                />
                <span className="text-xs font-bold text-primary shrink-0">{primaryUnidad}</span>
              </div>
            </div>
          </div>

          {/* Modalidad de IVA y Precio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                2. Precio del Bulto / Unidad
              </label>

              {/* Segmented control IVA */}
              <div className="inline-flex rounded-xl bg-surface-container-highest p-0.5 border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setModoPrecio('con_iva')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    modoPrecio === 'con_iva'
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Con IVA
                </button>
                <button
                  type="button"
                  onClick={() => setModoPrecio('neto')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    modoPrecio === 'neto'
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Neto
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <MathInput
                  value={precioBultoDisplay}
                  onChange={(val) => setPrecioBultoDisplay(val)}
                  prefix="$"
                  placeholder="0,00"
                  size="md"
                  autoFocus={true}
                  className="w-full font-mono text-base font-bold bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <select
                  value={alicuotaIVA}
                  onChange={(e) => setAlicuotaIVA(parseFloat(e.target.value) || 21)}
                  className="w-full h-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-2.5 py-2 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value={21}>IVA 21%</option>
                  <option value={10.5}>IVA 10.5%</option>
                  <option value={0}>IVA 0%</option>
                </select>
              </div>
            </div>
          </div>

          {/* Proveedor Opcional */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              3. Proveedor (Opcional)
            </label>
            <select
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">-- Sin proveedor específico (General / Lista) --</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.razonSocial || p.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Live Calculated Unit Price Preview */}
          <div className="p-4 rounded-2xl bg-surface-container-high border border-primary/20 space-y-2">
            <div className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center justify-between">
              <span>Precio Unitario Resultante</span>
              <span className="font-mono text-on-surface-variant text-[10px]">x {primaryUnidad}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="block text-[10px] text-on-surface-variant">Base Neta:</span>
                <span className="text-sm font-mono font-bold text-on-surface">
                  {formatARS(unitarioNeto)} <span className="text-[10px] font-normal text-on-surface-variant">/{primaryUnidad}</span>
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-on-surface-variant">Final con IVA:</span>
                <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatARS(unitarioFinal)} <span className="text-[10px] font-normal text-on-surface-variant">/{primaryUnidad}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/25">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={unitarioNeto <= 0 || isSubmitting}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs rounded-full shadow-md transition disabled:opacity-50 flex items-center gap-2 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Aplicando...' : `Aplicar a ${targetMaterials.length} materiales`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

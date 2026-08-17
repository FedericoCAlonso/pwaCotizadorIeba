import React, { useState, useEffect, useMemo } from 'react';
import { Save, X, Tag, Package } from 'lucide-react';
import { Oferta, Contacto, Producto } from '../../core/types';
import {
  calcularPrecioNeto,
  calcularPrecioFinal,
  calcularPrecioUnitarioDesdePresentacion,
  obtenerPresentacionesSugeridas,
  formatARS
} from '../../core/calculations';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useModalKeyboardNavigation } from '../../hooks/useModalKeyboardNavigation';

interface OfertaEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingOferta: Oferta | null;
  proveedores: Contacto[];
  productos: Producto[];
  formDataOferta: Partial<Oferta>;
  setFormDataOferta: React.Dispatch<React.SetStateAction<Partial<Oferta>>>;
  unidadVenta?: string;
  onSave: (e: React.FormEvent) => void;
}

export const OfertaEditorModal: React.FC<OfertaEditorModalProps> = ({
  isOpen,
  onClose,
  editingOferta,
  proveedores,
  productos,
  formDataOferta,
  setFormDataOferta,
  unidadVenta = 'u',
  onSave,
}) => {
  useEscapeKey(isOpen, onClose);
  const { containerRef, handleKeyDown } = useModalKeyboardNavigation({ isOpen });
  const [proveedorInput, setProveedorInput] = useState('');
  const [modoPrecio, setModoPrecio] = useState<'con_iva' | 'neto'>('con_iva');
  const [alicuotaIVA, setAlicuotaIVA] = useState<number>(21);

  // Presentación / Factor de empaque
  const sugerenciasEmpaque = useMemo(() => obtenerPresentacionesSugeridas(unidadVenta), [unidadVenta]);
  const [presentacionSeleccionada, setPresentacionSeleccionada] = useState<string>('');
  const [factorEmpaque, setFactorEmpaque] = useState<number>(1);
  const [precioBultoDisplay, setPrecioBultoDisplay] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      if (formDataOferta.proveedorId) {
        const found = proveedores.find((p) => p.id === formDataOferta.proveedorId);
        setProveedorInput(found ? found.razonSocial || found.nombre || '' : formDataOferta.proveedorNombre || '');
      } else {
        setProveedorInput(formDataOferta.proveedorNombre || '');
      }

      const ali = formDataOferta.alicuotaIVA !== undefined ? formDataOferta.alicuotaIVA : 21;
      setAlicuotaIVA(ali);

      const factor = formDataOferta.cantidadPorPresentacion || 1;
      setFactorEmpaque(factor);
      setPresentacionSeleccionada(formDataOferta.presentacionCompra || sugerenciasEmpaque[0]?.etiqueta || 'Unidad');

      const baseUnitNeto = formDataOferta.precioNeto ?? formDataOferta.precio ?? 0;
      const baseBultoNeto = formDataOferta.precioPresentacion ?? (baseUnitNeto * factor);

      if (modoPrecio === 'con_iva') {
        const finalBulto = formDataOferta.precioFinal !== undefined && factor === 1
          ? formDataOferta.precioFinal
          : calcularPrecioFinal(baseBultoNeto, ali);
        setPrecioBultoDisplay(finalBulto);
      } else {
        setPrecioBultoDisplay(baseBultoNeto);
      }
    }
  }, [
    isOpen,
    formDataOferta.proveedorId,
    formDataOferta.proveedorNombre,
    formDataOferta.precio,
    formDataOferta.precioNeto,
    formDataOferta.precioFinal,
    formDataOferta.alicuotaIVA,
    formDataOferta.presentacionCompra,
    formDataOferta.cantidadPorPresentacion,
    formDataOferta.precioPresentacion,
    proveedores,
    modoPrecio,
    sugerenciasEmpaque
  ]);

  // Cálculos reactivos
  const bultoNeto = modoPrecio === 'con_iva'
    ? calcularPrecioNeto(precioBultoDisplay, alicuotaIVA)
    : precioBultoDisplay;

  const bultoFinal = modoPrecio === 'con_iva'
    ? precioBultoDisplay
    : calcularPrecioFinal(precioBultoDisplay, alicuotaIVA);

  const unitarioNeto = calcularPrecioUnitarioDesdePresentacion(bultoNeto, factorEmpaque);
  const unitarioFinal = calcularPrecioUnitarioDesdePresentacion(bultoFinal, factorEmpaque);

  const syncFormData = (bultoVal: number, factor: number, presLabel: string, ali: number, modo: 'con_iva' | 'neto') => {
    const netBulto = modo === 'con_iva' ? calcularPrecioNeto(bultoVal, ali) : bultoVal;
    const finBulto = modo === 'con_iva' ? bultoVal : calcularPrecioFinal(bultoVal, ali);
    const netUnit = calcularPrecioUnitarioDesdePresentacion(netBulto, factor);
    const finUnit = calcularPrecioUnitarioDesdePresentacion(finBulto, factor);

    setFormDataOferta(prev => ({
      ...prev,
      precio: netUnit, // Canonical unit neto (GMT)
      precioNeto: netUnit,
      alicuotaIVA: ali,
      precioFinal: finUnit,
      presentacionCompra: presLabel,
      cantidadPorPresentacion: factor,
      precioPresentacion: modo === 'con_iva' ? netBulto : bultoVal
    }));
  };

  const handlePrecioBultoChange = (val: number) => {
    setPrecioBultoDisplay(val);
    syncFormData(val, factorEmpaque, presentacionSeleccionada, alicuotaIVA, modoPrecio);
  };

  const handlePresentacionChange = (etiqueta: string) => {
    setPresentacionSeleccionada(etiqueta);
    const matched = sugerenciasEmpaque.find(s => s.etiqueta === etiqueta);
    const nextFactor = matched ? matched.cantidad : factorEmpaque;
    setFactorEmpaque(nextFactor);
    syncFormData(precioBultoDisplay, nextFactor, etiqueta, alicuotaIVA, modoPrecio);
  };

  const handleCustomFactorChange = (qty: number) => {
    const validQty = Math.max(1, qty);
    setFactorEmpaque(validQty);
    syncFormData(precioBultoDisplay, validQty, presentacionSeleccionada, alicuotaIVA, modoPrecio);
  };

  const handleAlicuotaChange = (newAli: number) => {
    setAlicuotaIVA(newAli);
    syncFormData(precioBultoDisplay, factorEmpaque, presentacionSeleccionada, newAli, modoPrecio);
  };

  if (!isOpen) return null;

  const handleProveedorChange = (val: string) => {
    setProveedorInput(val);
    const matched = proveedores.find(
      (p) => (p.razonSocial || p.nombre || '').trim().toLowerCase() === val.trim().toLowerCase()
    );
    if (matched) {
      setFormDataOferta((prev) => ({
        ...prev,
        proveedorId: matched.id,
        proveedorNombre: matched.razonSocial || matched.nombre || val,
      }));
    } else {
      setFormDataOferta((prev) => ({
        ...prev,
        proveedorId: undefined,
        proveedorNombre: val,
      }));
    }
  };

  const inputCls =
    'w-full px-3.5 py-2.5 text-base sm:text-xs rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        className="bg-surface-container rounded-2xl w-full max-w-md shadow-2xl p-6 text-on-surface"
      >
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-container text-on-primary-container rounded-xl">
              <Tag className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-on-surface">
              {editingOferta ? 'Editar Oferta / Precio' : 'Cargar Oferta / Precio'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] p-2 text-on-surface-variant hover:text-on-surface rounded-full state-layer flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          {/* Marca / Producto Asociado */}
          {productos.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Marca / Modelo Asignado
              </label>
              <select
                value={formDataOferta.productoId || ''}
                onChange={(e) =>
                  setFormDataOferta({
                    ...formDataOferta,
                    productoId: e.target.value ? e.target.value : undefined,
                  })
                }
                className={inputCls}
              >
                <option value="">Precio Genérico (Aplica al material)</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.marca} {p.modelo ? `(${p.modelo})` : ''} {p.esPreferido ? '⭐ (Preferido)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-on-surface-variant mt-1">
                Indica si esta cotización corresponde a una marca puntual o al insumo general.
              </p>
            </div>
          )}

          {/* Proveedor (Agendado o Libre) */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Proveedor (Agendado u Ocasional)
            </label>
            <input
              type="text"
              list="proveedores-datalist"
              value={proveedorInput}
              onChange={(e) => handleProveedorChange(e.target.value)}
              placeholder="Escribe o elige un proveedor (ej: Dist. Oeste, Ferretería San Martín...)"
              className={inputCls}
              required
            />
            <datalist id="proveedores-datalist">
              {proveedores.map((p) => (
                <option key={p.id} value={p.razonSocial || p.nombre} />
              ))}
            </datalist>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {formDataOferta.proveedorId ? (
                <span className="text-primary font-medium">✓ Proveedor agendado en Directorio</span>
              ) : proveedorInput.trim() ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  ✎ Proveedor libre / no agendado
                </span>
              ) : (
                'Puedes seleccionar un contacto registrado o ingresar cualquier proveedor libre.'
              )}
            </p>
          </div>

          {/* Presentación de Compra / Empaque */}
          <div className="space-y-2 bg-surface-container-high/40 p-3 rounded-2xl border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-primary" />
                <span>Presentación de Compra / Empaque</span>
              </label>
              <span className="text-[10px] text-on-surface-variant font-mono">
                Unidad base: <strong>{unidadVenta}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <select
                  value={presentacionSeleccionada}
                  onChange={(e) => handlePresentacionChange(e.target.value)}
                  className={inputCls}
                >
                  {sugerenciasEmpaque.map((s, idx) => (
                    <option key={idx} value={s.etiqueta}>
                      {s.etiqueta}
                    </option>
                  ))}
                  <option value="Personalizado">Otro / Cantidad personalizada...</option>
                </select>
              </div>

              {presentacionSeleccionada === 'Personalizado' ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={factorEmpaque}
                    onChange={(e) => handleCustomFactorChange(parseFloat(e.target.value) || 1)}
                    className={`${inputCls} font-mono`}
                    placeholder="Cantidad por bulto"
                    required
                  />
                  <span className="text-xs text-on-surface-variant font-semibold shrink-0">{unidadVenta}/bulto</span>
                </div>
              ) : (
                <div className="flex items-center px-3 py-2 bg-surface-container-highest rounded-xl border border-outline-variant/30 text-xs text-on-surface-variant">
                  <span>Factor: <strong>{factorEmpaque} {unidadVenta}</strong> por presentación</span>
                </div>
              )}
            </div>
          </div>

          {/* Precio de Compra con Two-Way Binding e IVA (Canónico GMT) */}
          <div className="space-y-2 bg-surface-container-high/60 p-3.5 rounded-2xl border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-on-surface">
                {factorEmpaque > 1 ? `Precio de la Presentación (${presentacionSeleccionada})` : 'Precio de Compra Directo'}
              </label>
              <div className="flex items-center gap-1 bg-surface-container-highest p-0.5 rounded-lg border border-outline-variant/30 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setModoPrecio('con_iva');
                    syncFormData(precioBultoDisplay, factorEmpaque, presentacionSeleccionada, alicuotaIVA, 'con_iva');
                  }}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    modoPrecio === 'con_iva'
                      ? 'bg-primary text-on-primary font-bold shadow-2xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Con IVA incluido
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModoPrecio('neto');
                    syncFormData(precioBultoDisplay, factorEmpaque, presentacionSeleccionada, alicuotaIVA, 'neto');
                  }}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    modoPrecio === 'neto'
                      ? 'bg-primary text-on-primary font-bold shadow-2xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Neto (Sin IVA)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <div className="relative">
                  <span className="text-xs text-on-surface-variant absolute left-3 top-2.5 font-mono">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={precioBultoDisplay || ''}
                    onChange={(e) => handlePrecioBultoChange(parseFloat(e.target.value) || 0)}
                    className={`${inputCls} pl-7 font-mono text-primary font-bold text-base`}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <select
                  value={alicuotaIVA}
                  onChange={(e) => handleAlicuotaChange(parseFloat(e.target.value) || 21)}
                  className={inputCls}
                  title="Alícuota de IVA"
                >
                  <option value={21}>IVA 21%</option>
                  <option value={10.5}>IVA 10.5%</option>
                  <option value={27}>IVA 27%</option>
                  <option value={0}>IVA 0% (Exento)</option>
                </select>
              </div>
            </div>

            {/* Desglose en vivo de Base Neta, Final y Costo Unitario Computable */}
            <div className="pt-2 border-t border-outline-variant/20 space-y-1 text-[11px] font-mono text-on-surface-variant">
              {factorEmpaque > 1 && (
                <div className="flex justify-between items-center bg-primary/5 p-2 rounded-xl border border-primary/20 text-on-surface">
                  <span>Costo Unitario Base ({unidadVenta}):</span>
                  <strong className="text-primary text-xs font-bold">
                    {formatARS(unitarioNeto)} <span className="text-[10px] font-normal text-on-surface-variant">Neto / {unidadVenta}</span>
                  </strong>
                </div>
              )}

              <div className="flex items-center justify-between pt-0.5">
                <div>
                  {factorEmpaque > 1 ? 'Total Bulto Neto: ' : 'Base Neta: '}
                  <strong className="text-on-surface">{formatARS(bultoNeto)}</strong>
                </div>
                <div className="text-right">
                  {factorEmpaque > 1 ? 'Total Bulto c/IVA: ' : 'Final c/IVA: '}
                  <strong className="text-primary">{formatARS(bultoFinal)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Notas / Referencia de Cotización */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Notas / Plazo de entrega (Opcional)
            </label>
            <input
              type="text"
              value={formDataOferta.notas || ''}
              onChange={(e) => setFormDataOferta({ ...formDataOferta, notas: e.target.value })}
              placeholder="Ej: Contado efectivo, retiro inmediato, presupuesto #412..."
              className={inputCls}
            />
          </div>

          <div className="pt-3 border-t border-outline-variant/20 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-variant state-layer cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-xs state-layer shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Precio</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

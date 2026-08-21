import React, { useState, useRef, useEffect } from 'react';
import { Calculator, RotateCcw, X, CheckCircle, ChevronDown, Plus } from 'lucide-react';
import {
  CostoIndirecto,
  CostoIndirectoItemConfig,
  TipoFactura
} from '../../core/types';
import { formatARS, formatUSD, TotalesPresupuestoResultado } from '../../core/calculations';

interface PresupuestoTotalsCardProps {
  totales: TotalesPresupuestoResultado;
  tipoFactura: TipoFactura;
  costosIndirectosConfig: CostoIndirectoItemConfig[];
  costosIndirectosCatalog?: CostoIndirecto[];
  onToggleIndirectCost: (idx: number) => void;
  onUpdateIndirectCostName: (idx: number, name: string) => void;
  onUpdateIndirectCostValor: (idx: number, val: number) => void;
  onRemoveIndirectCost: (idx: number) => void;
  onAddCustomIndirectCost: () => void;
  onAddCatalogIndirectCost?: (ci: CostoIndirecto) => void;
  onResetIndirectCosts: () => void;
  margenPorcentaje: number;
  onMargenPorcentajeChange: (val: number) => void;
  onToggleTax: (idx: number) => void;
  onUpdateTaxPct: (idx: number, pct: number) => void;
  onRemoveTax: (idx: number) => void;
  onAddCustomTax: () => void;
  mostrarDolar: boolean;
  nombreDolar: string;
  onEmitirClick: () => void;
}

export const PresupuestoTotalsCard: React.FC<PresupuestoTotalsCardProps> = ({
  totales,
  tipoFactura,
  costosIndirectosConfig,
  costosIndirectosCatalog = [],
  onToggleIndirectCost,
  onUpdateIndirectCostName,
  onUpdateIndirectCostValor,
  onRemoveIndirectCost,
  onAddCustomIndirectCost,
  onAddCatalogIndirectCost,
  onResetIndirectCosts,
  margenPorcentaje,
  onMargenPorcentajeChange,
  onToggleTax,
  onUpdateTaxPct,
  onRemoveTax,
  onAddCustomTax,
  mostrarDolar,
  nombreDolar,
  onEmitirClick,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    if (showAddMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddMenu]);

  const unaddedCatalogItems = costosIndirectosCatalog.filter(
    (c) => !costosIndirectosConfig.some((cfg) => cfg.id === c.id || (cfg as any).costoIndirectoId === c.id)
  );

  return (
    <div className="bg-surface-container-low rounded-3xl p-6 space-y-5 border border-outline-variant/10 shadow-sm sticky top-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          <span>Liquidación & Cadena de Precios</span>
        </h3>
      </div>

      {/* 1. COSTO DIRECTO (C) */}
      <div className="bg-surface-container-high/60 p-4 rounded-2xl border border-outline-variant/20 space-y-2">
        <div className="flex justify-between items-center text-xs font-bold text-on-surface">
          <span className="uppercase tracking-wider">1. Costo Directo Total (C):</span>
          <span className="font-mono text-sm font-bold text-on-surface">{formatARS(totales.costoGlobal)}</span>
        </div>
        <div className="grid grid-cols-3 gap-1 text-[10px] text-on-surface-variant font-mono pt-1 border-t border-outline-variant/10">
          <div>
            Insumos: <strong className="text-on-surface block">{formatARS(totales.subtotalInsumos)}</strong>
          </div>
          <div>
            Mano Obra: <strong className="text-on-surface block">{formatARS(totales.subtotalManoObra)}</strong>
          </div>
          <div>
            Servicios:{' '}
            <strong className="text-on-surface block">{formatARS(totales.subtotalServiciosTercerizados)}</strong>
          </div>
        </div>
      </div>

      {/* 2. GASTOS GENERALES (GG) */}
      <div className="bg-surface-container-high/60 p-4 rounded-2xl border border-outline-variant/20 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
              2. Gastos Generales (GG)
            </label>
            <span className="text-[10px] text-on-surface-variant">
              {costosIndirectosConfig.filter((c) => c.aplica).length} activos (GG% se aplica sobre C)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResetIndirectCosts}
              className="p-1 text-on-surface-variant hover:text-primary transition-colors"
              title="Restablecer desde catálogo global"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            
            <div className="relative" ref={addMenuRef}>
              <button
                type="button"
                onClick={() => {
                  if (unaddedCatalogItems.length > 0) {
                    setShowAddMenu((prev) => !prev);
                  } else {
                    onAddCustomIndirectCost();
                  }
                }}
                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <span>+ Agregar GG</span>
                {unaddedCatalogItems.length > 0 && <ChevronDown className="w-3 h-3" />}
              </button>

              {showAddMenu && unaddedCatalogItems.length > 0 && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-surface-container-high border border-outline-variant/30 rounded-2xl shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
                    Disponibles en Catálogo:
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {unaddedCatalogItems.map((catItem) => (
                      <button
                        key={catItem.id}
                        type="button"
                        onClick={() => {
                          onAddCatalogIndirectCost?.(catItem);
                          setShowAddMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-surface-variant text-xs flex items-center justify-between transition-colors text-on-surface group"
                      >
                        <span className="truncate font-medium group-hover:text-primary">{catItem.nombre}</span>
                        <span className="font-mono text-[11px] text-on-surface-variant shrink-0 ml-2 font-bold">
                          {catItem.tipo === 'porcentual_sobre_costo' ? `${catItem.valor}%` : formatARS(catItem.valor)}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-outline-variant/20 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onAddCustomIndirectCost();
                        setShowAddMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-primary/10 text-primary text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Crear Personalizado...</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {costosIndirectosConfig.length === 0 ? (
          <div className="p-3 rounded-xl bg-surface-container/50 border border-dashed border-outline-variant/30 text-center space-y-1">
            <p className="text-[11px] text-on-surface-variant">Sin gastos generales aplicados a esta cotización.</p>
          </div>
        ) : (
          <div className="space-y-2">
          {costosIndirectosConfig.map((ci, idx) => {
            const applied = totales.costosIndirectosAplicados.find((c) => c.costoIndirectoId === ci.id);
            const montoCalculado = applied
              ? applied.montoCalculado
              : ci.tipo === 'porcentual_sobre_costo'
              ? Math.round(totales.costoGlobal * (ci.valor / 100))
              : Math.round(ci.valor);

            return (
              <div
                key={ci.id || idx}
                className="bg-surface-container p-2.5 rounded-xl border border-outline-variant/20 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-xs text-on-surface truncate flex-1">
                    <input
                      type="checkbox"
                      checked={ci.aplica}
                      onChange={() => onToggleIndirectCost(idx)}
                      className="w-4 h-4 text-primary rounded border-outline-variant"
                    />
                    <input
                      type="text"
                      value={ci.nombre}
                      onChange={(e) => onUpdateIndirectCostName(idx, e.target.value)}
                      className="bg-transparent border-none p-0 text-xs font-medium text-on-surface focus:ring-0 truncate w-full"
                    />
                  </label>

                  <div className="flex items-center gap-1 shrink-0">
                    {ci.tipo !== 'porcentual_sobre_costo' && (
                      <span className="text-[10px] text-on-surface-variant font-mono">$</span>
                    )}
                    <input
                      type="number"
                      step="0.5"
                      value={ci.valor}
                      onChange={(e) => onUpdateIndirectCostValor(idx, parseFloat(e.target.value) || 0)}
                      className="w-16 bg-surface-container-highest border border-outline-variant/30 rounded-lg px-1.5 py-0.5 text-xs text-right font-mono"
                    />
                    {ci.tipo === 'porcentual_sobre_costo' && (
                      <span className="text-[10px] text-on-surface-variant font-bold">%</span>
                    )}

                    <button
                      type="button"
                      onClick={() => onRemoveIndirectCost(idx)}
                      className="text-on-surface-variant hover:text-error p-1 rounded-full transition-colors ml-1"
                      title="Eliminar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {ci.aplica && (
                  <div className="flex justify-between items-center text-[11px] text-on-surface-variant font-mono pt-1 border-t border-outline-variant/10">
                    <span>
                      {ci.nombre} ({ci.tipo === 'porcentual_sobre_costo' ? `${ci.valor}% s/Base APU` : 'Fijo'}):
                    </span>
                    <span className="font-bold text-primary">{formatARS(montoCalculado)}</span>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        )}

        <div className="flex justify-between text-xs font-bold text-primary pt-1 border-t border-outline-variant/20">
          <span>Total Gastos Generales (GG):</span>
          <span className="font-mono">{formatARS(totales.gastosGeneralesTotal)}</span>
        </div>
      </div>

      {/* 3. BENEFICIO (B) */}
      <div className="bg-surface-container-high/60 p-4 rounded-2xl border border-outline-variant/20 space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
              3. Beneficio (B)
            </label>
            <span className="text-[10px] text-on-surface-variant">
              Calculado sobre Costo + GG ({formatARS(totales.costoTotalObra)})
            </span>
          </div>
          <div className="relative w-24">
            <input
              type="number"
              min="0"
              max="500"
              step="1"
              value={margenPorcentaje}
              onChange={(e) => onMargenPorcentajeChange(parseFloat(e.target.value) || 0)}
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl pl-3 pr-7 py-1.5 text-sm text-primary font-mono font-bold text-right focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <span className="text-xs text-primary font-bold absolute right-2.5 top-2">%</span>
          </div>
        </div>

        <div className="flex justify-between text-xs font-bold text-tertiary pt-1 border-t border-outline-variant/10">
          <span>Monto Beneficio ({margenPorcentaje}%):</span>
          <span className="font-mono font-semibold">{formatARS(totales.beneficioMonto)}</span>
        </div>
      </div>

      {/* 4. SUBTOTAL SIN IMPUESTOS (S = C + GG + B) */}
      <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/30 flex justify-between items-center text-xs font-bold text-on-surface shadow-2xs">
        <span className="uppercase tracking-wider">4. Subtotal sin Impuestos (S):</span>
        <span className="font-mono text-primary text-sm">{formatARS(totales.subtotalSinImpuestos)}</span>
      </div>

      {/* 5. IMPUESTOS (independientes calculados sobre S) */}
      <div className="bg-surface-container-high/60 p-4 rounded-2xl border border-outline-variant/20 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
              5. Impuestos ({tipoFactura})
            </label>
            <span className="text-[10px] text-on-surface-variant">Calculados sobre Subtotal (S), sin cascada</span>
          </div>
          <button
            type="button"
            onClick={onAddCustomTax}
            className="text-[11px] text-primary hover:underline font-semibold"
          >
            + Impuesto
          </button>
        </div>

        <div className="space-y-2">
          {totales.impuestosCalculados.map((tax: any, idx: number) => (
            <div
              key={tax.id || idx}
              className="bg-surface-container p-2.5 rounded-xl border border-outline-variant/20 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-xs text-on-surface truncate flex-1">
                  <input
                    type="checkbox"
                    checked={tax.aplica}
                    onChange={() => onToggleTax(idx)}
                    className="w-4 h-4 text-primary rounded border-outline-variant"
                  />
                  <span className="truncate">{tax.nombre}</span>
                </label>

                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    step="0.1"
                    value={tax.porcentaje}
                    onChange={(e) => onUpdateTaxPct(idx, parseFloat(e.target.value) || 0)}
                    className="w-16 bg-surface-container-highest border border-outline-variant/30 rounded-lg px-1.5 py-0.5 text-xs text-right font-mono"
                  />
                  <span className="text-[10px] text-on-surface-variant font-bold">%</span>

                  {idx >= 2 && (
                    <button
                      type="button"
                      onClick={() => onRemoveTax(idx)}
                      className="text-on-surface-variant hover:text-error p-1 rounded-full transition-colors ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {tax.aplica && (
                <div className="flex justify-between items-center text-[11px] text-on-surface-variant font-mono pt-1 border-t border-outline-variant/10">
                  <span>
                    {tax.nombre} ({tax.porcentaje}% s/S):
                  </span>
                  <span className="font-bold text-primary">{formatARS(tax.montoCalculado)}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between text-xs font-bold text-primary pt-1 border-t border-outline-variant/20">
          <span>Total Impuestos ({totales.impuestosPorcentajeTotal}%):</span>
          <span className="font-mono">{formatARS(totales.montoImpuestosTotal)}</span>
        </div>
      </div>

      {/* 6. PRECIO FINAL GLOBAL & COEFICIENTE K */}
      <div className="bg-primary-container/40 border border-primary/30 p-5 rounded-3xl space-y-2 text-center shadow-sm">
        <span className="text-xs uppercase tracking-wider font-bold text-primary block">
          6. PRECIO FINAL GLOBAL COTIZADO
        </span>
        <div className="font-mono text-3xl font-black text-on-surface">{formatARS(totales.precioFinalGlobal)}</div>

        <div className="pt-2 border-t border-primary/20 flex flex-col items-center justify-center gap-1">
          <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            Coeficiente de Venta K = {totales.coeficienteK.toFixed(4)}
          </span>
          <span className="text-[10px] text-on-surface-variant">
            Multiplicador aplicado a cada ítem para el cliente
          </span>
        </div>

        {mostrarDolar && totales.totalMonedaExtranjera && (
          <div className="text-xs text-tertiary font-mono font-semibold pt-1">
            Equivalente: {formatUSD(totales.totalMonedaExtranjera, nombreDolar)}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onEmitirClick}
        className="w-full py-3.5 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full transition-all flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-lg active:scale-98 cursor-pointer"
      >
        <CheckCircle className="w-5 h-5 text-on-primary" />
        <span>Emitir Presupuesto...</span>
      </button>
    </div>
  );
};

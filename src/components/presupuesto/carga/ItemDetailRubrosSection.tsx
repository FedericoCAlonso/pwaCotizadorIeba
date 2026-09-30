import React, { useState } from 'react';
import {
  Layers,
  Wrench,
  Truck,
  Trash2,
  FunctionSquare,
  AlertCircle
} from 'lucide-react';
import {
  InsumoSnapshot,
  ManoObraSnapshot,
  ServicioTercerizado,
  Insumo,
  CategoriaManoDeObra
} from '../../../core/types';
import { formatARS, roundMoney, safeNum } from '../../../core/calculations';
import { generateUUID } from '../../../core/uuid';
import { InlineMaterialSearchAdd } from './InlineMaterialSearchAdd';
import { InlineLaborAdd } from './InlineLaborAdd';
import { InlineServiceAdd } from './InlineServiceAdd';

interface ItemDetailRubrosSectionProps {
  insumosSnapshot?: InsumoSnapshot[];
  manoObraSnapshot?: ManoObraSnapshot[];
  serviciosTercerizados?: ServicioTercerizado[];
  erroresFormulas?: Record<string, string>;
  insumosMap?: Map<string, Insumo>;
  manoObraMap?: Map<string, CategoriaManoDeObra>;
  onUpdateLines: (updates: {
    insumosSnapshot?: InsumoSnapshot[];
    manoObraSnapshot?: ManoObraSnapshot[];
    serviciosTercerizados?: ServicioTercerizado[];
  }) => void;
  onOpenMaterialPicker?: () => void;
}

type ActiveRubroTab = 'materiales' | 'mano_obra' | 'servicios';

export const ItemDetailRubrosSection: React.FC<ItemDetailRubrosSectionProps> = ({
  insumosSnapshot = [],
  manoObraSnapshot = [],
  serviciosTercerizados = [],
  erroresFormulas = {},
  insumosMap = new Map(),
  manoObraMap = new Map(),
  onUpdateLines,
  onOpenMaterialPicker
}) => {
  const [activeRubro, setActiveRubro] = useState<ActiveRubroTab>('materiales');
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);

  // Totales de cada rubro
  const totalInsumos = insumosSnapshot.reduce((acc, i) => acc + (i.subtotalInsumo || 0), 0);
  const totalMo = manoObraSnapshot.reduce((acc, m) => acc + (m.subtotalManoObra || 0), 0);
  const totalServ = serviciosTercerizados.reduce(
    (acc, s) => acc + ((s.costo || 0) * (s.cantidad || 1)),
    0
  );

  // Actualizar fórmula de insumo
  const handleUpdateInsumoFormula = (idx: number, formulaStr: string) => {
    const trimmed = formulaStr.trim();
    const copy = [...insumosSnapshot];
    const ins = { ...copy[idx] };
    if (trimmed.startsWith('=')) {
      ins.formulaCantidad = trimmed;
    } else {
      ins.formulaCantidad = undefined;
      const parsed = Number(trimmed.replace(',', '.'));
      ins.cantidadUnitaria = isNaN(parsed) ? 1 : parsed;
      ins.cantidadTotal = ins.cantidadUnitaria;
      ins.subtotalInsumo = roundMoney(ins.cantidadTotal * ins.precioUnitarioCongelado);
    }
    copy[idx] = ins;
    onUpdateLines({ insumosSnapshot: copy });
  };

  // Actualizar fórmula de mano de obra
  const handleUpdateMoFormula = (idx: number, formulaStr: string) => {
    const trimmed = formulaStr.trim();
    const copy = [...manoObraSnapshot];
    const mo = { ...copy[idx] };
    if (trimmed.startsWith('=')) {
      mo.formulaHoras = trimmed;
    } else {
      mo.formulaHoras = undefined;
      const parsed = Number(trimmed.replace(',', '.'));
      mo.horasUnitarias = isNaN(parsed) ? 1 : parsed;
      mo.horasTotales = mo.horasUnitarias;
      mo.subtotalManoObra = roundMoney(mo.horasTotales * mo.costoHoraCongelado);
    }
    copy[idx] = mo;
    onUpdateLines({ manoObraSnapshot: copy });
  };

  // Eliminar línea
  const handleRemoveInsumo = (idx: number) => {
    onUpdateLines({ insumosSnapshot: insumosSnapshot.filter((_, i) => i !== idx) });
    if (selectedLineIndex === idx) setSelectedLineIndex(null);
  };

  const handleRemoveMo = (idx: number) => {
    onUpdateLines({ manoObraSnapshot: manoObraSnapshot.filter((_, i) => i !== idx) });
    if (selectedLineIndex === idx) setSelectedLineIndex(null);
  };

  const handleRemoveServ = (idx: number) => {
    onUpdateLines({
      serviciosTercerizados: serviciosTercerizados.filter((_, i) => i !== idx)
    });
    if (selectedLineIndex === idx) setSelectedLineIndex(null);
  };

  // Agregar material inline
  const handleAddMaterial = (mat: Insumo, qty: number, formula?: string) => {
    const unitPrice = roundMoney(safeNum(mat.precioActual ?? mat.precioNeto ?? mat.precioFinal));
    const subtotal = roundMoney(unitPrice * qty);
    const newIns: InsumoSnapshot = {
      insumoId: mat.id,
      materialId: mat.id,
      nombre: mat.nombre,
      marca: mat.marca,
      unidad: mat.unidadVenta || mat.unidad || 'u',
      cantidadUnitaria: qty,
      cantidadTotal: qty,
      precioUnitarioCongelado: unitPrice,
      subtotalInsumo: subtotal,
      formulaCantidad: formula
    };
    onUpdateLines({ insumosSnapshot: [...insumosSnapshot, newIns] });
  };

  // Agregar mano de obra inline (NO window.prompt)
  const handleAddLabor = (categoriaId: string, horas: number, formula?: string) => {
    const cat = manoObraMap.get(categoriaId);
    if (!cat) return;
    const rate = roundMoney(safeNum(cat.costoHora));
    const subtotal = roundMoney(rate * horas);
    const newMo: ManoObraSnapshot = {
      categoriaId: cat.id,
      nombreCategoria: cat.nombre,
      horasUnitarias: horas,
      horasTotales: horas,
      costoHoraCongelado: rate,
      subtotalManoObra: subtotal,
      formulaHoras: formula
    };
    onUpdateLines({ manoObraSnapshot: [...manoObraSnapshot, newMo] });
  };

  // Agregar servicio inline (NO window.prompt)
  const handleAddService = (descripcion: string, costo: number) => {
    const newServ: ServicioTercerizado = {
      id: `serv-${generateUUID().slice(0, 8)}`,
      descripcion,
      cantidad: 1,
      costo: roundMoney(costo)
    };
    onUpdateLines({ serviciosTercerizados: [...serviciosTercerizados, newServ] });
  };

  return (
    <div className="p-3.5 border-b border-outline-variant/30 select-none space-y-3">
      {/* Selector de Rubros */}
      <div className="flex items-center justify-between gap-1 p-0.5 bg-surface-container-high rounded-xl">
        <button
          type="button"
          onClick={() => {
            setActiveRubro('materiales');
            setSelectedLineIndex(null);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeRubro === 'materiales'
              ? 'bg-surface text-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Materiales ({insumosSnapshot.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveRubro('mano_obra');
            setSelectedLineIndex(null);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeRubro === 'mano_obra'
              ? 'bg-surface text-secondary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Mano Obra ({manoObraSnapshot.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveRubro('servicios');
            setSelectedLineIndex(null);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeRubro === 'servicios'
              ? 'bg-surface text-tertiary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Servicios ({serviciosTercerizados.length})</span>
        </button>
      </div>

      {/* ─── Pestaña Materiales ─── */}
      {activeRubro === 'materiales' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold text-on-surface">
              Total Insumos: {formatARS(totalInsumos)}
            </span>
          </div>

          {/* Formulario Inline de Búsqueda y Agregar Material */}
          <InlineMaterialSearchAdd
            insumosMap={insumosMap}
            onAddMaterial={handleAddMaterial}
            onOpenCatalog={onOpenMaterialPicker}
          />

          {insumosSnapshot.length === 0 ? (
            <p className="text-xs text-on-surface-variant/70 italic py-2">
              Sin materiales agregados a este ítem.
            </p>
          ) : (
            <div className="space-y-1.5">
              {insumosSnapshot.map((ins, idx) => {
                const isSelected = selectedLineIndex === idx;
                const errorMsg = erroresFormulas[`insumo_${idx}`];
                const formulaDisplay = ins.formulaCantidad || String(ins.cantidadTotal);

                return (
                  <div
                    key={(ins.insumoId || ins.materialId || 'ins') + '-' + idx}
                    onClick={() => setSelectedLineIndex(isSelected ? null : idx)}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary-container/20 border-primary shadow-xs'
                        : 'bg-surface-container-lowest border-outline-variant/20 hover:border-outline-variant/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-on-surface truncate">{ins.nombre}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-on-surface-variant">
                          {ins.cantidadTotal} {ins.unidad || 'u'}
                        </span>
                        <span className="font-mono font-semibold text-on-surface">
                          {formatARS(ins.subtotalInsumo)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveInsumo(idx);
                          }}
                          className="p-1 text-on-surface-variant hover:text-error rounded hover:bg-error-container/20"
                          title="Eliminar insumo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Barra de Fórmulas editable cuando la línea está seleccionada */}
                    {isSelected && (
                      <div className="mt-2 pt-2 border-t border-outline-variant/30 flex items-center gap-1.5">
                        <FunctionSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                        <input
                          type="text"
                          defaultValue={formulaDisplay}
                          onBlur={(e) => handleUpdateInsumoFormula(idx, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleUpdateInsumoFormula(idx, e.currentTarget.value);
                            }
                          }}
                          placeholder="Fórmula de cantidad =..."
                          className="w-full px-2 py-0.5 text-xs font-mono bg-surface border border-primary rounded text-on-surface focus:outline-none"
                        />
                      </div>
                    )}

                    {errorMsg && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-error">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Pestaña Mano de Obra ─── */}
      {activeRubro === 'mano_obra' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold text-on-surface">
              Total Mano de Obra: {formatARS(totalMo)}
            </span>
          </div>

          {/* Formulario Inline de Agregar Mano de Obra (NO prompts) */}
          <InlineLaborAdd manoObraMap={manoObraMap} onAddLabor={handleAddLabor} />

          {manoObraSnapshot.length === 0 ? (
            <p className="text-xs text-on-surface-variant/70 italic py-2">
              Sin mano de obra calculada para este ítem.
            </p>
          ) : (
            <div className="space-y-1.5">
              {manoObraSnapshot.map((mo, idx) => {
                const isSelected = selectedLineIndex === idx;
                const errorMsg = erroresFormulas[`mo_${idx}`];
                const formulaDisplay = mo.formulaHoras || String(mo.horasTotales);

                return (
                  <div
                    key={mo.categoriaId + idx}
                    onClick={() => setSelectedLineIndex(isSelected ? null : idx)}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-secondary-container/20 border-secondary shadow-xs'
                        : 'bg-surface-container-lowest border-outline-variant/20 hover:border-outline-variant/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-on-surface truncate">
                        {mo.nombreCategoria}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-on-surface-variant">
                          {mo.horasTotales} hs
                        </span>
                        <span className="font-mono font-semibold text-on-surface">
                          {formatARS(mo.subtotalManoObra)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMo(idx);
                          }}
                          className="p-1 text-on-surface-variant hover:text-error rounded hover:bg-error-container/20"
                          title="Eliminar mano de obra"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Barra de Fórmulas editable al seleccionar */}
                    {isSelected && (
                      <div className="mt-2 pt-2 border-t border-outline-variant/30 flex items-center gap-1.5">
                        <FunctionSquare className="w-3.5 h-3.5 text-secondary shrink-0" />
                        <input
                          type="text"
                          defaultValue={formulaDisplay}
                          onBlur={(e) => handleUpdateMoFormula(idx, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleUpdateMoFormula(idx, e.currentTarget.value);
                            }
                          }}
                          placeholder="Fórmula de horas =..."
                          className="w-full px-2 py-0.5 text-xs font-mono bg-surface border border-secondary rounded text-on-surface focus:outline-none"
                        />
                      </div>
                    )}

                    {errorMsg && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-error">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Pestaña Servicios Tercerizados ─── */}
      {activeRubro === 'servicios' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold text-on-surface">
              Total Servicios: {formatARS(totalServ)}
            </span>
          </div>

          {/* Formulario Inline de Agregar Servicio (NO prompts) */}
          <InlineServiceAdd onAddService={handleAddService} />

          {serviciosTercerizados.length === 0 ? (
            <p className="text-xs text-on-surface-variant/70 italic py-2">
              Sin servicios tercerizados ni subcontratos en este ítem.
            </p>
          ) : (
            <div className="space-y-1.5">
              {serviciosTercerizados.map((serv, idx) => (
                <div
                  key={serv.id || idx}
                  className="p-2 rounded-lg border bg-surface-container-lowest border-outline-variant/20 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-medium text-on-surface truncate">{serv.descripcion}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-semibold text-on-surface">
                      {formatARS(roundMoney((serv.costo || 0) * (serv.cantidad || 1)))}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveServ(idx)}
                      className="p-1 text-on-surface-variant hover:text-error rounded hover:bg-error-container/20"
                      title="Eliminar servicio"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

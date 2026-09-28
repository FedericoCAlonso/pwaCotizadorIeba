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
  ItemPresupuesto,
  Insumo,
  CategoriaManoDeObra
} from '../../../core/types';
import { formatARS } from '../../../core/calculations';
import { InlineMaterialSearchAdd } from './InlineMaterialSearchAdd';
import { InlineLaborAdd } from './InlineLaborAdd';
import { InlineServiceAdd } from './InlineServiceAdd';

interface TreeSheetItemBreakdownProps {
  item: ItemPresupuesto;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  onAddMaterial: (material: Insumo, cantidad: number, formula?: string) => void;
  onRemoveMaterial: (index: number) => void;
  onUpdateMaterialFormula: (index: number, formula: string) => void;
  onOpenMaterialCatalog: () => void;
  onAddLabor: (categoriaId: string, horas: number, formula?: string) => void;
  onRemoveLabor: (index: number) => void;
  onUpdateLaborFormula: (index: number, formula: string) => void;
  onAddService: (descripcion: string, costo: number) => void;
  onRemoveService: (index: number) => void;
}

type RubroTab = 'materiales' | 'mano_obra' | 'servicios';

export const TreeSheetItemBreakdown: React.FC<TreeSheetItemBreakdownProps> = ({
  item,
  insumosMap,
  manoObraMap,
  onAddMaterial,
  onRemoveMaterial,
  onUpdateMaterialFormula,
  onOpenMaterialCatalog,
  onAddLabor,
  onRemoveLabor,
  onUpdateLaborFormula,
  onAddService,
  onRemoveService
}) => {
  const [activeTab, setActiveTab] = useState<RubroTab>('materiales');
  const [selectedFormulaIndex, setSelectedFormulaIndex] = useState<{
    type: 'material' | 'mo';
    index: number;
  } | null>(null);

  const insumos = item.insumosSnapshot || [];
  const manoObra = item.manoObraSnapshot || [];
  const servicios = item.serviciosTercerizados || [];

  const totalInsumos = insumos.reduce((acc, i) => acc + (i.subtotalInsumo || 0), 0);
  const totalMo = manoObra.reduce((acc, m) => acc + (m.subtotalManoObra || 0), 0);
  const totalServ = servicios.reduce(
    (acc, s) => acc + ((s.costo || 0) * (s.cantidad || 1)),
    0
  );

  return (
    <div className="border-l-4 border-primary/50 bg-surface-container-lowest/90 px-4 py-3 border-b border-outline-variant/20 space-y-3 transition-all select-none">
      {/* ─── Pestañas de Rubros estilo píldora ─── */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-outline-variant/20 pb-2">
        <div className="flex items-center gap-1.5 p-0.5 bg-surface-container-high rounded-xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab('materiales');
              setSelectedFormulaIndex(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'materiales'
                ? 'bg-surface text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Materiales ({insumos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('mano_obra');
              setSelectedFormulaIndex(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'mano_obra'
                ? 'bg-surface text-secondary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Mano de Obra ({manoObra.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('servicios');
              setSelectedFormulaIndex(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'servicios'
                ? 'bg-surface text-tertiary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Servicios ({servicios.length})</span>
          </button>
        </div>

        {/* Subtotal del rubro activo */}
        <div className="font-mono text-xs text-on-surface-variant">
          Subtotal {activeTab === 'materiales' ? 'Insumos' : activeTab === 'mano_obra' ? 'M.O.' : 'Servicios'}:{' '}
          <strong className="text-on-surface font-bold">
            {formatARS(
              activeTab === 'materiales'
                ? totalInsumos
                : activeTab === 'mano_obra'
                ? totalMo
                : totalServ
            )}
          </strong>
        </div>
      </div>

      {/* ─── Pestaña Materiales ─── */}
      {activeTab === 'materiales' && (
        <div className="space-y-2">
          {/* Listado de Materiales */}
          {insumos.length === 0 ? (
            <p className="text-xs text-on-surface-variant/60 italic py-1">
              Sin materiales agregados. Utilizá el buscador debajo para incorporar insumos rápidamente.
            </p>
          ) : (
            <div className="divide-y divide-outline-variant/15 border border-outline-variant/20 rounded-xl overflow-hidden bg-surface">
              {insumos.map((ins, idx) => {
                const isFormulaSelected =
                  selectedFormulaIndex?.type === 'material' && selectedFormulaIndex.index === idx;
                const errorMsg = item.erroresFormulas?.[`insumo_${idx}`];
                const displayQty = ins.formulaCantidad || String(ins.cantidadTotal);

                return (
                  <div key={idx} className="p-2 hover:bg-surface-container-low transition-colors">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                        <span className="font-semibold text-on-surface truncate">{ins.nombre}</span>
                        {ins.marca && (
                          <span className="text-[10px] text-on-surface-variant/70 shrink-0">
                            ({ins.marca})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 font-mono">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFormulaIndex(
                              isFormulaSelected ? null : { type: 'material', index: idx }
                            )
                          }
                          className={`text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                            ins.formulaCantidad
                              ? 'bg-secondary-container/40 text-secondary font-bold'
                              : 'text-on-surface-variant hover:bg-surface-container'
                          }`}
                          title="Clic para editar fórmula o cantidad"
                        >
                          {ins.cantidadTotal} {ins.unidad || 'u'}
                        </button>

                        <span className="text-on-surface-variant/70 text-[11px] hidden sm:inline">
                          × {formatARS(ins.precioUnitarioCongelado)}
                        </span>

                        <span className="font-bold text-on-surface min-w-[70px] text-right">
                          {formatARS(ins.subtotalInsumo)}
                        </span>

                        <button
                          type="button"
                          onClick={() => onRemoveMaterial(idx)}
                          className="p-1 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded transition-colors cursor-pointer"
                          title="Eliminar insumo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Barra de Fórmulas interactiva si está seleccionada */}
                    {isFormulaSelected && (
                      <div className="mt-1.5 pt-1.5 border-t border-outline-variant/20 flex items-center gap-2">
                        <FunctionSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                        <input
                          type="text"
                          defaultValue={displayQty}
                          onBlur={(e) => onUpdateMaterialFormula(idx, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              onUpdateMaterialFormula(idx, e.currentTarget.value);
                              setSelectedFormulaIndex(null);
                            }
                          }}
                          placeholder="Cantidad o fórmula =..."
                          className="flex-1 px-2 py-0.5 text-xs font-mono bg-surface border border-primary rounded text-on-surface focus:outline-none"
                        />
                      </div>
                    )}

                    {errorMsg && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-error font-sans">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Buscador predictivo e inline add */}
          <div className="pt-1">
            <InlineMaterialSearchAdd
              insumosMap={insumosMap}
              onAddMaterial={onAddMaterial}
              onOpenCatalog={onOpenMaterialCatalog}
            />
          </div>
        </div>
      )}

      {/* ─── Pestaña Mano de Obra ─── */}
      {activeTab === 'mano_obra' && (
        <div className="space-y-2">
          {manoObra.length === 0 ? (
            <p className="text-xs text-on-surface-variant/60 italic py-1">
              Sin mano de obra calculada. Seleccioná una categoría e indicá horas debajo.
            </p>
          ) : (
            <div className="divide-y divide-outline-variant/15 border border-outline-variant/20 rounded-xl overflow-hidden bg-surface">
              {manoObra.map((mo, idx) => {
                const isFormulaSelected =
                  selectedFormulaIndex?.type === 'mo' && selectedFormulaIndex.index === idx;
                const errorMsg = item.erroresFormulas?.[`mo_${idx}`];
                const displayHs = mo.formulaHoras || String(mo.horasTotales);

                return (
                  <div key={idx} className="p-2 hover:bg-surface-container-low transition-colors">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-on-surface truncate flex-1 min-w-0">
                        {mo.nombreCategoria}
                      </span>

                      <div className="flex items-center gap-3 shrink-0 font-mono">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFormulaIndex(
                              isFormulaSelected ? null : { type: 'mo', index: idx }
                            )
                          }
                          className={`text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                            mo.formulaHoras
                              ? 'bg-secondary-container/40 text-secondary font-bold'
                              : 'text-on-surface-variant hover:bg-surface-container'
                          }`}
                          title="Clic para editar fórmula u horas"
                        >
                          {mo.horasTotales} hs
                        </button>

                        <span className="text-on-surface-variant/70 text-[11px] hidden sm:inline">
                          × {formatARS(mo.costoHoraCongelado)}/hs
                        </span>

                        <span className="font-bold text-on-surface min-w-[70px] text-right">
                          {formatARS(mo.subtotalManoObra)}
                        </span>

                        <button
                          type="button"
                          onClick={() => onRemoveLabor(idx)}
                          className="p-1 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded transition-colors cursor-pointer"
                          title="Eliminar mano de obra"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isFormulaSelected && (
                      <div className="mt-1.5 pt-1.5 border-t border-outline-variant/20 flex items-center gap-2">
                        <FunctionSquare className="w-3.5 h-3.5 text-secondary shrink-0" />
                        <input
                          type="text"
                          defaultValue={displayHs}
                          onBlur={(e) => onUpdateLaborFormula(idx, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              onUpdateLaborFormula(idx, e.currentTarget.value);
                              setSelectedFormulaIndex(null);
                            }
                          }}
                          placeholder="Horas o fórmula =..."
                          className="flex-1 px-2 py-0.5 text-xs font-mono bg-surface border border-secondary rounded text-on-surface focus:outline-none"
                        />
                      </div>
                    )}

                    {errorMsg && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-error font-sans">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulario rápido inline de Mano de Obra */}
          <div className="pt-1">
            <InlineLaborAdd manoObraMap={manoObraMap} onAddLabor={onAddLabor} />
          </div>
        </div>
      )}

      {/* ─── Pestaña Servicios Tercerizados ─── */}
      {activeTab === 'servicios' && (
        <div className="space-y-2">
          {servicios.length === 0 ? (
            <p className="text-xs text-on-surface-variant/60 italic py-1">
              Sin servicios tercerizados (ej: flete, zanjeo, volquetes).
            </p>
          ) : (
            <div className="divide-y divide-outline-variant/15 border border-outline-variant/20 rounded-xl overflow-hidden bg-surface">
              {servicios.map((serv, idx) => (
                <div
                  key={serv.id || idx}
                  className="p-2 flex items-center justify-between gap-2 text-xs hover:bg-surface-container-low transition-colors"
                >
                  <span className="font-semibold text-on-surface truncate flex-1 min-w-0">
                    {serv.descripcion}
                  </span>

                  <div className="flex items-center gap-3 shrink-0 font-mono">
                    <span className="font-bold text-on-surface min-w-[70px] text-right">
                      {formatARS((serv.costo || 0) * (serv.cantidad || 1))}
                    </span>

                    <button
                      type="button"
                      onClick={() => onRemoveService(idx)}
                      className="p-1 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded transition-colors cursor-pointer"
                      title="Eliminar servicio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulario rápido inline de Servicios */}
          <div className="pt-1">
            <InlineServiceAdd onAddService={onAddService} />
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useMemo } from 'react';
import { Package, HardHat, Plus, ExternalLink } from 'lucide-react';
import { ItemPresupuesto } from '../../../core/types';
import { TotalesPresupuestoResultado, formatARS } from '../../../core/calculations';
import { OnlinePriceButton } from '../../OnlinePriceButton';

interface ExpertInspectorDespieceSectionProps {
  items: ItemPresupuesto[];
  totales: TotalesPresupuestoResultado;
  onAddMaterialToCatalog?: (data: {
    nombre: string;
    unidad: string;
    precio: number | null;
    marca?: string;
  }) => void;
  onOpenListaMateriales?: () => void;
  onOpenMaterialsInCatalog?: () => void;
}

export const ExpertInspectorDespieceSection: React.FC<ExpertInspectorDespieceSectionProps> = ({
  items,
  totales,
  onAddMaterialToCatalog,
  onOpenListaMateriales,
  onOpenMaterialsInCatalog
}) => {
  // Despiece consolidado de insumos detectados en partidas a medida
  const insumosDetectados = useMemo(() => {
    const list: Array<{
      id: string;
      nombre: string;
      marca?: string;
      cantidadTotal: number;
      unidad: string;
      precioUnitario: number;
      subtotal: number;
      partidaNombre: string;
      enCatalogo: boolean;
    }> = [];

    items.forEach((it) => {
      if (it.insumosSnapshot && it.insumosSnapshot.length > 0) {
        it.insumosSnapshot.forEach((ins) => {
          list.push({
            id: ins.insumoId || '',
            nombre: ins.nombre,
            marca: ins.marca,
            cantidadTotal: ins.cantidadTotal,
            unidad: ins.unidad,
            precioUnitario: ins.precioUnitarioCongelado,
            subtotal: ins.subtotalInsumoFinal ?? ins.subtotalInsumo,
            partidaNombre: it.descripcion,
            enCatalogo: ins.precioUnitarioCongelado > 0 && !ins.insumoId?.startsWith('mat-adhoc-')
          });
        });
      }
    });
    return list;
  }, [items]);

  // Mano de obra consolidada en partidas
  const manoObraDetectada = useMemo(() => {
    const list: Array<{
      categoriaNombre: string;
      horasTotales: number;
      costoHora: number;
      subtotal: number;
      partidaNombre: string;
    }> = [];

    items.forEach((it) => {
      if (it.manoObraSnapshot && it.manoObraSnapshot.length > 0) {
        it.manoObraSnapshot.forEach((mo) => {
          list.push({
            categoriaNombre: mo.nombreCategoria,
            horasTotales: mo.horasTotales,
            costoHora: mo.costoHoraCongelado,
            subtotal: mo.subtotalManoObra,
            partidaNombre: it.descripcion
          });
        });
      }
    });
    return list;
  }, [items]);

  if (insumosDetectados.length === 0 && manoObraDetectada.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
            Despiece Detectado en YAML ({insumosDetectados.length})
          </h4>
        </div>
        <span className="text-[10px] font-mono text-on-surface-variant font-bold">
          {formatARS(totales.subtotalInsumos + totales.subtotalManoObra)}
        </span>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {insumosDetectados.map((ins, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-surface-container-highest/50 transition gap-2"
          >
            <div className="min-w-0 flex-1 pr-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-on-surface truncate">
                  {ins.cantidadTotal} {ins.unidad} {ins.nombre}
                </span>
                {ins.marca && (
                  <span className="text-[10px] text-primary/90 bg-primary/10 px-1.5 py-0.2 rounded font-bold shrink-0 border border-primary/20">
                    {ins.marca}
                  </span>
                )}
                {ins.enCatalogo ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded font-bold shrink-0">
                    ✓ Catálogo
                  </span>
                ) : ins.precioUnitario > 0 ? (
                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold shrink-0">
                    $ manual
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded font-bold shrink-0">
                    ⚠️ Sin precio
                  </span>
                )}
              </div>
              <span className="text-[10px] text-on-surface-variant truncate block">
                en {ins.partidaNombre}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Botón de búsqueda de precio online */}
              <OnlinePriceButton
                tipo="material"
                customNombre={`${ins.nombre} ${ins.marca || ''}`.trim()}
                size="xs"
                variant="icon"
              />

              {/* Botón para dar de alta al catálogo si es ad-hoc */}
              {!ins.enCatalogo && onAddMaterialToCatalog && (
                <button
                  type="button"
                  onClick={() =>
                    onAddMaterialToCatalog({
                      nombre: ins.nombre,
                      unidad: ins.unidad,
                      precio: ins.precioUnitario > 0 ? ins.precioUnitario : null,
                      marca: ins.marca
                    })
                  }
                  title="Agregar material al catálogo"
                  className="text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 font-bold transition shrink-0 cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                  Catálogo
                </button>
              )}

              <div className="text-right shrink-0 font-mono text-xs font-bold text-on-surface min-w-[50px]">
                {formatARS(ins.subtotal)}
              </div>
            </div>
          </div>
        ))}

        {manoObraDetectada.map((mo, idx) => (
          <div
            key={`mo-${idx}`}
            className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-surface-container-highest/50 transition border-t border-outline-variant/10"
          >
            <div className="min-w-0 flex-1 pr-2">
              <div className="flex items-center gap-1.5">
                <HardHat className="w-3 h-3 text-secondary shrink-0" />
                <span className="font-bold text-on-surface truncate">
                  {mo.horasTotales} h {mo.categoriaNombre}
                </span>
              </div>
              <span className="text-[10px] text-on-surface-variant truncate block">
                en {mo.partidaNombre}
              </span>
            </div>

            <div className="text-right shrink-0 font-mono text-xs font-bold text-secondary">
              {formatARS(mo.subtotal)}
            </div>
          </div>
        ))}
      </div>

      {(onOpenListaMateriales || onOpenMaterialsInCatalog) && (
        <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between gap-2 flex-wrap">
          {onOpenListaMateriales && (
            <button
              type="button"
              onClick={onOpenListaMateriales}
              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 py-1 cursor-pointer"
              title="Abrir Lista Consolidada de Materiales (BOM)"
            >
              <Package className="w-3 h-3" />
              <span>Ver Lista Completa (BOM)</span>
            </button>
          )}
          {onOpenMaterialsInCatalog && (
            <button
              type="button"
              onClick={onOpenMaterialsInCatalog}
              className="text-[11px] font-bold text-secondary hover:underline flex items-center gap-1 py-1 cursor-pointer ml-auto"
              title="Ir al Gestor de Insumos filtrado con estos materiales"
            >
              <span>Gestionar en Catálogo</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

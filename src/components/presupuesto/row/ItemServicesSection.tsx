import React from 'react';
import { GraduationCap } from 'lucide-react';
import { ItemPresupuesto } from '../../../core/types';
import { formatARS } from '../../../core/calculations';

interface ItemServicesSectionProps {
  item: ItemPresupuesto;
  calcItem: ItemPresupuesto;
}

export const ItemServicesSection: React.FC<ItemServicesSectionProps> = ({
  item,
  calcItem
}) => {
  return (
    <>
      {/* Honorarios Snapshot */}
      {item.costoServicios !== undefined && item.costoServicios > 0 && (
        <div className="p-3.5 bg-purple-500/10 rounded-xl border border-purple-500/20 space-y-1.5">
          <div className="flex justify-between items-center text-sm sm:text-base font-bold text-purple-700 dark:text-purple-300 tracking-wide">
            <span className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              <span>Honorarios y Ensayos Técnicos</span>
            </span>
            <span className="font-mono text-base font-bold">{formatARS(item.costoServicios)}</span>
          </div>
          {item.formulaHonorarios && (
            <div className="text-xs sm:text-sm text-on-surface-variant font-mono truncate">
              Fórmula: <code>{item.formulaHonorarios}</code>
            </div>
          )}
        </div>
      )}

      {/* Servicios Tercerizados Snapshot */}
      {item.serviciosTercerizados && item.serviciosTercerizados.length > 0 && (
        <div className="space-y-2 pt-2.5 border-t border-outline-variant/20">
          <div className="flex justify-between items-center text-sm sm:text-base font-bold text-purple-600 dark:text-purple-400 tracking-wide">
            <span>Servicios Tercerizados ({item.serviciosTercerizados.length})</span>
            <span className="font-mono text-base">{formatARS(item.costoServiciosTercerizados || 0)}</span>
          </div>
          <div className="space-y-1.5 divide-y divide-outline-variant/10">
            {item.serviciosTercerizados.map((st, sIdx) => (
              <div key={sIdx} className="pt-1.5 flex items-center justify-between text-on-surface-variant text-sm">
                <span className="truncate flex-1">
                  {st.descripcion} {st.nombreProveedor ? `(${st.nombreProveedor})` : ''}
                </span>
                <strong className="text-on-surface font-mono font-semibold text-sm sm:text-base">{formatARS(st.costo)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* APU Prorated Micro-Breakdown when GG absolutes exist */}
      {calcItem.ggAbsolutoProrrateado ? (
        <div className="w-full flex flex-wrap items-center justify-between gap-2.5 text-xs sm:text-sm text-on-surface-variant font-mono pt-2.5 border-t border-outline-variant/15">
          <span>Incidencia: {((calcItem.incidencia || 0) * 100).toFixed(1)}%</span>
          <span>GG Fijo Prorr.: +{formatARS(calcItem.ggAbsolutoProrrateado || 0)}</span>
          <span>Base APU: {formatARS(calcItem.baseCostoItem || 0)}</span>
          <span>Beneficio: {formatARS(calcItem.beneficioItem || 0)}</span>
        </div>
      ) : null}
    </>
  );
};

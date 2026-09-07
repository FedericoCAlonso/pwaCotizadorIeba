import React, { useMemo } from 'react';
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Info,
  Copy,
  FileCheck,
  Building2,
  MapPin,
  FileSpreadsheet,
  Calendar,
  Layers,
  Sparkles,
  Package,
  HardHat
} from 'lucide-react';
import { TotalesPresupuestoResultado, formatARS, formatUSD } from '../../../core/calculations';
import { DSLDiagnostic } from './dslParser';
import { Cliente, TipoFactura, CapituloPresupuesto, ItemPresupuesto } from '../../../core/types';
import { useToast } from '../../../contexts/ToastContext';

interface ExpertInspectorProps {
  totales: TotalesPresupuestoResultado;
  tipoFactura: TipoFactura;
  validezDias: number;
  margenPorcentaje: number | null;
  mostrarDolar: boolean;
  nombreDolar: string;
  clienteMatched?: Cliente;
  clienteQuery?: string;
  direccionObra?: string;
  capitulos: CapituloPresupuesto[];
  items: ItemPresupuesto[];
  diagnostics: DSLDiagnostic[];
  onEmitirClick?: () => void;
  onLoadExample?: () => void;
  onCopyDSL?: () => void;
}

export const ExpertInspector: React.FC<ExpertInspectorProps> = ({
  totales,
  tipoFactura,
  validezDias,
  margenPorcentaje,
  mostrarDolar,
  nombreDolar,
  clienteMatched,
  clienteQuery,
  direccionObra,
  capitulos,
  items,
  diagnostics,
  onEmitirClick,
  onLoadExample,
  onCopyDSL
}) => {
  const { toast } = useToast();

  const catalogItemsCount = items.filter((it) => Boolean(it.tareaTipoId)).length;
  const customItemsCount = items.filter((it) => !it.tareaTipoId).length;

  const warningDiagnostics = diagnostics.filter((d) => d.type === 'warning' || d.type === 'error');

  // Despiece consolidado de insumos detectados en partidas a medida
  const insumosDetectados = useMemo(() => {
    const list: Array<{
      id: string;
      nombre: string;
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

  return (
    <div className="space-y-4">
      {/* ─── 1. Card de Totales Económicos en Tiempo Real ─── */}
      <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">
              Cómputo en Vivo
            </h3>
          </div>

          <span className="text-xs font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            K: {totales.coeficienteK.toFixed(2)}
          </span>
        </div>

        {/* Precio Final Protagónico */}
        <div>
          <span className="text-xs text-on-surface-variant uppercase tracking-wider block font-semibold">
            Venta Total ({tipoFactura})
          </span>
          <div className="text-2xl sm:text-3xl font-mono font-black text-primary tracking-tight">
            {formatARS(totales.precioFinalGlobal)}
          </div>
          {mostrarDolar && totales.totalMonedaExtranjera !== undefined && (
            <div className="text-xs sm:text-sm font-mono font-bold text-on-surface-variant mt-0.5">
              {formatUSD(totales.totalMonedaExtranjera)} ({nombreDolar})
            </div>
          )}
        </div>

        {/* Desglose en Cascada */}
        <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
          <div className="p-2.5 bg-surface-container-highest/60 rounded-xl">
            <span className="text-on-surface-variant block font-medium">Insumos (C):</span>
            <span className="font-mono font-bold text-on-surface">
              {formatARS(totales.subtotalInsumos)}
            </span>
          </div>

          <div className="p-2.5 bg-surface-container-highest/60 rounded-xl">
            <span className="text-on-surface-variant block font-medium">Mano de Obra:</span>
            <span className="font-mono font-bold text-on-surface">
              {formatARS(totales.subtotalManoObra)}
            </span>
          </div>

          <div className="p-2.5 bg-surface-container-highest/60 rounded-xl">
            <span className="text-on-surface-variant block font-medium">Gastos Directos/GG:</span>
            <span className="font-mono font-bold text-on-surface">
              {formatARS(totales.gastosGeneralesTotal)}
            </span>
          </div>

          <div className="p-2.5 bg-surface-container-highest/60 rounded-xl">
            <span className="text-on-surface-variant block font-medium">Beneficio ({margenPorcentaje ?? 0}%):</span>
            <span className="font-mono font-bold text-primary">
              +{formatARS(totales.beneficioMonto)}
            </span>
          </div>
        </div>

        {totales.montoImpuestosTotal > 0 && (
          <div className="flex justify-between items-center text-xs px-2 pt-1 border-t border-outline-variant/15 text-on-surface-variant">
            <span>Impuestos discriminados ({tipoFactura}):</span>
            <span className="font-mono font-bold text-on-surface">
              {formatARS(totales.montoImpuestosTotal)}
            </span>
          </div>
        )}

        {onEmitirClick && (
          <button
            type="button"
            onClick={onEmitirClick}
            disabled={items.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-on-primary rounded-2xl text-sm font-bold shadow-xs transition active:scale-98 cursor-pointer min-h-[46px]"
          >
            <FileCheck className="w-4 h-4" />
            <span>Emitir Cotización / PDF</span>
          </button>
        )}
      </div>

      {/* ─── 2. Metadata y Vinculaciones Detectadas ─── */}
      <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
        <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          Estructura Detectada
        </h4>

        <div className="space-y-2 text-xs">
          {/* Cliente */}
          <div className="flex items-start gap-2 text-on-surface">
            <Building2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="font-bold block truncate">
                {clienteMatched ? (clienteMatched.razonSocial || clienteMatched.nombre) : (clienteQuery || 'Sin cliente asignado')}
              </span>
              {clienteMatched?.cuitDni && (
                <span className="font-mono text-[11px] text-on-surface-variant">
                  CUIT: {clienteMatched.cuitDni}
                </span>
              )}
            </div>
          </div>

          {/* Obra */}
          <div className="flex items-start gap-2 text-on-surface">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {direccionObra || (clienteMatched?.direccion ? `${clienteMatched.direccion} (Domicilio cliente)` : 'Sin dirección de obra')}
              </span>
            </div>
          </div>

          {/* Partidas y Capítulos */}
          <div className="flex items-center gap-2 text-on-surface pt-1 border-t border-outline-variant/15">
            <Layers className="w-4 h-4 text-primary shrink-0" />
            <span>
              <strong>{items.length}</strong> partidas en <strong>{capitulos.length}</strong> capítulos
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-on-surface-variant pl-6">
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold">
              {catalogItemsCount} catálogo
            </span>
            {customItemsCount > 0 && (
              <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md font-bold">
                {customItemsCount} libres
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. Insumos y Recursos Detectados en Vivo (Linting & Feedback) ─── */}
      {(insumosDetectados.length > 0 || manoObraDetectada.length > 0) && (
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
                className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-surface-container-highest/50 transition"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-on-surface truncate">
                      {ins.cantidadTotal} {ins.unidad} {ins.nombre}
                    </span>
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

                <div className="text-right shrink-0 font-mono text-xs font-bold text-on-surface">
                  {formatARS(ins.subtotal)}
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
        </div>
      )}

      {/* ─── 4. Diagnósticos y Avisos en Vivo ─── */}
      {warningDiagnostics.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-4 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Observaciones de Sintaxis ({warningDiagnostics.length})</span>
          </div>
          <ul className="space-y-1 text-amber-700/90 dark:text-amber-300/90 pl-6 list-disc">
            {warningDiagnostics.slice(0, 5).map((d, idx) => (
              <li key={idx}>
                <strong>Línea {d.line}:</strong> {d.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── 4. Acciones de Utilidad ─── */}
      <div className="flex items-center gap-2">
        {onLoadExample && (
          <button
            type="button"
            onClick={onLoadExample}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface rounded-xl text-xs font-bold border border-outline-variant/30 transition active:scale-95 cursor-pointer min-h-[38px]"
            title="Cargar texto de ejemplo para aprender la sintaxis"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Ejemplo</span>
          </button>
        )}

        {onCopyDSL && (
          <button
            type="button"
            onClick={onCopyDSL}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface rounded-xl text-xs font-bold border border-outline-variant/30 transition active:scale-95 cursor-pointer min-h-[38px]"
            title="Copiar texto de cotización al portapapeles"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar</span>
          </button>
        )}
      </div>
    </div>
  );
};

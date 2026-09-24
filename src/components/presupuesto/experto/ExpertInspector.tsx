import React from 'react';
import {
  Calculator,
  AlertTriangle,
  Copy,
  FileCheck,
  Package
} from 'lucide-react';
import { TotalesPresupuestoResultado, formatARS, formatUSD } from '../../../core/calculations';
import { DSLDiagnostic, CalculatedCell } from './dslParser';
import { Cliente, TipoFactura, CapituloPresupuesto, ItemPresupuesto } from '../../../core/types';
import { ExpertInspectorClientSection } from './ExpertInspectorClientSection';
import { ExpertInspectorCapitulosSection } from './ExpertInspectorCapitulosSection';
import { ExpertInspectorDespieceSection } from './ExpertInspectorDespieceSection';

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
  calculatedCells?: CalculatedCell[];
  clientes?: Cliente[];
  onSelectCliente?: (cliente: Cliente) => void;
  onOpenQuickClienteModal?: (initialName?: string) => void;
  onSetDireccionObra?: (direccion: string) => void;
  onEmitirClick?: () => void;
  onOpenListaMateriales?: () => void;
  onOpenMaterialsInCatalog?: () => void;
  onCopyDSL?: () => void;
  onAddMaterialToCatalog?: (data: {
    nombre: string;
    unidad: string;
    precio: number | null;
    marca?: string;
  }) => void;
}

export const ExpertInspector: React.FC<ExpertInspectorProps> = ({
  totales,
  tipoFactura,
  margenPorcentaje,
  mostrarDolar,
  nombreDolar,
  clienteMatched,
  clienteQuery,
  direccionObra,
  capitulos,
  items,
  diagnostics,
  calculatedCells = [],
  clientes = [],
  onSelectCliente,
  onOpenQuickClienteModal,
  onSetDireccionObra,
  onEmitirClick,
  onOpenListaMateriales,
  onOpenMaterialsInCatalog,
  onCopyDSL,
  onAddMaterialToCatalog
}) => {
  const warningDiagnostics = diagnostics.filter((d) => d.type === 'warning' || d.type === 'error');

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
            <div className="text-xs font-mono text-on-surface-variant mt-0.5">
              ≈ {formatUSD(totales.totalMonedaExtranjera)} ({nombreDolar})
            </div>
          )}
        </div>

        {/* Desglose Económico */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-outline-variant/15">
          <div>
            <span className="text-[11px] text-on-surface-variant block">Materiales:</span>
            <span className="font-mono font-bold text-on-surface">
              {formatARS(totales.subtotalInsumos)}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-on-surface-variant block">Mano de Obra:</span>
            <span className="font-mono font-bold text-on-surface">
              {formatARS(totales.subtotalManoObra)}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-on-surface-variant block">Beneficio ({margenPorcentaje ?? 35}%):</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              +{formatARS(totales.beneficioMonto)}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-on-surface-variant block">Gastos / Contingencia:</span>
            <span className="font-mono font-bold text-on-surface">
              +{formatARS(totales.gastosGeneralesTotal + (totales.montoMargenRiesgo || 0))}
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

      {/* ─── 2. Metadata y Vinculaciones Detectadas (Cliente & Obra) ─── */}
      <ExpertInspectorClientSection
        clienteMatched={clienteMatched}
        clienteQuery={clienteQuery}
        direccionObra={direccionObra}
        clientes={clientes}
        onSelectCliente={onSelectCliente}
        onOpenQuickClienteModal={onOpenQuickClienteModal}
        onSetDireccionObra={onSetDireccionObra}
      />

      {/* ─── 3. Capítulos & Partidas Detectados en Tiempo Real ─── */}
      <ExpertInspectorCapitulosSection capitulos={capitulos} items={items} />

      {/* ─── 4. Celdas de Cálculo y Variables en Vivo ─── */}
      {calculatedCells && calculatedCells.length > 0 && (
        <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center font-mono font-black text-xs">
                =
              </div>
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                Celdas de Cálculo ({calculatedCells.length})
              </h4>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">
              Fórmulas en cascada
            </span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {calculatedCells.map((cell, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-surface-container-high/40 hover:bg-surface-container-highest/60 transition gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-bold text-primary">
                      {cell.name}
                    </span>
                    {cell.isFormula ? (
                      <span className="text-[10px] font-mono text-on-surface-variant truncate">
                        = {cell.rawExpression.replace(/^=\s*/, '')}
                      </span>
                    ) : (
                      <span className="text-[10px] text-on-surface-variant">
                        (constante)
                      </span>
                    )}
                    {cell.scope === 'local' && (
                      <span className="text-[9px] bg-secondary/15 text-secondary px-1 py-0.2 rounded font-bold">
                        local
                      </span>
                    )}
                  </div>
                  {cell.error && (
                    <span className="text-[10px] text-red-500 block truncate font-medium">
                      ⚠️ {cell.error}
                    </span>
                  )}
                </div>

                <div className="text-right shrink-0 font-mono text-xs font-black text-on-surface">
                  {cell.evaluatedValue.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 5. Despiece Consolidado (Materiales y Mano de Obra) ─── */}
      <ExpertInspectorDespieceSection
        items={items}
        totales={totales}
        onAddMaterialToCatalog={onAddMaterialToCatalog}
        onOpenListaMateriales={onOpenListaMateriales}
        onOpenMaterialsInCatalog={onOpenMaterialsInCatalog}
      />

      {/* ─── 6. Diagnósticos y Avisos en Vivo ─── */}
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

      {/* ─── 7. Acciones de Utilidad ─── */}
      <div className="flex items-center gap-2">
        {onOpenListaMateriales && (
          <button
            type="button"
            onClick={onOpenListaMateriales}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface rounded-xl text-xs font-bold border border-outline-variant/30 transition active:scale-95 cursor-pointer min-h-[38px]"
            title="Ver lista de materiales consolidada (BOM), exportar a Excel o enviar por WhatsApp"
          >
            <Package className="w-3.5 h-3.5 text-primary" />
            <span>Materiales (BOM)</span>
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

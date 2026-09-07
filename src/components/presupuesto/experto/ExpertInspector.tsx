import React, { useMemo, useState } from 'react';
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
  HardHat,
  Plus,
  Search,
  UserPlus,
  Phone,
  Mail,
  ChevronDown,
  X
} from 'lucide-react';
import { TotalesPresupuestoResultado, formatARS, formatUSD } from '../../../core/calculations';
import { DSLDiagnostic, CalculatedCell } from './dslParser';
import { Cliente, TipoFactura, CapituloPresupuesto, ItemPresupuesto } from '../../../core/types';
import { useToast } from '../../../contexts/ToastContext';
import { OnlinePriceButton } from '../../OnlinePriceButton';

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
  onLoadExample?: () => void;
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
  calculatedCells = [],
  clientes = [],
  onSelectCliente,
  onOpenQuickClienteModal,
  onSetDireccionObra,
  onEmitirClick,
  onLoadExample,
  onCopyDSL,
  onAddMaterialToCatalog
}) => {
  const { toast } = useToast();
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  const catalogItemsCount = items.filter((it) => Boolean(it.tareaTipoId)).length;
  const customItemsCount = items.filter((it) => !it.tareaTipoId).length;

  const warningDiagnostics = diagnostics.filter((d) => d.type === 'warning' || d.type === 'error');

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

  const filteredClientesForPicker = useMemo(() => {
    if (!clientSearchQuery.trim()) return clientes.slice(0, 10);
    const q = clientSearchQuery.toLowerCase().trim();
    return clientes.filter(
      (c) =>
        (c.razonSocial && c.razonSocial.toLowerCase().includes(q)) ||
        (c.nombre && c.nombre.toLowerCase().includes(q)) ||
        (c.cuitDni && c.cuitDni.includes(q)) ||
        (c.cuit && c.cuit.includes(q)) ||
        (c.direccion && c.direccion.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [clientes, clientSearchQuery]);

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
      <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Comitente & Obra
            </h4>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsClientPickerOpen(!isClientPickerOpen)}
              className="text-[11px] font-bold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
            >
              <span>{isClientPickerOpen ? 'Cerrar' : clienteMatched ? 'Cambiar' : 'Buscar'}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isClientPickerOpen ? 'rotate-180' : ''}`} />
            </button>
            {onOpenQuickClienteModal && (
              <button
                type="button"
                onClick={() => onOpenQuickClienteModal(clienteQuery || '')}
                className="text-[11px] font-bold text-secondary hover:text-secondary/80 bg-secondary/10 hover:bg-secondary/20 p-1 rounded-lg transition cursor-pointer"
                title="Nuevo Cliente rápido"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Selector Desplegable de Clientes */}
        {isClientPickerOpen && (
          <div className="p-3 bg-surface border border-outline-variant/30 rounded-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150 shadow-sm">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, CUIT o dirección..."
                className="w-full bg-surface-container-high text-xs rounded-xl pl-8 pr-3 py-1.5 border border-outline-variant/30 focus:border-primary focus:outline-none"
                autoFocus
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {filteredClientesForPicker.length === 0 ? (
                <div className="text-[11px] text-on-surface-variant text-center py-2">
                  No se encontraron contactos.
                </div>
              ) : (
                filteredClientesForPicker.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelectCliente?.(c);
                      setIsClientPickerOpen(false);
                      setClientSearchQuery('');
                    }}
                    className="w-full text-left p-2 rounded-xl text-xs hover:bg-surface-container-highest transition flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-on-surface block truncate">
                        {c.razonSocial || c.nombre}
                      </span>
                      <span className="text-[10px] text-on-surface-variant block truncate">
                        {c.cuitDni ? `CUIT: ${c.cuitDni} · ` : ''}{c.condicionIVA || 'Consumidor Final'}{c.direccion ? ` · ${c.direccion}` : ''}
                      </span>
                    </div>
                    {c.id === clienteMatched?.id && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>

            {onOpenQuickClienteModal && (
              <button
                type="button"
                onClick={() => {
                  onOpenQuickClienteModal(clientSearchQuery);
                  setIsClientPickerOpen(false);
                  setClientSearchQuery('');
                }}
                className="w-full py-1.5 px-2 bg-primary text-on-primary rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Registrar "{clientSearchQuery || 'Nuevo Cliente'}" en Contactos</span>
              </button>
            )}
          </div>
        )}

        {/* Estado y Ficha del Cliente */}
        <div className="space-y-2.5 text-xs">
          {clienteMatched ? (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Contacto Registrado</span>
                </span>
                {clienteMatched.condicionIVA && (
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                    {clienteMatched.condicionIVA}
                  </span>
                )}
              </div>

              <div className="font-bold text-sm text-on-surface">
                {clienteMatched.razonSocial || clienteMatched.nombre}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-on-surface-variant pt-1 border-t border-emerald-500/15">
                {(clienteMatched.cuitDni || clienteMatched.cuit) && (
                  <span className="font-mono">
                    CUIT: {clienteMatched.cuitDni || clienteMatched.cuit}
                  </span>
                )}
                {clienteMatched.telefono && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-on-surface-variant" />
                    <span>{clienteMatched.telefono}</span>
                  </span>
                )}
                {clienteMatched.email && (
                  <span className="flex items-center gap-1 col-span-2 truncate">
                    <Mail className="w-3 h-3 text-on-surface-variant shrink-0" />
                    <span className="truncate">{clienteMatched.email}</span>
                  </span>
                )}
                {clienteMatched.direccion && (
                  <span className="col-span-2 text-[11px]">
                    Fiscal: {clienteMatched.direccion}{clienteMatched.localidad ? `, ${clienteMatched.localidad}` : ''}
                  </span>
                )}
              </div>

              {clienteMatched.direccion && direccionObra !== clienteMatched.direccion && onSetDireccionObra && (
                <button
                  type="button"
                  onClick={() => onSetDireccionObra(clienteMatched.direccion!)}
                  className="w-full text-left text-[11px] font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 p-2 rounded-xl flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Usar como obra: <strong>{clienteMatched.direccion}</strong></span>
                  </span>
                  <span className="text-[10px] font-bold shrink-0 ml-1">Copiar</span>
                </button>
              )}
            </div>
          ) : clienteQuery ? (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>No Registrado</span>
                </span>
                <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80">
                  Texto en YAML
                </span>
              </div>

              <div className="font-bold text-sm text-on-surface">
                "{clienteQuery}"
              </div>

              <p className="text-[11px] text-on-surface-variant">
                Este cliente no figura en tu base de contactos. Podés registrarlo rápidamente con CUIT y condición fiscal:
              </p>

              {onOpenQuickClienteModal && (
                <button
                  type="button"
                  onClick={() => onOpenQuickClienteModal(clienteQuery)}
                  className="w-full py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registrar "{clienteQuery}" en Contactos</span>
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-surface-container-high/60 border border-outline-variant/20 space-y-2 text-center">
              <span className="text-xs text-on-surface-variant block">
                Sin cliente asignado a la cotización
              </span>
              <button
                type="button"
                onClick={() => setIsClientPickerOpen(true)}
                className="w-full py-2 px-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Asignar o Registrar Cliente</span>
              </button>
            </div>
          )}

          {/* Obra */}
          <div className="flex items-start gap-2 text-on-surface pt-2 border-t border-outline-variant/15">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] uppercase tracking-wider text-on-surface-variant font-bold">
                Dirección de Obra
              </span>
              <span className="font-medium block truncate">
                {direccionObra || 'Sin dirección de obra especificada'}
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

      {/* ─── Celdas de Cálculo y Variables en Vivo ─── */}
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

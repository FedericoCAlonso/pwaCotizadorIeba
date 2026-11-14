import React, { useMemo, useState } from 'react';
import { Percent, Plus, Receipt, Trash2, X } from 'lucide-react';
import { formatARS } from '../../../core/calculations';
import { TotalesPresupuestoResultado } from '../../../core/calculations';
import {
  GastoPresupuestoConfig,
  Presupuesto,
  TipoFactura
} from '../../../core/types';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

interface MobileGastosIndirectosSheetProps {
  isOpen: boolean;
  onClose: () => void;
  gastos: GastoPresupuestoConfig[];
  totales: TotalesPresupuestoResultado;
  presupuesto: Presupuesto;
  onToggleGasto: (gastoId: string) => void;
  onUpdateValorGasto: (gastoId: string, valor: number) => void;
  onUpdateParametroGasto: (gastoId: string, paramId: string, valor: number) => void;
  onAddGastoPuntual: (
    nombre: string,
    modalidad: 'monto_fijo' | 'porcentual',
    valor: number
  ) => void;
  onDeleteGastoPuntual: (gastoId: string) => void;
  onUpdateMetadata: (patch: Partial<Presupuesto>) => void;
}

const TIPOS_FACTURA: TipoFactura[] = [
  'Factura A',
  'Factura B',
  'Factura C',
  'Presupuesto X (Sin Factura)'
];

function getDestinoLabel(destino?: string): string {
  if (destino === 'materiales') return 's/ Materiales';
  if (destino === 'mano_obra') return 's/ Mano de obra';
  if (destino === 'servicios') return 's/ Servicios';
  return 'Indirecto';
}

/**
 * Sheet móvil para configurar gastos indirectos, agregar gastos puntuales de obra
 * y ajustar beneficio/margen de riesgo de forma aislada por cotización.
 */
export const MobileGastosIndirectosSheet: React.FC<MobileGastosIndirectosSheetProps> = ({
  isOpen,
  onClose,
  gastos,
  totales,
  presupuesto,
  onToggleGasto,
  onUpdateValorGasto,
  onUpdateParametroGasto,
  onAddGastoPuntual,
  onDeleteGastoPuntual,
  onUpdateMetadata
}) => {
  useEscapeKey(isOpen, onClose, { pushHistory: false });

  const [showAddForm, setShowAddForm] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaModalidad, setNuevaModalidad] = useState<'monto_fijo' | 'porcentual'>('monto_fijo');
  const [nuevoValor, setNuevoValor] = useState('');

  const montosPorId = useMemo(() => {
    const map = new Map<string, number>();
    for (const gd of totales.gastosDesglosados) {
      map.set(gd.id, gd.montoCalculado);
    }
    return map;
  }, [totales.gastosDesglosados]);

  const totalGastosActivos = useMemo(
    () =>
      totales.gastosDesglosados.reduce(
        (acc, gd) => acc + (gd.aplica ? gd.montoCalculado : 0),
        0
      ),
    [totales.gastosDesglosados]
  );

  if (!isOpen) return null;

  const canAdd =
    nuevoNombre.trim().length > 0 &&
    nuevoValor.trim().length > 0 &&
    Number(nuevoValor) >= 0;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    onAddGastoPuntual(nuevoNombre.trim(), nuevaModalidad, Number(nuevoValor) || 0);
    setNuevoNombre('');
    setNuevoValor('');
    setShowAddForm(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Configurar gastos indirectos y márgenes"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface text-on-surface shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-outline-variant/60 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Receipt className="h-5 w-5 shrink-0 text-primary" />
            <h2 className="truncate text-base font-semibold text-on-surface">
              Gastos indirectos y márgenes
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar configuración de gastos"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid shrink-0 grid-cols-3 gap-2 border-b border-outline-variant/40 bg-surface-container-low px-4 py-2.5 text-xs">
          <div>
            <span className="block text-[10px] uppercase tracking-wide text-on-surface-variant">
              Directo
            </span>
            <strong className="font-semibold text-on-surface">
              {formatARS(totales.costoDirectoBase ?? totales.costoGlobal)}
            </strong>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wide text-on-surface-variant">
              Gastos ind.
            </span>
            <strong className="font-semibold text-primary">
              {formatARS(totalGastosActivos)}
            </strong>
          </div>
          <div className="text-right">
            <span className="block text-[10px] uppercase tracking-wide text-on-surface-variant">
              Total final
            </span>
            <strong className="font-bold text-primary" data-testid="sheet-total-final">
              {formatARS(totales.precioFinalGlobal)}
            </strong>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Gastos aplicables ({gastos.filter(g => g.aplica).length})
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(v => !v)}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary-container px-3 text-xs font-semibold text-on-primary-container"
              >
                <Plus className="h-4 w-4" />
                <span>Gasto puntual</span>
              </button>
            </div>

            {showAddForm && (
              <form
                onSubmit={handleAddSubmit}
                className="space-y-2.5 rounded-2xl border border-primary/30 bg-surface-container-low p-3"
              >
                <input
                  type="text"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Alquiler de andamio / Peajes"
                  aria-label="Descripción del gasto puntual"
                  className="min-h-[44px] w-full rounded-xl border border-outline-variant bg-surface px-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                  autoFocus
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNuevaModalidad('monto_fijo')}
                    className={`min-h-[44px] rounded-xl border px-3 text-xs font-semibold ${
                      nuevaModalidad === 'monto_fijo'
                        ? 'border-primary bg-primary-container text-on-primary-container'
                        : 'border-outline-variant bg-surface text-on-surface-variant'
                    }`}
                  >
                    Monto fijo ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNuevaModalidad('porcentual')}
                    className={`min-h-[44px] rounded-xl border px-3 text-xs font-semibold ${
                      nuevaModalidad === 'porcentual'
                        ? 'border-primary bg-primary-container text-on-primary-container'
                        : 'border-outline-variant bg-surface text-on-surface-variant'
                    }`}
                  >
                    Porcentual (%)
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={nuevoValor}
                    onChange={(e) => setNuevoValor(e.target.value)}
                    placeholder={nuevaModalidad === 'porcentual' ? '% ej: 8' : '$ ej: 25000'}
                    aria-label="Valor del gasto puntual"
                    className="min-h-[44px] flex-1 rounded-xl border border-outline-variant bg-surface px-3 text-sm font-mono text-on-surface focus:border-primary focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!canAdd}
                    className="min-h-[44px] rounded-xl bg-primary px-4 text-xs font-semibold text-on-primary disabled:opacity-40"
                  >
                    Agregar
                  </button>
                </div>
              </form>
            )}

            {gastos.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-outline-variant px-4 py-5 text-center text-xs text-on-surface-variant">
                No hay gastos indirectos cargados en el catálogo. Podés sumar un gasto puntual para esta obra arriba.
              </p>
            ) : (
              <div className="space-y-2">
                {gastos.map((g) => {
                  const montoCalc = g.aplica ? montosPorId.get(g.id) ?? 0 : 0;
                  const isCustom = !g.costoIndirectoId;
                  const isPorcentual = g.modalidad === 'porcentual';
                  const isParametrico = g.modalidad === 'parametrico';

                  return (
                    <div
                      key={g.id}
                      className={`rounded-2xl border p-3 transition-colors ${
                        g.aplica
                          ? 'border-primary/40 bg-surface-container-low'
                          : 'border-outline-variant/60 bg-surface opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={g.aplica}
                          aria-label={`Aplicar ${g.nombre}`}
                          onClick={() => onToggleGasto(g.id)}
                          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                              g.aplica ? 'bg-primary' : 'bg-outline-variant'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${
                                g.aplica ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-on-surface">
                              {g.nombre}
                            </p>
                            <p className="text-[11px] text-on-surface-variant">
                              {isParametrico
                                ? 'Paramétrico'
                                : isPorcentual
                                  ? `${g.valor}% ${getDestinoLabel(g.destino)}`
                                  : `Fijo ${getDestinoLabel(g.destino)}`}
                            </p>
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-1">
                          {g.aplica && (
                            <span className="text-xs font-semibold text-primary">
                              +{formatARS(montoCalc)}
                            </span>
                          )}
                          {isCustom && (
                            <button
                              type="button"
                              aria-label={`Eliminar gasto ${g.nombre}`}
                              onClick={() => onDeleteGastoPuntual(g.id)}
                              className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {g.aplica && !isParametrico && (
                        <div className="mt-2 flex items-center gap-2 pl-14">
                          <label className="text-xs text-on-surface-variant" htmlFor={`gasto-val-${g.id}`}>
                            {isPorcentual ? 'Porcentaje (%)' : 'Monto ($)'}
                          </label>
                          <input
                            id={`gasto-val-${g.id}`}
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            value={g.valor}
                            onChange={(e) => {
                              const parsed = Number(e.target.value);
                              if (Number.isFinite(parsed) && parsed >= 0) {
                                onUpdateValorGasto(g.id, parsed);
                              }
                            }}
                            aria-label={`Valor de ${g.nombre}`}
                            className="min-h-[44px] w-28 rounded-xl border border-outline-variant bg-surface px-2.5 text-right text-sm font-mono text-on-surface focus:border-primary focus:outline-none"
                          />
                        </div>
                      )}

                      {g.aplica && isParametrico && g.parametros && g.parametros.length > 0 && (
                        <div className="mt-2 space-y-2 pl-14">
                          {g.parametros.map((p) => {
                            const valActual =
                              g.valoresParametros?.[p.id] ?? Number(p.valorDefault ?? 0);
                            return (
                              <div key={p.id} className="flex items-center justify-between gap-2">
                                <label
                                  htmlFor={`gasto-param-${g.id}-${p.id}`}
                                  className="text-xs text-on-surface-variant"
                                >
                                  {p.nombre}
                                </label>
                                <input
                                  id={`gasto-param-${g.id}-${p.id}`}
                                  type="number"
                                  step="any"
                                  inputMode="decimal"
                                  value={valActual}
                                  onChange={(e) => {
                                    const parsed = Number(e.target.value);
                                    if (Number.isFinite(parsed)) {
                                      onUpdateParametroGasto(g.id, p.id, parsed);
                                    }
                                  }}
                                  className="min-h-[44px] w-24 rounded-xl border border-outline-variant bg-surface px-2.5 text-right text-sm font-mono text-on-surface focus:border-primary focus:outline-none"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-2.5 border-t border-outline-variant/50 pt-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              <Percent className="h-3.5 w-3.5" />
              <span>Márgenes y facturación</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-on-surface-variant">
                  Beneficio (%)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  inputMode="decimal"
                  value={presupuesto.beneficioPorcentaje ?? 20}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (Number.isFinite(val) && val >= 0) {
                      onUpdateMetadata({ beneficioPorcentaje: val });
                    }
                  }}
                  aria-label="Beneficio porcentual"
                  className="min-h-[44px] w-full rounded-xl border border-outline-variant bg-surface px-3 text-sm font-mono text-on-surface focus:border-primary focus:outline-none"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-on-surface-variant">
                  Margen de riesgo (%)
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={presupuesto.margenRiesgoPorcentaje ?? 0}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (Number.isFinite(val) && val >= 0) {
                      onUpdateMetadata({ margenRiesgoPorcentaje: val });
                    }
                  }}
                  aria-label="Margen de riesgo porcentual"
                  className="min-h-[44px] w-full rounded-xl border border-outline-variant bg-surface px-3 text-sm font-mono text-on-surface focus:border-primary focus:outline-none"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-on-surface-variant">
                Tipo de facturación
              </span>
              <select
                value={presupuesto.tipoFactura}
                onChange={(e) =>
                  onUpdateMetadata({ tipoFactura: e.target.value as TipoFactura })
                }
                aria-label="Tipo de facturación"
                className="min-h-[44px] w-full rounded-xl border border-outline-variant bg-surface px-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              >
                {TIPOS_FACTURA.map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </label>
          </section>
        </div>

        <footer className="shrink-0 border-t border-outline-variant/60 bg-surface px-4 py-3 pb-safe">
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-on-primary shadow-sm active:scale-[0.99]"
          >
            Listo
          </button>
        </footer>
      </div>
    </div>
  );
};

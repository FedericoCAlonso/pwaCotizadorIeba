import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  Plus,
  ReceiptText,
  Save,
  Share2,
  Trash2,
  Wrench
} from 'lucide-react';
import { TERMINOLOGY } from '../../../config/terminology';
import { formatARS } from '../../../core/calculations';
import {
  evaluarVisibilidadParametroEnEsquema,
  NotebookDocumentContext
} from '../../../core/notebookDocument';
import { AppConfig, ItemPresupuesto, Presupuesto, TareaTipo } from '../../../core/types';
import { useNotebookDocumentViewModel } from '../../../viewmodels/useNotebookDocumentViewModel';
import { NotebookClientPreviewDrawer } from '../notebook/NotebookClientPreviewDrawer';
import { MobileQuickFreeItemModal } from './MobileQuickFreeItemModal';
import { MobileSchemaParameterField } from './MobileSchemaParameterField';
import { MobileShareExportSheet } from './MobileShareExportSheet';
import { MobileTareaTipoPickerSheet } from './MobileTareaTipoPickerSheet';

interface MobileEjecutarViewProps {
  presupuestoId?: string;
  initialPresupuesto?: Partial<Presupuesto>;
  config: AppConfig;
  catalogOverride?: Partial<Omit<NotebookDocumentContext, 'config'>>;
  onBack: () => void;
  onSaved?: (id: string) => void;
}

/**
 * Vista móvil de cotización ("modo Ejecutar"): formulario auto-generado a partir
 * del esquema de Trabajos Tipo, total vivo fijo abajo, ítem libre rápido de 3 campos y compartir.
 */
export const MobileEjecutarView: React.FC<MobileEjecutarViewProps> = ({
  presupuestoId,
  initialPresupuesto,
  config,
  catalogOverride,
  onBack,
  onSaved
}) => {
  const vm = useNotebookDocumentViewModel({
    config,
    presupuestoId,
    initialPresupuesto,
    initialPassMode: 'valorizacion',
    catalogOverride,
    onSaved: p => onSaved?.(p.id)
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [freeItemOpen, setFreeItemOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const tareaById = useMemo(() => {
    const map = new Map<string, TareaTipo>();
    for (const t of vm.contexto.tareasTipo) map.set(t.id, t);
    return map;
  }, [vm.contexto.tareasTipo]);

  const renderItemCard = (item: ItemPresupuesto) => {
    const subtotalInfo = vm.subtotalesPorItemId[item.id];
    const subtotalVal =
      subtotalInfo?.precioVenta ??
      item.precioVentaTotal ??
      item.precioVentaUnitario * item.cantidad;
    const tareaTipo = item.tareaTipoId ? tareaById.get(item.tareaTipoId) : undefined;
    const rawOverrides = item.overridesParametros ?? item.valoresVariables ?? {};
    const numericOverrides: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawOverrides)) {
      const n = Number(v);
      if (Number.isFinite(n)) numericOverrides[k] = n;
    }

    const paramsEsquema = tareaTipo?.parametros ?? [];

    return (
      <article
        key={item.id}
        className="space-y-3 rounded-2xl border border-m3-outline-variant/70 bg-m3-surface p-4 shadow-xs"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-m3-surface-container-high px-2 py-0.5 text-[11px] font-medium text-m3-on-surface-variant">
                {tareaTipo ? TERMINOLOGY.trabajoTipoSingular : TERMINOLOGY.elementoLibre}
              </span>
              {subtotalInfo?.estadoValorizacion === 'sin_valorizar' && (
                <span className="rounded-md bg-m3-secondary-container px-2 py-0.5 text-[11px] font-medium text-m3-on-secondary-container">
                  {TERMINOLOGY.estadoSinValorizar}
                </span>
              )}
            </div>
            <h3 className="mt-1 text-base font-semibold leading-snug text-m3-on-surface">
              {item.descripcion}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-sm font-bold text-m3-primary">{formatARS(subtotalVal)}</span>
            <button
              type="button"
              aria-label={`Quitar ${item.descripcion}`}
              onClick={() => vm.eliminarItemPorId(item.id)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-m3-on-surface-variant hover:bg-m3-error-container hover:text-m3-on-error-container"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {tareaTipo && paramsEsquema.length > 0 ? (
          <div className="space-y-2">
            {paramsEsquema
              .filter(p => evaluarVisibilidadParametroEnEsquema(p, numericOverrides))
              .map(param => {
                const rawVal =
                  numericOverrides[param.id] ??
                  (Number.isFinite(Number(param.valorDefault)) ? Number(param.valorDefault) : 0);
                return (
                  <MobileSchemaParameterField
                    key={`${item.id}-${param.id}`}
                    param={param}
                    idPrefix={`item-${item.id}`}
                    value={rawVal}
                    onChange={nextVal => vm.actualizarParametroDeItem(item.id, param.id, nextVal)}
                  />
                );
              })}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl bg-m3-surface-container-low px-3 py-2 text-xs text-m3-on-surface-variant">
            <span>
              Cantidad: <strong className="text-m3-on-surface">{item.cantidad}</strong>{' '}
              {item.unidad || 'u'}
            </span>
            <span>
              Unitario:{' '}
              <strong className="text-m3-on-surface">
                {formatARS(item.precioManual ?? item.precioVentaUnitario)}
              </strong>
            </span>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-m3-surface-container-lowest text-m3-on-surface">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-m3-outline-variant bg-m3-surface/95 px-3 py-2.5 backdrop-blur-sm">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-m3-on-surface hover:bg-m3-surface-container"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <input
          type="text"
          value={vm.presupuesto.direccionObra || ''}
          onChange={e => vm.actualizarMetadataPresupuesto({ direccionObra: e.target.value })}
          placeholder={vm.presupuesto.numero || 'Obra o referencia'}
          aria-label="Obra o referencia"
          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-m3-on-surface focus:outline-none"
        />

        <button
          type="button"
          onClick={vm.toggleVistaPrevia}
          aria-label="Vista previa al cliente"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-m3-on-surface-variant hover:bg-m3-surface-container"
        >
          <Eye className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => void vm.guardar()}
          aria-label="Guardar cotización"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-m3-primary-container px-3.5 text-xs font-semibold text-m3-on-primary-container"
        >
          <Save className="h-4 w-4" />
          <span>{vm.saveStatus === 'saved' && !vm.isDirty ? 'Guardado' : 'Guardar'}</span>
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2.5 border-b border-m3-outline-variant/60 bg-m3-surface px-4 py-3">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-m3-primary px-3 py-2.5 text-sm font-semibold text-m3-on-primary shadow-sm active:scale-[0.99]"
        >
          <Wrench className="h-4 w-4 shrink-0" />
          <span className="truncate">+ {TERMINOLOGY.trabajoTipoSingular}</span>
        </button>

        <button
          type="button"
          onClick={() => setFreeItemOpen(true)}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-m3-outline bg-m3-surface-container-low px-3 py-2.5 text-sm font-semibold text-m3-on-surface active:scale-[0.99]"
        >
          <Plus className="h-4 w-4 shrink-0 text-m3-primary" />
          <span className="truncate">{TERMINOLOGY.elementoLibre}</span>
        </button>
      </div>

      <main className="flex-1 space-y-3 p-4 pb-32">
        {vm.alcanceYAdvertencias.advertenciasVisibles.length > 0 && (
          <section className="space-y-1.5 rounded-2xl border border-amber-300/60 bg-amber-50/70 p-3 text-xs text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>{TERMINOLOGY.seccionAlcanceYSupuestos}</span>
            </div>
            <ul className="space-y-1 pl-5 list-disc">
              {vm.alcanceYAdvertencias.advertenciasVisibles.map(adv => (
                <li key={adv.id}>{adv.texto}</li>
              ))}
            </ul>
          </section>
        )}

        {vm.presupuesto.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-m3-outline-variant bg-m3-surface px-6 py-12 text-center">
            <ReceiptText className="h-10 w-10 text-m3-primary/70" />
            <h2 className="mt-3 text-base font-semibold text-m3-on-surface">
              Cotización rápida en obra
            </h2>
            <p className="mt-1 max-w-xs text-xs text-m3-on-surface-variant">
              Elegí un {TERMINOLOGY.trabajoTipoSingular.toLowerCase()} precargado para completar
              sus medidas o sumá un {TERMINOLOGY.elementoLibre.toLowerCase()} en tres campos.
            </p>
          </div>
        ) : (
          <div className="space-y-3">{vm.presupuesto.items.map(renderItemCard)}</div>
        )}
      </main>

      <footer
        aria-label="Total en vivo"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-m3-outline-variant bg-m3-surface/95 px-4 py-3 shadow-lg backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-m3-on-surface-variant">
                Total estimado
              </span>
              {vm.esTotalParcial && (
                <span className="rounded-full bg-m3-secondary-container px-2 py-0.5 text-[10px] font-semibold text-m3-on-secondary-container">
                  Parcial ({vm.cantidadSinValorizar})
                </span>
              )}
            </div>
            <p className="truncate text-xl font-bold text-m3-primary" data-testid="mobile-live-total">
              {formatARS(vm.totales.precioFinalGlobal)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-m3-primary px-5 text-sm font-semibold text-m3-on-primary shadow-sm active:scale-95"
          >
            <Share2 className="h-4 w-4" />
            <span>Compartir</span>
          </button>
        </div>
      </footer>

      <MobileTareaTipoPickerSheet
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        buscarTareasTipo={vm.buscarTareasTipoMovil}
        onSelectAndAdd={vm.agregarTareaTipoDesdeEsquema}
      />

      <MobileQuickFreeItemModal
        isOpen={freeItemOpen}
        onClose={() => setFreeItemOpen(false)}
        onAdd={vm.agregarItemLibreRapido}
      />

      <MobileShareExportSheet
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        presupuesto={vm.presupuesto}
        cliente={vm.clienteActual}
        config={config}
        totalFinal={vm.totales.precioFinalGlobal}
        onOpenPreview={vm.toggleVistaPrevia}
      />

      <NotebookClientPreviewDrawer
        isOpen={vm.mostrarVistaPrevia}
        onClose={vm.toggleVistaPrevia}
        presupuesto={vm.presupuesto}
        totales={vm.totales}
        alcanceYAdvertencias={vm.alcanceYAdvertencias}
        esTotalParcial={vm.esTotalParcial}
        cantidadSinValorizar={vm.cantidadSinValorizar}
        config={config}
      />
    </div>
  );
};

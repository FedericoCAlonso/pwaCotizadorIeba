import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Command,
  Eye,
  HelpCircle,
  Redo2,
  Save,
  SlidersHorizontal,
  Undo2
} from 'lucide-react';
import { formatARS } from '../../../core/calculations';
import { Contacto, Presupuesto } from '../../../core/types';
import {
  ModoPasadaCotizacion,
} from '../../../core/notebookDocument';
import { NotebookSaveStatus } from '../../../viewmodels/useNotebookDocumentViewModel';
import { NotebookMetadataPopover } from './NotebookMetadataPopover';

export interface NotebookDesktopToolbarProps {
  presupuesto: Presupuesto;
  contactos: Contacto[];
  clienteActual?: Contacto;
  passMode: ModoPasadaCotizacion;
  isDirty: boolean;
  saveStatus: NotebookSaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  esTotalParcial: boolean;
  precioFinalGlobal: number;
  onRequestBack: () => void;
  onTogglePassMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onUpdateMetadata: (patch: Partial<Presupuesto>) => void;
  onOpenPalette: () => void;
  onTogglePreview: () => void;
  onToggleHelp: () => void;
}

/**
 * Barra superior modular del Notebook de escritorio: navegación segura, Undo/Redo,
 * edición de metadata comercial, guardado explícito y total en tiempo real.
 */
export const NotebookDesktopToolbar: React.FC<NotebookDesktopToolbarProps> = ({
  presupuesto,
  contactos,
  clienteActual,
  passMode,
  isDirty,
  saveStatus,
  canUndo,
  canRedo,
  esTotalParcial,
  precioFinalGlobal,
  onRequestBack,
  onTogglePassMode,
  onUndo,
  onRedo,
  onSave,
  onUpdateMetadata,
  onOpenPalette,
  onTogglePreview,
  onToggleHelp
}) => {
  const [showMetadata, setShowMetadata] = useState(false);

  return (
    <header className="px-4 py-2 border-b border-outline-variant/50 bg-surface-container-low flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onRequestBack}
          aria-label="Volver al listado"
          className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          <h1 className="text-sm font-semibold truncate">{presupuesto.numero}</h1>
          <button
            type="button"
            onClick={onTogglePassMode}
            title="Alternar modo de carga (Pasada 1 Esqueleto / Pasada 2 Valorización)"
            className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-container-high text-on-surface-variant border border-outline-variant/60 hover:bg-surface-container-highest"
          >
            {passMode === 'esqueleto' ? 'Pasada 1 · Esqueleto' : 'Pasada 2 · Valorización'}
          </button>

          {saveStatus === 'saving' ? (
            <span className="text-[11px] text-on-surface-variant">Guardando...</span>
          ) : saveStatus === 'error' ? (
            <span className="text-[11px] text-error font-medium">Error al guardar</span>
          ) : isDirty ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Sin guardar
            </span>
          ) : (
            saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-tertiary">
                <Check className="w-3 h-3" /> Guardado
              </span>
            )
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* Undo / Redo */}
        <div className="flex items-center rounded-lg border border-outline-variant/40 bg-surface-container p-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Deshacer"
            title="Deshacer (Ctrl+Z)"
            className="p-1 rounded-md text-on-surface-variant hover:bg-surface-container-high disabled:opacity-35 disabled:pointer-events-none"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Rehacer"
            title="Rehacer (Ctrl+Y)"
            className="p-1 rounded-md text-on-surface-variant hover:bg-surface-container-high disabled:opacity-35 disabled:pointer-events-none"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metadata comercial */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMetadata(v => !v)}
            aria-expanded={showMetadata}
            aria-label="Editar datos de cotización"
            title="Cliente, obra, facturación y beneficio"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-on-surface-variant bg-surface-container hover:bg-surface-container-high border border-outline-variant/50 max-w-[170px]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {clienteActual?.nombre || 'Datos'} · {presupuesto.beneficioPorcentaje ?? 20}%
            </span>
          </button>

          <NotebookMetadataPopover
            isOpen={showMetadata}
            presupuesto={presupuesto}
            contactos={contactos}
            onClose={() => setShowMetadata(false)}
            onUpdate={onUpdateMetadata}
          />
        </div>

        {/* Guardar explícito sin salir */}
        <button
          type="button"
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          aria-label="Guardar cotización"
          title="Guardar (Ctrl+S)"
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            isDirty
              ? 'bg-primary text-on-primary border-primary hover:opacity-90'
              : 'bg-surface-container text-on-surface-variant border-outline-variant/50 hover:bg-surface-container-high'
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          <span>Guardar</span>
        </button>

        <button
          type="button"
          onClick={onOpenPalette}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-on-surface-variant bg-surface-container hover:bg-surface-container-high border border-outline-variant/50"
        >
          <Command className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Paleta</span>
          <kbd className="text-[10px] font-mono opacity-75">Ctrl+K</kbd>
        </button>

        <button
          type="button"
          onClick={onTogglePreview}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-on-surface-variant bg-surface-container hover:bg-surface-container-high border border-outline-variant/50"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Cliente</span>
        </button>

        <button
          type="button"
          onClick={onToggleHelp}
          aria-label="Ayuda de atajos de teclado"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container-high"
        >
          <HelpCircle className="w-4 h-4" />
          <kbd className="text-[11px] font-mono">?</kbd>
        </button>

        <div
          data-testid="notebook-total-header"
          className="pl-2.5 border-l border-outline-variant/50 text-right"
        >
          <span className="block text-[10px] uppercase tracking-wider text-on-surface-variant">
            {esTotalParcial ? 'Total parcial' : 'Total cotización'}
          </span>
          <span
            className={`font-mono font-bold text-sm tabular-nums ${
              esTotalParcial ? 'text-amber-700 dark:text-amber-300' : 'text-primary'
            }`}
          >
            {formatARS(precioFinalGlobal)}
          </span>
        </div>
      </div>
    </header>
  );
};

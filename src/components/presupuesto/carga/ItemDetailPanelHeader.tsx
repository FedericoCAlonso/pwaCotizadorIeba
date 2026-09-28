import React from 'react';
import {
  X,
  BookmarkPlus,
  Unlink2,
  RefreshCw,
  Link2,
  FileSpreadsheet
} from 'lucide-react';
import { ItemPresupuesto, TareaTipo } from '../../../core/types';

interface ItemDetailPanelHeaderProps {
  item: ItemPresupuesto;
  tareasTipo?: TareaTipo[];
  onClose: () => void;
  onSaveAsTareaTipo?: () => void;
  onDesacoplar?: () => void;
  onActualizarVersion?: () => void;
}

export const ItemDetailPanelHeader: React.FC<ItemDetailPanelHeaderProps> = ({
  item,
  tareasTipo = [],
  onClose,
  onSaveAsTareaTipo,
  onDesacoplar,
  onActualizarVersion
}) => {
  const isLinked = Boolean(item.tareaTipoId && !item.desacoplado);
  const isDecoupled = Boolean(item.tareaTipoId && item.desacoplado);

  const matchedTarea = item.tareaTipoId ? tareasTipo.find((t) => t.id === item.tareaTipoId) : null;
  const currentCatalogVersion = matchedTarea?.version ?? 1;
  const hasNewerVersion = isLinked && (item.tareaTipoVersion ?? 1) < currentCatalogVersion;

  return (
    <div className="p-3.5 border-b border-outline-variant/30 bg-surface-container-low select-none">
      <div className="flex items-center justify-between gap-2">
        {/* Badge de Estado / Procedencia */}
        <div className="flex items-center gap-2 min-w-0">
          {isLinked ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-secondary-container text-on-secondary-container">
              <Link2 className="w-3.5 h-3.5" />
              <span className="truncate">
                {matchedTarea?.nombre || 'Tarea Tipo'} v{item.tareaTipoVersion ?? 1}
              </span>
            </span>
          ) : isDecoupled ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-surface-container-highest text-on-surface-variant">
              <Unlink2 className="w-3.5 h-3.5" />
              <span>Desacoplado</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-primary-container text-on-primary-container">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Propio</span>
            </span>
          )}
        </div>

        {/* Botón Cerrar */}
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
          title="Cerrar panel de detalle (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Botones de acción del encabezado */}
      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        {(!isLinked || isDecoupled) && onSaveAsTareaTipo && (
          <button
            type="button"
            onClick={onSaveAsTareaTipo}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary bg-primary-container/40 hover:bg-primary-container rounded-lg border border-primary/20 transition-colors cursor-pointer"
            title="Guardar este ítem en el Catálogo como una Tarea Tipo reutilizable"
          >
            <BookmarkPlus className="w-3 h-3" />
            <span>Guardar como Tarea Tipo</span>
          </button>
        )}

        {isLinked && onDesacoplar && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('¿Desacoplar ítem de la tarea tipo? Podrás editar sus líneas libremente como ítem propio.')) {
                onDesacoplar();
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-on-surface-variant hover:text-error bg-surface-container hover:bg-error-container/40 rounded-lg border border-outline-variant/30 transition-colors cursor-pointer"
            title="Desvincular del catálogo conservando las líneas actuales"
          >
            <Unlink2 className="w-3 h-3" />
            <span>Desacoplar</span>
          </button>
        )}

        {hasNewerVersion && onActualizarVersion && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`¿Actualizar a la versión ${currentCatalogVersion} de la Tarea Tipo? Se recalcularán las líneas con las fórmulas más recientes.`)) {
                onActualizarVersion();
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-secondary bg-secondary-container/40 hover:bg-secondary-container rounded-lg border border-secondary/20 transition-colors cursor-pointer animate-pulse"
            title="Actualizar a la última versión disponible en catálogo"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Actualizar a v{currentCatalogVersion}</span>
          </button>
        )}
      </div>
    </div>
  );
};

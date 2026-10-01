import React, { useState } from 'react';
import { Plus, Clock } from 'lucide-react';
import { CategoriaManoDeObra, RolCategoriaManoDeObra, ConvenioLaboral } from '../../core/types';
import { ManoObraRow } from './ManoObraRow';

interface ManoObraDesktopTableProps {
  manoObraList: CategoriaManoDeObra[];
  conveniosList: ConvenioLaboral[];
  onUpdateField: (moId: string, field: string, value: string | number) => Promise<void>;
  onOpenEdit: (mo: CategoriaManoDeObra) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onQuickCreate: (nombre?: string, convenioId?: string, rol?: RolCategoriaManoDeObra) => Promise<string>;
}

export const ManoObraDesktopTable: React.FC<ManoObraDesktopTableProps> = ({
  manoObraList,
  conveniosList,
  onUpdateField,
  onOpenEdit,
  onDelete,
  onDuplicate,
  onQuickCreate
}) => {
  const [quickName, setQuickName] = useState('');
  const [quickConvenio, setQuickConvenio] = useState('uocra');
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);

  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = quickName.trim();
    if (!trimmed) return;
    setIsCreatingQuick(true);
    try {
      await onQuickCreate(trimmed, quickConvenio, 'oficial');
      setQuickName('');
    } finally {
      setIsCreatingQuick(false);
    }
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-high/60 border-b border-outline-variant/20 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              <th className="px-2 py-2.5 w-8 text-center" title="Desplegar desglose"></th>
              <th className="px-2 py-2.5 w-8 text-center">#</th>
              <th className="px-3 py-2.5 min-w-[190px]">Categoría / Especialidad</th>
              <th className="px-2 py-2.5 w-36">Convenio (FCS)</th>
              <th className="px-2 py-2.5 w-32">Rol Cuadrilla</th>
              <th className="px-2 py-2.5 w-20 text-center">Jornada</th>
              <th className="px-3 py-2.5 w-32 text-right">Costo / Hora Real</th>
              <th className="px-3 py-2.5 w-32 text-right">Costo / Jornal Real</th>
              <th className="px-2 py-2.5 w-24 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {manoObraList.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-on-surface-variant space-y-2">
                  <Clock className="w-8 h-8 text-primary mx-auto opacity-40" />
                  <p className="text-sm font-semibold text-on-surface">No hay categorías de mano de obra definidas</p>
                  <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                    Comienza agregando las categorías habituales de tu cuadrilla (Oficial, Ayudante, etc.)
                  </p>
                </td>
              </tr>
            ) : (
              manoObraList.map((mo, idx) => (
                <ManoObraRow
                  key={mo.id}
                  mo={mo}
                  index={idx}
                  conveniosList={conveniosList}
                  onUpdateField={onUpdateField}
                  onOpenEdit={onOpenEdit}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                />
              ))
            )}

            {/* Fila de creación rápida al pie de la tabla */}
            <tr className="bg-surface-container-high/20 border-t border-outline-variant/20">
              <td className="px-2 py-2 text-center text-xs text-primary font-bold">
                <Plus className="w-3.5 h-3.5 mx-auto" />
              </td>
              <td colSpan={8} className="px-3 py-2">
                <form onSubmit={handleQuickAdd} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    placeholder="+ Agregar nueva categoría rápida (ej: Medio Oficial Tablerista)..."
                    className="flex-1 bg-surface-container-lowest/80 border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface"
                  />
                  <select
                    value={quickConvenio}
                    onChange={(e) => setQuickConvenio(e.target.value)}
                    aria-label="Convenio para nueva categoría rápida"
                    className="bg-surface-container border border-outline-variant/20 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shrink-0"
                  >
                    {conveniosList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre.split(' ')[0]} ({c.cargasSocialesPct}%)
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!quickName.trim() || isCreatingQuick}
                    className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  >
                    {isCreatingQuick ? 'Agregando...' : 'Agregar'}
                  </button>
                </form>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

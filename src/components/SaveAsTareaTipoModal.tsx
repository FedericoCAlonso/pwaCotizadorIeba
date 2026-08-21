import React, { useState, useEffect } from 'react';
import { Sparkles, Save, X } from 'lucide-react';
import { db } from '../db/database';
import { InsumoEnTarea, ManoObraEnTarea, TareaTipo } from '../core/types';
import { useAppOptions } from '../hooks/useAppOptions';
import { useToast } from '../contexts/ToastContext';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface SaveAsTareaTipoModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultNombre: string;
  defaultCategoria?: string;
  defaultNotasTecnicas?: string;
  insumos: InsumoEnTarea[];
  manoObra: ManoObraEnTarea[];
  unidad?: string;
  onSuccess?: (newTareaTipoId: string) => void;
}

export const SaveAsTareaTipoModal: React.FC<SaveAsTareaTipoModalProps> = ({
  isOpen,
  onClose,
  defaultNombre,
  defaultCategoria,
  defaultNotasTecnicas,
  insumos,
  manoObra,
  unidad = 'u',
  onSuccess
}) => {
  useEscapeKey(isOpen, onClose);
  const { categoriasTarea } = useAppOptions();
  const { toast } = useToast();

  const [nombre, setNombre] = useState(defaultNombre);
  const [categoria, setCategoria] = useState(defaultCategoria || categoriasTarea[0] || 'Bocas');
  const [notasTecnicas, setNotasTecnicas] = useState(defaultNotasTecnicas || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNombre(defaultNombre);
      setCategoria(defaultCategoria || categoriasTarea[0] || 'Bocas');
      setNotasTecnicas(defaultNotasTecnicas || '');
    }
  }, [isOpen, defaultNombre, defaultCategoria, defaultNotasTecnicas, categoriasTarea]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const newId = `tarea-${crypto.randomUUID()}`;

      const newTarea: TareaTipo = {
        id: newId,
        nombre: nombre.trim(),
        categoria,
        insumos,
        manoObra,
        unidad: unidad || 'u',
        parametros: [
          {
            id: 'cantidad',
            nombre: `Cantidad de ${unidad || 'Unidades'}`,
            tipo: 'numero',
            valorDefault: 1,
            unidad: unidad || 'u'
          }
        ],
        variables: [],
        notasTecnicas: notasTecnicas.trim() || undefined,
        frecuenciaUso: 1,
        ultimoUsoFecha: now,
        createdAt: now,
        updatedAt: now
      };

      await db.tareasTipo.add(newTarea);
      toast.success('¡Trabajo Tipo guardado con éxito!');
      if (onSuccess) onSuccess(newId);
      onClose();
    } catch (err) {
      console.error('Error al guardar Trabajo Tipo:', err);
      toast.error('Ocurrió un error al guardar el Trabajo Tipo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-on-surface pb-safe">
        {/* Mobile drag bar */}
        <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />

        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Guardar como Trabajo Tipo</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-on-surface mb-1">Nombre de la Plantilla / Trabajo Tipo *</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs"
              placeholder="ej. Armado e Instalación de Tablero Seccional"
            />
          </div>

          <div>
            <label className="block font-semibold text-on-surface mb-1">Categoría del Trabajo *</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs"
            >
              {categoria && !categoriasTarea.includes(categoria) && (
                <option value={categoria}>{categoria} (Personalizada)</option>
              )}
              {categoriasTarea.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Resumen del Contenido */}
          <div className="p-3 bg-surface-container-low border border-outline-variant/20 rounded-2xl space-y-1">
            <span className="font-semibold text-on-surface block">Contenido a Clonar:</span>
            <div className="flex items-center gap-4 text-on-surface-variant text-[11px]">
              <span>📦 <strong>{insumos.length}</strong> Insumos/Materiales</span>
              <span>⏱️ <strong>{manoObra.reduce((acc, m) => acc + m.horas, 0)} hs</strong> Mano de Obra</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-on-surface mb-1">Notas Técnicas o Especificaciones (Opcional)</label>
            <textarea
              rows={2}
              value={notasTecnicas}
              onChange={(e) => setNotasTecnicas(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs"
              placeholder="Instrucciones o especificaciones de montaje para este trabajo tipo..."
            />
          </div>

          <div className="pt-3 border-t border-outline-variant/20 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-full text-on-surface-variant hover:bg-surface-variant font-medium text-center min-h-[40px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 sm:py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full shadow-sm transition-all min-h-[40px]"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Trabajo Tipo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

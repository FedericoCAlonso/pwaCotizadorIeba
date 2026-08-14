import React, { useState } from 'react';
import { Sparkles, Layers, Save, X, CheckCircle2 } from 'lucide-react';
import { db } from '../db/database';
import { InsumoEnTarea, ManoObraEnTarea, TareaTipo, CATEGORIA_TAREA } from '../core/types';

interface SaveAsTareaTipoModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultNombre: string;
  defaultCategoria?: string;
  insumos: InsumoEnTarea[];
  manoObra: ManoObraEnTarea[];
  unidad?: string;
  onSuccess?: (newTareaTipoId: string) => void;
}

const CATEGORIAS_LIST = Object.values(CATEGORIA_TAREA);

export const SaveAsTareaTipoModal: React.FC<SaveAsTareaTipoModalProps> = ({
  isOpen,
  onClose,
  defaultNombre,
  defaultCategoria = 'Instalaciones',
  insumos,
  manoObra,
  unidad = 'u',
  onSuccess
}) => {
  const [nombre, setNombre] = useState(defaultNombre);
  const [categoria, setCategoria] = useState(defaultCategoria);
  const [notasTecnicas, setNotasTecnicas] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setNombre(defaultNombre);
      setCategoria(defaultCategoria || 'Instalaciones');
      setNotasTecnicas('');
    }
  }, [isOpen, defaultNombre, defaultCategoria]);

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
        notasTecnicas: notasTecnicas.trim() || undefined,
        frecuenciaUso: 1,
        ultimoUsoFecha: now,
        createdAt: now,
        updatedAt: now
      };

      await db.tareasTipo.add(newTarea);
      alert('¡Trabajo Tipo guardado con éxito!');
      if (onSuccess) onSuccess(newId);
      onClose();
    } catch (err) {
      console.error('Error al guardar Trabajo Tipo:', err);
      alert('Ocurrió un error al guardar el Trabajo Tipo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-on-surface">
        <div className="px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Guardar como Trabajo Tipo / Plantilla</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
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
              {CATEGORIAS_LIST.map((cat) => (
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

          <div className="pt-3 border-t border-outline-variant/20 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-on-surface-variant hover:bg-surface-variant font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full shadow-sm transition-all"
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

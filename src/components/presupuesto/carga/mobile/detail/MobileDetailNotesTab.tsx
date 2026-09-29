import React from 'react';
import { FileText, ShieldAlert } from 'lucide-react';

export interface MobileDetailNotesTabProps {
  notasTecnicas?: string;
  clausulaExclusiones?: string;
  onUpdateNotas?: (notas: string, exclusiones?: string) => void;
}

export const MobileDetailNotesTab: React.FC<MobileDetailNotesTabProps> = ({
  notasTecnicas = '',
  clausulaExclusiones = '',
  onUpdateNotas
}) => {
  return (
    <div className="space-y-4 pb-6 select-none">
      {/* Notas y Especificaciones Técnicas */}
      <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/30 space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <label htmlFor="mobile-notas-tecnicas" className="text-xs font-bold text-on-surface">
            Especificaciones Técnicas y Alcance
          </label>
        </div>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          Detalles de instalación, marcas requeridas, normas IRAM o consideraciones de obra para el cliente.
        </p>
        <textarea
          id="mobile-notas-tecnicas"
          rows={4}
          value={notasTecnicas}
          onChange={(e) => onUpdateNotas?.(e.target.value, clausulaExclusiones)}
          placeholder="Ej: Cañería embutida en losa, cables normalizados antillama según AEA 90364..."
          className="w-full p-3 text-xs bg-surface border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-primary transition-colors resize-y leading-relaxed"
        />
      </div>

      {/* Cláusula de Exclusiones */}
      <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/30 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <label htmlFor="mobile-clausula-exclusiones" className="text-xs font-bold text-on-surface">
            Cláusula de Exclusiones
          </label>
        </div>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          Tareas o insumos explícitamente no contemplados en el precio presupuestado.
        </p>
        <textarea
          id="mobile-clausula-exclusiones"
          rows={3}
          value={clausulaExclusiones}
          onChange={(e) => onUpdateNotas?.(notasTecnicas, e.target.value)}
          placeholder="Ej: No incluye rotura de hormigón armado, pintura final de tapas ni provisión de artefactos lumínicos..."
          className="w-full p-3 text-xs bg-surface border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-amber-500 transition-colors resize-y leading-relaxed"
        />
      </div>
    </div>
  );
};

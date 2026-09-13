import React from 'react';
import { Clock, Save, HardHat, Calendar } from 'lucide-react';
import { ModalContainer } from '../ModalContainer';
import { RolCategoriaManoDeObra } from '../../core/types';
import { ManoObraFormState } from '../../viewmodels/useManoObraViewModel';
import { formatARS, safeNum } from '../../core/calculations';

interface ManoObraEditorModalProps {
  isOpen: boolean;
  isCreating: boolean;
  form: ManoObraFormState;
  onClose: () => void;
  onNombreChange: (nombre: string) => void;
  onRolChange: (rol: RolCategoriaManoDeObra) => void;
  onHorasJornadaChange: (horas: number) => void;
  onCostoHoraChange: (val: number | string) => void;
  onCostoJornadaChange: (val: number | string) => void;
  onSave: (e?: React.FormEvent) => void;
}

const ROLES: { id: RolCategoriaManoDeObra; label: string; sub: string }[] = [
  { id: 'oficial', label: 'Oficial', sub: 'Autónomo / Conexiones' },
  { id: 'ayudante', label: 'Ayudante', sub: 'Asistencia / Tándem' },
  { id: 'especialista', label: 'Especialista', sub: 'Protocolos / Ensayos' },
  { id: 'independiente', label: 'Unipersonal', sub: 'Trabajo Individual' }
];

export const ManoObraEditorModal: React.FC<ManoObraEditorModalProps> = ({
  isOpen,
  isCreating,
  form,
  onClose,
  onNombreChange,
  onRolChange,
  onHorasJornadaChange,
  onCostoHoraChange,
  onCostoJornadaChange,
  onSave
}) => {
  const inputCls =
    'w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl px-3.5 py-2.5 text-base sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 min-h-[44px] transition-shadow';

  const costoHoraNum = safeNum(form.costoHora);
  const costoJornadaNum = safeNum(form.costoJornada);

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      title={isCreating ? 'Nueva Categoría de Mano de Obra' : 'Editar Categoría de Mano de Obra'}
      subtitle="Definí el valor por jornada de convenio (UOCRA) o por hora para el cómputo de tareas"
      icon={<Clock className="w-5 h-5 text-primary" />}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs sm:text-sm text-on-surface-variant hover:bg-surface-variant"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs sm:text-sm shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar
          </button>
        </div>
      }
    >
      <form onSubmit={onSave} className="space-y-4">
        {/* Nombre de la categoría */}
        <div>
          <label className="block text-xs font-bold text-on-surface mb-1">
            Nombre de la Categoría *
          </label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => onNombreChange(e.target.value)}
            className={inputCls}
            placeholder="Ej: Oficial Electricista, Ayudante, Especialista"
            required
            autoFocus
          />
        </div>

        {/* Rol Funcional en Cuadrilla */}
        <div>
          <label className="block text-xs font-bold text-on-surface mb-1.5 flex items-center gap-1.5">
            <HardHat className="w-3.5 h-3.5 text-primary" />
            <span>Rol Funcional en Cuadrilla *</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ROLES.map((r) => {
              const isSelected = form.rol === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onRolChange(r.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all text-xs ${
                    isSelected
                      ? 'bg-primary text-on-primary border-primary shadow-xs font-bold'
                      : 'bg-surface-container-high border-outline-variant/20 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <div className="font-bold">{r.label}</div>
                  <div className="text-xs opacity-80 mt-0.5">{r.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Base Horaria de la Jornada */}
        <div className="bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/20 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Base Horaria de Jornada</span>
            </label>
            <span className="text-xs text-on-surface-variant font-medium">
              {form.horasJornada} hs/día
            </span>
          </div>

          <div className="flex items-center gap-2">
            {[
              { hs: 9, label: '9 hs (Convenio UOCRA)', tip: 'Jornada extendida habitual con almuerzo y descansos (L-V)' },
              { hs: 8, label: '8 hs (Legal estándar)', tip: 'Jornada legal laboral de 8 horas diarias' }
            ].map((preset) => {
              const isSelected = form.horasJornada === preset.hs;
              return (
                <button
                  key={preset.hs}
                  type="button"
                  onClick={() => onHorasJornadaChange(preset.hs)}
                  title={preset.tip}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-primary text-on-primary border-primary shadow-2xs'
                      : 'bg-surface-container border-outline-variant/20 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Doble Entrada Sincronizada: Jornada vs Hora */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Costo por Jornada */}
          <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-on-surface">
                Costo por Jornada (ARS)
              </label>
              <span className="text-2xs font-semibold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Convenio
              </span>
            </div>
            <div className="relative">
              <span className="text-xs text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2 font-mono">
                $
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={form.costoJornada ?? ''}
                onChange={(e) => onCostoJornadaChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                className={`${inputCls} pl-8 font-mono text-primary font-bold`}
                placeholder="Ej: 72000"
              />
            </div>
            <p className="text-2xs text-on-surface-variant">
              Jornada completa de {form.horasJornada} hs.
            </p>
          </div>

          {/* Costo por Hora */}
          <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-on-surface">
                Costo por Hora (ARS) *
              </label>
              <span className="text-2xs font-semibold uppercase px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                Cómputo APU
              </span>
            </div>
            <div className="relative">
              <span className="text-xs text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2 font-mono">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.costoHora ?? ''}
                onChange={(e) => onCostoHoraChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                className={`${inputCls} pl-8 font-mono text-primary font-bold`}
                placeholder="Ej: 8000"
                required
              />
            </div>
            <p className="text-2xs text-on-surface-variant">
              Tarifa horaria usada en los análisis de precios unitarios.
            </p>
          </div>
        </div>

        {/* Resumen de Equivalencia */}
        {costoHoraNum > 0 && (
          <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/15 text-xs text-on-surface-variant flex items-center justify-between gap-2">
            <div>
              <span>Equivalencia: </span>
              <strong className="text-on-surface font-mono">{formatARS(costoHoraNum)}/h</strong>
              <span> × {form.horasJornada} hs = </span>
              <strong className="text-primary font-mono">{formatARS(costoJornadaNum)}/jornada</strong>
            </div>
          </div>
        )}
      </form>
    </ModalContainer>
  );
};

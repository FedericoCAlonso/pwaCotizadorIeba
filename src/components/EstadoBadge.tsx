import React from 'react';
import { CheckCircle, Clock, FileCheck, XCircle, AlertTriangle } from 'lucide-react';
import { EstadoPresupuesto } from '../core/types';

interface EstadoBadgeProps {
  estado: EstadoPresupuesto;
  size?: 'sm' | 'md';
}

export const EstadoBadge: React.FC<EstadoBadgeProps> = ({ estado, size = 'sm' }) => {
  const iconCls = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const textCls = size === 'sm' ? 'text-[11px] px-2.5 py-0.5' : 'text-xs px-3 py-1';

  switch (estado) {
    case 'aprobado':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-lg bg-tertiary-container text-on-tertiary-container select-none ${textCls}`}>
          <CheckCircle className={iconCls} /> Aprobado
        </span>
      );
    case 'enviado':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-lg bg-secondary-container text-on-secondary-container select-none ${textCls}`}>
          <FileCheck className={iconCls} /> Enviado
        </span>
      );
    case 'borrador':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-lg bg-surface-container-highest text-on-surface-variant select-none ${textCls}`}>
          <Clock className={iconCls} /> Borrador
        </span>
      );
    case 'rechazado':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-lg bg-error-container text-on-error-container select-none ${textCls}`}>
          <XCircle className={iconCls} /> Rechazado
        </span>
      );
    case 'vencido':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-lg bg-primary-container text-on-primary-container select-none ${textCls}`}>
          <AlertTriangle className={iconCls} /> Vencido
        </span>
      );
    default:
      return null;
  }
};

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
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ${textCls}`}>
          <CheckCircle className={iconCls} /> Aprobado
        </span>
      );
    case 'enviado':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 ${textCls}`}>
          <FileCheck className={iconCls} /> Enviado
        </span>
      );
    case 'borrador':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 ${textCls}`}>
          <Clock className={iconCls} /> Borrador
        </span>
      );
    case 'rechazado':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 ${textCls}`}>
          <XCircle className={iconCls} /> Rechazado
        </span>
      );
    case 'vencido':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 ${textCls}`}>
          <AlertTriangle className={iconCls} /> Vencido
        </span>
      );
    default:
      return null;
  }
};

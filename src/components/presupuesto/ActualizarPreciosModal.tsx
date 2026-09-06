import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  X,
  Package,
  Users,
  Wrench,
  Truck,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';
import {
  AnalisisCambiosPreciosPresupuesto,
  OpcionesActualizacionPrecios,
  formatARS
} from '../../core/calculations';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ActualizarPreciosModalProps {
  isOpen: boolean;
  onClose: () => void;
  analisis: AnalisisCambiosPreciosPresupuesto | null;
  onConfirm: (opciones: OpcionesActualizacionPrecios) => void;
}

export const ActualizarPreciosModal: React.FC<ActualizarPreciosModalProps> = ({
  isOpen,
  onClose,
  analisis,
  onConfirm
}) => {
  useEscapeKey(isOpen, onClose);

  const [opciones, setOpciones] = useState<OpcionesActualizacionPrecios>({
    actualizarMateriales: true,
    actualizarManoObra: true,
    actualizarTareasTipo: true,
    actualizarCostosIndirectos: true,
    actualizarDolar: true
  });

  const [expandedSections, setExpandedSections] = useState<{
    materiales: boolean;
    manoObra: boolean;
    tareasTipo: boolean;
    indirectos: boolean;
  }>({
    materiales: false,
    manoObra: false,
    tareasTipo: false,
    indirectos: false
  });

  // Inicializar opciones según los cambios detectados
  useEffect(() => {
    if (analisis) {
      setOpciones({
        actualizarMateriales: analisis.materiales.count > 0,
        actualizarManoObra: analisis.manoObra.count > 0,
        actualizarTareasTipo: analisis.tareasTipo.count > 0,
        actualizarCostosIndirectos: analisis.costosIndirectos.count > 0,
        actualizarDolar: analisis.dolar.cambio !== null
      });
    }
  }, [analisis]);

  if (!isOpen || !analisis) return null;

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const totalCapasSeleccionadas =
    (opciones.actualizarMateriales && analisis.materiales.count > 0 ? 1 : 0) +
    (opciones.actualizarManoObra && analisis.manoObra.count > 0 ? 1 : 0) +
    (opciones.actualizarTareasTipo && analisis.tareasTipo.count > 0 ? 1 : 0) +
    (opciones.actualizarCostosIndirectos && analisis.costosIndirectos.count > 0 ? 1 : 0) +
    (opciones.actualizarDolar && analisis.dolar.cambio !== null ? 1 : 0);

  const handleSelectAll = (select: boolean) => {
    setOpciones({
      actualizarMateriales: select && analisis.materiales.count > 0,
      actualizarManoObra: select && analisis.manoObra.count > 0,
      actualizarTareasTipo: select && analisis.tareasTipo.count > 0,
      actualizarCostosIndirectos: select && analisis.costosIndirectos.count > 0,
      actualizarDolar: select && analisis.dolar.cambio !== null
    });
  };

  const handleApply = () => {
    onConfirm(opciones);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">Actualizar Precios y Tarifas Vigentes</h2>
              <p className="text-xs text-on-surface-variant">
                Sincronizá los costos congelados con los valores actuales del catálogo y tarifas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {!analisis.hayCambios ? (
            <div className="text-center py-8 px-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
              <Check className="w-8 h-8 text-emerald-500 mx-auto" />
              <h3 className="font-semibold text-on-surface">¡Cotización al día!</h3>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                Todos los insumos, tarifas horarias de mano de obra y costos indirectos de este presupuesto ya poseen los valores vigentes del catálogo.
              </p>
            </div>
          ) : (
            <>
              {/* Impacto Resumen Card */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between flex-wrap gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                    <span>Impacto estimado en costo directo:</span>
                    {analisis.totalImpactoEstimado >= 0 ? (
                      <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold">
                        <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                        +{formatARS(analisis.totalImpactoEstimado)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-rose-600 dark:text-rose-400 font-bold">
                        <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                        {formatARS(analisis.totalImpactoEstimado)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    Seleccioná qué capas querés sincronizar antes de aplicar los cambios
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    Seleccionar todo
                  </button>
                  <span className="text-outline-variant">|</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="text-xs text-on-surface-variant hover:underline"
                  >
                    Desmarcar todo
                  </button>
                </div>
              </div>

              {/* Capas de Actualización */}
              <div className="space-y-3">
                {/* 1. Capa Materiales */}
                <div className={`border rounded-xl transition-all overflow-hidden ${
                  opciones.actualizarMateriales && analisis.materiales.count > 0
                    ? 'border-primary/40 bg-surface-container-lowest'
                    : 'border-outline-variant/30 bg-surface-container-low/40 opacity-80'
                }`}>
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                      <input
                        type="checkbox"
                        checked={opciones.actualizarMateriales}
                        disabled={analisis.materiales.count === 0}
                        onChange={(e) => setOpciones(prev => ({ ...prev, actualizarMateriales: e.target.checked }))}
                        className="rounded text-primary focus:ring-primary w-4 h-4"
                      />
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-on-surface">Materiales e Insumos</span>
                      </div>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        analisis.materiales.count > 0
                          ? 'bg-primary/10 text-primary'
                          : 'bg-surface-variant text-on-surface-variant'
                      }`}>
                        {analisis.materiales.count > 0 ? `${analisis.materiales.count} insumo(s) con variación` : 'Al día'}
                      </span>
                    </label>

                    {analisis.materiales.count > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-on-surface">
                          {analisis.materiales.totalImpacto >= 0 ? '+' : ''}{formatARS(analisis.materiales.totalImpacto)}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSection('materiales')}
                          className="p-1 text-on-surface-variant hover:text-on-surface rounded-md"
                        >
                          {expandedSections.materiales ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {expandedSections.materiales && analisis.materiales.cambios.length > 0 && (
                    <div className="p-3 bg-surface-container-low border-t border-outline-variant/20 max-h-48 overflow-y-auto space-y-1.5 text-xs">
                      {analisis.materiales.cambios.map((c, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1 border-b border-outline-variant/10 last:border-0">
                          <div>
                            <span className="font-medium text-on-surface">{c.nombre}</span>
                            <span className="text-xs text-on-surface-variant ml-1.5">({c.cantidadTotal} {c.unidad})</span>
                          </div>
                          <div className="text-right">
                            <span className="line-through text-on-surface-variant/80 text-xs mr-1.5">
                              {formatARS(c.precioAnterior)}
                            </span>
                            <span className="font-semibold text-primary">
                              {formatARS(c.precioNuevo)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Capa Mano de Obra */}
                <div className={`border rounded-xl transition-all overflow-hidden ${
                  opciones.actualizarManoObra && analisis.manoObra.count > 0
                    ? 'border-primary/40 bg-surface-container-lowest'
                    : 'border-outline-variant/30 bg-surface-container-low/40 opacity-80'
                }`}>
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                      <input
                        type="checkbox"
                        checked={opciones.actualizarManoObra}
                        disabled={analisis.manoObra.count === 0}
                        onChange={(e) => setOpciones(prev => ({ ...prev, actualizarManoObra: e.target.checked }))}
                        className="rounded text-primary focus:ring-primary w-4 h-4"
                      />
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-on-surface">Tarifas de Mano de Obra</span>
                      </div>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        analisis.manoObra.count > 0
                          ? 'bg-primary/10 text-primary'
                          : 'bg-surface-variant text-on-surface-variant'
                      }`}>
                        {analisis.manoObra.count > 0 ? `${analisis.manoObra.count} categoría(s) con variación` : 'Al día'}
                      </span>
                    </label>

                    {analisis.manoObra.count > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-on-surface">
                          {analisis.manoObra.totalImpacto >= 0 ? '+' : ''}{formatARS(analisis.manoObra.totalImpacto)}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSection('manoObra')}
                          className="p-1 text-on-surface-variant hover:text-on-surface rounded-md"
                        >
                          {expandedSections.manoObra ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {expandedSections.manoObra && analisis.manoObra.cambios.length > 0 && (
                    <div className="p-3 bg-surface-container-low border-t border-outline-variant/20 max-h-48 overflow-y-auto space-y-1.5 text-xs">
                      {analisis.manoObra.cambios.map((c, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1 border-b border-outline-variant/10 last:border-0">
                          <div>
                            <span className="font-medium text-on-surface">{c.nombreCategoria}</span>
                            <span className="text-xs text-on-surface-variant ml-1.5">({c.horasTotales} hs)</span>
                          </div>
                          <div className="text-right">
                            <span className="line-through text-on-surface-variant/80 text-xs mr-1.5">
                              {formatARS(c.costoHoraAnterior)}/h
                            </span>
                            <span className="font-semibold text-primary">
                              {formatARS(c.costoHoraNuevo)}/h
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Capa Tareas Tipo Paramétricas */}
                {analisis.tareasTipo.count > 0 && (
                  <div className={`border rounded-xl transition-all overflow-hidden ${
                    opciones.actualizarTareasTipo
                      ? 'border-primary/40 bg-surface-container-lowest'
                      : 'border-outline-variant/30 bg-surface-container-low/40 opacity-80'
                  }`}>
                    <div className="p-3.5 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={opciones.actualizarTareasTipo}
                          onChange={(e) => setOpciones(prev => ({ ...prev, actualizarTareasTipo: e.target.checked }))}
                          className="rounded text-primary focus:ring-primary w-4 h-4"
                        />
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-primary" />
                          <span className="text-sm font-semibold text-on-surface">Recálculo Integral de Tareas Tipo</span>
                        </div>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-primary/10 text-primary">
                          {analisis.tareasTipo.count} tarea(s)
                        </span>
                      </label>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-on-surface">
                          {analisis.tareasTipo.totalImpacto >= 0 ? '+' : ''}{formatARS(analisis.tareasTipo.totalImpacto)}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSection('tareasTipo')}
                          className="p-1 text-on-surface-variant hover:text-on-surface rounded-md"
                        >
                          {expandedSections.tareasTipo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {expandedSections.tareasTipo && analisis.tareasTipo.cambios.length > 0 && (
                      <div className="p-3 bg-surface-container-low border-t border-outline-variant/20 max-h-48 overflow-y-auto space-y-1.5 text-xs">
                        {analisis.tareasTipo.cambios.map((c, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1 border-b border-outline-variant/10 last:border-0">
                            <span className="font-medium text-on-surface">{c.itemDescripcion}</span>
                            <div className="text-right">
                              <span className="line-through text-on-surface-variant/80 text-xs mr-1.5">
                                {formatARS(c.costoDirectoAnterior)}
                              </span>
                              <span className="font-semibold text-primary">
                                {formatARS(c.costoDirectoNuevo)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Capa Costos Indirectos */}
                {analisis.costosIndirectos.count > 0 && (
                  <div className={`border rounded-xl transition-all overflow-hidden ${
                    opciones.actualizarCostosIndirectos
                      ? 'border-primary/40 bg-surface-container-lowest'
                      : 'border-outline-variant/30 bg-surface-container-low/40 opacity-80'
                  }`}>
                    <div className="p-3.5 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={opciones.actualizarCostosIndirectos}
                          onChange={(e) => setOpciones(prev => ({ ...prev, actualizarCostosIndirectos: e.target.checked }))}
                          className="rounded text-primary focus:ring-primary w-4 h-4"
                        />
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-primary" />
                          <span className="text-sm font-semibold text-on-surface">Costos Indirectos y Gastos de Obra</span>
                        </div>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-primary/10 text-primary">
                          {analisis.costosIndirectos.count} gasto(s)
                        </span>
                      </label>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-on-surface">
                          {analisis.costosIndirectos.totalImpacto >= 0 ? '+' : ''}{formatARS(analisis.costosIndirectos.totalImpacto)}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSection('indirectos')}
                          className="p-1 text-on-surface-variant hover:text-on-surface rounded-md"
                        >
                          {expandedSections.indirectos ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {expandedSections.indirectos && analisis.costosIndirectos.cambios.length > 0 && (
                      <div className="p-3 bg-surface-container-low border-t border-outline-variant/20 max-h-48 overflow-y-auto space-y-1.5 text-xs">
                        {analisis.costosIndirectos.cambios.map((c, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1 border-b border-outline-variant/10 last:border-0">
                            <span className="font-medium text-on-surface">{c.nombre}</span>
                            <div className="text-right">
                              <span className="line-through text-on-surface-variant/80 text-xs mr-1.5">
                                {formatARS(c.valorAnterior)}
                              </span>
                              <span className="font-semibold text-primary">
                                {formatARS(c.valorNuevo)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Capa Dólar */}
                {analisis.dolar.cambio && (
                  <div className={`border rounded-xl transition-all overflow-hidden ${
                    opciones.actualizarDolar
                      ? 'border-primary/40 bg-surface-container-lowest'
                      : 'border-outline-variant/30 bg-surface-container-low/40 opacity-80'
                  }`}>
                    <div className="p-3.5 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={opciones.actualizarDolar}
                          onChange={(e) => setOpciones(prev => ({ ...prev, actualizarDolar: e.target.checked }))}
                          className="rounded text-primary focus:ring-primary w-4 h-4"
                        />
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-primary" />
                          <span className="text-sm font-semibold text-on-surface">Dólar de Referencia</span>
                        </div>
                      </label>
                      <div className="text-right text-xs">
                        <span className="line-through text-on-surface-variant/70 mr-1.5">
                          ${analisis.dolar.cambio.valorAnterior}
                        </span>
                        <span className="font-semibold text-primary">
                          ${analisis.dolar.cambio.valorNuevo}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
          >
            {analisis.hayCambios ? 'Cancelar' : 'Entendido'}
          </button>

          {analisis.hayCambios && (
            <button
              type="button"
              onClick={handleApply}
              disabled={totalCapasSeleccionadas === 0}
              className="px-5 py-2.5 bg-primary text-on-primary font-semibold text-xs rounded-full shadow-sm hover:bg-primary/90 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Aplicar Actualización ({totalCapasSeleccionadas})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  Users,
  HardHat,
  Package,
  Truck,
  Globe,
  Plus,
  BookOpen,
  RotateCcw,
  Sliders,
  X,
  Edit2,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import {
  ItemPresupuesto,
  CategoriaManoDeObra,
  EstrategiaCuadrilla,
  NivelConfianzaSinergia,
  ModoPlanificacionCuadrilla,
  GastoPresupuestoConfig,
  DestinoGasto
} from '../../../core/types';
import { formatARS, TotalesPresupuestoResultado } from '../../../core/calculations';
import { PlanificadorCuadrillaCard } from '../PlanificadorCuadrillaCard';

interface CuadrillaTabProps {
  items: ItemPresupuesto[];
  estrategia: EstrategiaCuadrilla;
  nivelConfianza: NivelConfianzaSinergia;
  aplicarOptimizacion: boolean;
  operarios: number;
  horasJornada: number;
  modoPlanificacion: ModoPlanificacionCuadrilla;
  diasObjetivo: number;
  manoObraList: CategoriaManoDeObra[];
  onChangeEstrategia: (est: EstrategiaCuadrilla) => void;
  onChangeNivelConfianza: (nivel: NivelConfianzaSinergia) => void;
  onToggleOptimizacion: (activar: boolean) => void;
  onChangeOperarios: (n: number) => void;
  onChangeHorasJornada: (h: number) => void;
  onChangeModoPlanificacion: (modo: ModoPlanificacionCuadrilla) => void;
  onChangeDiasObjetivo: (dias: number) => void;
  totales: TotalesPresupuestoResultado;
  gastosConfig: GastoPresupuestoConfig[];
  onOpenGastoModal: (gastoToEdit?: GastoPresupuestoConfig) => void;
  onOpenCatalogPicker: () => void;
  onOpenParametricGastoModal: (gasto: GastoPresupuestoConfig) => void;
  onToggleGasto: (idx: number) => void;
  onRemoveGasto: (id: string) => void;
  onResetGastos?: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export const CuadrillaTab: React.FC<CuadrillaTabProps> = ({
  items,
  estrategia,
  nivelConfianza,
  aplicarOptimizacion,
  operarios,
  horasJornada,
  modoPlanificacion,
  diasObjetivo,
  manoObraList,
  onChangeEstrategia,
  onChangeNivelConfianza,
  onToggleOptimizacion,
  onChangeOperarios,
  onChangeHorasJornada,
  onChangeModoPlanificacion,
  onChangeDiasObjetivo,
  totales,
  gastosConfig,
  onOpenGastoModal,
  onOpenCatalogPicker,
  onOpenParametricGastoModal,
  onToggleGasto,
  onRemoveGasto,
  onResetGastos,
  onNext,
  onPrev
}) => {
  const getDestinoBadge = (destino: DestinoGasto) => {
    switch (destino) {
      case 'mano_obra':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
            <HardHat className="w-3 h-3" /> Mano de Obra
          </span>
        );
      case 'materiales':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
            <Package className="w-3 h-3" /> Materiales
          </span>
        );
      case 'servicios':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
            <Truck className="w-3 h-3" /> Servicios
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
            <Globe className="w-3 h-3" /> Indirecto General
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Planificador de Cuadrilla & Sinergia de Obra */}
      <PlanificadorCuadrillaCard
        items={items}
        operarios={operarios}
        horasEfectivasJornada={horasJornada}
        onSelectHorasEfectivasJornada={onChangeHorasJornada}
        modoPlanificacion={modoPlanificacion}
        onSelectModoPlanificacion={onChangeModoPlanificacion}
        diasObjetivo={diasObjetivo}
        onSelectDiasObjetivo={onChangeDiasObjetivo}
        aplicarOptimizacion={aplicarOptimizacion}
        onSelectOperarios={onChangeOperarios}
        onToggleAplicarOptimizacion={onToggleOptimizacion}
        categoriasManoObra={manoObraList}
        estrategiaSeleccionada={estrategia}
        nivelConfianza={nivelConfianza}
        onSelectEstrategia={onChangeEstrategia}
        onSelectNivelConfianza={onChangeNivelConfianza}
      />

      {/* 2. Gastos Directos & Logística de Obra */}
      <div className="bg-surface-container-low rounded-3xl p-4 sm:p-6 border border-outline-variant/20 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-on-surface">
                Gastos Operativos, Logística & Modificadores
              </h3>
              <p className="text-xs text-on-surface-variant">
                Traslados, fletes, andamios, seguros y gastos adicionales directos o indirectos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {onResetGastos && (
              <button
                type="button"
                onClick={onResetGastos}
                className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-xl border border-outline-variant/20 hover:bg-surface-container-high"
                title="Restablecer gastos por defecto del catálogo"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onOpenCatalogPicker}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl sm:rounded-2xl bg-secondary-container text-on-secondary-container text-xs font-bold hover:bg-secondary-container/80 transition-colors shadow-2xs cursor-pointer"
              title="Elegir gastos existentes del catálogo"
            >
              <BookOpen className="w-4 h-4" />
              <span>Desde Catálogo</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenGastoModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl sm:rounded-2xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors shadow-2xs cursor-pointer"
              title="Crear un nuevo gasto personalizado"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Gasto</span>
            </button>
          </div>
        </div>

        {gastosConfig.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface-container-lowest border border-dashed border-outline-variant/30 text-center space-y-3">
            <p className="text-xs sm:text-sm font-semibold text-on-surface-variant">
              No hay gastos operativos adicionales aplicados a esta cotización.
            </p>
            <button
              type="button"
              onClick={onOpenCatalogPicker}
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-xl text-xs font-bold hover:bg-secondary-container/80 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Explorar catálogo de gastos frecuentes</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {gastosConfig.map((gasto, idx) => {
              const desglosado = totales.gastosDesglosados?.find((d) => d.id === gasto.id);
              const montoCalc = desglosado?.montoCalculado ?? 0;
              const hasParams = Boolean(gasto.parametros && gasto.parametros.length > 0);

              return (
                <div
                  key={gasto.id || idx}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 ${
                    gasto.aplica
                      ? 'bg-surface-container-lowest border-outline-variant/30 shadow-2xs'
                      : 'bg-surface-container/30 border-outline-variant/15 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={gasto.aplica}
                      onChange={() => onToggleGasto(idx)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-on-surface truncate">
                          {gasto.nombre}
                        </span>
                        {getDestinoBadge(gasto.destino || 'costo_indirecto')}
                      </div>

                      <div className="text-xs text-on-surface-variant font-mono flex items-center gap-2 pt-0.5">
                        <span>
                          {gasto.modalidad === 'porcentual'
                            ? `${gasto.valor}% sobre base`
                            : formatARS(gasto.valor)}
                        </span>
                        {hasParams && gasto.valoresParametros && (
                          <span className="text-primary font-sans font-semibold">
                            (paramétrico configurado)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
                    <span className="font-mono text-xs sm:text-sm font-bold text-on-surface">
                      {formatARS(montoCalc)}
                    </span>

                    {hasParams && (
                      <button
                        type="button"
                        onClick={() => onOpenParametricGastoModal(gasto)}
                        className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                        title="Ajustar variables paramétricas del gasto"
                      >
                        <Sliders className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenGastoModal(gasto)}
                      className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                      title="Editar configuración del gasto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveGasto(gasto.id)}
                      className="p-1.5 text-on-surface-variant hover:text-error rounded-lg transition-colors cursor-pointer"
                      title="Quitar gasto"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Navegación entre etapas */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-container-highest text-on-surface rounded-2xl text-xs sm:text-sm font-bold hover:bg-outline-variant/30 transition-all border border-outline-variant/30 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Partidas</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-2xl text-xs sm:text-sm font-bold shadow-md hover:bg-primary/90 transition-all cursor-pointer"
        >
          <span>Continuar a Cierre Comercial</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

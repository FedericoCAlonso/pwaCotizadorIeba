import React from 'react';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  Calculator,
  HardHat,
  Package,
  Truck,
  Globe,
  Percent,
  DollarSign,
  Zap,
  Sparkles,
  Calendar
} from 'lucide-react';
import {
  RolCategoriaManoDeObra,
  DestinoGasto,
  ModalidadGasto
} from '../core/types';
import { formatARS } from '../core/calculations';
import { GastoEditorModal } from './presupuesto/GastoEditorModal';
import { ManoObraEditorModal } from './manoObra/ManoObraEditorModal';
import { useManoObraViewModel } from '../viewmodels/useManoObraViewModel';

export const ManoObraManager: React.FC = () => {
  const {
    manoObraList,
    editingMO,
    isCreatingMO,
    moForm,
    openCreateMO,
    openEditMO,
    closeMOModal,
    handleNombreChange,
    handleRolChange,
    handleHorasJornadaChange,
    handleCostoHoraChange,
    handleCostoJornadaChange,
    handleSaveMO,
    handleDeleteMO,

    gastosCatalogList,
    showGastoModal,
    editingGasto,
    handleOpenCreateGasto,
    handleOpenEditGasto,
    handleCloseGastoModal,
    handleSaveCatalogGasto,
    handleDeleteCatalogGasto,
    handleToggleIncluirPorDefecto
  } = useManoObraViewModel();

  const getRolBadge = (rol?: RolCategoriaManoDeObra) => {
    switch (rol) {
      case 'ayudante':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/20">
            <span>Ayudante / Asistencia</span>
          </span>
        );
      case 'especialista':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-500/20">
            <span>Especialista / Protocolos</span>
          </span>
        );
      case 'independiente':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            <span>Unipersonal / Individual</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
            <span>Oficial / Autónomo</span>
          </span>
        );
    }
  };

  const getDestinoBadge = (destino?: DestinoGasto) => {
    switch (destino) {
      case 'mano_obra':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/20">
            <HardHat className="w-3.5 h-3.5 text-amber-500" />
            <span>Mano de Obra (MOD)</span>
          </span>
        );
      case 'materiales':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full border border-blue-500/20">
            <Package className="w-3.5 h-3.5 text-blue-500" />
            <span>Materiales / Insumos</span>
          </span>
        );
      case 'servicios':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full border border-purple-500/20">
            <Truck className="w-3.5 h-3.5 text-purple-500" />
            <span>Servicios Tercerizados</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-slate-500/10 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-500/20">
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>Costo Indirecto (s/ Total C)</span>
          </span>
        );
    }
  };

  const getModalidadBadge = (modalidad?: ModalidadGasto, formula?: string) => {
    if (modalidad === 'parametrico' || formula) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
          <Zap className="w-3 h-3" />
          <span>Fórmula ⚡</span>
        </span>
      );
    }
    if (modalidad === 'monto_fijo') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full">
          <DollarSign className="w-3 h-3" />
          <span>Monto Fijo</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full">
        <Percent className="w-3 h-3" />
        <span>Porcentual</span>
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: MANO DE OBRA */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span>Categorías de Mano de Obra</span>
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Tarifas por jornada de convenio (UOCRA) y por hora de mano de obra directa (MOD) sin margen.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCreateMO()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs sm:text-sm transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Categoría</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {manoObraList.map((mo) => {
            const hs = mo.horasJornada && mo.horasJornada > 0 ? mo.horasJornada : 9;
            const cj = mo.costoJornada && mo.costoJornada > 0 ? mo.costoJornada : mo.costoHora * hs;

            return (
              <div
                key={mo.id}
                className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all space-y-3 shadow-sm flex flex-col justify-between"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-on-surface text-base">{mo.nombre}</h3>
                      {getRolBadge(mo.rol)}
                    </div>
                    <span className="text-xs text-on-surface-variant block mt-1">
                      Actualizado: {new Date(mo.fechaActualizacion).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditMO(mo)}
                      className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
                      aria-label={`Editar ${mo.nombre}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMO(mo.id)}
                      className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors cursor-pointer"
                      aria-label={`Eliminar ${mo.nombre}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tarifas Duales: Hora y Jornada */}
                <div className="pt-3 border-t border-outline-variant/20 space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-medium text-on-surface-variant">Costo / hora:</span>
                    <span className="font-mono text-xl font-black text-primary">
                      {formatARS(mo.costoHora)}
                      <span className="text-xs text-on-surface-variant font-sans font-normal ml-1">/h</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-on-surface-variant/70" />
                      <span>Jornal ({hs} hs):</span>
                    </span>
                    <span className="font-mono font-bold text-on-surface">
                      {formatARS(cj)}
                      <span className="text-2xs font-normal text-on-surface-variant ml-1">/día</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <hr className="border-outline-variant/20" />

      {/* SECTION 2: GASTOS & MODIFICADORES DEL CATÁLOGO */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              <span>Gastos & Modificadores de Costo (Catálogo)</span>
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Gastos directos (cargas sociales s/MO, garantía s/materiales) o costos indirectos (s/Costo Total C).
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreateGasto}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs sm:text-sm transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Gasto</span>
          </button>
        </div>

        {gastosCatalogList.length === 0 ? (
          <div className="p-8 rounded-3xl bg-surface-container/50 border border-dashed border-outline-variant/30 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-primary mx-auto opacity-75" />
            <p className="text-sm font-semibold text-on-surface">No hay gastos configurados en el catálogo global.</p>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto">
              Presiona <strong>"Nuevo Gasto"</strong> para definir cargas sociales de MO, coeficientes de garantía para materiales o gastos indirectos de obra.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gastosCatalogList.map((g) => {
              const destino = g.destino || (g.tipo === 'porcentual_sobre_costo' ? 'costo_indirecto' : 'costo_indirecto');
              const modalidad = g.modalidad || (g.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo');

              return (
                <div
                  key={g.id}
                  className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all space-y-3 shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-on-surface text-base truncate">{g.nombre}</h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditGasto(g)}
                          className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
                          aria-label={`Editar ${g.nombre}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCatalogGasto(g.id)}
                          className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors cursor-pointer"
                          aria-label={`Eliminar ${g.nombre}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {getDestinoBadge(destino)}
                      {getModalidadBadge(modalidad, g.formula)}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs text-on-surface-variant font-bold uppercase tracking-wider block">
                        Valor / Regla:
                      </span>
                      <span className="font-mono text-base font-black text-primary">
                        {modalidad === 'parametrico' && g.formula ? (
                          <span className="text-xs font-mono bg-surface-container-highest px-2 py-0.5 rounded-md">
                            {g.formula}
                          </span>
                        ) : modalidad === 'porcentual' ? (
                          `${g.valor}%`
                        ) : (
                          formatARS(g.valor)
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleIncluirPorDefecto(g)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-2xs cursor-pointer ${
                        (g.incluirPorDefecto ?? true)
                          ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-surface-container-highest hover:bg-surface-variant text-on-surface-variant border-outline-variant/30 opacity-70'
                      }`}
                      title="Hacer clic para activar o desactivar la inclusión automática en nuevos presupuestos"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          (g.incluirPorDefecto ?? true) ? 'bg-emerald-500' : 'bg-outline-variant'
                        }`}
                      />
                      <span>{(g.incluirPorDefecto ?? true) ? 'Por Defecto: Sí' : 'Por Defecto: No'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Mano de Obra (Doble entrada Jornada UOCRA & Hora) */}
      <ManoObraEditorModal
        isOpen={isCreatingMO || editingMO !== null}
        isCreating={isCreatingMO}
        form={moForm}
        onClose={closeMOModal}
        onNombreChange={handleNombreChange}
        onRolChange={handleRolChange}
        onHorasJornadaChange={handleHorasJornadaChange}
        onCostoHoraChange={handleCostoHoraChange}
        onCostoJornadaChange={handleCostoJornadaChange}
        onSave={handleSaveMO}
      />

      {/* Modal: Gasto del Catálogo Global */}
      <GastoEditorModal
        isOpen={showGastoModal}
        onClose={handleCloseGastoModal}
        gastoToEdit={editingGasto}
        showIncluirPorDefecto={true}
        onSave={handleSaveCatalogGasto}
        onDelete={editingGasto ? handleDeleteCatalogGasto : undefined}
      />
    </div>
  );
};

import React from 'react';
import {
  Plus,
  FolderPlus,
  Folder,
  Trash2,
  AlertCircle,
  Layers,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import {
  ItemPresupuesto,
  CapituloPresupuesto,
  CategoriaManoDeObra
} from '../../../core/types';
import { formatARS, TotalesPresupuestoResultado } from '../../../core/calculations';
import { PresupuestoItemRow } from '../PresupuestoItemRow';

interface PartidasTabProps {
  items: ItemPresupuesto[];
  capitulos: CapituloPresupuesto[];
  totales: TotalesPresupuestoResultado;
  expandedItems: Record<string, boolean>;
  onToggleExpandItem: (id: string) => void;
  itemTitleRefs: React.MutableRefObject<Map<string, HTMLInputElement>>;
  onOpenItemPicker: (capituloId?: string) => void;
  onAddCapitulo: () => void;
  onUpdateCapitulo: (id: string, name: string) => void;
  onRemoveCapitulo: (id: string) => void;
  onAddDirectItem: (capituloId?: string, desc?: string) => void;
  onUpdateItemCondicion: (index: number, condicion: any) => void;
  onUpdateItemQuantity: (index: number, qty: number | null, formula?: string) => void;
  onUpdateItemUnit: (index: number, unit: string) => void;
  onUpdateItemUnitDirectCost: (index: number, cost: number | null) => void;
  onUpdateItemDescription: (index: number, desc: string) => void;
  onUpdateItemNotasTecnicas: (index: number, notas: string) => void;
  onRemoveItem: (index: number) => void;
  onSaveAsTemplate: (item: ItemPresupuesto) => void;
  onOpenParametricModal: (index: number) => void;
  onOpenMaterialModal: (index: number) => void;
  onOpenInSituEditor: (index: number) => void;
  onOpenMaterialPicker: (itemIndex: number) => void;
  onOpenBrandModal: (itemIndex: number, materialIndex: number) => void;
  onUpdateItemMaterialQuantity: (itemIndex: number, materialIndex: number, qty: number | null) => void;
  onRemoveItemMaterial: (itemIndex: number, materialIndex: number) => void;
  onUpdateItemManoObraCost: (index: number, cost: number | null) => void;
  onAddLaborRole: (itemIndex: number, categoriaId: string, horas: number) => void;
  onUpdateItemLaborHours: (itemIndex: number, laborIndex: number, horas: number | null) => void;
  onRemoveItemLabor: (itemIndex: number, laborIndex: number) => void;
  manoObraList: CategoriaManoDeObra[];
  condicionesTrabajo: Array<{ value: string; label: string }>;
  umbralMargenMinimo?: number;
  onNext: () => void;
  onPrev: () => void;
}

export const PartidasTab: React.FC<PartidasTabProps> = ({
  items,
  capitulos,
  totales,
  expandedItems,
  onToggleExpandItem,
  itemTitleRefs,
  onOpenItemPicker,
  onAddCapitulo,
  onUpdateCapitulo,
  onRemoveCapitulo,
  onAddDirectItem,
  onUpdateItemCondicion,
  onUpdateItemQuantity,
  onUpdateItemUnit,
  onUpdateItemUnitDirectCost,
  onUpdateItemDescription,
  onUpdateItemNotasTecnicas,
  onRemoveItem,
  onSaveAsTemplate,
  onOpenParametricModal,
  onOpenMaterialModal,
  onOpenInSituEditor,
  onOpenMaterialPicker,
  onOpenBrandModal,
  onUpdateItemMaterialQuantity,
  onRemoveItemMaterial,
  onUpdateItemManoObraCost,
  onAddLaborRole,
  onUpdateItemLaborHours,
  onRemoveItemLabor,
  manoObraList,
  condicionesTrabajo,
  umbralMargenMinimo = 20,
  onNext,
  onPrev
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Barra de Herramientas de Partidas */}
      <div className="bg-surface-container-low rounded-3xl p-4 sm:p-5 border border-outline-variant/20 shadow-xs flex flex-wrap items-center justify-between gap-3.5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-on-surface">
            Partidas y Cómputo Métrico
          </h2>
          <p className="text-sm text-on-surface-variant font-medium">
            {items.length} {items.length === 1 ? 'partida presupuestada' : 'partidas presupuestadas'}
            {capitulos.length > 0 && ` en ${capitulos.length} ${capitulos.length === 1 ? 'capítulo' : 'capítulos'}`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => onOpenItemPicker(undefined)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold transition-all shadow-xs min-h-[46px] cursor-pointer"
            title="Agregar partida desde catálogo o como ítem libre"
          >
            <Plus className="w-5 h-5" />
            <span>Agregar Partida</span>
          </button>

          <button
            type="button"
            onClick={() => onAddDirectItem(undefined)}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold transition-all border border-outline-variant/30 min-h-[46px] cursor-pointer"
            title="Agregar renglón libre rápido"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>+ Ítem Libre</span>
          </button>

          <button
            type="button"
            onClick={onAddCapitulo}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold transition-all border border-outline-variant/30 min-h-[46px] cursor-pointer"
            title="Crear un nuevo capítulo o ambiente de obra"
          >
            <FolderPlus className="w-4 h-4 text-primary" />
            <span>Nuevo Capítulo</span>
          </button>
        </div>
      </div>

      {/* Alerta de Margen Bajo */}
      {totales.totalARS > 0 && (() => {
        const netMarginPct = ((totales.totalARS - totales.costoTotalObra) / totales.totalARS) * 100;
        if (netMarginPct < umbralMargenMinimo) {
          return (
            <div className="p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-700 dark:text-amber-300 flex items-start gap-3 shadow-xs">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-bold text-base">Advertencia de Margen Bajo ({netMarginPct.toFixed(1)}%)</p>
                <p className="leading-relaxed">
                  El margen neto estimado de esta cotización está por debajo del umbral mínimo de seguridad configurado (<strong>{umbralMargenMinimo}%</strong>).
                </p>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Listado de Partidas */}
      {items.length === 0 ? (
        <div className="text-center py-16 px-4 border-2 border-dashed border-outline-variant/40 rounded-3xl bg-surface-container-low space-y-4">
          <div className="w-14 h-14 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Layers className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <p className="text-lg font-bold text-on-surface">Aún no agregaste partidas a esta cotización.</p>
            <p className="text-sm sm:text-base text-on-surface-variant max-w-md mx-auto leading-relaxed">
              Buscá una tarea en tu catálogo con sus rendimientos precalculados o creá un ítem libre para cotizar al instante.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => onOpenItemPicker(undefined)}
              className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-on-primary rounded-2xl text-sm sm:text-base font-bold shadow-xs hover:bg-primary/90 transition-all cursor-pointer min-h-[46px]"
            >
              <Plus className="w-4 h-4" />
              <span>Explorar Catálogo</span>
            </button>
            <button
              type="button"
              onClick={() => onAddDirectItem(undefined)}
              className="inline-flex items-center gap-2 px-5 py-3 bg-surface-container-highest text-on-surface rounded-2xl text-sm sm:text-base font-semibold hover:bg-outline-variant/30 transition-all border border-outline-variant/30 cursor-pointer min-h-[46px]"
            >
              <span>+ Ítem Libre Directo</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Si NO hay capítulos, renderizar lista plana */}
          {capitulos.length === 0 ? (
            <div className="space-y-3.5">
              {items.map((item, idx) => {
                const isExpanded = !!expandedItems[item.id];
                const calcItem = totales.itemsCalculados[idx] || item;

                return (
                  <PresupuestoItemRow
                    key={item.id}
                    item={item}
                    index={idx}
                    calcItem={calcItem}
                    isExpanded={isExpanded}
                    titleInputRef={(el) => {
                      if (el) itemTitleRefs.current.set(item.id, el);
                      else itemTitleRefs.current.delete(item.id);
                    }}
                    onEnterAtEnd={() => onAddDirectItem(undefined)}
                    onToggleExpand={onToggleExpandItem}
                    onUpdateItemCondicion={onUpdateItemCondicion}
                    onUpdateItemQuantity={onUpdateItemQuantity}
                    onUpdateItemUnit={onUpdateItemUnit}
                    onUpdateItemUnitDirectCost={onUpdateItemUnitDirectCost}
                    onUpdateItemDescription={onUpdateItemDescription}
                    onUpdateItemNotasTecnicas={onUpdateItemNotasTecnicas}
                    onRemoveItem={onRemoveItem}
                    onSaveAsTemplate={onSaveAsTemplate}
                    onOpenParametricModal={onOpenParametricModal}
                    onOpenMaterialModal={onOpenMaterialModal}
                    onOpenInSituEditor={onOpenInSituEditor}
                    onOpenMaterialPicker={onOpenMaterialPicker}
                    onOpenMaterialBrandModal={onOpenBrandModal}
                    onUpdateItemMaterialQuantity={onUpdateItemMaterialQuantity}
                    onRemoveItemMaterial={onRemoveItemMaterial}
                    onUpdateItemManoObraCost={onUpdateItemManoObraCost}
                    onAddLaborRole={onAddLaborRole}
                    onUpdateItemLaborHours={onUpdateItemLaborHours}
                    onRemoveItemLabor={onRemoveItemLabor}
                    categoriasManoObra={manoObraList}
                    condicionesTrabajo={condicionesTrabajo}
                  />
                );
              })}
            </div>
          ) : (
            <div className="space-y-5">
              {capitulos.map((cap) => {
                const capItems = items
                  .map((item, idx) => ({ item, originalIdx: idx }))
                  .filter(({ item }) => item.capituloId === cap.id);

                const capTotal = totales.capitulosTotales?.[cap.id];

                return (
                  <div
                    key={cap.id}
                    className="bg-surface-container/50 border border-outline-variant/30 rounded-3xl p-4 sm:p-5 space-y-3.5"
                  >
                    {/* Chapter Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-outline-variant/20 pb-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-[180px]">
                        <Folder className="w-5 h-5 text-primary shrink-0" />
                        <input
                          type="text"
                          value={cap.nombre}
                          onChange={(e) => onUpdateCapitulo(cap.id, e.target.value)}
                          className="bg-transparent border-none p-0 text-base sm:text-lg font-bold text-on-surface focus:ring-0 w-full min-h-[38px]"
                          placeholder="Nombre del Capítulo..."
                        />
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {capTotal && (
                          <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-3.5 py-1.5 rounded-full border border-primary/20">
                            Subtotal: {formatARS(capTotal.precioVentaTotal)}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => onRemoveCapitulo(cap.id)}
                          className="p-2 text-on-surface-variant hover:text-error rounded-full transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                          title="Eliminar Capítulo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Chapter Items */}
                    {capItems.length === 0 ? (
                      <p className="text-sm text-on-surface-variant/70 italic py-4 text-center">
                        Sin partidas en este capítulo.
                      </p>
                    ) : (
                      <div className="space-y-3.5">
                        {capItems.map(({ item, originalIdx }) => {
                          const isExpanded = !!expandedItems[item.id];
                          const calcItem = totales.itemsCalculados[originalIdx] || item;

                          return (
                            <PresupuestoItemRow
                              key={item.id}
                              item={item}
                              index={originalIdx}
                              calcItem={calcItem}
                              isExpanded={isExpanded}
                              titleInputRef={(el) => {
                                if (el) itemTitleRefs.current.set(item.id, el);
                                else itemTitleRefs.current.delete(item.id);
                              }}
                              onEnterAtEnd={() => onAddDirectItem(cap.id)}
                              onToggleExpand={onToggleExpandItem}
                              onUpdateItemCondicion={onUpdateItemCondicion}
                              onUpdateItemQuantity={onUpdateItemQuantity}
                              onUpdateItemUnit={onUpdateItemUnit}
                              onUpdateItemUnitDirectCost={onUpdateItemUnitDirectCost}
                              onUpdateItemDescription={onUpdateItemDescription}
                              onUpdateItemNotasTecnicas={onUpdateItemNotasTecnicas}
                              onRemoveItem={onRemoveItem}
                              onSaveAsTemplate={onSaveAsTemplate}
                              onOpenParametricModal={onOpenParametricModal}
                              onOpenMaterialModal={onOpenMaterialModal}
                              onOpenInSituEditor={onOpenInSituEditor}
                              onOpenMaterialPicker={onOpenMaterialPicker}
                              onOpenMaterialBrandModal={onOpenBrandModal}
                              onUpdateItemMaterialQuantity={onUpdateItemMaterialQuantity}
                              onRemoveItemMaterial={onRemoveItemMaterial}
                              onUpdateItemManoObraCost={onUpdateItemManoObraCost}
                              onAddLaborRole={onAddLaborRole}
                              onUpdateItemLaborHours={onUpdateItemLaborHours}
                              onRemoveItemLabor={onRemoveItemLabor}
                              categoriasManoObra={manoObraList}
                              condicionesTrabajo={condicionesTrabajo}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Add Item to Chapter button */}
                    <div className="pt-2.5 border-t border-outline-variant/15 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => onOpenItemPicker(cap.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-sm font-bold transition-colors shadow-2xs cursor-pointer min-h-[40px]"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Partida en {cap.nombre || 'este Capítulo'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Unassigned Items Block */}
              {(() => {
                const unassigned = items
                  .map((item, idx) => ({ item, originalIdx: idx }))
                  .filter(({ item }) => !item.capituloId);

                if (unassigned.length === 0) return null;

                return (
                  <div className="bg-surface-container/30 border border-dashed border-outline-variant/30 rounded-3xl p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2.5">
                      <span className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">
                        Partidas Generales (Sin Capítulo Asignado)
                      </span>
                      <span className="text-sm font-mono font-bold text-on-surface-variant">
                        {unassigned.length} {unassigned.length === 1 ? 'partida' : 'partidas'}
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {unassigned.map(({ item, originalIdx }) => {
                        const isExpanded = !!expandedItems[item.id];
                        const calcItem = totales.itemsCalculados[originalIdx] || item;

                        return (
                          <PresupuestoItemRow
                            key={item.id}
                            item={item}
                            index={originalIdx}
                            calcItem={calcItem}
                            isExpanded={isExpanded}
                            titleInputRef={(el) => {
                              if (el) itemTitleRefs.current.set(item.id, el);
                              else itemTitleRefs.current.delete(item.id);
                            }}
                            onEnterAtEnd={() => onAddDirectItem(undefined)}
                            onToggleExpand={onToggleExpandItem}
                            onUpdateItemCondicion={onUpdateItemCondicion}
                            onUpdateItemQuantity={onUpdateItemQuantity}
                            onUpdateItemUnit={onUpdateItemUnit}
                            onUpdateItemUnitDirectCost={onUpdateItemUnitDirectCost}
                            onUpdateItemDescription={onUpdateItemDescription}
                            onUpdateItemNotasTecnicas={onUpdateItemNotasTecnicas}
                            onRemoveItem={onRemoveItem}
                            onSaveAsTemplate={onSaveAsTemplate}
                            onOpenParametricModal={onOpenParametricModal}
                            onOpenMaterialModal={onOpenMaterialModal}
                            onOpenInSituEditor={onOpenInSituEditor}
                            onOpenMaterialPicker={onOpenMaterialPicker}
                            onOpenMaterialBrandModal={onOpenBrandModal}
                            onUpdateItemMaterialQuantity={onUpdateItemMaterialQuantity}
                            onRemoveItemMaterial={onRemoveItemMaterial}
                            onUpdateItemManoObraCost={onUpdateItemManoObraCost}
                            onAddLaborRole={onAddLaborRole}
                            onUpdateItemLaborHours={onUpdateItemLaborHours}
                            onRemoveItemLabor={onRemoveItemLabor}
                            categoriasManoObra={manoObraList}
                            condicionesTrabajo={condicionesTrabajo}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Navegación entre etapas */}
      <div className="flex items-center justify-between pt-3">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex items-center gap-2 px-5 py-3 bg-surface-container-highest text-on-surface rounded-2xl text-sm sm:text-base font-bold hover:bg-outline-variant/30 transition-all border border-outline-variant/30 cursor-pointer min-h-[48px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Obra & Cliente</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-2xl text-sm sm:text-base font-bold shadow-md hover:bg-primary/90 transition-all cursor-pointer min-h-[48px]"
        >
          <span>Continuar a Cuadrilla & Gastos</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

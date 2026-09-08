import React, { useCallback } from 'react';
import {
  ItemPresupuesto,
  AppConfig,
  TipoFactura,
  CategoriaManoDeObra
} from '../core/types';
import {
  obtenerMultiplicadorCondicion,
  roundMoney,
  safeNum
} from '../core/calculations';
import { useToast } from '../contexts/ToastContext';
import { StagedItemPayload } from '../components/tareasTipo/MaterialPickerModal';
import { ApplyBrandPayload } from '../components/presupuesto/MaterialBrandModal';

interface UsePresupuestoItemsOperationsProps {
  items: ItemPresupuesto[];
  setItems: React.Dispatch<React.SetStateAction<ItemPresupuesto[]>>;
  config: AppConfig;
  tipoFactura: TipoFactura;
  manoObraMap: Map<string, CategoriaManoDeObra>;
}

export function usePresupuestoItemsOperations({
  items,
  setItems,
  config,
  tipoFactura,
  manoObraMap
}: UsePresupuestoItemsOperationsProps) {
  const { toast } = useToast();

  const handleUpdateItemCondicion = useCallback(
    (index: number, condicion: 'normal' | 'dificultosa' | 'favorable') => {
      setItems((prev) => {
        const next = [...prev];
        const target = next[index];
        if (!target) return prev;

        const mult = obtenerMultiplicadorCondicion(condicion, {
          multiplicadorCondicionNormal: config.multiplicadorCondicionNormal,
          multiplicadorCondicionDificultosa: config.multiplicadorCondicionDificultosa,
          multiplicadorCondicionFavorable: config.multiplicadorCondicionFavorable
        });

        const manoObraSnap = target.manoObraSnapshot || [];
        const manoObraActualizada = manoObraSnap.map((mo) => {
          const horasAjustadas = mo.horasTotales * mult;
          return {
            ...mo,
            subtotalManoObra: roundMoney(mo.costoHoraCongelado * horasAjustadas)
          };
        });

        const costoManoObra = roundMoney(
          manoObraActualizada.reduce((acc, m) => acc + m.subtotalManoObra, 0)
        );
        const costoInsumos = safeNum(target.costoInsumos);
        const costoServicios = safeNum(target.costoServiciosTercerizados);
        const hasSnapshots =
          (target.insumosSnapshot && target.insumosSnapshot.length > 0) || manoObraSnap.length > 0;

        const costoDirectoTotal = hasSnapshots
          ? roundMoney(costoInsumos + costoManoObra + costoServicios)
          : safeNum(target.costoDirectoTotal);

        next[index] = {
          ...target,
          condicionTrabajo: condicion,
          manoObraSnapshot: manoObraActualizada,
          costoManoObra,
          costoDirectoTotal,
          costoUnitario: roundMoney(costoDirectoTotal / (target.cantidad || 1)),
          costoTotal: costoDirectoTotal
        };
        return next;
      });
    },
    [config, setItems]
  );

  const handleUpdateItemQuantity = useCallback(
    (index: number, qty: number | null, formula?: string) => {
      setItems((prev) => {
        const next = [...prev];
        const target = next[index];
        if (!target) return prev;

        if (qty === null || isNaN(qty as number)) {
          next[index] = {
            ...target,
            cantidad: null as any,
            formulaCantidad: formula
          };
          return next;
        }

        const safeQty = Math.max(0.001, safeNum(qty));
        const prevQty = safeNum(target.cantidad) || 1;

        const insumosSnap = target.insumosSnapshot || [];
        const manoObraSnap = target.manoObraSnapshot || [];

        const insumosActualizados = insumosSnap.map((i) => {
          const unitario = i.cantidadUnitaria ? i.cantidadUnitaria : i.cantidadTotal / prevQty;
          const nuevaCantidadTotal = roundMoney(unitario * safeQty);
          return {
            ...i,
            cantidadTotal: nuevaCantidadTotal,
            cantidadUnitaria: unitario,
            subtotalInsumo: roundMoney(i.precioUnitarioCongelado * nuevaCantidadTotal),
            subtotalInsumoFinal: roundMoney(
              (i.precioFinalUnitarioCongelado || i.precioUnitarioCongelado * 1.21) * nuevaCantidadTotal
            )
          };
        });

        const manoObraActualizada = manoObraSnap.map((m) => {
          const unitario = m.horasUnitarias ? m.horasUnitarias : m.horasTotales / prevQty;
          const nuevasHorasTotales = roundMoney(unitario * safeQty);
          return {
            ...m,
            horasTotales: nuevasHorasTotales,
            horasUnitarias: unitario,
            subtotalManoObra: roundMoney(m.costoHoraCongelado * nuevasHorasTotales)
          };
        });

        const isFacturaC_or_X =
          tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
        const costoInsumos =
          insumosActualizados.length > 0
            ? isFacturaC_or_X
              ? roundMoney(
                  insumosActualizados.reduce(
                    (acc, i) =>
                      acc +
                      (i.subtotalInsumoFinal ??
                        roundMoney(
                          i.precioUnitarioCongelado *
                            (1 + (i.alicuotaIVA ?? 21) / 100) *
                            i.cantidadTotal
                        )),
                    0
                  )
                )
              : roundMoney(insumosActualizados.reduce((acc, i) => acc + i.subtotalInsumo, 0))
            : safeNum(target.costoInsumos);

        const costoManoObra =
          manoObraActualizada.length > 0
            ? roundMoney(manoObraActualizada.reduce((acc, m) => acc + m.subtotalManoObra, 0))
            : safeNum(target.costoManoObra);

        const costoServicios = safeNum(target.costoServiciosTercerizados);
        const hasSnapshots = insumosSnap.length > 0 || manoObraSnap.length > 0;
        const costoUnitario = hasSnapshots
          ? roundMoney((costoInsumos + costoManoObra + costoServicios) / safeQty)
          : safeNum(target.costoUnitario);
        const costoDirectoTotal = hasSnapshots
          ? roundMoney(costoInsumos + costoManoObra + costoServicios)
          : roundMoney(costoUnitario * safeQty);

        next[index] = {
          ...target,
          cantidad: safeQty,
          formulaCantidad: formula,
          insumosSnapshot: insumosActualizados,
          manoObraSnapshot: manoObraActualizada,
          costoInsumos,
          costoManoObra,
          costoUnitario,
          costoDirectoTotal,
          costoTotal: costoDirectoTotal
        };
        return next;
      });
    },
    [tipoFactura, setItems]
  );

  const handleUpdateItemUnitDirectCost = useCallback(
    (index: number, cost: number | null) => {
      setItems((prev) => {
        const next = [...prev];
        const target = next[index];
        if (!target) return prev;

        if (cost === null || isNaN(cost as number)) {
          next[index] = {
            ...target,
            costoUnitario: null as any,
            costoManoObra: 0,
            costoDirectoTotal: 0,
            costoTotal: 0
          };
          return next;
        }

        const safeCost = Math.max(0, safeNum(cost));
        const qty = safeNum(target.cantidad) || 1;
        const costoDirectoTotal = roundMoney(safeCost * qty);

        const hasSnapshots =
          (target.insumosSnapshot && target.insumosSnapshot.length > 0) ||
          (target.manoObraSnapshot && target.manoObraSnapshot.length > 0);
        const costoInsumos = safeNum(target.costoInsumos);
        const costoServicios = safeNum(target.costoServiciosTercerizados);
        const costoManoObra = hasSnapshots
          ? safeNum(target.costoManoObra)
          : Math.max(0, roundMoney(costoDirectoTotal - costoInsumos - costoServicios));

        next[index] = {
          ...target,
          costoUnitario: safeCost,
          costoManoObra,
          costoDirectoTotal,
          costoTotal: costoDirectoTotal
        };
        return next;
      });
    },
    [setItems]
  );

  const handleUpdateItemDescription = useCallback(
    (index: number, desc: string) => {
      setItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], descripcion: desc };
        return next;
      });
    },
    [setItems]
  );

  const handleUpdateItemUnit = useCallback(
    (index: number, unit: string) => {
      setItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], unidad: unit };
        return next;
      });
    },
    [setItems]
  );

  const handleUpdateItemNotasTecnicas = useCallback(
    (index: number, notas: string) => {
      setItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], notasTecnicas: notas };
        return next;
      });
    },
    [setItems]
  );

  const handleAddMaterialsToItem = useCallback(
    (itemIndex: number, stagedItems: StagedItemPayload[]) => {
      if (!stagedItems || stagedItems.length === 0) return;

      setItems((prev) => {
        const next = [...prev];
        const target = next[itemIndex];
        if (!target) return prev;

        const isFacturaC_or_X =
          tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
        const existingSnapshots = [...(target.insumosSnapshot || [])];

        for (const staged of stagedItems) {
          const { material, cantidad } = staged;
          const ali = material.alicuotaIVA ?? config.alicuotaIVAPorDefecto ?? 21;
          const precioNeto = roundMoney(safeNum(material.precioActual));
          const precioFinal = roundMoney(precioNeto * (1 + ali / 100));

          const existingIdx = existingSnapshots.findIndex(
            (s) => s.insumoId === material.id || s.materialId === material.id
          );

          if (existingIdx >= 0) {
            const cur = existingSnapshots[existingIdx];
            const newQty = roundMoney(cur.cantidadTotal + cantidad);
            existingSnapshots[existingIdx] = {
              ...cur,
              cantidadTotal: newQty,
              cantidadUnitaria: roundMoney(newQty / (target.cantidad || 1)),
              subtotalInsumo: roundMoney(cur.precioUnitarioCongelado * newQty),
              subtotalInsumoFinal: roundMoney(
                (cur.precioFinalUnitarioCongelado || precioFinal) * newQty
              )
            };
          } else {
            existingSnapshots.push({
              insumoId: material.id,
              materialId: material.id,
              nombre: material.nombre,
              marca: material.marca,
              productoId: material.productoId,
              unidad: material.unidadVenta || material.unidad || 'u',
              cantidadTotal: cantidad,
              cantidadUnitaria: roundMoney(cantidad / (target.cantidad || 1)),
              precioUnitarioCongelado: precioNeto,
              alicuotaIVA: ali,
              precioFinalUnitarioCongelado: precioFinal,
              subtotalInsumo: roundMoney(precioNeto * cantidad),
              subtotalInsumoFinal: roundMoney(precioFinal * cantidad)
            });
          }
        }

        const costoInsumos = isFacturaC_or_X
          ? roundMoney(
              existingSnapshots.reduce(
                (acc, i) =>
                  acc +
                  (i.subtotalInsumoFinal ??
                    roundMoney(
                      i.precioUnitarioCongelado *
                        (1 + (i.alicuotaIVA ?? 21) / 100) *
                        i.cantidadTotal
                    )),
                0
              )
            )
          : roundMoney(existingSnapshots.reduce((acc, i) => acc + i.subtotalInsumo, 0));

        let costoManoObra = safeNum(target.costoManoObra);
        if (
          costoManoObra === 0 &&
          (!target.insumosSnapshot || target.insumosSnapshot.length === 0) &&
          safeNum(target.costoDirectoTotal) > 0
        ) {
          costoManoObra = safeNum(target.costoDirectoTotal);
        }

        const costoServicios = safeNum(target.costoServiciosTercerizados);
        const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios);
        const safeQty = target.cantidad || 1;

        next[itemIndex] = {
          ...target,
          insumosSnapshot: existingSnapshots,
          costoInsumos,
          costoManoObra,
          costoDirectoTotal,
          costoUnitario: roundMoney(costoDirectoTotal / safeQty),
          costoTotal: costoDirectoTotal
        };

        return next;
      });

      toast.success(
        stagedItems.length === 1
          ? `Material "${stagedItems[0].material.nombre}" incorporado a la partida`
          : `${stagedItems.length} materiales incorporados a la partida`
      );
    },
    [config, tipoFactura, setItems, toast]
  );

  const handleUpdateItemMaterialQuantity = useCallback(
    (itemIndex: number, materialIndex: number, newQty: number | null) => {
      const safeQty = Math.max(0, safeNum(newQty));
      if (safeQty === 0) {
        setItems((prev) => {
          const next = [...prev];
          const target = next[itemIndex];
          if (!target || !target.insumosSnapshot) return prev;

          const snapshots = target.insumosSnapshot.filter((_, idx) => idx !== materialIndex);
          const isFacturaC_or_X =
            tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
          const costoInsumos = isFacturaC_or_X
            ? roundMoney(
                snapshots.reduce(
                  (acc, i) =>
                    acc +
                    (i.subtotalInsumoFinal ??
                      roundMoney(
                        i.precioUnitarioCongelado *
                          (1 + (i.alicuotaIVA ?? 21) / 100) *
                          i.cantidadTotal
                      )),
                  0
                )
              )
            : roundMoney(snapshots.reduce((acc, i) => acc + i.subtotalInsumo, 0));

          const costoDirectoTotal = roundMoney(
            costoInsumos +
              safeNum(target.costoManoObra) +
              safeNum(target.costoServiciosTercerizados)
          );
          const targetQty = target.cantidad || 1;

          next[itemIndex] = {
            ...target,
            insumosSnapshot: snapshots,
            costoInsumos,
            costoDirectoTotal,
            costoUnitario: roundMoney(costoDirectoTotal / targetQty),
            costoTotal: costoDirectoTotal
          };
          return next;
        });
        toast.info('Material quitado de la partida');
        return;
      }

      setItems((prev) => {
        const next = [...prev];
        const target = next[itemIndex];
        if (!target || !target.insumosSnapshot) return prev;

        const snapshots = [...target.insumosSnapshot];
        const snap = snapshots[materialIndex];
        if (!snap) return prev;

        snapshots[materialIndex] = {
          ...snap,
          cantidadTotal: safeQty,
          cantidadUnitaria: roundMoney(safeQty / (target.cantidad || 1)),
          subtotalInsumo: roundMoney(snap.precioUnitarioCongelado * safeQty),
          subtotalInsumoFinal: roundMoney(
            (snap.precioFinalUnitarioCongelado || snap.precioUnitarioCongelado * 1.21) * safeQty
          )
        };

        const isFacturaC_or_X =
          tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
        const costoInsumos = isFacturaC_or_X
          ? roundMoney(
              snapshots.reduce(
                (acc, i) =>
                  acc +
                  (i.subtotalInsumoFinal ??
                    roundMoney(
                      i.precioUnitarioCongelado *
                        (1 + (i.alicuotaIVA ?? 21) / 100) *
                        i.cantidadTotal
                    )),
                0
              )
            )
          : roundMoney(snapshots.reduce((acc, i) => acc + i.subtotalInsumo, 0));

        const costoDirectoTotal = roundMoney(
          costoInsumos +
            safeNum(target.costoManoObra) +
            safeNum(target.costoServiciosTercerizados)
        );
        const targetQty = target.cantidad || 1;

        next[itemIndex] = {
          ...target,
          insumosSnapshot: snapshots,
          costoInsumos,
          costoDirectoTotal,
          costoUnitario: roundMoney(costoDirectoTotal / targetQty),
          costoTotal: costoDirectoTotal
        };
        return next;
      });
    },
    [tipoFactura, setItems, toast]
  );

  const handleRemoveItemMaterial = useCallback(
    (itemIndex: number, materialIndex: number) => {
      setItems((prev) => {
        const next = [...prev];
        const target = next[itemIndex];
        if (!target || !target.insumosSnapshot) return prev;

        const snapshots = target.insumosSnapshot.filter((_, idx) => idx !== materialIndex);
        const isFacturaC_or_X =
          tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
        const costoInsumos = isFacturaC_or_X
          ? roundMoney(
              snapshots.reduce(
                (acc, i) =>
                  acc +
                  (i.subtotalInsumoFinal ??
                    roundMoney(
                      i.precioUnitarioCongelado *
                        (1 + (i.alicuotaIVA ?? 21) / 100) *
                        i.cantidadTotal
                    )),
                0
              )
            )
          : roundMoney(snapshots.reduce((acc, i) => acc + i.subtotalInsumo, 0));

        const costoDirectoTotal = roundMoney(
          costoInsumos +
            safeNum(target.costoManoObra) +
            safeNum(target.costoServiciosTercerizados)
        );
        const targetQty = target.cantidad || 1;

        next[itemIndex] = {
          ...target,
          insumosSnapshot: snapshots,
          costoInsumos,
          costoDirectoTotal,
          costoUnitario: roundMoney(costoDirectoTotal / targetQty),
          costoTotal: costoDirectoTotal
        };
        return next;
      });
      toast.info('Material quitado de la partida');
    },
    [tipoFactura, setItems, toast]
  );

  const handleApplyMaterialBrand = useCallback(
    (
      brandTarget: { itemIndex: number; materialIndex: number } | null,
      payload: ApplyBrandPayload
    ) => {
      if (!brandTarget) return;
      const { itemIndex, materialIndex } = brandTarget;

      setItems((prev) => {
        const next = [...prev];
        const target = next[itemIndex];
        if (!target || !target.insumosSnapshot) return prev;

        const snapshots = [...target.insumosSnapshot];
        const snap = snapshots[materialIndex];
        if (!snap) return prev;

        const newPrice = roundMoney(
          payload.precioUnitario > 0 ? payload.precioUnitario : snap.precioUnitarioCongelado
        );
        const ali = snap.alicuotaIVA ?? config.alicuotaIVAPorDefecto ?? 21;
        const newPriceFinal = roundMoney(newPrice * (1 + ali / 100));

        snapshots[materialIndex] = {
          ...snap,
          marca: payload.marca || undefined,
          productoId: payload.productoId,
          ofertaId: payload.ofertaId,
          precioUnitarioCongelado: newPrice,
          precioFinalUnitarioCongelado: newPriceFinal,
          subtotalInsumo: roundMoney(newPrice * snap.cantidadTotal),
          subtotalInsumoFinal: roundMoney(newPriceFinal * snap.cantidadTotal)
        };

        const isFacturaC_or_X =
          tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
        const costoInsumos = isFacturaC_or_X
          ? roundMoney(
              snapshots.reduce(
                (acc, i) =>
                  acc +
                  (i.subtotalInsumoFinal ??
                    roundMoney(
                      i.precioUnitarioCongelado *
                        (1 + (i.alicuotaIVA ?? 21) / 100) *
                        i.cantidadTotal
                    )),
                0
              )
            )
          : roundMoney(snapshots.reduce((acc, i) => acc + i.subtotalInsumo, 0));

        const costoDirectoTotal = roundMoney(
          costoInsumos +
            safeNum(target.costoManoObra) +
            safeNum(target.costoServiciosTercerizados)
        );
        const targetQty = target.cantidad || 1;

        next[itemIndex] = {
          ...target,
          insumosSnapshot: snapshots,
          costoInsumos,
          costoDirectoTotal,
          costoUnitario: roundMoney(costoDirectoTotal / targetQty),
          costoTotal: costoDirectoTotal
        };
        return next;
      });

      toast.success(
        payload.marca
          ? `Marca "${payload.marca}" asignada al material`
          : 'Material actualizado a genérico / sin marca'
      );
    },
    [config, tipoFactura, setItems, toast]
  );

  const handleUpdateItemManoObraCost = useCallback(
    (index: number, moCost: number | null) => {
      const safeMOCost = Math.max(0, safeNum(moCost));
      setItems((prev) => {
        const next = [...prev];
        const target = next[index];
        if (!target) return prev;
        const costoInsumos = safeNum(target.costoInsumos);
        const costoServicios = safeNum(target.costoServiciosTercerizados);
        const costoDirectoTotal = roundMoney(costoInsumos + safeMOCost + costoServicios);
        const qty = target.cantidad || 1;

        next[index] = {
          ...target,
          costoManoObra: safeMOCost,
          costoDirectoTotal,
          costoUnitario: roundMoney(costoDirectoTotal / qty),
          costoTotal: costoDirectoTotal
        };
        return next;
      });
    },
    [setItems]
  );

  const handleAddLaborToItem = useCallback(
    (itemIndex: number, categoriaId: string, horas: number) => {
      const catMO = manoObraMap.get(categoriaId);
      if (!catMO) return;

      const safeHoras = Math.max(0.1, safeNum(horas) || 1);
      const costoHora = roundMoney(safeNum(catMO.costoHora));

      setItems((prev) => {
        const next = [...prev];
        const target = next[itemIndex];
        if (!target) return prev;

        const mult = obtenerMultiplicadorCondicion(target.condicionTrabajo || 'normal', {
          multiplicadorCondicionNormal: config.multiplicadorCondicionNormal,
          multiplicadorCondicionDificultosa: config.multiplicadorCondicionDificultosa,
          multiplicadorCondicionFavorable: config.multiplicadorCondicionFavorable
        });

        const existingSnapshots = [...(target.manoObraSnapshot || [])];
        const existingIdx = existingSnapshots.findIndex((s) => s.categoriaId === categoriaId);

        if (existingIdx >= 0) {
          const cur = existingSnapshots[existingIdx];
          const newHoras = roundMoney(cur.horasTotales + safeHoras);
          existingSnapshots[existingIdx] = {
            ...cur,
            horasTotales: newHoras,
            horasUnitarias: roundMoney(newHoras / (target.cantidad || 1)),
            subtotalManoObra: roundMoney(cur.costoHoraCongelado * (newHoras * mult))
          };
        } else {
          existingSnapshots.push({
            categoriaId: catMO.id,
            nombreCategoria: catMO.nombre,
            horasUnitarias: roundMoney(safeHoras / (target.cantidad || 1)),
            horasTotales: safeHoras,
            costoHoraCongelado: costoHora,
            subtotalManoObra: roundMoney(costoHora * (safeHoras * mult))
          });
        }

        const costoManoObra = roundMoney(
          existingSnapshots.reduce((acc, m) => acc + m.subtotalManoObra, 0)
        );
        const isFacturaC_or_X =
          tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
        const insumosSnap = target.insumosSnapshot || [];
        const costoInsumos =
          insumosSnap.length > 0
            ? isFacturaC_or_X
              ? roundMoney(
                  insumosSnap.reduce(
                    (acc, i) =>
                      acc +
                      (i.subtotalInsumoFinal ??
                        roundMoney(
                          i.precioUnitarioCongelado *
                            (1 + (i.alicuotaIVA ?? 21) / 100) *
                            i.cantidadTotal
                        )),
                    0
                  )
                )
              : roundMoney(insumosSnap.reduce((acc, i) => acc + i.subtotalInsumo, 0))
            : safeNum(target.costoInsumos);

        const costoServicios = safeNum(target.costoServiciosTercerizados);
        const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios);
        const safeQty = target.cantidad || 1;

        next[itemIndex] = {
          ...target,
          manoObraSnapshot: existingSnapshots,
          costoManoObra,
          costoDirectoTotal,
          costoUnitario: roundMoney(costoDirectoTotal / safeQty),
          costoTotal: costoDirectoTotal
        };

        return next;
      });

      toast.success(`Mano de obra "${catMO.nombre}" agregada a la partida`);
    },
    [config, manoObraMap, tipoFactura, setItems, toast]
  );

  const handleUpdateItemLaborHours = useCallback(
    (itemIndex: number, laborIndex: number, newHours: number | null) => {
      const safeHours = Math.max(0, safeNum(newHours));
      if (safeHours === 0) {
        setItems((prev) => {
          const next = [...prev];
          const target = next[itemIndex];
          if (!target || !target.manoObraSnapshot) return prev;

          const snapshots = target.manoObraSnapshot.filter((_, idx) => idx !== laborIndex);
          const costoManoObra = roundMoney(
            snapshots.reduce((acc, m) => acc + m.subtotalManoObra, 0)
          );
          const isFacturaC_or_X =
            tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
          const insumosSnap = target.insumosSnapshot || [];
          const costoInsumos =
            insumosSnap.length > 0
              ? isFacturaC_or_X
                ? roundMoney(
                    insumosSnap.reduce(
                      (acc, i) =>
                        acc +
                        (i.subtotalInsumoFinal ??
                          roundMoney(
                            i.precioUnitarioCongelado *
                              (1 + (i.alicuotaIVA ?? 21) / 100) *
                              i.cantidadTotal
                          )),
                      0
                    )
                  )
                : roundMoney(insumosSnap.reduce((acc, i) => acc + i.subtotalInsumo, 0))
              : safeNum(target.costoInsumos);

          const costoServicios = safeNum(target.costoServiciosTercerizados);
          const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios);
          const targetQty = target.cantidad || 1;

          next[itemIndex] = {
            ...target,
            manoObraSnapshot: snapshots,
            costoManoObra,
            costoDirectoTotal,
            costoUnitario: roundMoney(costoDirectoTotal / targetQty),
            costoTotal: costoDirectoTotal
          };

          return next;
        });
        toast.info('Rol de mano de obra quitado de la partida');
        return;
      }

      setItems((prev) => {
        const next = [...prev];
        const target = next[itemIndex];
        if (!target || !target.manoObraSnapshot) return prev;

        const mult = obtenerMultiplicadorCondicion(target.condicionTrabajo || 'normal', {
          multiplicadorCondicionNormal: config.multiplicadorCondicionNormal,
          multiplicadorCondicionDificultosa: config.multiplicadorCondicionDificultosa,
          multiplicadorCondicionFavorable: config.multiplicadorCondicionFavorable
        });

        const snapshots = [...target.manoObraSnapshot];
        const snap = snapshots[laborIndex];
        if (!snap) return prev;

        snapshots[laborIndex] = {
          ...snap,
          horasTotales: safeHours,
          horasUnitarias: roundMoney(safeHours / (target.cantidad || 1)),
          subtotalManoObra: roundMoney(snap.costoHoraCongelado * (safeHours * mult))
        };

        const costoManoObra = roundMoney(
          snapshots.reduce((acc, m) => acc + m.subtotalManoObra, 0)
        );
        const isFacturaC_or_X =
          tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
        const insumosSnap = target.insumosSnapshot || [];
        const costoInsumos =
          insumosSnap.length > 0
            ? isFacturaC_or_X
              ? roundMoney(
                  insumosSnap.reduce(
                    (acc, i) =>
                      acc +
                      (i.subtotalInsumoFinal ??
                        roundMoney(
                          i.precioUnitarioCongelado *
                            (1 + (i.alicuotaIVA ?? 21) / 100) *
                            i.cantidadTotal
                        )),
                    0
                  )
                )
              : roundMoney(insumosSnap.reduce((acc, i) => acc + i.subtotalInsumo, 0))
            : safeNum(target.costoInsumos);

        const costoServicios = safeNum(target.costoServiciosTercerizados);
        const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios);
        const targetQty = target.cantidad || 1;

        next[itemIndex] = {
          ...target,
          manoObraSnapshot: snapshots,
          costoManoObra,
          costoDirectoTotal,
          costoUnitario: roundMoney(costoDirectoTotal / targetQty),
          costoTotal: costoDirectoTotal
        };

        return next;
      });
    },
    [config, tipoFactura, setItems, toast]
  );

  const handleRemoveItemLabor = useCallback(
    (itemIndex: number, laborIndex: number) => {
      setItems((prev) => {
        const next = [...prev];
        const target = next[itemIndex];
        if (!target || !target.manoObraSnapshot) return prev;

        const snapshots = target.manoObraSnapshot.filter((_, idx) => idx !== laborIndex);
        const costoManoObra = roundMoney(
          snapshots.reduce((acc, m) => acc + m.subtotalManoObra, 0)
        );
        const isFacturaC_or_X =
          tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
        const insumosSnap = target.insumosSnapshot || [];
        const costoInsumos =
          insumosSnap.length > 0
            ? isFacturaC_or_X
              ? roundMoney(
                  insumosSnap.reduce(
                    (acc, i) =>
                      acc +
                      (i.subtotalInsumoFinal ??
                        roundMoney(
                          i.precioUnitarioCongelado *
                            (1 + (i.alicuotaIVA ?? 21) / 100) *
                            i.cantidadTotal
                        )),
                    0
                  )
                )
              : roundMoney(insumosSnap.reduce((acc, i) => acc + i.subtotalInsumo, 0))
            : safeNum(target.costoInsumos);

        const costoServicios = safeNum(target.costoServiciosTercerizados);
        const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios);
        const targetQty = target.cantidad || 1;

        next[itemIndex] = {
          ...target,
          manoObraSnapshot: snapshots,
          costoManoObra,
          costoDirectoTotal,
          costoUnitario: roundMoney(costoDirectoTotal / targetQty),
          costoTotal: costoDirectoTotal
        };

        return next;
      });

      toast.info('Rol de mano de obra quitado de la partida');
    },
    [tipoFactura, setItems, toast]
  );

  return {
    handleUpdateItemCondicion,
    handleUpdateItemQuantity,
    handleUpdateItemUnit,
    handleUpdateItemUnitDirectCost,
    handleUpdateItemDescription,
    handleUpdateItemNotasTecnicas,
    handleAddMaterialsToItem,
    handleUpdateItemMaterialQuantity,
    handleRemoveItemMaterial,
    handleApplyMaterialBrand,
    handleUpdateItemManoObraCost,
    handleAddLaborToItem,
    handleUpdateItemLaborHours,
    handleRemoveItemLabor
  };
}

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import {
  Presupuesto,
  AppConfig,
  EstadoPresupuesto,
  MaterialFilterContext,
  OpcionesEmisionPresupuesto
} from '../core/types';
import {
  calcularTotalesPresupuesto,
  generarImpuestosPorDefecto,
  roundMoney
} from '../core/calculations';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';

export interface UsePresupuestoDetailViewModelProps {
  presupuestoId: string;
  config: AppConfig;
  onEdit: () => void;
  onDuplicate: (p: Presupuesto) => void;
  onViewMaterialsInCatalog?: (ctx: MaterialFilterContext) => void;
}

export function usePresupuestoDetailViewModel({
  presupuestoId,
  config,
  onEdit,
  onDuplicate,
  onViewMaterialsInCatalog
}: UsePresupuestoDetailViewModelProps) {
  const { toast } = useToast();
  const confirm = useConfirm();

  // ─── Data Access ──────────────────────────────────────────────────────────────
  const presupuestos = useLiveQuery(() => db.presupuestos.where('id').equals(presupuestoId).toArray(), [presupuestoId]);
  const presupuesto = presupuestos && presupuestos.length > 0 ? presupuestos[0] : null;

  const rawContactos = useLiveQuery(() => db.contactos.toArray()) || [];
  const rawClientes = useLiveQuery(() => db.clientes.toArray()) || [];
  const cliente = useMemo(() => {
    if (!presupuesto?.clienteId) return null;
    const fromContactos = rawContactos.find(c => c.id === presupuesto.clienteId && !c.deleted);
    if (fromContactos) return fromContactos;
    return rawClientes.find(c => c.id === presupuesto.clienteId && !c.deleted) || null;
  }, [presupuesto, rawContactos, rawClientes]);

  const [activeTab, setActiveTab] = useState<'presupuesto' | 'computo'>('presupuesto');
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  // ─── Actions & Commands ───────────────────────────────────────────────────────
  const handleUpdateStatus = async (nuevoEstado: EstadoPresupuesto) => {
    if (!presupuesto) return;
    await db.presupuestos.update(presupuesto.id, { estado: nuevoEstado, fechaModificacion: new Date().toISOString() });
    toast.success(`Estado actualizado a: ${nuevoEstado}`);
  };

  const handleOpenMaterialsInCatalog = () => {
    if (!presupuesto || !onViewMaterialsInCatalog) return;
    const matQtyMap: Record<string, { cantidad: number; unidad: string }> = {};
    const idsSet = new Set<string>();
    const namesSet = new Set<string>();

    presupuesto.items.forEach((it) => {
      (it.insumosSnapshot || []).forEach((ins: any) => {
        const id = ins.materialId || ins.insumoId || ins.id;
        if (id) {
          idsSet.add(id);
          const current = matQtyMap[id]?.cantidad || 0;
          matQtyMap[id] = {
            cantidad: roundMoney(current + (ins.cantidadTotal || 0)),
            unidad: ins.unidadVenta || ins.unidad || 'u'
          };
        }
        if (ins.nombre && ins.nombre.trim() && ins.nombre !== 'Insumo no encontrado') {
          namesSet.add(ins.nombre.trim());
        }
      });
    });

    if (idsSet.size === 0 && namesSet.size === 0) {
      toast.info('Esta cotización está compuesta por partidas libres sin despiece de insumos catalogados.');
      return;
    }

    onViewMaterialsInCatalog({
      title: `Cotización ${presupuesto.numero}`,
      materialIds: Array.from(idsSet),
      materialNames: Array.from(namesSet),
      quantities: matQtyMap,
      returnTab: 'presupuestos',
      returnViewMode: 'detail',
      returnPresupuestoId: presupuesto.id
    });
  };

  const handleRevalidateWithCatalog = async () => {
    if (!presupuesto) return;
    setIsUpdatingPrices(true);
    try {
      const allOfertas = await db.ofertas.toArray();
      const sortedOfertas = [...allOfertas].filter(o => !o.deleted).sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());

      let updatedCount = 0;
      const updatedItems = presupuesto.items.map((it) => {
        if (!it.insumosSnapshot || it.insumosSnapshot.length === 0) return it;
        const nextSnap = it.insumosSnapshot.map((ins) => {
          const matId = ins.materialId || (ins as any).insumoId;
          const latestOferta = sortedOfertas.filter(o => o.materialId === matId).pop();
          if (latestOferta && latestOferta.precio > 0) {
            const newPrice = latestOferta.precio;
            const ali = ins.alicuotaIVA ?? 21;
            const newFinalPrice = latestOferta.precioFinal ?? (newPrice * (1 + ali / 100));
            if (newPrice !== ins.precioUnitarioCongelado) {
              updatedCount++;
            }
            return {
              ...ins,
              precioUnitarioCongelado: newPrice,
              precioFinalUnitarioCongelado: newFinalPrice,
              subtotalInsumo: roundMoney(newPrice * (ins.cantidadTotal || 1)),
              subtotalInsumoFinal: roundMoney(newFinalPrice * (ins.cantidadTotal || 1))
            };
          }
          return ins;
        });

        const isFacturaC_or_X = presupuesto.tipoFactura === 'Factura C' || presupuesto.tipoFactura === 'Presupuesto X (Sin Factura)';
        const costoInsumosNeto = roundMoney(nextSnap.reduce((acc, i) => acc + i.subtotalInsumo, 0));
        const costoInsumosFinal = roundMoney(nextSnap.reduce((acc, i) => acc + (i.subtotalInsumoFinal ?? i.subtotalInsumo), 0));
        const costoInsumos = isFacturaC_or_X ? costoInsumosFinal : costoInsumosNeto;
        const costoMO = it.costoManoObra || 0;
        const costoDirectoTotal = roundMoney(costoInsumos + costoMO);

        return {
          ...it,
          insumosSnapshot: nextSnap,
          costoInsumos,
          costoDirectoTotal,
          costoUnitario: roundMoney(costoDirectoTotal / (it.cantidad || 1)),
          costoTotal: costoDirectoTotal
        };
      });

      const calculatedTotals = calcularTotalesPresupuesto({
        items: updatedItems,
        costosIndirectosConfig: presupuesto.costosIndirectosConfig || [],
        costosIndirectosCatalog: [],
        beneficioPorcentaje: presupuesto.beneficioPorcentaje ?? presupuesto.margenPorcentaje ?? 30,
        tipoFactura: presupuesto.tipoFactura,
        impuestosDetalle: presupuesto.impuestosDetalle || [],
        cotizacionMonedaExtranjera: presupuesto.cotizacionMonedaExtranjera || 1200
      });

      await db.presupuestos.update(presupuesto.id, {
        items: calculatedTotals.itemsCalculados,
        costoGlobal: calculatedTotals.costoGlobal,
        subtotalInsumos: calculatedTotals.subtotalInsumos,
        subtotalManoObra: calculatedTotals.subtotalManoObra,
        subtotalCostosDirectos: calculatedTotals.costoGlobal,
        subtotalCostosIndirectos: calculatedTotals.gastosGeneralesTotal,
        gastosGeneralesTotal: calculatedTotals.gastosGeneralesTotal,
        costoTotalObra: calculatedTotals.costoTotalObra,
        beneficioMonto: calculatedTotals.beneficioMonto,
        montoGanancia: calculatedTotals.beneficioMonto,
        subtotalSinImpuestos: calculatedTotals.subtotalSinImpuestos,
        montoImpuestosTotal: calculatedTotals.montoImpuestosTotal,
        montoImpuestos: calculatedTotals.montoImpuestosTotal,
        precioFinalGlobal: calculatedTotals.precioFinalGlobal,
        totalARS: calculatedTotals.precioFinalGlobal,
        totalMonedaExtranjera: calculatedTotals.totalMonedaExtranjera,
        fechaModificacion: new Date().toISOString()
      });

      if (updatedCount > 0) {
        toast.success(`Se actualizaron ${updatedCount} precios de insumos con las ofertas vigentes del catálogo.`);
      } else {
        toast.info('Los precios de los insumos ya coinciden con la última oferta vigente.');
      }
    } catch (err) {
      console.error('Error al revalidar precios:', err);
      toast.error('Ocurrió un error al actualizar los precios.');
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const handleDelete = async () => {
    if (!presupuesto) return;
    const ok = await confirm({
      title: 'Eliminar Cotización',
      message: `¿Estás seguro de eliminar la cotización ${presupuesto.numero}?`,
      confirmText: 'Eliminar',
      isDestructive: true
    });
    if (ok) {
      await db.presupuestos.delete(presupuesto.id);
      toast.info('Presupuesto eliminado');
    }
  };

  const handleUpdateOpcionesEmision = async (updates: Partial<OpcionesEmisionPresupuesto>) => {
    if (!presupuesto) return;
    const updated = {
      ...presupuesto.opcionesEmision,
      ...updates
    };
    await db.presupuestos.update(presupuesto.id, {
      opcionesEmision: updated,
      fechaModificacion: new Date().toISOString()
    });
  };

  return {
    presupuesto,
    cliente,
    activeTab,
    setActiveTab,
    isUpdatingPrices,
    handleUpdateStatus,
    handleOpenMaterialsInCatalog,
    handleRevalidateWithCatalog,
    handleDelete,
    handleUpdateOpcionesEmision,
    onEdit,
    onDuplicate
  };
}

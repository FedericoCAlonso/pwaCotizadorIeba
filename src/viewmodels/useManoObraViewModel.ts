import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, softDelete } from '../db/database';
import {
  CategoriaManoDeObra,
  RolCategoriaManoDeObra,
  CostoIndirecto,
  GastoPresupuestoConfig
} from '../core/types';
import {
  safeNum,
  calcularCostoHoraDesdeJornada,
  calcularCostoJornadaDesdeHora
} from '../core/calculations';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';

export interface ManoObraFormState {
  nombre: string;
  costoHora: number | string;
  costoJornada: number | string;
  horasJornada: number;
  rol: RolCategoriaManoDeObra;
}

export const DEFAULT_MANO_OBRA_FORM: ManoObraFormState = {
  nombre: '',
  costoHora: 8000,
  costoJornada: 72000,
  horasJornada: 9,
  rol: 'oficial'
};

export function useManoObraViewModel() {
  const { toast } = useToast();
  const confirm = useConfirm();

  // ─── Data Access (Dexie Live Queries) ─────────────────────────────────────────
  const rawManoObra = useLiveQuery(() => db.manoObra.toArray());
  const rawCostosIndirectos = useLiveQuery(() => db.costosIndirectos.toArray());

  const manoObraList: CategoriaManoDeObra[] = useMemo(
    () => (rawManoObra || []).filter((m) => !m.deleted),
    [rawManoObra]
  );

  const gastosCatalogList: CostoIndirecto[] = useMemo(
    () => (rawCostosIndirectos || []).filter((c) => !c.deleted),
    [rawCostosIndirectos]
  );

  // ─── Mano de Obra State ───────────────────────────────────────────────────────
  const [editingMO, setEditingMO] = useState<CategoriaManoDeObra | null>(null);
  const [isCreatingMO, setIsCreatingMO] = useState(false);
  const [moForm, setMOForm] = useState<ManoObraFormState>(DEFAULT_MANO_OBRA_FORM);

  // ─── Gastos (Catálogo Global) State ───────────────────────────────────────────
  const [showGastoModal, setShowGastoModal] = useState(false);
  const [editingGasto, setEditingGasto] = useState<GastoPresupuestoConfig | null>(null);

  // ─── Global Shortcut Listener ─────────────────────────────────────────────────
  useEffect(() => {
    const handleNew = () => {
      openCreateMO();
    };
    window.addEventListener('app:shortcut-new', handleNew);
    return () => window.removeEventListener('app:shortcut-new', handleNew);
  }, []);

  // ─── Mano de Obra Form Handlers ───────────────────────────────────────────────
  const openCreateMO = (defaultRol: RolCategoriaManoDeObra = 'oficial') => {
    const defaultHora = 8000;
    const defaultHs = 9;
    setMOForm({
      nombre: '',
      costoHora: defaultHora,
      costoJornada: calcularCostoJornadaDesdeHora(defaultHora, defaultHs),
      horasJornada: defaultHs,
      rol: defaultRol
    });
    setEditingMO(null);
    setIsCreatingMO(true);
  };

  const openEditMO = (mo: CategoriaManoDeObra) => {
    const hs = mo.horasJornada && mo.horasJornada > 0 ? mo.horasJornada : 9;
    const cj = mo.costoJornada && mo.costoJornada > 0
      ? mo.costoJornada
      : calcularCostoJornadaDesdeHora(mo.costoHora, hs);

    setMOForm({
      nombre: mo.nombre,
      costoHora: mo.costoHora,
      costoJornada: cj,
      horasJornada: hs,
      rol: mo.rol || 'oficial'
    });
    setEditingMO(mo);
    setIsCreatingMO(false);
  };

  const closeMOModal = () => {
    setIsCreatingMO(false);
    setEditingMO(null);
  };

  const handleNombreChange = (nombre: string) => {
    setMOForm((prev) => ({ ...prev, nombre }));
  };

  const handleRolChange = (rol: RolCategoriaManoDeObra) => {
    setMOForm((prev) => ({ ...prev, rol }));
  };

  const handleHorasJornadaChange = (horas: number) => {
    const hs = Math.max(1, Math.min(24, Math.round(horas)));
    setMOForm((prev) => {
      const numHora = typeof prev.costoHora === 'number' ? prev.costoHora : parseFloat(prev.costoHora);
      const newCostoJornada = !isNaN(numHora) && numHora > 0
        ? calcularCostoJornadaDesdeHora(numHora, hs)
        : prev.costoJornada;

      return {
        ...prev,
        horasJornada: hs,
        costoJornada: newCostoJornada
      };
    });
  };

  const handleCostoHoraChange = (val: number | string) => {
    setMOForm((prev) => {
      if (val === '') {
        return { ...prev, costoHora: '', costoJornada: '' };
      }
      const num = typeof val === 'number' ? val : parseFloat(val);
      if (isNaN(num)) {
        return { ...prev, costoHora: val };
      }
      const cj = calcularCostoJornadaDesdeHora(num, prev.horasJornada);
      return { ...prev, costoHora: val, costoJornada: cj };
    });
  };

  const handleCostoJornadaChange = (val: number | string) => {
    setMOForm((prev) => {
      if (val === '') {
        return { ...prev, costoJornada: '', costoHora: '' };
      }
      const num = typeof val === 'number' ? val : parseFloat(val);
      if (isNaN(num)) {
        return { ...prev, costoJornada: val };
      }
      const ch = calcularCostoHoraDesdeJornada(num, prev.horasJornada);
      return { ...prev, costoJornada: val, costoHora: ch };
    });
  };

  const handleSaveMO = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const now = new Date().toISOString();
    const safeHora = safeNum(moForm.costoHora);
    const safeHs = moForm.horasJornada > 0 ? moForm.horasJornada : 9;
    const safeJornada = safeNum(moForm.costoJornada) > 0
      ? safeNum(moForm.costoJornada)
      : calcularCostoJornadaDesdeHora(safeHora, safeHs);

    if (!moForm.nombre.trim()) {
      toast.error('El nombre de la categoría es obligatorio');
      return;
    }

    if (isCreatingMO) {
      await db.manoObra.add({
        id: `mo-${crypto.randomUUID()}`,
        nombre: moForm.nombre.trim(),
        costoHora: safeHora,
        horasJornada: safeHs,
        costoJornada: safeJornada,
        rol: moForm.rol,
        fechaActualizacion: now,
        createdAt: now,
        updatedAt: now,
        deleted: false
      });
      toast.success('Categoría de mano de obra creada');
      closeMOModal();
    } else if (editingMO) {
      await db.manoObra.update(editingMO.id, {
        nombre: moForm.nombre.trim(),
        costoHora: safeHora,
        horasJornada: safeHs,
        costoJornada: safeJornada,
        rol: moForm.rol,
        fechaActualizacion: now,
        updatedAt: now
      });
      toast.success('Categoría de mano de obra actualizada');
      closeMOModal();
    }
  };

  const handleDeleteMO = async (id: string) => {
    const ok = await confirm({
      title: 'Eliminar Mano de Obra',
      message: '¿Estás seguro de eliminar esta categoría de mano de obra del catálogo?',
      confirmText: 'Eliminar',
      isDestructive: true
    });
    if (ok) {
      await softDelete('manoObra', id);
      toast.success('Categoría eliminada');
    }
  };

  // ─── Gastos del Catálogo Handlers ─────────────────────────────────────────────
  const handleOpenCreateGasto = () => {
    setEditingGasto(null);
    setShowGastoModal(true);
  };

  const handleOpenEditGasto = (g: CostoIndirecto) => {
    const configFormat: GastoPresupuestoConfig = {
      id: g.id,
      costoIndirectoId: g.id,
      nombre: g.nombre,
      destino: g.destino || (g.tipo === 'porcentual_sobre_costo' ? 'costo_indirecto' : 'costo_indirecto'),
      modalidad: g.modalidad || (g.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo'),
      valor: g.valor,
      formula: g.formula,
      incluirPorDefecto: g.incluirPorDefecto ?? true,
      aplica: true
    };
    setEditingGasto(configFormat);
    setShowGastoModal(true);
  };

  const handleCloseGastoModal = () => {
    setShowGastoModal(false);
    setEditingGasto(null);
  };

  const handleSaveCatalogGasto = async (gasto: GastoPresupuestoConfig) => {
    const now = new Date().toISOString();
    const existing = gastosCatalogList.find((g) => g.id === gasto.id);

    const catalogRecord: CostoIndirecto = {
      id: gasto.id,
      nombre: gasto.nombre,
      destino: gasto.destino || 'costo_indirecto',
      modalidad: gasto.modalidad || 'porcentual',
      valor: gasto.valor,
      formula: gasto.formula,
      parametros: gasto.parametros,
      tipo: gasto.modalidad === 'porcentual' ? 'porcentual_sobre_costo' : 'fijo_mensual',
      incluirPorDefecto: gasto.incluirPorDefecto ?? true,
      updatedAt: now
    };

    if (existing) {
      await db.costosIndirectos.update(gasto.id, catalogRecord as any);
      toast.success(`Gasto "${gasto.nombre}" actualizado`);
    } else {
      catalogRecord.createdAt = now;
      catalogRecord.deleted = false;
      await db.costosIndirectos.add(catalogRecord as any);
      toast.success(`Gasto "${gasto.nombre}" agregado al catálogo`);
    }
    handleCloseGastoModal();
  };

  const handleDeleteCatalogGasto = async (id: string) => {
    const ok = await confirm({
      title: 'Eliminar Gasto del Catálogo',
      message: '¿Estás seguro de eliminar este gasto del catálogo global?',
      confirmText: 'Eliminar',
      isDestructive: true
    });
    if (ok) {
      await softDelete('costosIndirectos', id);
      toast.success('Gasto eliminado del catálogo');
      handleCloseGastoModal();
    }
  };

  const handleToggleIncluirPorDefecto = async (g: CostoIndirecto) => {
    const nuevoEstado = !(g.incluirPorDefecto ?? true);
    await db.costosIndirectos.update(g.id, {
      incluirPorDefecto: nuevoEstado,
      updatedAt: new Date().toISOString()
    });
    toast.success(
      nuevoEstado
        ? `"${g.nombre}" se incluirá por defecto en nuevas cotizaciones`
        : `"${g.nombre}" no se incluirá por defecto`
    );
  };

  return {
    // Mano de Obra
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

    // Gastos Catálogo
    gastosCatalogList,
    showGastoModal,
    editingGasto,
    handleOpenCreateGasto,
    handleOpenEditGasto,
    handleCloseGastoModal,
    handleSaveCatalogGasto,
    handleDeleteCatalogGasto,
    handleToggleIncluirPorDefecto
  };
}

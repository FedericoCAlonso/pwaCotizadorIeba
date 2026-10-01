import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, softDelete } from '../db/database';
import {
  CategoriaManoDeObra,
  RolCategoriaManoDeObra,
  CostoIndirecto,
  GastoPresupuestoConfig,
  ConvenioLaboral,
  DestinoGasto,
  ModalidadGasto
} from '../core/types';
import {
  safeNum,
  roundMoney,
  calcularCostoHoraDesdeJornada,
  calcularCostoJornadaDesdeHora,
  CONVENIOS_PREDEFINIDOS,
  calcularDesgloseCostoManoObraReal
} from '../core/calculations';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';

export interface ManoObraFormState {
  nombre: string;
  convenioId: string;
  costoHora: number | string;
  costoJornada: number | string;
  costoBasicoJornada: number | string;
  costoBasicoHora: number | string;
  porcentajeCargasSociales: number | string;
  gastosDirectosJornada: number | string;
  horasJornada: number;
  rol: RolCategoriaManoDeObra;
}

export const DEFAULT_MANO_OBRA_FORM: ManoObraFormState = {
  nombre: '',
  convenioId: 'uocra',
  costoHora: 8167,
  costoJornada: 73500,
  costoBasicoJornada: 40000,
  costoBasicoHora: 4444,
  porcentajeCargasSociales: 65,
  gastosDirectosJornada: 7500,
  horasJornada: 9,
  rol: 'oficial'
};

export function useManoObraViewModel() {
  const { toast } = useToast();
  const confirm = useConfirm();

  // ─── Data Access (Dexie Live Queries) ─────────────────────────────────────────
  const rawManoObra = useLiveQuery(() => db.manoObra.toArray());
  const rawCostosIndirectos = useLiveQuery(() => db.costosIndirectos.toArray());
  const rawConvenios = useLiveQuery(() => db.convenios.toArray());

  const conveniosList: ConvenioLaboral[] = useMemo(() => {
    const list = (rawConvenios || []).filter((c) => !c.deleted);
    if (list.length > 0) return list;
    return CONVENIOS_PREDEFINIDOS;
  }, [rawConvenios]);

  const manoObraList: CategoriaManoDeObra[] = useMemo(
    () => (rawManoObra || []).filter((m) => !m.deleted),
    [rawManoObra]
  );

  const gastosCatalogList: CostoIndirecto[] = useMemo(
    () => (rawCostosIndirectos || []).filter((c) => !c.deleted),
    [rawCostosIndirectos]
  );

  // ─── Active Tab & Search/Filters State ────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'cuadrilla' | 'cargas' | 'convenios'>('cuadrilla');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRol, setFilterRol] = useState<string>('todos');
  const [filterConvenio, setFilterConvenio] = useState<string>('todos');
  const [filterDestino, setFilterDestino] = useState<string>('todos');

  // ─── Filtered Lists ──────────────────────────────────────────────────────────
  const filteredManoObraList = useMemo(() => {
    return manoObraList.filter((m) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = m.nombre.toLowerCase().includes(q);
        const matchesRol = (m.rol || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRol) return false;
      }
      if (filterRol !== 'todos' && m.rol !== filterRol) return false;
      if (filterConvenio !== 'todos') {
        const cId = m.convenioId || 'uocra';
        if (cId !== filterConvenio) return false;
      }
      return true;
    });
  }, [manoObraList, searchQuery, filterRol, filterConvenio]);

  const filteredGastosList = useMemo(() => {
    return gastosCatalogList.filter((g) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = g.nombre.toLowerCase().includes(q);
        if (!matchesName) return false;
      }
      if (filterDestino !== 'todos' && (g.destino || 'costo_indirecto') !== filterDestino) {
        return false;
      }
      return true;
    });
  }, [gastosCatalogList, searchQuery, filterDestino]);

  const filteredConveniosList = useMemo(() => {
    return conveniosList.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = c.nombre.toLowerCase().includes(q) || (c.descripcion || '').toLowerCase().includes(q);
        if (!matchesName) return false;
      }
      return true;
    });
  }, [conveniosList, searchQuery]);

  // ─── Mano de Obra State ───────────────────────────────────────────────────────
  const [editingMO, setEditingMO] = useState<CategoriaManoDeObra | null>(null);
  const [isCreatingMO, setIsCreatingMO] = useState(false);
  const [moForm, setMOForm] = useState<ManoObraFormState>(DEFAULT_MANO_OBRA_FORM);

  // ─── Gastos (Catálogo Global) State ───────────────────────────────────────────
  const [showGastoModal, setShowGastoModal] = useState(false);
  const [editingGasto, setEditingGasto] = useState<GastoPresupuestoConfig | null>(null);

  // ─── Convenios Laborales State ────────────────────────────────────────────────
  const [showConvenioModal, setShowConvenioModal] = useState(false);
  const [editingConvenio, setEditingConvenio] = useState<ConvenioLaboral | null>(null);

  // ─── Global Shortcut Listener ─────────────────────────────────────────────────
  useEffect(() => {
    const handleNew = () => {
      if (activeTab === 'cuadrilla') openCreateMO();
      else if (activeTab === 'cargas') handleOpenCreateGasto();
      else openCreateConvenio();
    };
    window.addEventListener('app:shortcut-new', handleNew);
    return () => window.removeEventListener('app:shortcut-new', handleNew);
  }, [activeTab]);

  // ─── Convenios Form Handlers ──────────────────────────────────────────────────
  const openCreateConvenio = () => {
    setEditingConvenio({
      id: '',
      nombre: '',
      cargasSocialesPct: 65,
      gastosDirectosOperarioDefecto: 5000,
      horasJornadaDefecto: 9,
      descripcion: '',
      adicionales: {
        adicionalTrabajoAltura: 0.20
      }
    });
    setShowConvenioModal(true);
  };

  const openEditConvenio = (c: ConvenioLaboral) => {
    setEditingConvenio(c);
    setShowConvenioModal(true);
  };

  const closeConvenioModal = () => {
    setShowConvenioModal(false);
    setEditingConvenio(null);
  };

  const handleQuickCreateConvenio = async (
    nombre?: string,
    cargasSocialesPct: number = 65
  ): Promise<string> => {
    const trimmed = (nombre || '').trim() || 'Nuevo Convenio';
    const newId = `cct-${Date.now()}`;
    const now = new Date().toISOString();
    const newConvenio: ConvenioLaboral = {
      id: newId,
      nombre: trimmed,
      cargasSocialesPct: safeNum(cargasSocialesPct) || 65,
      gastosDirectosOperarioDefecto: 5000,
      horasJornadaDefecto: 9,
      descripcion: `Régimen laboral ${trimmed}`,
      adicionales: {
        adicionalTrabajoAltura: 0.20
      },
      createdAt: now,
      updatedAt: now,
      deleted: false
    };
    await db.convenios.put(newConvenio);
    toast.success(`Convenio "${trimmed}" creado correctamente`);
    return newId;
  };

  const handleUpdateConvenioField = async (
    id: string,
    field: string,
    value: any
  ): Promise<void> => {
    const target = conveniosList.find((c) => c.id === id);
    if (!target) return;
    const now = new Date().toISOString();
    await db.convenios.update(id, {
      [field]: value,
      updatedAt: now,
      _updatedAt: Date.now()
    });
    toast.success(`Convenio actualizado`);
  };

  const handleDuplicateConvenio = async (id: string): Promise<string> => {
    const original = conveniosList.find((c) => c.id === id);
    if (!original) return '';
    const now = new Date().toISOString();
    const newId = `cct-${Date.now()}`;
    const cloned: ConvenioLaboral = {
      ...original,
      id: newId,
      nombre: `${original.nombre} (Copia)`,
      createdAt: now,
      updatedAt: now,
      deleted: false
    };
    await db.convenios.put(cloned);
    toast.success(`Convenio clonado como "${cloned.nombre}"`);
    return newId;
  };

  const handleDeleteConvenio = async (id: string): Promise<void> => {
    const target = conveniosList.find((c) => c.id === id);
    if (!target) return;
    const ok = await confirm({
      title: '¿Eliminar convenio laboral?',
      message: `Se eliminará "${target.nombre}". Las categorías de mano de obra asociadas mantendrán sus valores actuales.`,
      confirmText: 'Eliminar',
      isDestructive: true
    });
    if (!ok) return;
    await softDelete('convenios', id);
    toast.success(`Convenio "${target.nombre}" eliminado`);
  };

  const handleSaveConvenio = async (convenio: ConvenioLaboral): Promise<void> => {
    const now = new Date().toISOString();
    const isNew = !convenio.id;
    const id = isNew ? `cct-${Date.now()}` : convenio.id;
    const toSave: ConvenioLaboral = {
      ...convenio,
      id,
      updatedAt: now,
      _updatedAt: Date.now()
    };
    if (isNew) toSave.createdAt = now;
    if (toSave.deleted === undefined) toSave.deleted = false;
    await db.convenios.put(toSave);
    toast.success(`Convenio "${convenio.nombre}" guardado`);
    setShowConvenioModal(false);
    setEditingConvenio(null);
  };

  // ─── Mano de Obra Form Handlers ───────────────────────────────────────────────
  const openCreateMO = (defaultRol: RolCategoriaManoDeObra = 'oficial') => {
    const defaultConvenio = conveniosList[0];
    const hs = 9;
    const basico = 40000;
    const fcs = defaultConvenio.cargasSocialesPct;
    const gDirectos = defaultConvenio.gastosDirectosOperarioDefecto ?? 5000;
    const calc = calcularDesgloseCostoManoObraReal(basico, fcs, gDirectos, hs);

    setMOForm({
      nombre: '',
      convenioId: defaultConvenio.id,
      costoHora: calc.costoHoraReal,
      costoJornada: calc.costoJornadaReal,
      costoBasicoJornada: basico,
      costoBasicoHora: calc.costoBasicoHora,
      porcentajeCargasSociales: fcs,
      gastosDirectosJornada: gDirectos,
      horasJornada: hs,
      rol: defaultRol
    });
    setEditingMO(null);
    setIsCreatingMO(true);
  };

  const openEditMO = (mo: CategoriaManoDeObra) => {
    const hs = mo.horasJornada && mo.horasJornada > 0 ? mo.horasJornada : 9;
    const cId = mo.convenioId || 'uocra';
    const conv = conveniosList.find((c) => c.id === cId) || conveniosList[0];
    const fcs = mo.porcentajeCargasSociales ?? conv.cargasSocialesPct;
    const gDirectos = mo.gastosDirectosJornada ?? (conv.gastosDirectosOperarioDefecto || 0);

    const cj = mo.costoJornada && mo.costoJornada > 0
      ? mo.costoJornada
      : calcularCostoJornadaDesdeHora(mo.costoHora, hs);

    let basicoJornada = mo.costoBasicoJornada;
    if (!basicoJornada || basicoJornada <= 0) {
      const factor = 1 + fcs / 100;
      basicoJornada = Math.round(Math.max(0, (cj - gDirectos) / factor));
    }

    setMOForm({
      nombre: mo.nombre,
      convenioId: cId,
      costoHora: mo.costoHora,
      costoJornada: cj,
      costoBasicoJornada: basicoJornada,
      costoBasicoHora: roundMoney(basicoJornada / hs),
      porcentajeCargasSociales: fcs,
      gastosDirectosJornada: gDirectos,
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

  const handleConvenioChange = (convenioId: string) => {
    const conv = conveniosList.find((c) => c.id === convenioId) || conveniosList[0];
    setMOForm((prev) => {
      const fcs = conv.cargasSocialesPct;
      const gDirectos = conv.gastosDirectosOperarioDefecto ?? 0;
      const basico = safeNum(prev.costoBasicoJornada);
      const calc = calcularDesgloseCostoManoObraReal(basico, fcs, gDirectos, prev.horasJornada);
      return {
        ...prev,
        convenioId,
        porcentajeCargasSociales: fcs,
        gastosDirectosJornada: gDirectos,
        costoJornada: calc.costoJornadaReal,
        costoHora: calc.costoHoraReal
      };
    });
  };

  const handleHorasJornadaChange = (horas: number) => {
    const hs = Math.max(1, Math.min(24, Math.round(horas)));
    setMOForm((prev) => {
      const numHora = typeof prev.costoHora === 'number' ? prev.costoHora : parseFloat(prev.costoHora);
      const newCostoJornada = !isNaN(numHora) && numHora > 0
        ? calcularCostoJornadaDesdeHora(numHora, hs)
        : prev.costoJornada;

      const basico = safeNum(prev.costoBasicoJornada);
      const calcBasicoHora = basico > 0 ? roundMoney(basico / hs) : prev.costoBasicoHora;

      return {
        ...prev,
        horasJornada: hs,
        costoBasicoHora: calcBasicoHora,
        costoJornada: newCostoJornada
      };
    });
  };

  const handleCostoHoraChange = (val: number | string) => {
    setMOForm((prev) => {
      if (val === '') return { ...prev, costoHora: '', costoJornada: '' };
      const num = safeNum(val);
      const cj = calcularCostoJornadaDesdeHora(num, prev.horasJornada);
      return { ...prev, costoHora: val, costoJornada: cj };
    });
  };

  const handleCostoJornadaChange = (val: number | string) => {
    setMOForm((prev) => {
      if (val === '') return { ...prev, costoJornada: '', costoHora: '' };
      const num = safeNum(val);
      const ch = calcularCostoHoraDesdeJornada(num, prev.horasJornada);
      return { ...prev, costoJornada: val, costoHora: ch };
    });
  };

  const handleCostoBasicoJornadaChange = (val: number | string) => {
    setMOForm((prev) => {
      const basico = safeNum(val);
      const fcs = safeNum(prev.porcentajeCargasSociales);
      const gDirectos = safeNum(prev.gastosDirectosJornada);
      const calc = calcularDesgloseCostoManoObraReal(basico, fcs, gDirectos, prev.horasJornada);
      return {
        ...prev,
        costoBasicoJornada: val,
        costoBasicoHora: calc.costoBasicoHora,
        costoJornada: calc.costoJornadaReal,
        costoHora: calc.costoHoraReal
      };
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

    const payload: Partial<CategoriaManoDeObra> = {
      nombre: moForm.nombre.trim(),
      convenioId: moForm.convenioId || 'uocra',
      costoHora: safeHora,
      horasJornada: safeHs,
      costoJornada: safeJornada,
      costoBasicoJornada: safeNum(moForm.costoBasicoJornada),
      costoBasicoHora: safeNum(moForm.costoBasicoHora),
      porcentajeCargasSociales: safeNum(moForm.porcentajeCargasSociales),
      gastosDirectosJornada: safeNum(moForm.gastosDirectosJornada),
      rol: moForm.rol,
      fechaActualizacion: now,
      updatedAt: now
    };

    if (isCreatingMO) {
      await db.manoObra.add({
        ...payload,
        id: `mo-${crypto.randomUUID()}`,
        createdAt: now,
        deleted: false
      } as any);
      toast.success('Categoría de mano de obra creada');
      closeMOModal();
    } else if (editingMO) {
      await db.manoObra.update(editingMO.id, payload as any);
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

  const handleDuplicateMO = async (moId: string) => {
    const mo = manoObraList.find((m) => m.id === moId);
    if (!mo) return;
    const now = new Date().toISOString();
    const newId = `mo-${crypto.randomUUID()}`;
    await db.manoObra.add({
      ...mo,
      id: newId,
      nombre: `${mo.nombre} (Copia)`,
      createdAt: now,
      updatedAt: now,
      fechaActualizacion: now,
      deleted: false
    });
    toast.success(`Categoría duplicada como "${mo.nombre} (Copia)"`);
  };

  const handleUpdateMOField = async (
    moId: string,
    field: string,
    value: string | number
  ) => {
    const mo = manoObraList.find((m) => m.id === moId);
    if (!mo) return;
    const now = new Date().toISOString();
    const hs = mo.horasJornada && mo.horasJornada > 0 ? mo.horasJornada : 9;

    const updates: Partial<CategoriaManoDeObra> = {
      fechaActualizacion: now,
      updatedAt: now
    };

    if (field === 'nombre') {
      const trimmed = String(value).trim();
      if (!trimmed) return;
      updates.nombre = trimmed;
    } else if (field === 'rol') {
      updates.rol = value as RolCategoriaManoDeObra;
    } else if (field === 'convenioId') {
      const conv = conveniosList.find((c) => c.id === value) || conveniosList[0];
      updates.convenioId = String(value);
      updates.porcentajeCargasSociales = conv.cargasSocialesPct;
      updates.gastosDirectosJornada = conv.gastosDirectosOperarioDefecto ?? 0;
      const basico = mo.costoBasicoJornada ?? Math.round((mo.costoJornada || mo.costoHora * hs) / 1.65);
      const calc = calcularDesgloseCostoManoObraReal(basico, conv.cargasSocialesPct, updates.gastosDirectosJornada, hs);
      updates.costoBasicoJornada = basico;
      updates.costoBasicoHora = calc.costoBasicoHora;
      updates.costoJornada = calc.costoJornadaReal;
      updates.costoHora = calc.costoHoraReal;
    } else if (field === 'horasJornada') {
      const newHs = Math.max(1, Math.min(24, Math.round(safeNum(value))));
      updates.horasJornada = newHs;
      const basico = safeNum(mo.costoBasicoJornada);
      if (basico > 0) {
        const calc = calcularDesgloseCostoManoObraReal(basico, mo.porcentajeCargasSociales ?? 65, mo.gastosDirectosJornada ?? 0, newHs);
        updates.costoJornada = calc.costoJornadaReal;
        updates.costoHora = calc.costoHoraReal;
      } else {
        updates.costoJornada = calcularCostoJornadaDesdeHora(mo.costoHora, newHs);
      }
    } else if (field === 'costoBasicoJornada') {
      const newBasico = safeNum(value);
      const fcs = mo.porcentajeCargasSociales ?? 65;
      const gd = mo.gastosDirectosJornada ?? 0;
      const calc = calcularDesgloseCostoManoObraReal(newBasico, fcs, gd, hs);
      updates.costoBasicoJornada = newBasico;
      updates.costoBasicoHora = calc.costoBasicoHora;
      updates.costoJornada = calc.costoJornadaReal;
      updates.costoHora = calc.costoHoraReal;
    } else if (field === 'costoHora') {
      const newHora = safeNum(value);
      updates.costoHora = newHora;
      updates.costoJornada = calcularCostoJornadaDesdeHora(newHora, hs);
    } else if (field === 'costoJornada') {
      const newJornada = safeNum(value);
      updates.costoJornada = newJornada;
      updates.costoHora = calcularCostoHoraDesdeJornada(newJornada, hs);
    }

    await db.manoObra.update(moId, updates as any);
  };

  const handleBatchParitariaUpdate = async (percentage: number, categoryIds?: string[]) => {
    if (isNaN(percentage) || percentage === 0) return;
    const factor = 1 + percentage / 100;
    const targets = categoryIds && categoryIds.length > 0
      ? manoObraList.filter((m) => categoryIds.includes(m.id))
      : manoObraList;

    if (targets.length === 0) return;

    const now = new Date().toISOString();
    await Promise.all(
      targets.map((m) => {
        const hs = m.horasJornada && m.horasJornada > 0 ? m.horasJornada : 9;
        const newBasico = m.costoBasicoJornada ? Math.round(m.costoBasicoJornada * factor) : undefined;
        let newHora = Math.round(m.costoHora * factor);
        let newJornal = calcularCostoJornadaDesdeHora(newHora, hs);

        if (newBasico) {
          const calc = calcularDesgloseCostoManoObraReal(
            newBasico,
            m.porcentajeCargasSociales ?? 65,
            m.gastosDirectosJornada ?? 0,
            hs
          );
          newHora = calc.costoHoraReal;
          newJornal = calc.costoJornadaReal;
        }

        return db.manoObra.update(m.id, {
          costoBasicoJornada: newBasico,
          costoHora: newHora,
          costoJornada: newJornal,
          fechaActualizacion: now,
          updatedAt: now
        } as any);
      })
    );

    const sign = percentage > 0 ? '+' : '';
    toast.success(`Ajuste de paritaria aplicado: ${sign}${percentage}% a ${targets.length} categorías`);
  };

  const handleQuickCreateMO = async (
    nombre?: string,
    convenioId: string = 'uocra',
    rol: RolCategoriaManoDeObra = 'oficial'
  ) => {
    const finalName = (nombre || '').trim() || 'Nueva Categoría';
    const now = new Date().toISOString();
    const conv = conveniosList.find((c) => c.id === convenioId) || conveniosList[0];
    const hs = 9;
    const basico = 40000;
    const fcs = conv.cargasSocialesPct;
    const gd = conv.gastosDirectosOperarioDefecto ?? 5000;
    const calc = calcularDesgloseCostoManoObraReal(basico, fcs, gd, hs);
    const newId = `mo-${crypto.randomUUID()}`;

    await db.manoObra.add({
      id: newId,
      nombre: finalName,
      convenioId: conv.id,
      costoBasicoJornada: basico,
      costoBasicoHora: calc.costoBasicoHora,
      porcentajeCargasSociales: fcs,
      gastosDirectosJornada: gd,
      costoHora: calc.costoHoraReal,
      horasJornada: hs,
      costoJornada: calc.costoJornadaReal,
      rol,
      fechaActualizacion: now,
      createdAt: now,
      updatedAt: now,
      deleted: false
    } as any);
    toast.success(`Categoría "${finalName}" creada`);
    return newId;
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
      destino: g.destino || 'costo_indirecto',
      modalidad: g.modalidad || 'porcentual',
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

  const handleDuplicateGasto = async (gastoId: string) => {
    const gasto = gastosCatalogList.find((g) => g.id === gastoId);
    if (!gasto) return;
    const now = new Date().toISOString();
    const newId = `gasto-${crypto.randomUUID()}`;
    await db.costosIndirectos.add({
      ...gasto,
      id: newId,
      nombre: `${gasto.nombre} (Copia)`,
      createdAt: now,
      updatedAt: now,
      deleted: false
    } as any);
    toast.success(`Gasto duplicado como "${gasto.nombre} (Copia)"`);
  };

  const handleQuickCreateGasto = async (
    nombre?: string,
    destino: DestinoGasto = 'costo_indirecto',
    modalidad: ModalidadGasto = 'porcentual',
    valor: number = 5
  ) => {
    const finalName = (nombre || '').trim() || 'Nuevo Gasto';
    const now = new Date().toISOString();
    const newId = `gasto-${crypto.randomUUID()}`;
    await db.costosIndirectos.add({
      id: newId,
      nombre: finalName,
      destino,
      modalidad,
      valor,
      tipo: modalidad === 'porcentual' ? 'porcentual_sobre_costo' : 'fijo_mensual',
      incluirPorDefecto: true,
      createdAt: now,
      updatedAt: now,
      deleted: false
    } as any);
    toast.success(`Gasto "${finalName}" agregado al catálogo`);
    return newId;
  };

  const handleUpdateGastoField = async (
    gastoId: string,
    field: string,
    value: any
  ) => {
    const gasto = gastosCatalogList.find((g) => g.id === gastoId);
    if (!gasto) return;
    const now = new Date().toISOString();
    await db.costosIndirectos.update(gastoId, {
      [field]: value,
      updatedAt: now
    } as any);
  };

  const handleToggleIncluirPorDefecto = async (g: CostoIndirecto) => {
    const nuevoEstado = !(g.incluirPorDefecto ?? true);
    await db.costosIndirectos.update(g.id, {
      incluirPorDefecto: nuevoEstado,
      updatedAt: new Date().toISOString()
    } as any);
    toast.success(
      nuevoEstado
        ? `"${g.nombre}" se incluirá por defecto en nuevas cotizaciones`
        : `"${g.nombre}" no se incluirá por defecto`
    );
  };

  return {
    // Navigation / Tabs & Search Filters
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filterRol,
    setFilterRol,
    filterConvenio,
    setFilterConvenio,
    filterDestino,
    setFilterDestino,
    conveniosList,

    // Mano de Obra
    manoObraList,
    filteredManoObraList,
    editingMO,
    isCreatingMO,
    moForm,
    openCreateMO,
    openEditMO,
    closeMOModal,
    handleNombreChange,
    handleRolChange,
    handleConvenioChange,
    handleHorasJornadaChange,
    handleCostoHoraChange,
    handleCostoJornadaChange,
    handleCostoBasicoJornadaChange,
    handleSaveMO,
    handleDeleteMO,
    handleDuplicateMO,
    handleUpdateMOField,
    handleBatchParitariaUpdate,
    handleQuickCreateMO,

    // Gastos Catálogo
    gastosCatalogList,
    filteredGastosList,
    showGastoModal,
    editingGasto,
    handleOpenCreateGasto,
    handleOpenEditGasto,
    handleCloseGastoModal,
    handleSaveCatalogGasto,
    handleDeleteCatalogGasto,
    handleDuplicateGasto,
    handleQuickCreateGasto,
    handleUpdateGastoField,
    handleToggleIncluirPorDefecto,

    // Convenios Laborales
    filteredConveniosList,
    showConvenioModal,
    editingConvenio,
    openCreateConvenio,
    openEditConvenio,
    closeConvenioModal,
    handleSaveConvenio,
    handleDeleteConvenio,
    handleDuplicateConvenio,
    handleQuickCreateConvenio,
    handleUpdateConvenioField
  };
}

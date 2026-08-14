import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Save,
  Package,
  Clock,
  Calculator,
  BookOpen,
  Copy,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sliders,
  Sparkles,
  BarChart3,
  RefreshCw,
  Search
} from 'lucide-react';
import { db, softDelete } from '../db/database';
import {
  TareaTipo,
  Insumo,
  CategoriaManoDeObra,
  InsumoEnTarea,
  ManoObraEnTarea,
  CATEGORIA_TAREA
} from '../core/types';
import {
  calcularCostoTareaTipo,
  formatARS,
  calcularDispersionHorasTarea,
  auditarRentabilidadTareaTipo,
  roundMoney
} from '../core/calculations';
import { ModalContainer } from './ModalContainer';

const CATEGORIAS_TAREA_LIST = Object.values(CATEGORIA_TAREA);

export const TareasTipoManager: React.FC = () => {
  const tareasTipo = (useLiveQuery(() => db.tareasTipo.toArray()) || []).filter((t) => !t.deleted);
  const legacyInsumos = (useLiveQuery(() => db.insumos.toArray()) || []).filter((i) => !i.deleted);
  const materiales = (useLiveQuery(() => db.materiales.toArray()) || []).filter((m) => !m.deleted);
  const ofertas = (useLiveQuery(() => db.ofertas.toArray()) || []).filter((o) => !o.deleted);
  const manoObraList = (useLiveQuery(() => db.manoObra.toArray()) || []).filter((m) => !m.deleted);
  const registrosTrabajo = (useLiveQuery(() => db.registrosTrabajo.toArray()) || []).filter((r) => !r.deleted);
  const configs = useLiveQuery(() => db.config.toArray()) || [];
  const config = configs[0];

  const insumosMap = new Map<string, Insumo>();
  legacyInsumos.forEach((i) => insumosMap.set(i.id, i));
  materiales.forEach((m) => {
    const oferta = ofertas.find((o) => o.materialId === m.id);
    insumosMap.set(m.id, {
      ...m,
      id: m.id,
      nombre: m.nombre,
      unidad: m.unidadVenta || 'u',
      categoria: m.categoriaId,
      precioActual: oferta ? oferta.precio : (m as any).precioActual || 0,
      fechaActualizacion: oferta ? oferta.fecha : new Date().toISOString(),
      historialPrecios: []
    });
  });
  const manoObraMap = new Map<string, CategoriaManoDeObra>(manoObraList.map((m) => [m.id, m]));

  const [activeSubmodulo, setActiveSubmodulo] = useState<'catalogo' | 'simulacion' | 'calibracion' | 'auditoria'>('catalogo');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('todas');

  // Simulation State ("What-If Scenarios")
  const [simulatedTareaId, setSimulatedTareaId] = useState<string>('');
  const [simMaterialesPct, setSimMaterialesPct] = useState<number>(0); // -50% to +100%
  const [simManoObraPct, setSimManoObraPct] = useState<number>(0); // -50% to +100%
  const [simHorasExtra, setSimHorasExtra] = useState<number>(0); // 0 to 10 hs
  const [simMargenPct, setSimMargenPct] = useState<number>(config?.margenPorDefectoPct || 35); // 10% to 70%

  // Editor Modal States
  const [editingTarea, setEditingTarea] = useState<TareaTipo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<{
    nombre: string;
    categoria: string;
    unidad: string;
    notasTecnicas: string;
    insumos: InsumoEnTarea[];
    manoObra: ManoObraEnTarea[];
  }>({
    nombre: '',
    categoria: 'Bocas',
    unidad: 'punto',
    notasTecnicas: '',
    insumos: [],
    manoObra: []
  });

  const handleOpenCreate = () => {
    setFormData({
      nombre: '',
      categoria: 'Bocas',
      unidad: 'punto',
      notasTecnicas: '',
      insumos: [],
      manoObra: []
    });
    setIsCreating(true);
  };

  const handleOpenEdit = (tarea: TareaTipo) => {
    setEditingTarea(tarea);
    setFormData({
      nombre: tarea.nombre,
      categoria: tarea.categoria,
      unidad: tarea.unidad,
      notasTecnicas: tarea.notasTecnicas || '',
      insumos: tarea.insumos.map((i) => ({ ...i })),
      manoObra: tarea.manoObra.map((m) => ({ ...m }))
    });
  };

  const handleSaveTarea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return;
    const now = new Date().toISOString();

    if (isCreating) {
      await db.tareasTipo.add({
        id: `tt-${crypto.randomUUID()}`,
        nombre: formData.nombre.trim(),
        categoria: formData.categoria.trim(),
        unidad: formData.unidad.trim() || 'punto',
        notasTecnicas: formData.notasTecnicas.trim() || undefined,
        insumos: formData.insumos,
        manoObra: formData.manoObra,
        factorCorreccion: 1.0,
        createdAt: now,
        updatedAt: now,
        deleted: false
      });
      setIsCreating(false);
    } else if (editingTarea) {
      await db.tareasTipo.update(editingTarea.id, {
        nombre: formData.nombre.trim(),
        categoria: formData.categoria.trim(),
        unidad: formData.unidad.trim() || 'punto',
        notasTecnicas: formData.notasTecnicas.trim() || undefined,
        insumos: formData.insumos,
        manoObra: formData.manoObra,
        updatedAt: now
      });
      setEditingTarea(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta tarea tipo del catálogo?')) {
      await softDelete('tareasTipo', id);
    }
  };

  const handleDuplicateTarea = (t: TareaTipo) => {
    setEditingTarea(null);
    setFormData({
      nombre: `${t.nombre} (Copia)`,
      categoria: t.categoria || CATEGORIAS_TAREA_LIST[0],
      unidad: t.unidad || 'u',
      notasTecnicas: t.notasTecnicas || '',
      insumos: t.insumos ? t.insumos.map((i) => ({ ...i })) : [],
      manoObra: t.manoObra ? t.manoObra.map((m) => ({ ...m })) : []
    });
    setIsCreating(true);
  };

  const handleCalibrarEma = async (tareaId: string, factorSugerido: number) => {
    await db.tareasTipo.update(tareaId, { factorCorreccion: factorSugerido });
    alert(`¡Factor EMA calibrado con éxito a ${factorSugerido.toFixed(2)}x!`);
  };

  const addInsumoRow = () => {
    const list = Array.from(insumosMap.values());
    if (list.length === 0) return alert('Primero debes cargar insumos en el catálogo de Materiales.');
    setFormData((prev) => ({
      ...prev,
      insumos: [...prev.insumos, { materialId: list[0].id, insumoId: list[0].id, cantidad: 1 }]
    }));
  };

  const removeInsumoRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      insumos: prev.insumos.filter((_, i) => i !== index)
    }));
  };

  const updateInsumoRow = (index: number, field: 'materialId' | 'insumoId' | 'cantidad', val: any) => {
    setFormData((prev) => {
      const next = [...prev.insumos];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, insumos: next };
    });
  };

  const addManoObraRow = () => {
    if (manoObraList.length === 0) return alert('Primero debes cargar categorías de Mano de Obra.');
    setFormData((prev) => ({
      ...prev,
      manoObra: [...prev.manoObra, { categoriaId: manoObraList[0].id, horas: 1 }]
    }));
  };

  const removeManoObraRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      manoObra: prev.manoObra.filter((_, i) => i !== index)
    }));
  };

  const updateManoObraRow = (index: number, field: 'categoriaId' | 'horas', val: any) => {
    setFormData((prev) => {
      const next = [...prev.manoObra];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, manoObra: next };
    });
  };

  const tempTareaForm: TareaTipo = {
    id: 'temp',
    nombre: formData.nombre,
    categoria: formData.categoria,
    unidad: formData.unidad,
    insumos: formData.insumos,
    manoObra: formData.manoObra,
    factorCorreccion: 1.0
  };
  const tempCost = calcularCostoTareaTipo(tempTareaForm, insumosMap, manoObraMap);

  const filteredTareas = tareasTipo.filter((t) => {
    const matchesSearch = t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (t.notasTecnicas && t.notasTecnicas.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategoryFilter === 'todas' || t.categoria === selectedCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] transition-shadow";

  // Selected Simulation Task Calculation
  const selectedSimTarea = tareasTipo.find((t) => t.id === (simulatedTareaId || tareasTipo[0]?.id));
  const baseCostData = selectedSimTarea ? calcularCostoTareaTipo(selectedSimTarea, insumosMap, manoObraMap) : null;

  const simCostInsumos = baseCostData ? roundMoney(baseCostData.costoInsumosUnitario * (1 + simMaterialesPct / 100)) : 0;
  const baseHorasMo = baseCostData ? baseCostData.manoObraSnapshotUnitario.reduce((acc, m) => acc + m.horasTotales, 0) : 0;
  const simHorasTotalesMo = baseHorasMo + simHorasExtra;
  const costoHoraPromedio = baseHorasMo > 0 && baseCostData ? baseCostData.costoManoObraUnitario / baseHorasMo : (manoObraList[0]?.costoHora || 9500);
  const simCostManoObra = roundMoney(simHorasTotalesMo * costoHoraPromedio * (1 + simManoObraPct / 100));

  const simCostDirectoTotal = roundMoney(simCostInsumos + simCostManoObra);
  const factorMargen = 1 - (simMargenPct / 100);
  const simPrecioVenta = factorMargen > 0 ? roundMoney(simCostDirectoTotal / factorMargen) : roundMoney(simCostDirectoTotal * 1.35);
  const simGanancia = roundMoney(simPrecioVenta - simCostDirectoTotal);

  const baseCostoDirecto = baseCostData ? baseCostData.costoDirectoUnitario : 0;
  const variacionCostoDirectoPct = baseCostoDirecto > 0 ? roundMoney(((simCostDirectoTotal - baseCostoDirecto) / baseCostoDirecto) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            <span>Laboratorio de Tareas Tipo (Modo Experto)</span>
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Diseño de ensambles, simulación What-If de escenarios, calibración EMA y auditoría de rentabilidad.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Tarea Tipo</span>
        </button>
      </div>

      {/* Submodule Navigation Tabs */}
      <div className="flex border-b border-outline-variant/30 overflow-x-auto no-scrollbar gap-2 sm:gap-6">
        <button
          onClick={() => setActiveSubmodulo('catalogo')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubmodulo === 'catalogo'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Catálogo & Diseñador ({tareasTipo.length})</span>
        </button>

        <button
          onClick={() => {
            if (!simulatedTareaId && tareasTipo.length > 0) setSimulatedTareaId(tareasTipo[0].id);
            setActiveSubmodulo('simulacion');
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubmodulo === 'simulacion'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Simulación What-If</span>
        </button>

        <button
          onClick={() => setActiveSubmodulo('calibracion')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubmodulo === 'calibracion'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Motor Estadístico EMA</span>
        </button>

        <button
          onClick={() => setActiveSubmodulo('auditoria')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubmodulo === 'auditoria'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Auditoría de Rentabilidad</span>
        </button>
      </div>

      {/* SUBMÓDULO 1: CATÁLOGO & DISEÑADOR */}
      {activeSubmodulo === 'catalogo' && (
        <div className="space-y-5">
          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar tarea o nota técnica..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>

            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className={`${inputCls} sm:w-auto capitalize`}
            >
              <option value="todas">Todas las categorías</option>
              {CATEGORIAS_TAREA_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Grid of Task Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTareas.map((tarea) => {
              const costData = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);
              const audit = auditarRentabilidadTareaTipo(tarea, insumosMap, manoObraMap, config);

              return (
                <div
                  key={tarea.id}
                  className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all flex flex-col justify-between space-y-4 shadow-sm"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-on-tertiary-container bg-tertiary-container px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          {tarea.categoria}
                        </span>
                        <h3 className="font-bold text-on-surface text-base mt-1">{tarea.nombre}</h3>
                      </div>

                      <div className="flex items-center gap-1">
                        <span
                          className={`w-3 h-3 rounded-full ${
                            audit.estado === 'verde'
                              ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                              : audit.estado === 'amarillo'
                              ? 'bg-amber-500 shadow-sm shadow-amber-500/50'
                              : 'bg-rose-500 shadow-sm shadow-rose-500/50'
                          }`}
                          title={`Estado auditoría: ${audit.estado}`}
                        />
                        <button
                          onClick={() => handleDuplicateTarea(tarea)}
                          className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl"
                          title="Duplicar tarea"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(tarea)}
                          className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl"
                          title="Editar tarea"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tarea.id)}
                          className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-xl"
                          title="Eliminar tarea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {tarea.notasTecnicas && (
                      <p className="text-xs text-on-surface-variant mt-2 line-clamp-2 italic">
                        {tarea.notasTecnicas}
                      </p>
                    )}

                    {/* Despiece Insumos */}
                    <div className="mt-3 pt-3 border-t border-outline-variant/20 space-y-1 text-xs">
                      <div className="text-[11px] font-semibold text-on-surface-variant uppercase">
                        Insumos ({tarea.insumos.length}):
                      </div>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {tarea.insumos.map((item, idx) => {
                          const mat = insumosMap.get(item.materialId || item.insumoId || '');
                          return (
                            <div key={idx} className="flex justify-between items-center text-[11px] text-on-surface">
                              <span className="truncate max-w-[170px]">{mat?.nombre || 'Material'}</span>
                              <span className="font-mono text-on-surface-variant shrink-0">
                                {item.cantidad} {mat?.unidadVenta || mat?.unidad || 'u'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mano de Obra */}
                    <div className="mt-3 pt-2 border-t border-outline-variant/20 flex justify-between text-xs">
                      <span className="text-on-surface-variant">Mano de Obra:</span>
                      <span className="font-mono font-semibold text-on-surface">
                        {tarea.manoObra.reduce((acc, m) => acc + m.horas, 0)} hs
                      </span>
                    </div>
                  </div>

                  {/* Costos Footer */}
                  <div className="pt-3 border-t border-outline-variant/30 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] text-on-surface-variant uppercase block">Costo Directo Base</span>
                      <span className="font-mono text-base font-extrabold text-primary">
                        {formatARS(costData.costoDirectoUnitario)}
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-normal"> /{tarea.unidad}</span>
                    </div>

                    <button
                      onClick={() => {
                        setSimulatedTareaId(tarea.id);
                        setActiveSubmodulo('simulacion');
                      }}
                      className="px-3 py-1.5 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container rounded-xl text-xs font-semibold flex items-center gap-1"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Simular</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBMÓDULO 2: SIMULACIÓN WHAT-IF */}
      {activeSubmodulo === 'simulacion' && selectedSimTarea && (
        <div className="space-y-6">
          {/* Selector de Tarea para simular */}
          <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-primary font-bold uppercase tracking-wider">Escenario What-If</span>
              <h3 className="text-lg font-bold text-on-surface">Simulación de Variación de Costos & Márgenes</h3>
            </div>

            <select
              value={simulatedTareaId}
              onChange={(e) => setSimulatedTareaId(e.target.value)}
              className={`${inputCls} sm:w-72 font-semibold`}
            >
              {tareasTipo.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} ({formatARS(calcularCostoTareaTipo(t, insumosMap, manoObraMap).costoDirectoUnitario)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sliders Control Panel */}
            <div className="lg:col-span-2 bg-surface-container-low rounded-3xl p-6 border border-outline-variant/20 space-y-6 shadow-sm">
              <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                <span>Parámetros de Variación Temp</span>
              </h4>

              {/* Slider 1: Materiales % */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-on-surface">Aumento en Costo de Materiales (%):</label>
                  <span className={`font-mono font-bold text-sm px-2.5 py-0.5 rounded-full ${simMaterialesPct > 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : simMaterialesPct < 0 ? 'bg-emerald-500/20 text-emerald-600' : 'bg-surface-variant text-on-surface'}`}>
                    {simMaterialesPct > 0 ? `+${simMaterialesPct}%` : `${simMaterialesPct}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="100"
                  step="5"
                  value={simMaterialesPct}
                  onChange={(e) => setSimMaterialesPct(parseInt(e.target.value) || 0)}
                  className="w-full accent-primary h-2 bg-surface-container-highest rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 2: Mano de Obra % */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-on-surface">Aumento en Costo Hora Mano de Obra (%):</label>
                  <span className={`font-mono font-bold text-sm px-2.5 py-0.5 rounded-full ${simManoObraPct > 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : simManoObraPct < 0 ? 'bg-emerald-500/20 text-emerald-600' : 'bg-surface-variant text-on-surface'}`}>
                    {simManoObraPct > 0 ? `+${simManoObraPct}%` : `${simManoObraPct}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="100"
                  step="5"
                  value={simManoObraPct}
                  onChange={(e) => setSimManoObraPct(parseInt(e.target.value) || 0)}
                  className="w-full accent-primary h-2 bg-surface-container-highest rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 3: Horas Adicionales */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-on-surface">Horas Adicionales / Ayudante Extra:</label>
                  <span className="font-mono font-bold text-sm text-primary px-2.5 py-0.5 bg-primary/10 rounded-full">
                    +{simHorasExtra} hs
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.5"
                  value={simHorasExtra}
                  onChange={(e) => setSimHorasExtra(parseFloat(e.target.value) || 0)}
                  className="w-full accent-primary h-2 bg-surface-container-highest rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 4: Margen Objetivo % */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-on-surface">Margen de Ganancia Objetivo (%):</label>
                  <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 bg-emerald-500/10 rounded-full">
                    {simMargenPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  step="1"
                  value={simMargenPct}
                  onChange={(e) => setSimMargenPct(parseInt(e.target.value) || 35)}
                  className="w-full accent-emerald-500 h-2 bg-surface-container-highest rounded-lg cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSimMaterialesPct(0);
                    setSimManoObraPct(0);
                    setSimHorasExtra(0);
                    setSimMargenPct(config?.margenPorDefectoPct || 35);
                  }}
                  className="px-4 py-2 bg-surface-variant hover:bg-surface-container-highest rounded-full text-xs font-semibold text-on-surface-variant flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restablecer Simulación</span>
                </button>
              </div>
            </div>

            {/* Results Dashboard Panel */}
            <div className="bg-surface-container border border-outline-variant/30 rounded-3xl p-6 space-y-5 shadow-md flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Resultados Proyectados</span>
                </h4>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs py-1 border-b border-outline-variant/20">
                    <span className="text-on-surface-variant">Insumos Simulados:</span>
                    <span className="font-mono font-semibold text-on-surface">{formatARS(simCostInsumos)}</span>
                  </div>

                  <div className="flex justify-between text-xs py-1 border-b border-outline-variant/20">
                    <span className="text-on-surface-variant">Mano de Obra Simulado ({simHorasTotalesMo}h):</span>
                    <span className="font-mono font-semibold text-on-surface">{formatARS(simCostManoObra)}</span>
                  </div>

                  <div className="flex justify-between text-sm py-2 border-b border-outline-variant/30 font-bold">
                    <span className="text-on-surface">Costo Directo Simulado:</span>
                    <span className="font-mono text-primary">{formatARS(simCostDirectoTotal)}</span>
                  </div>

                  <div className="flex justify-between text-xs py-1 text-emerald-600 dark:text-emerald-400">
                    <span>Ganancia Proyectada ({simMargenPct}%):</span>
                    <span className="font-mono font-bold">{formatARS(simGanancia)}</span>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-2xl bg-primary-container/40 border border-primary/20 text-center">
                  <span className="text-xs text-on-surface-variant uppercase font-semibold block">Precio Venta Sugerido</span>
                  <div className="font-mono text-2xl font-extrabold text-primary mt-1">
                    {formatARS(simPrecioVenta)}
                  </div>
                  <span className="text-[10px] text-on-surface-variant block mt-0.5">por {selectedSimTarea.unidad}</span>
                </div>
              </div>

              {/* Variación vs Base */}
              <div className="pt-3 border-t border-outline-variant/30 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Variación Costo vs Base:</span>
                  <span className={`font-mono font-bold ${variacionCostoDirectoPct > 0 ? 'text-rose-500' : variacionCostoDirectoPct < 0 ? 'text-emerald-500' : 'text-on-surface-variant'}`}>
                    {variacionCostoDirectoPct > 0 ? `+${variacionCostoDirectoPct}%` : `${variacionCostoDirectoPct}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBMÓDULO 3: MOTOR ESTADÍSTICO EMA & DISPERSIÓN */}
      {activeSubmodulo === 'calibracion' && (
        <div className="space-y-6">
          <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/20 space-y-2">
            <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span>Calibración Estadística EMA (Media Móvil Exponencial)</span>
            </h3>
            <p className="text-xs text-on-surface-variant">
              Compara el tiempo teórico de catálogo contra el historial real registrado en obra. El factor EMA ajusta dinámicamente las estimaciones futuras.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tareasTipo.map((tarea) => {
              const disp = calcularDispersionHorasTarea(tarea, registrosTrabajo, config?.alphaEmaManoObra || 0.3);

              return (
                <div key={tarea.id} className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 space-y-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-on-tertiary-container bg-tertiary-container px-2 py-0.5 rounded-full uppercase">
                        {tarea.categoria}
                      </span>
                      <h4 className="font-bold text-on-surface text-base mt-1">{tarea.nombre}</h4>
                    </div>
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary-container text-on-primary-container shrink-0">
                      {disp.factorEMAActual.toFixed(2)}x EMA
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Muestras de obra:</span>
                      <span className="font-mono font-bold text-on-surface">{disp.nMuestras} registros</span>
                    </div>
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Horas Base Catálogo:</span>
                      <span className="font-mono text-on-surface">{disp.horasEstimadasBase} hs/{tarea.unidad}</span>
                    </div>
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Mínimo / Máximo Real:</span>
                      <span className="font-mono text-on-surface">
                        {disp.nMuestras > 0 ? `${disp.minHorasUnidad}h — ${disp.maxHorasUnidad}h` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Promedio Real:</span>
                      <span className="font-mono text-primary font-bold">
                        {disp.nMuestras > 0 ? `${disp.promedioHorasUnidad} hs` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Desviación Estándar (σ):</span>
                      <span className="font-mono text-on-surface">
                        {disp.nMuestras > 0 ? `±${disp.desviacionEstandar} hs` : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-outline-variant/30 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-on-surface-variant uppercase block">Factor Sugerido EMA</span>
                      <span className="font-mono text-sm font-bold text-primary">{disp.factorEmaSugerido.toFixed(2)}x</span>
                    </div>

                    <button
                      onClick={() => handleCalibrarEma(tarea.id, disp.factorEmaSugerido)}
                      disabled={disp.nMuestras === 0}
                      className="px-3.5 py-2 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-40 rounded-xl text-xs font-semibold transition-colors shadow-xs"
                    >
                      Aplicar EMA
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBMÓDULO 4: AUDITORÍA DE RENTABILIDAD & ALERTAS */}
      {activeSubmodulo === 'auditoria' && (
        <div className="space-y-6">
          <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/20 space-y-2">
            <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <span>Auditoría de Rentabilidad & Materiales Discontinuados</span>
            </h3>
            <p className="text-xs text-on-surface-variant">
              Semáforo de salud técnica. Detecta automáticamente tareas con insumos obsoletos (`activo: false`) o cuyo margen proyectado cayó por debajo del {config?.umbralMargenMinimoAdvertencia || 20}%.
            </p>
          </div>

          <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-on-surface">
                <thead className="bg-surface-container text-xs text-on-surface-variant border-b border-outline-variant/30">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Estado Semáforo</th>
                    <th className="px-5 py-3.5 font-medium">Tarea Tipo</th>
                    <th className="px-5 py-3.5 text-right font-medium">Costo Directo</th>
                    <th className="px-5 py-3.5 text-right font-medium">Precio Venta</th>
                    <th className="px-5 py-3.5 text-center font-medium">Margen Proyectado</th>
                    <th className="px-5 py-3.5 font-medium">Alertas / Diagnóstico</th>
                    <th className="px-5 py-3.5 text-right font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {tareasTipo.map((tarea) => {
                    const audit = auditarRentabilidadTareaTipo(tarea, insumosMap, manoObraMap, config);

                    return (
                      <tr key={tarea.id} className="hover:bg-surface-container-highest/50 transition-colors">
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold capitalize ${
                              audit.estado === 'verde'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : audit.estado === 'amarillo'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                audit.estado === 'verde'
                                  ? 'bg-emerald-500'
                                  : audit.estado === 'amarillo'
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                            />
                            {audit.estado === 'verde' ? 'Sana' : audit.estado === 'amarillo' ? 'Alerta' : 'Riesgo Crítico'}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-bold text-on-surface">{tarea.nombre}</div>
                          <span className="text-xs text-on-surface-variant font-mono">[{tarea.categoria}]</span>
                        </td>

                        <td className="px-5 py-4 text-right font-mono font-bold text-primary">
                          {formatARS(audit.costoDirecto)}
                        </td>

                        <td className="px-5 py-4 text-right font-mono font-bold text-on-surface">
                          {formatARS(audit.precioVentaSugerido)}
                        </td>

                        <td className="px-5 py-4 text-center font-mono font-bold">
                          <span
                            className={
                              audit.margenPorcentajeProyectado < (config?.umbralMargenMinimoAdvertencia || 20)
                                ? 'text-rose-500 font-extrabold'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            {audit.margenPorcentajeProyectado}%
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs space-y-1">
                          {audit.alertas.length === 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Ficha y margen en regla
                            </span>
                          ) : (
                            audit.alertas.map((alt, idx) => (
                              <div key={idx} className="text-rose-600 dark:text-rose-400 font-medium flex items-start gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>{alt}</span>
                              </div>
                            ))
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleOpenEdit(tarea)}
                            className="px-3 py-1.5 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container rounded-xl text-xs font-semibold"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editor / Diseñador de Tarea Tipo */}
      <ModalContainer
        isOpen={isCreating || !!editingTarea}
        onClose={() => {
          setIsCreating(false);
          setEditingTarea(null);
        }}
        title={editingTarea ? `Editar ${editingTarea.nombre}` : 'Diseñador de Tarea Tipo (Ensamble)'}
        subtitle="Despiece de materiales y horas por categoría de mano de obra"
        icon={<Layers className="w-5 h-5 text-primary" />}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveTarea} className="space-y-5">
          {/* General Data */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Nombre de la Tarea</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className={inputCls}
                placeholder="Ej: Boca de Iluminación Completa (IUG)"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Categoría</label>
              <select
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className={inputCls}
              >
                {CATEGORIAS_TAREA_LIST.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Unidad de Medida</label>
              <input
                type="text"
                value={formData.unidad}
                onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                className={inputCls}
                placeholder="punto, m, u"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Notas / Especificaciones Técnicas</label>
              <input
                type="text"
                value={formData.notasTecnicas}
                onChange={(e) => setFormData({ ...formData, notasTecnicas: e.target.value })}
                className={inputCls}
                placeholder="Especificaciones norma IRAM o montaje"
              />
            </div>
          </div>

          {/* Section: Insumos / Materiales */}
          <div className="space-y-2 border-t border-outline-variant/30 pt-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-4 h-4" />
                <span>Despiece de Insumos & Materiales</span>
              </h4>
              <button
                type="button"
                onClick={addInsumoRow}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Insumo
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {formData.insumos.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic py-2">Sin materiales asignados a esta tarea.</p>
              ) : (
                formData.insumos.map((item, idx) => {
                  const targetId = item.materialId || item.insumoId || '';
                  const selectedMat = insumosMap.get(targetId);

                  return (
                    <div key={idx} className="flex items-center gap-2 bg-surface-container-low p-2 rounded-xl border border-outline-variant/20">
                      <select
                        value={targetId}
                        onChange={(e) => {
                          updateInsumoRow(idx, 'materialId', e.target.value);
                          updateInsumoRow(idx, 'insumoId', e.target.value);
                        }}
                        className={`${inputCls} flex-1 text-xs`}
                      >
                        {Array.from(insumosMap.values()).map((ins) => (
                          <option key={ins.id} value={ins.id}>
                            {ins.nombre} {ins.precioActual ? `(${formatARS(ins.precioActual)})` : ''}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1 w-28 shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          value={item.cantidad}
                          onChange={(e) => updateInsumoRow(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                          className={`${inputCls} text-xs font-mono text-center px-1`}
                        />
                        <span className="text-[10px] text-on-surface-variant shrink-0">{selectedMat?.unidadVenta || 'u'}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeInsumoRow(idx)}
                        className="p-1.5 text-on-surface-variant hover:text-error rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section: Mano de Obra */}
          <div className="space-y-2 border-t border-outline-variant/30 pt-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>Horas por Categoría de Mano de Obra</span>
              </h4>
              <button
                type="button"
                onClick={addManoObraRow}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Mano de Obra
              </button>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto">
              {formData.manoObra.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic py-2">Sin horas de mano de obra asignadas.</p>
              ) : (
                formData.manoObra.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-surface-container-low p-2 rounded-xl border border-outline-variant/20">
                    <select
                      value={item.categoriaId}
                      onChange={(e) => updateManoObraRow(idx, 'categoriaId', e.target.value)}
                      className={`${inputCls} flex-1 text-xs`}
                    >
                      {manoObraList.map((mo) => (
                        <option key={mo.id} value={mo.id}>
                          {mo.nombre} ({formatARS(mo.costoHora)}/h)
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 w-24 shrink-0">
                      <input
                        type="number"
                        step="0.1"
                        value={item.horas}
                        onChange={(e) => updateManoObraRow(idx, 'horas', parseFloat(e.target.value) || 0)}
                        className={`${inputCls} text-xs font-mono text-center px-1`}
                      />
                      <span className="text-[10px] text-on-surface-variant shrink-0">hs</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeManoObraRow(idx)}
                      className="p-1.5 text-on-surface-variant hover:text-error rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Live Cost Summary Preview */}
          <div className="p-3.5 rounded-2xl bg-surface-container-high border border-outline-variant/30 flex justify-between items-center text-xs">
            <div>
              <span className="text-on-surface-variant block">Costo Directo Estimado</span>
              <span className="font-mono font-bold text-primary text-base">{formatARS(tempCost.costoDirectoUnitario)}</span>
            </div>
            <div className="text-right font-mono text-on-surface-variant text-[11px]">
              <div>Insumos: {formatARS(tempCost.costoInsumosUnitario)}</div>
              <div>MO: {formatARS(tempCost.costoManoObraUnitario)}</div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingTarea(null);
              }}
              className="px-4 py-2 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-variant"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs shadow-sm active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Tarea Tipo</span>
            </button>
          </div>
        </form>
      </ModalContainer>
    </div>
  );
};

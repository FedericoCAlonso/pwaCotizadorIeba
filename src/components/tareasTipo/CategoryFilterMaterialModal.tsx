import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Sliders,
  X,
  Check,
  Plus,
  Trash2,
  Package,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { db } from '../../db/database';
import {
  Insumo,
  CategoriaMaterial,
  ParametroTrabajoTipo,
  VariableCalculadaTrabajoTipo,
  FiltroMaterialEnTarea,
  CriterioAtributoMaterial
} from '../../core/types';
import { resolverMaterialPorFiltro, formatARS } from '../../core/calculations';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useToast } from '../../contexts/ToastContext';
import { FormulaInput } from '../common/FormulaInput';

interface CategoryFilterMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  parametros?: ParametroTrabajoTipo[];
  variables?: VariableCalculadaTrabajoTipo[];
  currentScope: Record<string, number>;
  insumosMap: Map<string, Insumo>;
  initialData?: {
    nombreSlot: string;
    filtroMaterial: FiltroMaterialEnTarea;
    cantidad: number;
    formula?: string;
  } | null;
  onSaveCategoryFilter: (payload: {
    nombreSlot: string;
    filtroMaterial: FiltroMaterialEnTarea;
    cantidad: number;
    formula?: string;
  }) => void;
}

export const CategoryFilterMaterialModal: React.FC<CategoryFilterMaterialModalProps> = ({
  isOpen,
  onClose,
  parametros = [],
  variables = [],
  currentScope,
  insumosMap,
  initialData = null,
  onSaveCategoryFilter
}) => {
  useEscapeKey(isOpen, onClose);
  const { toast } = useToast();

  const categoriasDB = useLiveQuery(() => db.categoriasMaterial.toArray()) || [];

  // Supercategorías agrupadas
  const supercategoriasDisponibles = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string; categorias: CategoriaMaterial[] }>();
    categoriasDB.forEach((c) => {
      const superId = c.supercategoriaId || 'general';
      const superNom = c.supercategoriaNombre || 'General';
      if (!map.has(superId)) {
        map.set(superId, { id: superId, nombre: superNom, categorias: [] });
      }
      map.get(superId)!.categorias.push(c);
    });
    return Array.from(map.values());
  }, [categoriasDB]);

  // Estado del Formulario
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>('cat-termomagneticas');
  const [nombreSlot, setNombreSlot] = useState<string>('Protección de Cabecera');
  const [criterios, setCriterios] = useState<CriterioAtributoMaterial[]>([
    { atributo: 'polos', operador: '==', valor: '2' },
    { atributo: 'In', operador: '==', valor: '$calibre_principal' },
    { atributo: 'curva', operador: '==', valor: 'Curva C' }
  ]);
  const [estrategia, setEstrategia] = useState<'menor_valor_que_cumpla' | 'mayor_valor_que_cumpla' | 'primer_coincidencia'>('menor_valor_que_cumpla');
  const [atributoOrden, setAtributoOrden] = useState<string>('In');
  const [cantidad, setCantidad] = useState<number>(1);
  const [formula, setFormula] = useState<string>('1');

  // Inicializar estado al abrir en modo Edición o Alta
  useEffect(() => {
    if (isOpen) {
      if (initialData && initialData.filtroMaterial) {
        setSelectedCategoriaId(initialData.filtroMaterial.categoriaId || 'cat-termomagneticas');
        setNombreSlot(initialData.nombreSlot || initialData.filtroMaterial.etiqueta || '');
        setCriterios(
          initialData.filtroMaterial.criterios && initialData.filtroMaterial.criterios.length > 0
            ? JSON.parse(JSON.stringify(initialData.filtroMaterial.criterios))
            : []
        );
        setEstrategia(initialData.filtroMaterial.estrategiaSeleccion || 'menor_valor_que_cumpla');
        setAtributoOrden(initialData.filtroMaterial.atributoOrden || 'In');
        setCantidad(initialData.cantidad || 1);
        setFormula(initialData.formula || String(initialData.cantidad || 1));
      } else {
        // Modo Alta por defecto
        setSelectedCategoriaId('cat-termomagneticas');
        setNombreSlot('Protección de Cabecera');
        const hasCalibre = parametros.some((p) => p.id.includes('calibre')) || variables.some((v) => v.id.includes('calibre'));
        setCriterios([
          { atributo: 'polos', operador: '==', valor: '2' },
          { atributo: 'In', operador: '==', valor: hasCalibre ? '$calibre_principal' : '25' },
          { atributo: 'curva', operador: '==', valor: 'Curva C' }
        ]);
        setEstrategia('menor_valor_que_cumpla');
        setAtributoOrden('In');
        setCantidad(1);
        setFormula('1');
      }
    }
  }, [isOpen, initialData]);

  // Categoría actual seleccionada y sus atributos sugeridos
  const selectedCat = useMemo(() => {
    return categoriasDB.find((c) => c.id === selectedCategoriaId);
  }, [categoriasDB, selectedCategoriaId]);

  // Materiales activos en la categoría actual para extraer valores reales de catálogo
  const materialsInCategory = useMemo(() => {
    return Array.from(insumosMap.values()).filter(
      (m) => m.categoriaId === selectedCategoriaId && m.activo !== false
    );
  }, [insumosMap, selectedCategoriaId]);

  // Valores existentes en catálogo para un atributo dado
  const getAttributeValues = useCallback(
    (attrClave: string): string[] => {
      if (!attrClave) return [];
      const valuesSet = new Set<string>();
      materialsInCategory.forEach((m) => {
        const attr = m.atributos?.find((a) => a.clave.toLowerCase() === attrClave.toLowerCase());
        if (attr && attr.valor !== undefined && attr.valor !== null && String(attr.valor).trim() !== '') {
          valuesSet.add(String(attr.valor).trim());
        }
      });
      const suggestedAttr = selectedCat?.atributosSugeridos?.find(
        (a) => a.clave.toLowerCase() === attrClave.toLowerCase()
      );
      if (suggestedAttr?.opciones) {
        suggestedAttr.opciones.forEach((opt) => valuesSet.add(opt.trim()));
      }
      return Array.from(valuesSet);
    },
    [materialsInCategory, selectedCat]
  );

  // Cambiar categoría y precargar atributos sugeridos
  const handleSelectCategoria = (catId: string) => {
    setSelectedCategoriaId(catId);
    const cat = categoriasDB.find((c) => c.id === catId);
    if (!cat) return;

    setNombreSlot(cat.nombre);

    if (catId === 'cat-termomagneticas') {
      const hasCalibre = parametros.some((p) => p.id.includes('calibre')) || variables.some((v) => v.id.includes('calibre'));
      setCriterios([
        { atributo: 'polos', operador: '==', valor: '2' },
        { atributo: 'In', operador: '==', valor: hasCalibre ? '$calibre_principal' : '25' },
        { atributo: 'curva', operador: '==', valor: 'Curva C' }
      ]);
      setAtributoOrden('In');
      setEstrategia('menor_valor_que_cumpla');
    } else if (catId === 'cat-diferenciales') {
      const hasCalibre = parametros.some((p) => p.id.includes('calibre')) || variables.some((v) => v.id.includes('calibre'));
      setCriterios([
        { atributo: 'polos', operador: '==', valor: '2' },
        { atributo: 'In', operador: '>=', valor: hasCalibre ? '$calibre_principal' : '25' }
      ]);
      setAtributoOrden('In');
      setEstrategia('menor_valor_que_cumpla');
    } else if (catId === 'cat-tableros') {
      const hasModulosVar = variables.find((v) => v.id.includes('modulos'))?.id;
      const valModulos = hasModulosVar ? `$${hasModulosVar}` : (parametros.some((p) => p.id.includes('circuitos')) ? '4 + circuitos * 2' : '8');
      setCriterios([
        { atributo: 'tipo_instalacion', operador: '==', valor: 'Embutir' },
        { atributo: 'capacidad_modulos', operador: '>=', valor: valModulos }
      ]);
      setAtributoOrden('capacidad_modulos');
      setEstrategia('menor_valor_que_cumpla');
    } else if (catId === 'cat-cables') {
      setCriterios([
        { atributo: 'tipo_cable', operador: '==', valor: 'Unipolar IRAM 247-3' },
        { atributo: 'seccion', operador: '>=', valor: '2.5' }
      ]);
      setAtributoOrden('seccion');
      setEstrategia('menor_valor_que_cumpla');
    } else if (cat.atributosSugeridos && cat.atributosSugeridos.length > 0) {
      setCriterios(
        cat.atributosSugeridos.slice(0, 2).map((a) => ({
          atributo: a.clave,
          operador: '==',
          valor: a.opciones?.[0] || ''
        }))
      );
    } else {
      setCriterios([]);
    }
  };

  // Manejo de criterios
  const handleAddCriterio = () => {
    const availableAttr = selectedCat?.atributosSugeridos?.find(
      (a) => !criterios.some((c) => c.atributo.toLowerCase() === a.clave.toLowerCase())
    );
    const attrKey = availableAttr ? availableAttr.clave : 'nuevo_atributo';
    setCriterios((prev) => [...prev, { atributo: attrKey, operador: '==', valor: '' }]);
  };

  const handleUpdateCriterio = (index: number, updates: Partial<CriterioAtributoMaterial>) => {
    setCriterios((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleRemoveCriterio = (index: number) => {
    setCriterios((prev) => prev.filter((_, i) => i !== index));
  };

  // Live evaluation of matching material
  const filtroConstruido: FiltroMaterialEnTarea = useMemo(() => {
    return {
      categoriaId: selectedCategoriaId,
      criterios: criterios.filter((c) => c.atributo.trim() !== ''),
      estrategiaSeleccion: estrategia,
      atributoOrden: atributoOrden,
      etiqueta: nombreSlot
    };
  }, [selectedCategoriaId, criterios, estrategia, atributoOrden, nombreSlot]);

  const resolvedMaterial = useMemo(() => {
    return resolverMaterialPorFiltro(filtroConstruido, currentScope, insumosMap);
  }, [filtroConstruido, currentScope, insumosMap]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!nombreSlot.trim()) {
      toast.warning('Por favor asigna un nombre o descripción a la ranura dinámica.');
      return;
    }
    if (criterios.length === 0) {
      toast.warning('Agrega al menos un criterio de búsqueda por atributo.');
      return;
    }

    onSaveCategoryFilter({
      nombreSlot: nombreSlot.trim(),
      filtroMaterial: filtroConstruido,
      cantidad: Math.max(1, cantidad),
      formula: formula.trim() || '1'
    });

    toast.success(initialData ? `Ranura "${nombreSlot}" actualizada` : `Insumo dinámico "${nombreSlot}" agregado`);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-surface border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden pb-safe">
        {/* Mobile drag bar */}
        <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />

        {/* Header (M3 Tonal Top App Bar) */}
        <div className="flex items-center justify-between p-3.5 sm:p-5 border-b border-outline-variant/20 bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-primary/10 rounded-2xl text-primary border border-primary/20 shrink-0">
              {initialData ? <Sliders className="w-4 h-4 sm:w-5 sm:h-5" /> : <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-on-surface truncate">
                {initialData ? 'Editar Material por Categoría' : 'Agregar Material por Categoría'}
              </h3>
              <p className="text-[11px] sm:text-xs text-on-surface-variant truncate">
                Selecciona la familia técnica y define propiedades según variables
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition active:scale-95 min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* 1. Categoría de Catálogo */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-on-surface uppercase tracking-wider block">
              1. Categoría de Materiales
            </label>
            <select
              value={selectedCategoriaId}
              onChange={(e) => handleSelectCategoria(e.target.value)}
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2.5 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
            >
              {supercategoriasDisponibles.map((superCat) => (
                <optgroup key={superCat.id} label={superCat.nombre}>
                  {superCat.categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* 2. Nombre del Slot / Insumo */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-on-surface uppercase tracking-wider block">
              2. Nombre / Rol del Material en la Tarea
            </label>
            <input
              type="text"
              value={nombreSlot}
              onChange={(e) => setNombreSlot(e.target.value)}
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2.5 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
              placeholder="Ej: Térmica General de Cabecera, Diferencial Coordinado, etc."
            />
          </div>

          {/* 3. Criterios de Atributos Técnicos */}
          <div className="space-y-2.5 border-t border-outline-variant/20 pt-3.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                  3. Condiciones sobre Atributos Técnicos
                </label>
                <p className="text-[10px] text-on-surface-variant hidden sm:block">
                  Compara los atributos del catálogo contra números fijos, variables de obra o expresiones.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddCriterio}
                className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl border border-primary/20 flex items-center gap-1 transition active:scale-95 min-h-[36px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar Atributo</span>
              </button>
            </div>

            {criterios.length === 0 ? (
              <div
                onClick={handleAddCriterio}
                className="text-center py-5 px-3 border border-dashed border-outline-variant/30 rounded-2xl bg-surface-container-highest/20 cursor-pointer hover:border-primary/50 transition"
              >
                <Sliders className="w-5 h-5 text-outline-variant mx-auto mb-1" />
                <p className="text-xs font-bold text-on-surface">Sin criterios de selección</p>
                <p className="text-[11px] text-primary mt-0.5">+ Toca aquí para agregar una regla por atributo</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {criterios.map((crit, idx) => {
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/20 space-y-2 transition hover:border-outline-variant/40"
                    >
                      {/* Fila Superior: Atributo + Operador + Botón Eliminar */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Atributo */}
                          <div className="flex-1 sm:w-44 sm:flex-initial">
                            {selectedCat?.atributosSugeridos && selectedCat.atributosSugeridos.length > 0 ? (
                              <select
                                value={crit.atributo}
                                onChange={(e) => handleUpdateCriterio(idx, { atributo: e.target.value })}
                                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs font-bold text-on-surface focus:outline-none min-h-[36px]"
                              >
                                {selectedCat.atributosSugeridos.map((a) => (
                                  <option key={a.clave} value={a.clave}>
                                    {a.etiqueta || a.clave}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={crit.atributo}
                                onChange={(e) => handleUpdateCriterio(idx, { atributo: e.target.value })}
                                placeholder="Clave atributo"
                                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs font-bold text-on-surface focus:outline-none min-h-[36px]"
                              />
                            )}
                          </div>

                          {/* Operador */}
                          <div className="w-28 sm:w-36 shrink-0">
                            <select
                              value={crit.operador}
                              onChange={(e) => handleUpdateCriterio(idx, { operador: e.target.value as any })}
                              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-primary focus:outline-none min-h-[36px]"
                            >
                              <option value="==">== (Igual)</option>
                              <option value=">=">&gt;= (Mayor o igual)</option>
                              <option value="<=">&lt;= (Menor o igual)</option>
                              <option value="!=">!= (Distinto)</option>
                            </select>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveCriterio(idx)}
                          className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Quitar criterio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Fila Inferior: Valor o Expresión con IntelliSense, Sugerencias de Catálogo y Chips */}
                      <div className="bg-surface-container-highest border border-outline-variant/30 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-primary/50">
                        <FormulaInput
                          value={crit.valor}
                          onChange={(newVal) => handleUpdateCriterio(idx, { valor: newVal })}
                          parametros={parametros}
                          variables={variables}
                          attributeValues={getAttributeValues(crit.atributo)}
                          placeholder="Valor fijo (ej: 25), variable ($calibre) o fórmula..."
                          showChips={true}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Estrategia de Selección de Calibre & Fórmula de Cantidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-outline-variant/20 pt-3">
            <div>
              <label className="text-[11px] font-bold text-on-surface uppercase tracking-wider block mb-1">
                Estrategia de Selección
              </label>
              <select
                value={estrategia}
                onChange={(e) => setEstrategia(e.target.value as any)}
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:outline-none min-h-[44px]"
              >
                <option value="menor_valor_que_cumpla">Menor valor comercial que cubra (Recomendado)</option>
                <option value="primer_coincidencia">Primer coincidencia exacta</option>
                <option value="mayor_valor_que_cumpla">Mayor valor disponible</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-on-surface uppercase tracking-wider block mb-1">
                Fórmula de Cantidad
              </label>
              <div className="bg-surface-container-highest border border-outline-variant/30 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-primary/50 min-h-[44px] flex items-center">
                <FormulaInput
                  value={formula}
                  onChange={(val) => setFormula(val)}
                  parametros={parametros}
                  variables={variables}
                  placeholder="1 o ej: circuitos * 2"
                  showChips={false}
                />
              </div>
            </div>
          </div>

          {/* 5. Vista Previa en Tiempo Real */}
          <div className="p-3.5 rounded-2xl border bg-surface-container-low/90 space-y-2 border-primary/25">
            <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
              <span className="font-bold text-primary uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Vista Previa con Variables de Prueba:</span>
              </span>
              <span className="font-mono text-on-surface-variant text-[10px]">
                {Object.entries(currentScope)
                  .map(([k, v]) => `$${k}=${v}`)
                  .join(', ')}
              </span>
            </div>

            {resolvedMaterial ? (
              <div className="flex items-center justify-between gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-300 flex-wrap">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-xs truncate">{resolvedMaterial.nombre}</span>
                </div>
                <span className="font-mono font-bold text-xs shrink-0">
                  {formatARS(resolvedMaterial.precioActual || 0)} / {resolvedMaterial.unidadVenta || 'u'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="text-xs">
                  Ningún material del catálogo cumple los criterios con los valores de prueba actuales.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer (M3 Action Row) */}
        <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low flex flex-col-reverse sm:flex-row justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition text-center min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-full shadow-xs transition flex items-center justify-center gap-2 min-h-[44px] active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>{initialData ? 'Guardar Cambios' : 'Agregar Insumo por Categoría'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

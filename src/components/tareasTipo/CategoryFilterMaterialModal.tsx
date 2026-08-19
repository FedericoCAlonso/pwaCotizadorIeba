import React, { useState, useMemo } from 'react';
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

interface CategoryFilterMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  parametros?: ParametroTrabajoTipo[];
  variables?: VariableCalculadaTrabajoTipo[];
  currentScope: Record<string, number>;
  insumosMap: Map<string, Insumo>;
  onAddCategoryFilter: (payload: {
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
  onAddCategoryFilter
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

  // Categoría actual seleccionada y sus atributos sugeridos
  const selectedCat = useMemo(() => {
    return categoriasDB.find((c) => c.id === selectedCategoriaId);
  }, [categoriasDB, selectedCategoriaId]);

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
      toast.warning('Por favor asigna un nombre o descripción al slot dinámico.');
      return;
    }
    if (criterios.length === 0) {
      toast.warning('Agrega al menos un criterio de búsqueda por atributo.');
      return;
    }

    onAddCategoryFilter({
      nombreSlot: nombreSlot.trim(),
      filtroMaterial: filtroConstruido,
      cantidad: Math.max(1, cantidad),
      formula: formula.trim() || '1'
    });

    toast.success(`Insumo dinámico "${nombreSlot}" agregado`);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-surface border border-outline-variant/30 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20 bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl text-primary border border-primary/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">Agregar Material por Categoría / Criterio</h3>
              <p className="text-xs text-on-surface-variant">
                Selecciona la familia técnica y define qué propiedades debe cumplir según las variables de obra
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface rounded-xl hover:bg-surface-variant transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* 1. Categoría de Catálogo */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-on-surface uppercase tracking-wider block">
              1. Categoría de Materiales
            </label>
            <select
              value={selectedCategoriaId}
              onChange={(e) => handleSelectCategoria(e.target.value)}
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
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
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Ej: Térmica General de Cabecera, Diferencial Coordinado, etc."
            />
          </div>

          {/* 3. Criterios de Atributos Técnicos */}
          <div className="space-y-2 border-t border-outline-variant/20 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                3. Condiciones sobre Atributos Técnicos
              </label>
              <button
                type="button"
                onClick={handleAddCriterio}
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar Atributo</span>
              </button>
            </div>

            <div className="space-y-2">
              {criterios.map((crit, idx) => {
                return (
                  <div
                    key={idx}
                    className="p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/20 flex flex-wrap items-center gap-2"
                  >
                    {/* Atributo */}
                    <div className="w-36 shrink-0">
                      {selectedCat?.atributosSugeridos && selectedCat.atributosSugeridos.length > 0 ? (
                        <select
                          value={crit.atributo}
                          onChange={(e) => handleUpdateCriterio(idx, { atributo: e.target.value })}
                          className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-lg px-2 py-1 text-xs font-semibold text-on-surface focus:outline-none"
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
                          className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-lg px-2 py-1 text-xs font-semibold text-on-surface focus:outline-none"
                        />
                      )}
                    </div>

                    {/* Operador */}
                    <select
                      value={crit.operador}
                      onChange={(e) => handleUpdateCriterio(idx, { operador: e.target.value as any })}
                      className="bg-surface-container-highest border border-outline-variant/30 rounded-lg px-2 py-1 text-xs font-mono font-bold text-primary focus:outline-none shrink-0"
                    >
                      <option value="==">== (Igual)</option>
                      <option value=">=">&gt;= (Mayor o igual)</option>
                      <option value="<=">&lt;= (Menor o igual)</option>
                      <option value="!=">!= (Distinto)</option>
                    </select>

                    {/* Valor o Variable */}
                    <div className="flex-1 min-w-[140px] flex items-center gap-1">
                      <input
                        type="text"
                        value={crit.valor}
                        onChange={(e) => handleUpdateCriterio(idx, { valor: e.target.value })}
                        placeholder="Valor fijo o ej: $calibre_principal"
                        className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-lg px-2.5 py-1 text-xs font-mono text-on-surface focus:outline-none"
                      />
                    </div>

                    {/* Parámetros y Variables sugeridos */}
                    {(parametros.length > 0 || variables.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        {parametros.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleUpdateCriterio(idx, { valor: `$${p.id}` })}
                            className="px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-[10px] font-mono font-bold text-primary rounded-md border border-primary/20 transition"
                            title={`Parámetro: $${p.id} (${p.nombre})`}
                          >
                            ${p.id}
                          </button>
                        ))}
                        {variables.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleUpdateCriterio(idx, { valor: `$${v.id}` })}
                            className="px-1.5 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 rounded-md border border-emerald-500/20 transition"
                            title={`Variable calculada: $${v.id} (${v.nombre})`}
                          >
                            ⚡${v.id}
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveCriterio(idx)}
                      className="p-1 text-on-surface-variant hover:text-error rounded-lg transition shrink-0"
                      title="Quitar criterio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Estrategia de Selección de Calibre */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-outline-variant/20 pt-3">
            <div>
              <label className="text-[11px] font-bold text-on-surface uppercase tracking-wider block mb-1">
                Estrategia de Selección
              </label>
              <select
                value={estrategia}
                onChange={(e) => setEstrategia(e.target.value as any)}
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs text-on-surface focus:outline-none"
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
              <input
                type="text"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="1 o ej: circuitos"
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-primary focus:outline-none"
              />
            </div>
          </div>

          {/* 5. Vista Previa en Tiempo Real */}
          <div className="p-3.5 rounded-2xl border bg-surface-container-low/90 space-y-1.5 border-primary/25">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-primary uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Vista Previa con Variables de Prueba:</span>
              </span>
              <span className="font-mono text-on-surface-variant">
                {Object.entries(currentScope)
                  .map(([k, v]) => `$${k}=${v}`)
                  .join(', ')}
              </span>
            </div>

            {resolvedMaterial ? (
              <div className="flex items-center justify-between gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2 truncate">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="font-bold text-xs truncate">{resolvedMaterial.nombre}</span>
                </div>
                <span className="font-mono font-bold text-xs shrink-0">
                  {formatARS(resolvedMaterial.precioActual || 0)} / {resolvedMaterial.unidadVenta || 'u'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-xs">
                  Ningún material del catálogo cumple los criterios con los valores actuales.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low flex justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface rounded-xl hover:bg-surface-variant transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Agregar Insumo por Categoría</span>
          </button>
        </div>
      </div>
    </div>
  );
};
